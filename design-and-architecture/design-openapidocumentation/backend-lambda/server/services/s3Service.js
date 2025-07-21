const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

class S3Service {
  constructor() {
    this.s3Client = new S3Client({ 
      region: process.env.AWS_REGION || process.env.BEDROCK_REGION || 'eu-west-1' 
    });
    this.bucketName = process.env.BUCKET_NAME;
  }

  /**
   * Generate safe project name for S3 keys
   * @param {string} projectName - Project name
   * @returns {string} Safe project name
   */
  getSafeProjectName(projectName) {
    return projectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  }

  /**
   * Generate S3 key for OpenAPI spec storage
   * @param {string} projectName - Project name
   * @param {string} specId - Specification identifier
   * @param {string} type - Type of file ('spec' or 'docs')
   * @returns {string} S3 key
   */
  generateSpecKey(projectName, specId, type = 'spec') {
    const suffix = type === 'docs' ? '-docs.json' : '.json';
    const safeProjectName = this.getSafeProjectName(projectName);
    return `projects/${safeProjectName}/specs/${specId}${suffix}`;
  }

  /**
   * Generate S3 key for project metadata
   * @param {string} projectName - Project name
   * @returns {string} S3 key
   */
  generateMetadataKey(projectName) {
    const safeProjectName = this.getSafeProjectName(projectName);
    return `projects/${safeProjectName}/metadata.json`;
  }

  /**
   * Generate S3 key for analysis data storage
   * @param {string} projectName - Project name
   * @returns {string} S3 key
   */
  generateAnalysisKey(projectName) {
    const safeProjectName = this.getSafeProjectName(projectName);
    return `projects/${safeProjectName}/analysis.json`;
  }

  /**
   * Generate S3 key for image storage
   * @param {string} projectName - Project name
   * @param {string} fileName - File name
   * @returns {string} S3 key
   */
  generateImageKey(projectName, fileName) {
    const safeProjectName = this.getSafeProjectName(projectName);
    return `projects/${safeProjectName}/images/${fileName}`;
  }

  /**
   * Store OpenAPI specification in S3
   * @param {string} projectName - Project name
   * @param {string} specId - Specification identifier
   * @param {Object} specData - OpenAPI specification data
   * @returns {Promise<Object>} Result with S3 key and success status
   */
  async storeSpec(projectName, specId, specData) {
    try {
      const key = this.generateSpecKey(projectName, specId, 'spec');
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify(specData, null, 2),
        ContentType: 'application/json',
        Metadata: {
          projectName: projectName,
          specId: specId,
          createdAt: new Date().toISOString(),
          type: 'openapi-spec'
        }
      });

      await this.s3Client.send(command);
      
      console.log(`OpenAPI spec stored in S3: ${key}`);
      return { success: true, s3Key: key };
    } catch (error) {
      console.error('Error storing spec in S3:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Store OpenAPI documentation in S3
   * @param {string} projectName - Project name
   * @param {string} specId - Specification identifier
   * @param {Object} docsData - Documentation data
   * @returns {Promise<Object>} Result with S3 key and success status
   */
  async storeDocs(projectName, specId, docsData) {
    try {
      const key = this.generateSpecKey(projectName, specId, 'docs');
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify(docsData, null, 2),
        ContentType: 'application/json',
        Metadata: {
          projectName: projectName,
          specId: specId,
          createdAt: new Date().toISOString(),
          type: 'openapi-docs'
        }
      });

      await this.s3Client.send(command);
      
      console.log(`OpenAPI docs stored in S3: ${key}`);
      return { success: true, s3Key: key };
    } catch (error) {
      console.error('Error storing docs in S3:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieve OpenAPI specification from S3
   * @param {string} projectName - Project name
   * @param {string} specId - Specification identifier
   * @returns {Promise<Object>} Specification data or null if not found
   */
  async getSpec(projectName, specId) {
    try {
      const key = this.generateSpecKey(projectName, specId, 'spec');
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      const specData = await response.Body.transformToString();
      
      return JSON.parse(specData);
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        console.log(`Spec not found in S3: ${specId} for project: ${projectName}`);
        return null;
      }
      console.error('Error retrieving spec from S3:', error);
      throw error;
    }
  }

  /**
   * Retrieve OpenAPI documentation from S3
   * @param {string} projectName - Project name
   * @param {string} specId - Specification identifier
   * @returns {Promise<Object>} Documentation data or null if not found
   */
  async getDocs(projectName, specId) {
    try {
      const key = this.generateSpecKey(projectName, specId, 'docs');
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      const docsData = await response.Body.transformToString();
      
      return JSON.parse(docsData);
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        console.log(`Docs not found in S3: ${specId} for project: ${projectName}`);
        return null;
      }
      console.error('Error retrieving docs from S3:', error);
      throw error;
    }
  }

  /**
   * List all specifications for a project
   * @param {string} projectName - Project name
   * @returns {Promise<Array>} Array of specification metadata
   */
  async listProjectSpecs(projectName) {
    try {
      const safeProjectName = this.getSafeProjectName(projectName);
      const prefix = `projects/${safeProjectName}/specs/`;
      
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix
      });

      const response = await this.s3Client.send(command);
      const specs = [];

      if (response.Contents) {
        for (const object of response.Contents) {
          // Only process spec files (not docs files)
          if (object.Key.endsWith('.json') && !object.Key.endsWith('-docs.json')) {
            const keyParts = object.Key.split('/');
            const fileName = keyParts[keyParts.length - 1];
            const specId = fileName.replace('.json', '');
            
            specs.push({
              id: specId,
              projectName: projectName,
              lastModified: object.LastModified,
              size: object.Size,
              s3Key: object.Key
            });
          }
        }
      }

      return specs.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    } catch (error) {
      console.error('Error listing project specs from S3:', error);
      return [];
    }
  }

  /**
   * List all specifications across ALL projects
   * @returns {Promise<Array>} Array of specification metadata from all projects
   */
  async listAllSpecs() {
    try {
      const prefix = 'projects/';
      
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix
      });

      const response = await this.s3Client.send(command);
      const specs = [];

      if (response.Contents) {
        for (const object of response.Contents) {
          // Only process spec files (not docs files) that are in the specs folder
          if (object.Key.endsWith('.json') && 
              !object.Key.endsWith('-docs.json') && 
              object.Key.includes('/specs/')) {
            
            // Extract project name and spec ID from the key
            // Key format: projects/{projectName}/specs/{specId}.json
            const keyParts = object.Key.split('/');
            if (keyParts.length >= 4 && keyParts[0] === 'projects' && keyParts[2] === 'specs') {
              const projectName = keyParts[1];
              const fileName = keyParts[keyParts.length - 1];
              const specId = fileName.replace('.json', '');
              
              specs.push({
                id: specId,
                projectName: projectName,
                lastModified: object.LastModified,
                size: object.Size,
                s3Key: object.Key
              });
            }
          }
        }
      }

      return specs.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    } catch (error) {
      console.error('Error listing all specs from S3:', error);
      return [];
    }
  }

  /**
   * Store uploaded image in S3
   * @param {string} projectName - Project name
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} originalName - Original file name
   * @param {string} contentType - Image content type
   * @returns {Promise<Object>} Result with S3 key and success status
   */
  async storeImage(projectName, imageBuffer, originalName, contentType = 'image/jpeg') {
    try {
      const timestamp = Date.now();
      const extension = originalName.split('.').pop() || (contentType.includes('png') ? 'png' : 'jpg');
      const fileName = `uploaded-image-${timestamp}.${extension}`;
      const key = this.generateImageKey(projectName, fileName);
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: imageBuffer,
        ContentType: contentType,
        Metadata: {
          projectName: projectName,
          originalName: originalName,
          uploadedAt: new Date().toISOString(),
          type: 'uploaded-image'
        }
      });

      await this.s3Client.send(command);
      
      console.log(`Image stored in S3: ${key}`);
      return { success: true, s3Key: key, fileName: fileName };
    } catch (error) {
      console.error('Error storing image in S3:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update project metadata
   * @param {string} projectName - Project name
   * @param {Object} metadata - Project metadata
   * @returns {Promise<Object>} Result with success status
   */
  async updateProjectMetadata(projectName, metadata) {
    try {
      const key = this.generateMetadataKey(projectName);
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify({
          ...metadata,
          projectName: projectName,
          updatedAt: new Date().toISOString()
        }, null, 2),
        ContentType: 'application/json'
      });

      await this.s3Client.send(command);
      
      console.log(`Project metadata updated in S3: ${key}`);
      return { success: true, s3Key: key };
    } catch (error) {
      console.error('Error updating project metadata in S3:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Store analysis data in S3
   * @param {string} projectName - Project name
   * @param {Object} analysisData - Complete analysis data
   * @returns {Promise<Object>} Result with S3 key and success status
   */
  async storeAnalysis(projectName, analysisData) {
    try {
      const key = this.generateAnalysisKey(projectName);
      
      const analysisPayload = {
        ...analysisData,
        projectName: projectName,
        createdAt: analysisData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: 'analysis-data'
      };
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify(analysisPayload, null, 2),
        ContentType: 'application/json',
        Metadata: {
          projectName: projectName,
          createdAt: analysisPayload.createdAt,
          type: 'analysis-data'
        }
      });

      await this.s3Client.send(command);
      
      console.log(`Analysis data stored in S3: ${key}`);
      return { success: true, s3Key: key };
    } catch (error) {
      console.error('Error storing analysis in S3:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieve analysis data from S3
   * @param {string} projectName - Project name
   * @returns {Promise<Object>} Analysis data or null if not found
   */
  async getAnalysis(projectName) {
    try {
      const key = this.generateAnalysisKey(projectName);
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      const analysisData = await response.Body.transformToString();
      
      return JSON.parse(analysisData);
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        console.log(`Analysis not found in S3 for project: ${projectName}`);
        return null;
      }
      console.error('Error retrieving analysis from S3:', error);
      throw error;
    }
  }

  /**
   * List all projects
   * @returns {Promise<Array>} Array of project metadata
   */
  async listAllProjects() {
    try {
      const prefix = 'projects/';
      
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        Delimiter: '/'
      });

      const response = await this.s3Client.send(command);
      const projects = [];

      if (response.CommonPrefixes) {
        for (const prefix of response.CommonPrefixes) {
          const projectPath = prefix.Prefix;
          const projectName = projectPath.replace('projects/', '').replace('/', '');
          
          // Try to get project metadata
          try {
            const metadata = await this.getProjectMetadata(projectName);
            projects.push({
              name: projectName,
              ...metadata
            });
          } catch (error) {
            // Add basic info even if we can't read metadata
            projects.push({
              name: projectName,
              error: 'Could not read project metadata'
            });
          }
        }
      }

      return projects.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } catch (error) {
      console.error('Error listing projects from S3:', error);
      return [];
    }
  }

  /**
   * Get project metadata
   * @param {string} projectName - Project name
   * @returns {Promise<Object>} Project metadata or null if not found
   */
  async getProjectMetadata(projectName) {
    try {
      const key = this.generateMetadataKey(projectName);
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      const metadata = await response.Body.transformToString();
      
      return JSON.parse(metadata);
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return null;
      }
      console.error('Error retrieving project metadata from S3:', error);
      throw error;
    }
  }
}

module.exports = new S3Service();