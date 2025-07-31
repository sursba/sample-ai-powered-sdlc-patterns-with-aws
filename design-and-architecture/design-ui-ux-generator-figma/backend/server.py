#!/usr/bin/env python3
"""
Main server for the UI Generator application.

This server provides API endpoints for generating UI/UX designs using AWS Bedrock.
It handles CORS and serves the frontend application in production.
"""

import os
import json
import traceback
import logging
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import boto3
from botocore.exceptions import NoCredentialsError, ClientError, ProfileNotFound

from bedrock_service import BedrockService
from config import get_config

# Set up logging
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('server.log')
    ]
)

# Suppress specific loggers
logging.getLogger('botocore').setLevel(logging.WARNING)
logging.getLogger('bedrock_service').setLevel(logging.WARNING)
logging.getLogger('werkzeug').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

# Get configuration
config = get_config()

# Create Flask app
app = Flask(__name__, static_folder='../frontend/build')

# Configure CORS
CORS(app, resources={r"/api/*": {"origins": config.CORS_ORIGINS}})

# Initialize Bedrock service
try:
    bedrock_service = BedrockService(region_name=config.AWS_REGION)
    logger.info("BedrockService initialized successfully")
except Exception as e:
    logger.error(f"Error initializing BedrockService: {str(e)}")
    logger.error(traceback.format_exc())
    bedrock_service = None

@app.route('/api/generate-mockup', methods=['POST', 'OPTIONS'])
def generate_mockup():
    """Generate UI mockup from text description."""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        if bedrock_service is None:
            return jsonify({
                "success": False,
                "error": "BedrockService not initialized. Check AWS credentials."
            }), 500
        
        data = request.json
        prompt = data.get('prompt')
        width = data.get('width', 1024)
        height = data.get('height', 1024)
        quality = data.get('quality', 'standard')
        
        if not prompt:
            return jsonify({"success": False, "error": "Prompt is required"}), 400
        
        result = bedrock_service.generate_ui_mockup(
            prompt=prompt,
            width=width,
            height=height,
            quality=quality
        )
        
        response = jsonify(result)
        return _corsify_actual_response(response)
    except Exception as e:
        logger.error(f"Error in generate_mockup: {str(e)}")
        logger.error(traceback.format_exc())
        response = jsonify({"success": False, "error": str(e)})
        return _corsify_actual_response(response), 500

@app.route('/api/generate-multiple-mockups', methods=['POST', 'OPTIONS'])
def generate_multiple_mockups():
    """Generate multiple UI mockups from text description."""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        if bedrock_service is None:
            return jsonify({
                "success": False,
                "error": "BedrockService not initialized. Check AWS credentials."
            }), 500
        
        data = request.json
        prompt = data.get('prompt')
        num_images = data.get('num_images', 4)
        width = data.get('width', 1024)
        height = data.get('height', 1024)
        quality = data.get('quality', 'standard')
        
        if not prompt:
            return jsonify({"success": False, "error": "Prompt is required"}), 400
        
        # Validate num_images - only allow 2, 3, 4 images
        if not isinstance(num_images, int) or num_images not in [2, 3, 4]:
            return jsonify({"success": False, "error": "num_images must be 2, 3, or 4"}), 400
        
        result = bedrock_service.generate_multiple_ui_mockups(
            prompt=prompt,
            num_images=num_images,
            width=width,
            height=height,
            quality=quality
        )
        
        response = jsonify(result)
        return _corsify_actual_response(response)
    except Exception as e:
        logger.error(f"Error in generate_multiple_mockups: {str(e)}")
        logger.error(traceback.format_exc())
        response = jsonify({"success": False, "error": str(e)})
        return _corsify_actual_response(response), 500

@app.route('/api/download-image/<filename>', methods=['GET', 'OPTIONS'])
def download_image(filename):
    """Download a generated image."""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        # Validate the filename to prevent directory traversal attacks
        if '..' in filename or filename.startswith('/') or '/' in filename:
            return jsonify({"success": False, "error": "Invalid filename"}), 400
        
        file_path = os.path.join(config.ASSETS_DIR, filename)
        
        if not os.path.exists(file_path):
            logger.error(f"Image not found: {filename}")
            response = jsonify({"success": False, "error": f"Image not found: {filename}"})
            return _corsify_actual_response(response), 404
        
        response = send_file(
            file_path,
            mimetype='image/png',
            as_attachment=True,
            download_name=filename
        )
        return _corsify_actual_response(response)
    except Exception as e:
        logger.error(f"Error downloading image {filename}: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        return _corsify_actual_response(response), 500

@app.route('/api/generate-description', methods=['POST', 'OPTIONS'])
def generate_description():
    """Generate UI description from text prompt."""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        if bedrock_service is None:
            return jsonify({
                "success": False,
                "error": "BedrockService not initialized. Check AWS credentials."
            }), 500
        
        data = request.json
        prompt = data.get('prompt')
        
        if not prompt:
            return jsonify({"success": False, "error": "Prompt is required"}), 400
        
        result = bedrock_service.generate_ui_description(prompt)
        response = jsonify(result)
        return _corsify_actual_response(response)
    except Exception as e:
        logger.error(f"Error in generate_description: {str(e)}")
        logger.error(traceback.format_exc())
        response = jsonify({"success": False, "error": str(e)})
        return _corsify_actual_response(response), 500

@app.route('/api/generate-components', methods=['POST', 'OPTIONS'])
def generate_components():
    """Generate Figma component specifications from text prompt."""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        if bedrock_service is None:
            return jsonify({
                "success": False,
                "error": "BedrockService not initialized. Check AWS credentials."
            }), 500
        
        data = request.json
        prompt = data.get('prompt')
        
        if not prompt:
            return jsonify({"success": False, "error": "Prompt is required"}), 400
        
        result = bedrock_service.generate_figma_components(prompt)
        response = jsonify(result)
        return _corsify_actual_response(response)
    except Exception as e:
        logger.error(f"Error in generate_components: {str(e)}")
        logger.error(traceback.format_exc())
        response = jsonify({"success": False, "error": str(e)})
        return _corsify_actual_response(response), 500

@app.route('/api/check-aws-credentials', methods=['GET', 'OPTIONS'])
def check_aws_credentials():
    """Check if AWS credentials are properly configured."""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        # Try different ways to create a boto3 session
        try:
            # Method 1: Default session
            logger.info("Trying default boto3 Session...")
            session = boto3.Session()
            credentials = session.get_credentials()
            
            if not credentials:
                logger.info("No credentials found in default session")
                
                # Method 2: Try with explicit profile
                logger.info("Trying with 'default' profile...")
                try:
                    session = boto3.Session(profile_name='default')
                    credentials = session.get_credentials()
                except ProfileNotFound:
                    logger.info("'default' profile not found")
                
                # Method 3: Try with environment variables
                if not credentials and ('AWS_ACCESS_KEY_ID' in os.environ and 'AWS_SECRET_ACCESS_KEY' in os.environ):
                    logger.info("Trying with environment variables...")
                    session = boto3.Session(
                        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
                        region_name=os.environ.get('AWS_REGION', 'us-east-1')
                    )
                    credentials = session.get_credentials()
            
            if not credentials:
                logger.info("No credentials found in any session")
                response = jsonify({
                    "success": False,
                    "error": "No AWS credentials found",
                    "message": "AWS credentials are not properly configured"
                })
                return _corsify_actual_response(response), 500
            
            # Print credential provider for debugging
            logger.info(f"Credential provider: {credentials.method}")
            
            # Try to use STS to validate the credentials
            sts = session.client('sts')
            identity = sts.get_caller_identity()
            
            logger.info(f"Successfully authenticated as: {identity['Arn']}")
            
            response = jsonify({
                "success": True,
                "message": "AWS credentials are properly configured",
                "account_id": identity['Account'],
                "user_id": identity['UserId'],
                "arn": identity['Arn'],
                "credential_provider": credentials.method
            })
            return _corsify_actual_response(response)
        
        except Exception as inner_e:
            logger.error(f"Error in session creation: {str(inner_e)}")
            raise
            
    except NoCredentialsError:
        logger.error("No AWS credentials found")
        response = jsonify({
            "success": False,
            "error": "No AWS credentials found",
            "message": "AWS credentials are not properly configured"
        })
        return _corsify_actual_response(response), 500
    except ClientError as e:
        logger.error(f"AWS client error: {str(e)}")
        response = jsonify({
            "success": False,
            "error": str(e),
            "message": "AWS credentials are not properly configured or insufficient permissions"
        })
        return _corsify_actual_response(response), 500
    except Exception as e:
        logger.error(f"Error checking AWS credentials: {str(e)}")
        logger.error(traceback.format_exc())
        response = jsonify({
            "success": False,
            "error": str(e),
            "message": "Failed to check AWS credentials"
        })
        return _corsify_actual_response(response), 500

@app.route('/api/check-bedrock-access', methods=['GET', 'OPTIONS'])
def check_bedrock_access():
    """Check if the user has access to required Bedrock models."""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        # Try to create a boto3 session explicitly
        session = boto3.Session()
        
        # Create a bedrock client using the session
        bedrock = session.client('bedrock')
        
        # List available foundation models
        response = bedrock.list_foundation_models()
        
        # Check for required models
        models = response.get('modelSummaries', [])
        model_ids = [model.get('modelId') for model in models]
        
        # Try different model IDs for Claude
        claude_model_ids = [
            'anthropic.claude-3-sonnet-20240229-v1:0',  # Claude 3 Sonnet
            'anthropic.claude-3-haiku-20240307-v1:0'    # Claude 3 Haiku
        ]
        
        # Find the first available Claude model
        available_claude_model = None
        for model_id in claude_model_ids:
            if model_id in model_ids:
                available_claude_model = model_id
                logger.info(f"Found available Claude model: {model_id}")
                break
        
        required_models = [
            'anthropic.claude-3-sonnet-20240229-v1:0',
            'amazon.nova-canvas-v1:0'
        ]
        
        available_required_models = [model for model in required_models if model in model_ids]
        missing_models = [model for model in required_models if model not in model_ids]
        
        response = jsonify({
            "success": True,
            "available_models": available_required_models,
            "missing_models": missing_models,
            "has_all_required_models": len(missing_models) == 0
        })
        return _corsify_actual_response(response)
    except Exception as e:
        logger.error(f"Error checking Bedrock access: {str(e)}")
        logger.error(traceback.format_exc())
        response = jsonify({
            "success": False,
            "error": str(e),
            "message": "Failed to check Bedrock model access"
        })
        return _corsify_actual_response(response), 500

@app.route('/api/assets/<path:filename>', methods=['GET', 'OPTIONS'])
def serve_asset(filename):
    """Serve generated assets."""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        # Create the assets directory if it doesn't exist
        os.makedirs(config.ASSETS_DIR, exist_ok=True)
        
        # Validate the filename to prevent directory traversal attacks
        if '..' in filename or filename.startswith('/'):
            return jsonify({"success": False, "error": "Invalid filename"}), 400
            
        if os.path.exists(os.path.join(config.ASSETS_DIR, filename)):
            response = send_from_directory(config.ASSETS_DIR, filename)
            return _corsify_actual_response(response)
        else:
            logger.error(f"Asset not found: {filename}")
            response = jsonify({"success": False, "error": f"Asset not found: {filename}"})
            return _corsify_actual_response(response), 404
    except Exception as e:
        logger.error(f"Error serving asset {filename}: {str(e)}")
        response = jsonify({"success": False, "error": str(e)})
        return _corsify_actual_response(response), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "aws_connected": bedrock_service is not None
    })

# Helper functions for CORS
def _build_cors_preflight_response():
    """Build a response for CORS preflight requests."""
    response = jsonify({})
    response.headers.add('Access-Control-Allow-Origin', config.CORS_ORIGINS)
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

def _corsify_actual_response(response):
    """Add CORS headers to the actual response."""
    response.headers.add('Access-Control-Allow-Origin', config.CORS_ORIGINS)
    return response

# Serve React frontend
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """Serve the React frontend."""
    # If requesting the root or index.html, serve the React app
    if path == "" or path == "index.html":
        if app.static_folder and os.path.exists(os.path.join(app.static_folder, 'index.html')):
            return send_from_directory(app.static_folder, 'index.html')
    
    # Try to serve static files from the build directory
    if path != "" and app.static_folder and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    
    # For any other route (React Router), serve the React app
    if app.static_folder and os.path.exists(os.path.join(app.static_folder, 'index.html')):
        return send_from_directory(app.static_folder, 'index.html')
    
    # If build not found, return error message
    return "<h1>UI Generator Backend</h1><p>Backend is running. Frontend build not found.</p>"

if __name__ == '__main__':
    # Create assets directory if it doesn't exist
    os.makedirs(config.ASSETS_DIR, exist_ok=True)
    
    # Print AWS SDK version for debugging (only to log file)
    logging.getLogger(__name__).info(f"Using boto3 version: {boto3.__version__}")
    
    # Start the server
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG, threaded=True)