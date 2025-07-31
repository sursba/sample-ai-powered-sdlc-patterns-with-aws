"""
Direct Lambda handler for the UI Generator backend.

This module provides a direct AWS Lambda handler function for the UI Generator application.
It handles API Gateway events and interacts with AWS Bedrock to generate UI/UX designs,
descriptions, and component specifications.

The handler supports the following endpoints:
- /api/health: Health check endpoint
- /api/generate-mockup: Generates UI mockups using Amazon Nova Canvas
- /api/generate-description: Generates UI descriptions using Claude
- /api/generate-components: Generates Figma component specifications using Claude

Security features:
- Input validation for all requests
- Error handling with detailed logging
- CORS headers for cross-origin requests
- Fallback mechanisms for Bedrock model availability

Usage:
    This module is designed to be used as an AWS Lambda handler with API Gateway integration.
    It is not intended to be run directly.
"""

import os
import json
import base64
import logging
import traceback
import boto3
import uuid
from datetime import datetime

# Version information
__version__ = '1.0.0'
__author__ = 'UI/UX Generator Team'
import uuid
from datetime import datetime

# Configure logging
log_level = os.environ.get('LOG_LEVEL', 'DEBUG')
logging.basicConfig(level=getattr(logging, log_level))
logger = logging.getLogger(__name__)

# Set AWS region for boto3
region = os.environ.get('AWS_REGION', 'us-east-1')
boto3.setup_default_session(region_name=region)
logger.info(f"Using AWS region: {region}")

# Define constants for Bedrock models
CLAUDE_MODELS = [
    'anthropic.claude-3-sonnet-20240229-v1:0',  # Primary model
    'anthropic.claude-3-haiku-20240307-v1:0',   # Fallback model 1
    'anthropic.claude-v2:1'                     # Fallback model 2
]

NOVA_CANVAS_MODEL = 'amazon.nova-canvas-v1:0'

def handler(event, context):
    """
    AWS Lambda handler function.
    
    Args:
        event (dict): The Lambda event object from API Gateway
        context (object): The Lambda context object
        
    Returns:
        dict: Response object for API Gateway
    """
    # Add request ID for tracking
    request_id = context.aws_request_id if context else str(uuid.uuid4())
    logger.info(f"Request ID: {request_id} - Received event: {json.dumps(event)}")
    
    # Log AWS credential information for debugging (only in DEBUG mode)
    if log_level == 'DEBUG':
        try:
            sts = boto3.client('sts')
            identity = sts.get_caller_identity()
            logger.debug(f"Request ID: {request_id} - AWS Identity: {identity['Arn']}")
        except Exception as e:
            logger.error(f"Request ID: {request_id} - Error getting AWS identity: {str(e)}")
    
    # Extract path and method
    path = event.get('path', '')
    method = event.get('httpMethod', 'GET')
    
    # Add security headers
    security_headers = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
    }
    
    # Handle OPTIONS requests for CORS
    if method == 'OPTIONS':
        response = cors_response({})
        response['headers'].update(security_headers)
        return response
    
    # Handle health check
    if path == '/api/health' or path == '/health':
        response = cors_response({
            'status': 'healthy',
            'version': __version__,
            'message': 'Direct Lambda handler is working correctly',
            'request_id': request_id
        })
        response['headers'].update(security_headers)
        return response
    
    # Handle API endpoints
    try:
        # Validate request method for each endpoint
        if path == '/api/generate-mockup':
            if method != 'POST':
                response = cors_response({
                    'success': False,
                    'error': f'Method {method} not allowed for {path}',
                    'allowed_methods': ['POST']
                }, 405)
                response['headers'].update(security_headers)
                return response
            response = handle_generate_mockup(event, request_id)
            response['headers'].update(security_headers)
            return response
            
        elif path == '/api/generate-description':
            if method != 'POST':
                response = cors_response({
                    'success': False,
                    'error': f'Method {method} not allowed for {path}',
                    'allowed_methods': ['POST']
                }, 405)
                response['headers'].update(security_headers)
                return response
            response = handle_generate_description(event, request_id)
            response['headers'].update(security_headers)
            return response
            
        elif path == '/api/generate-components':
            if method != 'POST':
                response = cors_response({
                    'success': False,
                    'error': f'Method {method} not allowed for {path}',
                    'allowed_methods': ['POST']
                }, 405)
                response['headers'].update(security_headers)
                return response
            response = handle_generate_components(event, request_id)
            response['headers'].update(security_headers)
            return response
            
        else:
            response = cors_response({
                'success': False,
                'message': f'Path {path} with method {method} not supported',
                'supported_paths': [
                    '/api/health',
                    '/api/generate-mockup',
                    '/api/generate-description',
                    '/api/generate-components'
                ],
                'request_id': request_id
            }, 404)
            response['headers'].update(security_headers)
            return response
            
    except ValueError as e:
        # Handle validation errors
        logger.warning(f"Request ID: {request_id} - Validation error: {str(e)}")
        response = cors_response({
            'success': False,
            'error': str(e),
            'error_type': 'ValidationError',
            'request_id': request_id
        }, 400)
        response['headers'].update(security_headers)
        return response
        
    except Exception as e:
        # Handle all other errors
        logger.error(f"Request ID: {request_id} - Error processing request: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Don't expose stack traces in production
        error_details = {
            'success': False,
            'error': 'Internal server error',
            'request_id': request_id
        }
        
        # Add more details in debug mode
        if log_level == 'DEBUG':
            error_details['error_message'] = str(e)
            error_details['error_type'] = type(e).__name__
        
        response = cors_response(error_details, 500)
        response['headers'].update(security_headers)
        return response

def cors_response(body, status_code=200):
    """Create a response with CORS headers.
    
    Args:
        body (dict): The response body
        status_code (int, optional): The HTTP status code. Defaults to 200.
        
    Returns:
        dict: The response object with CORS headers
    """
    # In production, restrict CORS to specific origins
    # For now, allow all origins for development
    allowed_origins = os.environ.get('ALLOWED_ORIGINS', '*')
    
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed_origins,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Cache-Control': 'no-store'
        },
        'body': json.dumps(body)
    }

def get_request_body(event):
    """Extract and parse request body from event.
    
    Args:
        event (dict): The Lambda event object from API Gateway
        
    Returns:
        dict: The parsed request body
        
    Raises:
        ValueError: If the body is not valid JSON
    """
    try:
        body = event.get('body', '{}')
        if not body:
            return {}
            
        if event.get('isBase64Encoded', False):
            body = base64.b64decode(body).decode('utf-8')
            
        return json.loads(body)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in request body: {str(e)}")
        raise ValueError(f"Invalid JSON in request body: {str(e)}")
    except Exception as e:
        logger.error(f"Error parsing request body: {str(e)}")
        raise ValueError(f"Error parsing request body: {str(e)}")


def handle_generate_mockup(event, request_id):
    """Handle generate mockup request."""
    try:
        # Parse request body
        body = get_request_body(event)
        prompt = body.get('prompt')
        width = body.get('width', 1024)
        height = body.get('height', 1024)
        quality = body.get('quality', 'standard')
        
        if not prompt:
            return cors_response({'success': False, 'error': 'Prompt is required'}, 400)
        
        logger.info(f"Request ID: {request_id} - Generating UI mockup with prompt: {prompt[:50]}...")
        
        # Create request payload for Nova Canvas
        request_body = {
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {
                "text": prompt
            },
            "imageGenerationConfig": {
                "numberOfImages": 1,
                "quality": quality,
                "width": width,
                "height": height,
                "seed": 42  # For reproducibility
            }
        }
        
        # Create bedrock runtime client
        bedrock_runtime = boto3.client('bedrock-runtime')
        
        # Invoke the model
        response = bedrock_runtime.invoke_model(
            modelId=NOVA_CANVAS_MODEL,
            contentType='application/json',
            accept='application/json',
            body=json.dumps(request_body)
        )
        
        # Parse response
        response_body = json.loads(response['body'].read())
        
        # Extract image
        image_data = response_body['images'][0]
        
        # Create a unique filename
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"ui_mockup_{timestamp}_{unique_id}.png"
        
        # Return the base64 image directly
        return cors_response({
            'success': True,
            'image': image_data,
            'filename': filename,
            'request_id': request_id
        })
        
    except Exception as e:
        logger.error(f"Request ID: {request_id} - Error generating UI mockup: {str(e)}")
        logger.error(traceback.format_exc())
        return cors_response({
            'success': False,
            'error': str(e)
        }, 500)

def handle_generate_description(event, request_id):
    """Handle generate description request."""
    try:
        # Parse request body
        body = get_request_body(event)
        prompt = body.get('prompt')
        
        if not prompt:
            return cors_response({'success': False, 'error': 'Prompt is required'}, 400)
        
        logger.info(f"Request ID: {request_id} - Generating UI description with prompt: {prompt[:50]}...")
        
        # Create request payload for Claude - optimized for faster response
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 800,  # Reduced token count for faster response
            "temperature": 0.4,  # Lower temperature for more precise output
            "top_p": 0.9,  # Add top_p for better performance
            "top_k": 250,  # Add top_k for faster generation
            "messages": [
                {
                    "role": "user", 
                    "content": f"Based on this description: '{prompt}', provide a concise UI/UX specification including:\n\n1. Overall layout structure (brief)\n2. Color scheme recommendations (with hex codes)\n3. Key components needed (3-5 most important)\n4. Brief user interaction patterns\n5. Key responsive design considerations\n\nKeep your response focused and to the point. Format it as a structured specification that a designer could follow."
                }
            ]
        }
        
        # Create bedrock runtime client
        bedrock_runtime = boto3.client('bedrock-runtime')
        
        # Try different Claude models
        claude_models = [
            'anthropic.claude-3-sonnet-20240229-v1:0',
            'anthropic.claude-3-haiku-20240307-v1:0',
            'anthropic.claude-v2:1'
        ]
        
        response_text = None
        last_error = None
        
        for model_id in claude_models:
            try:
                logger.info(f"Trying Claude model: {model_id}")
                
                # Invoke the model
                response = bedrock_runtime.invoke_model(
                    modelId=model_id,
                    contentType='application/json',
                    accept='application/json',
                    body=json.dumps(request_body)
                )
                
                # Parse response
                response_body = json.loads(response['body'].read())
                response_text = response_body['content'][0]['text']
                logger.info(f"Successfully used model: {model_id}")
                break
                
            except Exception as e:
                logger.warning(f"Error with model {model_id}: {str(e)}")
                last_error = e
                continue
        
        if response_text:
            return cors_response({
                'success': True,
                'description': response_text
            })
        else:
            raise last_error or Exception("All Claude models failed")
        
    except Exception as e:
        logger.error(f"Error generating UI description: {str(e)}")
        logger.error(traceback.format_exc())
        return cors_response({
            'success': False,
            'error': str(e)
        }, 500)

def handle_generate_components(event, request_id):
    """Handle generate components request."""
    try:
        # Parse request body
        body = get_request_body(event)
        prompt = body.get('prompt')
        
        if not prompt:
            return cors_response({'success': False, 'error': 'Prompt is required'}, 400)
        
        logger.info(f"Request ID: {request_id} - Generating Figma components with prompt: {prompt[:50]}...")
        
        # Create request payload for Claude - comprehensive but efficient
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1800,  # Increased token count for more comprehensive output
            "temperature": 0.3,  # Lower temperature for more precise output
            "top_p": 0.9,  # Add top_p for better performance
            "top_k": 250,  # Add top_k for faster generation
            "messages": [
                {
                    "role": "user", 
                    "content": f"Based on this UI/UX requirement: '{prompt}', provide comprehensive specifications for Figma components needed to implement this design. Include 8-10 key components covering the main UI elements. For each component include:\n\n1. Component name (use standard Figma naming conventions)\n2. Key dimensions (width, height, padding in pixels)\n3. Typography details (font family, size, weight)\n4. Color specifications (hex codes for main states)\n5. Auto layout settings if applicable (direction, spacing)\n6. Basic effects (shadows with values)\n7. Component variants if applicable\n\nStart with a component hierarchy showing parent-child relationships. Then provide detailed specifications for each component. Format your response as a structured specification that a designer can directly implement in Figma. Use precise measurements and values that can be directly entered into Figma's properties panel."
                }
            ]
        }
        
        # Create bedrock runtime client
        bedrock_runtime = boto3.client('bedrock-runtime')
        
        # Try different Claude models
        claude_models = [
            'anthropic.claude-3-sonnet-20240229-v1:0',
            'anthropic.claude-3-haiku-20240307-v1:0',
            'anthropic.claude-v2:1'
        ]
        
        response_text = None
        last_error = None
        
        for model_id in claude_models:
            try:
                logger.info(f"Trying Claude model: {model_id}")
                
                # Invoke the model
                response = bedrock_runtime.invoke_model(
                    modelId=model_id,
                    contentType='application/json',
                    accept='application/json',
                    body=json.dumps(request_body)
                )
                
                # Parse response
                response_body = json.loads(response['body'].read())
                response_text = response_body['content'][0]['text']
                logger.info(f"Successfully used model: {model_id}")
                break
                
            except Exception as e:
                logger.warning(f"Error with model {model_id}: {str(e)}")
                last_error = e
                continue
        
        if response_text:
            return cors_response({
                'success': True,
                'components': response_text
            })
        else:
            raise last_error or Exception("All Claude models failed")
        
    except Exception as e:
        logger.error(f"Error generating Figma components: {str(e)}")
        logger.error(traceback.format_exc())
        return cors_response({
            'success': False,
            'error': str(e)
        }, 500)