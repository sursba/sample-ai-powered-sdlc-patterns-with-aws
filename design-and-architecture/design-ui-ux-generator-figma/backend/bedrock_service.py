"""
Bedrock Service for UI Generator.

This module provides a service for interacting with AWS Bedrock to generate UI/UX designs,
descriptions, and component specifications.
"""

import boto3
import json
import base64
import os
import uuid
import traceback
import logging
import time
import random
import threading
from datetime import datetime
from botocore.exceptions import NoCredentialsError, ClientError
from config import get_config

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global rate limiter
class RateLimiter:
    def __init__(self, max_requests_per_minute=10):
        self.max_requests = max_requests_per_minute
        self.requests = []
        self.lock = threading.Lock()
    
    def wait_if_needed(self):
        with self.lock:
            now = time.time()
            # Remove requests older than 1 minute
            self.requests = [req_time for req_time in self.requests if now - req_time < 60]
            
            if len(self.requests) >= self.max_requests:
                # Calculate how long to wait
                oldest_request = min(self.requests)
                wait_time = 60 - (now - oldest_request) + 1  # Add 1 second buffer
                logger.warning(f"Rate limit reached, waiting {wait_time:.2f} seconds")
                time.sleep(wait_time)
                # Clean up again after waiting
                now = time.time()
                self.requests = [req_time for req_time in self.requests if now - req_time < 60]
            
            # Record this request
            self.requests.append(now)

class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=300):  # 5 minutes
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
        self.lock = threading.Lock()
    
    def call(self, func, *args, **kwargs):
        with self.lock:
            if self.state == 'OPEN':
                if time.time() - self.last_failure_time > self.recovery_timeout:
                    self.state = 'HALF_OPEN'
                    logger.info("Circuit breaker moving to HALF_OPEN state")
                else:
                    raise Exception("Circuit breaker is OPEN - too many recent failures")
            
            try:
                result = func(*args, **kwargs)
                if self.state == 'HALF_OPEN':
                    self.state = 'CLOSED'
                    self.failure_count = 0
                    logger.info("Circuit breaker reset to CLOSED state")
                return result
            except Exception as e:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.failure_count >= self.failure_threshold:
                    self.state = 'OPEN'
                    logger.error(f"Circuit breaker opened after {self.failure_count} failures")
                
                raise e

# Global rate limiter instances for different models
nova_canvas_rate_limiter = RateLimiter(max_requests_per_minute=4)  # Very conservative for image generation
claude_rate_limiter = RateLimiter(max_requests_per_minute=10)  # Text generation can handle more

# Circuit breaker for Bedrock calls
bedrock_circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=300)

class BedrockService:
    """Service for interacting with AWS Bedrock to generate UI/UX designs."""
    
    def __init__(self, region_name=None):
        """
        Initialize the Bedrock service with the specified AWS region.
        
        Args:
            region_name (str, optional): AWS region name. Defaults to config.AWS_REGION.
        """
        try:
            # Get configuration
            self.config = get_config()
            
            # Use provided region or default from config
            region_name = region_name or self.config.AWS_REGION
            
            # Create an explicit session
            self.session = boto3.Session(region_name=region_name)
            
            # Print credential provider for debugging
            credentials = self.session.get_credentials()
            if credentials:
                logger.info(f"Using AWS credential provider: {credentials.method}")
            else:
                logger.warning("No AWS credentials found in session")
            
            # Check if running in Lambda environment
            is_lambda = 'AWS_LAMBDA_FUNCTION_NAME' in os.environ
            logger.info(f"Running in Lambda environment: {is_lambda}")
            
            # Create the bedrock runtime client
            # In Lambda, we don't need to explicitly provide credentials as the Lambda role will be used
            self.bedrock_runtime = boto3.client(
                service_name='bedrock-runtime',
                region_name=region_name
            )
            
            # Create output directory
            self.output_dir = self.config.ASSETS_DIR
            os.makedirs(self.output_dir, exist_ok=True)
            
            # Define available Claude models in order of preference
            self.claude_models = [
                'anthropic.claude-3-haiku-20240307-v1:0',     # Claude 3 Haiku (primary)
                'anthropic.claude-3-opus-20240229-v1:0',      # Claude 3 Opus (fallback)
                'anthropic.claude-3-5-haiku-20241022-v1:0',   # Claude 3.5 Haiku (secondary fallback)
                'anthropic.claude-3-7-sonnet-20250219-v1:0',  # Claude 3.7 Sonnet (tertiary fallback)
                'anthropic.claude-3-5-sonnet-20240620-v1:0',  # Claude 3.5 Sonnet (quaternary fallback)
                'anthropic.claude-3-sonnet-20240229-v1:0',    # Claude 3 Sonnet (quinary fallback)
                'anthropic.claude-v2:1',                      # Claude 2 (older fallback)
            ]
            
            # Try to find an available Claude model
            self.claude_model_id = None
            
            try:
                # List available foundation models
                bedrock = self.session.client('bedrock')
                response = bedrock.list_foundation_models()
                models = response.get('modelSummaries', [])
                model_ids = [model.get('modelId') for model in models]
                
                # Find the first available Claude model
                for model_id in self.claude_models:
                    if model_id in model_ids:
                        self.claude_model_id = model_id
                        logger.info(f"Found available Claude model: {model_id}")
                        break
                
                if not self.claude_model_id:
                    logger.warning("No Claude models available. Using default Claude 3 Haiku.")
                    self.claude_model_id = 'anthropic.claude-3-haiku-20240307-v1:0'
            except Exception as e:
                logger.warning(f"Error checking available models: {str(e)}")
                # Fallback to Claude 3 Haiku
                self.claude_model_id = 'anthropic.claude-3-haiku-20240307-v1:0'
            
            logger.info(f"BedrockService initialized with region: {region_name}")
            logger.info(f"Using Claude model: {self.claude_model_id}")
            
        except Exception as e:
            logger.error(f"Error initializing BedrockService: {str(e)}")
            logger.error(traceback.format_exc())
            raise
    
    def _invoke_model_with_retry(self, model_id, request_body, max_retries=5):
        """
        Invoke Bedrock model with retry logic for throttling.
        
        Args:
            model_id (str): The model ID to invoke
            request_body (dict): The request payload
            max_retries (int): Maximum number of retries
            
        Returns:
            dict: Response from the model
        """
        # Choose appropriate rate limiter based on model type
        if 'nova-canvas' in model_id:
            rate_limiter = nova_canvas_rate_limiter
        elif 'claude' in model_id:
            rate_limiter = claude_rate_limiter
        else:
            rate_limiter = claude_rate_limiter  # Default to Claude limiter
            
        # Apply rate limiting before making the request
        rate_limiter.wait_if_needed()
        
        for attempt in range(max_retries + 1):
            try:
                # Create a new client with no retries to handle retries ourselves
                bedrock_runtime = boto3.client(
                    'bedrock-runtime',
                    region_name=self.session.region_name,
                    config=boto3.session.Config(
                        retries={'max_attempts': 0}  # Disable AWS SDK retries
                    )
                )
                
                response = bedrock_runtime.invoke_model(
                    modelId=model_id,
                    contentType='application/json',
                    accept='application/json',
                    body=json.dumps(request_body)
                )
                logger.info(f"Successfully invoked model {model_id} on attempt {attempt + 1}")
                return response
                
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', '')
                error_message = str(e)
                
                if 'ThrottlingException' in error_message or 'Too many requests' in error_message:
                    if attempt < max_retries:
                        # Exponential backoff with jitter (longer waits for throttling)
                        wait_time = min(60, (3 ** attempt) + random.uniform(1, 3))
                        logger.warning(f"Throttling detected on attempt {attempt + 1}, waiting {wait_time:.2f} seconds before retry")
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"Max retries ({max_retries}) exceeded for throttling")
                        raise ClientError(
                            error_response={
                                'Error': {
                                    'Code': 'ThrottlingException',
                                    'Message': f'Request throttled after {max_retries} retries. The service is experiencing high demand. Please try again in a few minutes with fewer images or wait longer between requests.'
                                }
                            },
                            operation_name='InvokeModel'
                        )
                else:
                    # Re-raise non-throttling errors immediately
                    logger.error(f"Non-throttling error on attempt {attempt + 1}: {error_message}")
                    raise e
            except Exception as e:
                logger.error(f"Unexpected error on attempt {attempt + 1}: {str(e)}")
                if attempt < max_retries:
                    wait_time = 2 ** attempt
                    logger.warning(f"Retrying after {wait_time} seconds due to unexpected error")
                    time.sleep(wait_time)
                    continue
                else:
                    raise e
        
        # This should never be reached, but just in case
        raise Exception("Max retries exceeded")
    
    def generate_ui_mockup(self, prompt, width=1024, height=1024, quality="standard", output_filename=None):
        """
        Generate UI mockup using Amazon Nova Canvas.
        
        Args:
            prompt (str): Text description of the UI to generate
            width (int, optional): Width of the generated image. Defaults to 1024.
            height (int, optional): Height of the generated image. Defaults to 1024.
            quality (str, optional): Quality of the generated image. Defaults to "standard".
            output_filename (str, optional): Output filename. Defaults to None.
            
        Returns:
            dict: Result of the generation, including success status and file path
        """
        if not output_filename:
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            unique_id = str(uuid.uuid4())[:8]
            output_filename = os.path.join(self.output_dir, f"ui_mockup_{timestamp}_{unique_id}.png")
        
        # Create request payload
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
        
        try:
            logger.info(f"Generating UI mockup with prompt: {prompt[:50]}...")
            
            # Invoke the model with retry logic
            response = self._invoke_model_with_retry(
                model_id='amazon.nova-canvas-v1:0',
                request_body=request_body
            )
            
            # Parse response
            response_body = json.loads(response['body'].read())
            
            # Extract and save image
            image_data = response_body['images'][0]
            image_bytes = base64.b64decode(image_data)
            
            with open(output_filename, 'wb') as f:
                f.write(image_bytes)
            
            logger.info(f"Image saved to {output_filename}")
            
            # Also return the base64 image data for frontend download functionality
            filename = os.path.basename(output_filename)
            
            return {
                "success": True,
                "file_path": output_filename,
                "relative_path": os.path.relpath(output_filename, os.path.dirname(os.path.dirname(__file__))),
                "image": image_data,  # Base64 image data for download
                "filename": filename,  # Just the filename for download
                "url": f"/api/assets/{filename}"  # URL to access the image
            }
        
        except NoCredentialsError:
            logger.error("No AWS credentials found")
            return {
                "success": False,
                "error": "No AWS credentials found. Please run 'aws configure' to set up your credentials."
            }
        except ClientError as e:
            logger.error(f"AWS client error: {str(e)}")
            return {
                "success": False,
                "error": f"AWS client error: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error generating UI mockup: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e)
            }
    
    def generate_multiple_ui_mockups(self, prompt, num_images=4, width=1024, height=1024, quality="standard"):
        """
        Generate multiple UI mockups using Amazon Nova Canvas batch generation.
        
        Args:
            prompt (str): Text description of the UI to generate
            num_images (int, optional): Number of images to generate. Defaults to 4.
            width (int, optional): Width of the generated images. Defaults to 1024.
            height (int, optional): Height of the generated images. Defaults to 1024.
            quality (str, optional): Quality of the generated images. Defaults to "standard".
            
        Returns:
            dict: Result of the generation, including success status and list of images
        """
        try:
            logger.info(f"Generating {num_images} UI mockups with prompt: {prompt[:50]}...")
            
            # Nova Canvas can generate up to 5 images in one API call
            # Create request payload for batch generation
            request_body = {
                "taskType": "TEXT_IMAGE",
                "textToImageParams": {
                    "text": prompt
                },
                "imageGenerationConfig": {
                    "numberOfImages": num_images,  # Generate all images in one call
                    "quality": quality,
                    "width": width,
                    "height": height,
                    "seed": random.randint(1, 2147483647)
                }
            }
            
            # Single API call to generate all images
            logger.info(f"Making single API call to generate {num_images} images")
            response = self._invoke_model_with_retry(
                model_id='amazon.nova-canvas-v1:0',
                request_body=request_body
            )
            
            # Parse response
            response_body = json.loads(response['body'].read())
            
            # Process all generated images
            images = []
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            unique_id = str(uuid.uuid4())[:8]
            
            for i, image_data in enumerate(response_body['images']):
                try:
                    # Save each image
                    output_filename = os.path.join(self.output_dir, f"ui_mockup_{timestamp}_{unique_id}_{i+1}.png")
                    image_bytes = base64.b64decode(image_data)
                    
                    with open(output_filename, 'wb') as f:
                        f.write(image_bytes)
                    
                    filename = os.path.basename(output_filename)
                    
                    images.append({
                        'id': f"image_{i+1}_{unique_id}",
                        'data_url': f"data:image/png;base64,{image_data}",
                        'filename': filename,
                        'url': f"/api/assets/{filename}",
                        'prompt': prompt,
                        'index': i + 1
                    })
                    
                    logger.info(f"Processed image {i+1}/{num_images}: {filename}")
                    
                except Exception as img_error:
                    logger.error(f"Error processing image {i+1}: {str(img_error)}")
                    continue
            
            if not images:
                return {
                    "success": False,
                    "error": "Failed to process any generated images"
                }
            
            logger.info(f"Successfully generated {len(images)} images in single API call")
            return {
                "success": True,
                "images": images,
                "total_count": len(images),
                "requested_count": num_images,
                "errors": None
            }
        
        except Exception as e:
            logger.error(f"Error generating multiple UI mockups: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e)
            }
    
    def generate_ui_description(self, prompt):
        """
        Generate UI description using Claude model.
        
        Args:
            prompt (str): Text description of the UI to generate
            
        Returns:
            dict: Result of the generation, including success status and description
        """
        try:
            logger.info(f"Generating UI description with prompt: {prompt[:50]}...")
            
            # Create request payload
            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": [
                    {
                        "role": "user", 
                        "content": f"Based on this description: '{prompt}', provide a detailed UI/UX specification including:\n\n1. Overall layout structure\n2. Color scheme recommendations\n3. Key components needed\n4. User interaction patterns\n5. Responsive design considerations\n\nFormat your response as a structured specification document that a designer could follow."
                    }
                ]
            }
            
            # Invoke the model with retry logic
            response = self._invoke_model_with_retry(
                model_id=self.claude_model_id,
                request_body=request_body
            )
            
            # Parse response
            response_body = json.loads(response['body'].read())
            
            return {
                "success": True,
                "description": response_body['content'][0]['text']
            }
        
        except NoCredentialsError:
            logger.error("No AWS credentials found")
            return {
                "success": False,
                "error": "No AWS credentials found. Please run 'aws configure' to set up your credentials."
            }
        except ClientError as e:
            logger.error(f"AWS client error: {str(e)}")
            
            # If the error is related to the model ID, try with a fallback model
            if "ValidationException" in str(e) and "Invocation of model ID" in str(e):
                for fallback_model in self.claude_models:
                    if fallback_model != self.claude_model_id:
                        try:
                            logger.info(f"Trying fallback model: {fallback_model}")
                            
                            # Invoke the model with fallback
                            response = self.bedrock_runtime.invoke_model(
                                modelId=fallback_model,
                                contentType='application/json',
                                accept='application/json',
                                body=json.dumps(request_body)
                            )
                            
                            # Parse response
                            response_body = json.loads(response['body'].read())
                            
                            # Update the model ID for future calls
                            self.claude_model_id = fallback_model
                            logger.info(f"Updated to use model: {fallback_model}")
                            
                            return {
                                "success": True,
                                "description": response_body['content'][0]['text']
                            }
                        except Exception as fallback_e:
                            logger.error(f"Fallback model {fallback_model} failed: {str(fallback_e)}")
                            continue
                
                # If all fallbacks fail
                return {
                    "success": False,
                    "error": f"All model fallbacks failed. Original error: {str(e)}"
                }
            else:
                return {
                    "success": False,
                    "error": f"AWS client error: {str(e)}"
                }
        except Exception as e:
            logger.error(f"Error generating UI description: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e)
            }
    
    def generate_figma_components(self, prompt):
        """
        Generate Figma component descriptions using Claude model.
        
        Args:
            prompt (str): Text description of the UI to generate components for
            
        Returns:
            dict: Result of the generation, including success status and components
        """
        try:
            logger.info(f"Generating Figma components with prompt: {prompt[:50]}...")
            
            # Create request payload
            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 2000,
                "messages": [
                    {
                        "role": "user", 
                        "content": f"Based on this UI/UX requirement: '{prompt}', provide detailed specifications for Figma components that would be needed, including:\n\n1. Component name\n2. Purpose\n3. Properties/variants\n4. Styling details (colors, typography, spacing)\n5. States (if applicable)\n6. Accessibility considerations\n\nFormat your response as a structured list of components that could be directly implemented in Figma."
                    }
                ]
            }
            
            # Invoke the model with retry logic
            response = self._invoke_model_with_retry(
                model_id=self.claude_model_id,
                request_body=request_body
            )
            
            # Parse response
            response_body = json.loads(response['body'].read())
            
            return {
                "success": True,
                "components": response_body['content'][0]['text']
            }
        
        except NoCredentialsError:
            logger.error("No AWS credentials found")
            return {
                "success": False,
                "error": "No AWS credentials found. Please run 'aws configure' to set up your credentials."
            }
        except ClientError as e:
            logger.error(f"AWS client error: {str(e)}")
            
            # If the error is related to the model ID, try with a fallback model
            if "ValidationException" in str(e) and "Invocation of model ID" in str(e):
                for fallback_model in self.claude_models:
                    if fallback_model != self.claude_model_id:
                        try:
                            logger.info(f"Trying fallback model: {fallback_model}")
                            
                            # Invoke the model with fallback
                            response = self.bedrock_runtime.invoke_model(
                                modelId=fallback_model,
                                contentType='application/json',
                                accept='application/json',
                                body=json.dumps(request_body)
                            )
                            
                            # Parse response
                            response_body = json.loads(response['body'].read())
                            
                            # Update the model ID for future calls
                            self.claude_model_id = fallback_model
                            logger.info(f"Updated to use model: {fallback_model}")
                            
                            return {
                                "success": True,
                                "components": response_body['content'][0]['text']
                            }
                        except Exception as fallback_e:
                            logger.error(f"Fallback model {fallback_model} failed: {str(fallback_e)}")
                            continue
                
                # If all fallbacks fail
                return {
                    "success": False,
                    "error": f"All model fallbacks failed. Original error: {str(e)}"
                }
            else:
                return {
                    "success": False,
                    "error": f"AWS client error: {str(e)}"
                }
        except Exception as e:
            logger.error(f"Error generating Figma components: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e)
            }