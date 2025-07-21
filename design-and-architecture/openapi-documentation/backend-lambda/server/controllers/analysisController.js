// External dependencies
const { v4: uuidv4 } = require('uuid');

// Services
const analysisService = require('../services/analysisService');
const s3Service = require('../services/s3Service');

// Store analysis result and uploaded image info globally
let latestAnalysisResult = null;
let uploadedImageInfo = null;

// Generate domain analysis from text prompt
const generateAnalysis = async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    // Use project name from project middleware
    const projectName = req.projectName || 'default-project';

    const analysisResult = await analysisService.generateBoundedContexts(prompt);

    // Store the result globally for backward compatibility
    latestAnalysisResult = analysisResult;

    if (!analysisResult || analysisResult.error) {
      return res.status(500).json({ error: analysisResult?.error || 'Analysis failed' });
    }

    const analysisId = uuidv4();

    const formattedAnalysisResult = {
      domainAnalysis: analysisResult.domainAnalysis || prompt,
      boundedContextAnalysis: analysisResult.boundedContextAnalysis || '',
      prompt: prompt,
      analysisId: analysisId,
      projectName: projectName,
      createdAt: new Date().toISOString()
    };

    latestAnalysisResult = formattedAnalysisResult;

    // Store analysis data in S3
    const s3Result = await s3Service.storeAnalysis(projectName, formattedAnalysisResult);
    
    if (s3Result.success) {
      console.log(`Domain analysis stored in S3: ${s3Result.s3Key}`);
    } else {
      console.error('Failed to store domain analysis in S3:', s3Result.error);
    }

    return res.json({
      success: true,
      message: 'Domain analysis completed successfully',
      analysisId: analysisId,
      projectName: projectName,
      s3Stored: s3Result.success,
      analysisResult: formattedAnalysisResult
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Upload and store image info
const uploadImage = async (req, res) => {
  try {
    console.log('Upload request received:', {
      hasFile: !!req.file,
      hasBody: !!req.body,
      bodyKeys: Object.keys(req.body || {}),
      headers: req.headers['content-type']
    });

    // Use project name from project middleware
    const projectName = req.projectName || 'default-project';

    let fileInfo = null;

    // Handle traditional multipart/form-data upload (from multer)
    if (req.file) {
      console.log('Processing multipart file upload');
      fileInfo = {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        buffer: req.file.buffer
      };
    }
    // Handle base64 JSON upload (from AWS client)
    else if (req.body && req.body.image && req.body.image.data) {
      console.log('Processing base64 JSON upload');
      const imageData = req.body.image;

      // Convert base64 to buffer
      const buffer = Buffer.from(imageData.data, 'base64');

      fileInfo = {
        originalName: imageData.name,
        mimeType: imageData.type,
        size: imageData.size,
        buffer: buffer
      };
    }
    else {
      console.log('No file found in request - neither multipart nor base64');
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    console.log('File details:', {
      originalName: fileInfo.originalName,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      bufferSize: fileInfo.buffer.length,
      projectName: projectName
    });

    // Store image in S3 with project structure
    const s3Result = await s3Service.storeImage(
      projectName,
      fileInfo.buffer,
      fileInfo.originalName,
      fileInfo.mimeType
    );

    if (!s3Result.success) {
      console.error('Failed to store image in S3:', s3Result.error);
      return res.status(500).json({ error: 'Failed to store image' });
    }

    // Store image info in global variable for backward compatibility
    // TODO: Remove this once all clients use the new S3-based approach
    uploadedImageInfo = {
      originalName: fileInfo.originalName,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      buffer: fileInfo.buffer,
      s3Key: s3Result.s3Key,
      projectName: projectName
    };

    console.log('Image uploaded successfully:', {
      originalName: fileInfo.originalName,
      size: fileInfo.size,
      s3Key: s3Result.s3Key,
      projectName: projectName
    });

    return res.json({
      success: true,
      message: 'Image uploaded successfully',
      originalName: fileInfo.originalName,
      s3Key: s3Result.s3Key,
      projectName: projectName
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Analyze uploaded image
const analyzeImage = async (req, res) => {
  try {
    // Use project name from project middleware
    const projectName = req.projectName || 'default-project';

    let fileBuffer = null;
    let analysisType = 'domain';
    let prompt = '';

    // Handle traditional multipart/form-data upload (from multer)
    if (req.file) {
      console.log('Processing multipart file for analysis');
      fileBuffer = req.file.buffer;
      analysisType = req.body.analysisType || 'domain';
      prompt = req.body.prompt || '';
    }
    // Handle base64 JSON upload (from AWS client)
    else if (req.body && req.body.image && req.body.image.data) {
      console.log('Processing base64 JSON file for analysis');
      fileBuffer = Buffer.from(req.body.image.data, 'base64');
      analysisType = req.body.analysisType || 'domain';
      prompt = req.body.prompt || '';
    }
    else {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    console.log('Analyzing image with project context:', {
      projectName: projectName,
      analysisType: analysisType,
      hasPrompt: !!prompt
    });

    // Check if image was already uploaded in this project to avoid duplicate saves
    let s3Result = { success: false, s3Key: null };
    
    // Only store image if it wasn't already uploaded via uploadImage endpoint
    if (!uploadedImageInfo || uploadedImageInfo.projectName !== projectName) {
      s3Result = await s3Service.storeImage(
        projectName,
        fileBuffer,
        `analysis-image-${Date.now()}.jpg`,
        'image/jpeg'
      );

      if (s3Result.success) {
        console.log('Image stored in S3 for analysis:', s3Result.s3Key);
      }
    } else {
      // Use existing uploaded image info
      s3Result = { success: true, s3Key: uploadedImageInfo.s3Key };
      console.log('Using previously uploaded image:', s3Result.s3Key);
    }

    const analysisResult = await analysisService.analyzeDomainModel(
      fileBuffer,
      analysisType,
      prompt,
      projectName // Pass project name to the analysis service
    );

    let processedResult = analysisService.processImageAnalysisResult(analysisResult);

    // Add project context to the result
    processedResult.projectName = projectName;
    processedResult.imageS3Key = s3Result.success ? s3Result.s3Key : null;
    processedResult.prompt = prompt;
    processedResult.analysisType = analysisType;
    processedResult.createdAt = new Date().toISOString();

    latestAnalysisResult = processedResult;

    // Store analysis data in S3
    const analysisS3Result = await s3Service.storeAnalysis(projectName, processedResult);
    
    if (analysisS3Result.success) {
      console.log(`Image analysis stored in S3: ${analysisS3Result.s3Key}`);
    } else {
      console.error('Failed to store image analysis in S3:', analysisS3Result.error);
    }

    return res.json({
      success: true,
      message: 'Image analyzed successfully',
      analysisResult: processedResult,
      projectName: projectName,
      s3Stored: analysisS3Result.success
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Get analysis content for textarea
const getAnalysisContent = (req, res) => {
  try {
    if (!latestAnalysisResult) {
      return res.json({
        hasContent: false,
        content: ''
      });
    }

    const content = analysisService.extractAnalysisContent(latestAnalysisResult);

    return res.json({
      hasContent: content !== '',
      content: content
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Generate business contexts from domain analysis
const generateBoundedContexts = async (req, res) => {
  try {
    const { domainAnalysis } = req.body;

    if (!domainAnalysis) {
      return res.status(400).json({ error: 'Domain analysis is required' });
    }

    // Use project name from project middleware
    const projectName = req.projectName || 'default-project';
    
    const context = {
      projectName: projectName
    };
    
    const result = await analysisService.generateBusinessContextsWithTimeout(domainAnalysis, context);

    if (result.success === false) {
      return res.status(200).json(result);
    }

    const updatedAnalysisResult = {
      ...latestAnalysisResult,
      ...result,
      boundedContextAnalysis: result.businessContextAnalysis,
      businessContextAnalysis: result.businessContextAnalysis,
      projectName: projectName,
      updatedAt: new Date().toISOString()
    };

    latestAnalysisResult = updatedAnalysisResult;

    // Store updated analysis data in S3
    const s3Result = await s3Service.storeAnalysis(projectName, updatedAnalysisResult);
    
    if (s3Result.success) {
      console.log(`Business context analysis stored in S3: ${s3Result.s3Key}`);
    } else {
      console.error('Failed to store business context analysis in S3:', s3Result.error);
    }

    return res.json({
      success: true,
      message: 'Business contexts generated successfully',
      boundedContextAnalysis: result.businessContextAnalysis,
      businessContextAnalysis: result.businessContextAnalysis,
      projectName: projectName,
      s3Stored: s3Result.success
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Generate ASCII diagram of business contexts
const generateAsciiDiagram = async (req, res) => {
  try {
    const { domainAnalysis, businessContext, hasComprehensiveData, dataSource } = req.body;

    if (!domainAnalysis && !businessContext) {
      return res.status(400).json({ error: 'Domain analysis or business context is required' });
    }

    // Use project name from project middleware
    const projectName = req.projectName || 'default-project';

    const result = await analysisService.generateAsciiDiagramWithTimeout(
      domainAnalysis,
      businessContext
    );

    if (result.success === false) {
      return res.status(200).json({
        ...result,
        retryable: result.retryable !== false
      });
    }

    const processedResult = analysisService.processAsciiDiagramResult(result);

    if (!processedResult.asciiDiagram) {
      return res.status(200).json({
        success: false,
        error: 'ASCII diagram was not generated. The Lambda function may have encountered an issue.',
        retryable: true
      });
    }

    const updatedAnalysisResult = { 
      ...latestAnalysisResult, 
      asciiDiagram: processedResult.asciiDiagram,
      projectName: projectName,
      updatedAt: new Date().toISOString()
    };

    latestAnalysisResult = updatedAnalysisResult;

    // Store updated analysis data in S3
    const s3Result = await s3Service.storeAnalysis(projectName, updatedAnalysisResult);
    
    if (s3Result.success) {
      console.log(`ASCII diagram analysis stored in S3: ${s3Result.s3Key}`);
    } else {
      console.error('Failed to store ASCII diagram analysis in S3:', s3Result.error);
    }

    return res.json({
      success: true,
      message: 'ASCII diagram generated successfully',
      asciiDiagram: processedResult.asciiDiagram,
      projectName: projectName,
      s3Stored: s3Result.success
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Remove uploaded image
const removeImage = (req, res) => {
  try {
    uploadedImageInfo = null;
    latestAnalysisResult = null;

    return res.json({
      success: true,
      message: 'Image removed successfully'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Check if any uploaded images exist
const getImageStatus = (req, res) => {
  try {
    const hasImage = uploadedImageInfo !== null;

    return res.json({
      hasImage,
      originalName: hasImage ? uploadedImageInfo.originalName : null
    });
  } catch (error) {
    return res.json({
      hasImage: false,
      originalName: null
    });
  }
};

// Get analysis data by project name
const getAnalysisByProject = async (req, res) => {
  try {
    // Use project name from project middleware or URL parameter
    const projectName = req.params.projectName || req.projectName || 'default-project';

    console.log(`Retrieving analysis for project ${projectName}`);

    // Get analysis data from S3
    const analysisData = await s3Service.getAnalysis(projectName);

    if (!analysisData) {
      return res.status(404).json({ 
        error: 'Analysis not found for this project',
        projectName: projectName
      });
    }

    return res.json({
      success: true,
      projectName: projectName,
      analysisData: analysisData,
      retrievedFrom: 's3'
    });
  } catch (error) {
    console.error('Error retrieving analysis by project:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve analysis data',
      details: error.message 
    });
  }
};

// Get all projects (simplified approach)
const getAllProjects = async (req, res) => {
  try {
    console.log(`Listing all projects`);

    // Get all projects from S3
    const allProjects = await s3Service.listAllProjects();

    return res.json({
      success: true,
      totalProjects: allProjects.length,
      projects: allProjects.map(project => ({
        name: project.name,
        lastModified: project.updatedAt || project.lastModified,
        hasAnalysis: !!project.updatedAt,
        metadata: project.metadata || {}
      }))
    });
  } catch (error) {
    console.error('Error retrieving projects:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve projects',
      details: error.message 
    });
  }
};

module.exports = {
  generateAnalysis,
  uploadImage,
  analyzeImage,
  getAnalysisContent,
  generateBoundedContexts,
  generateAsciiDiagram,
  removeImage,
  getImageStatus,
  getAnalysisByProject,
  getAllProjects
};