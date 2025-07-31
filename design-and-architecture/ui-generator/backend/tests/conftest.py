"""
Pytest configuration and fixtures for the UI Generator backend tests.
"""

import pytest
import os
import json
import tempfile
from unittest.mock import Mock, patch, MagicMock
from flask import Flask

# Add the parent directory to the path so we can import our modules
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app
from bedrock_service import BedrockService
from config import Config


@pytest.fixture
def client():
    """Create a test client for the Flask application."""
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    
    with app.test_client() as client:
        with app.app_context():
            yield client


@pytest.fixture
def mock_bedrock_service():
    """Create a mock BedrockService instance."""
    mock_service = Mock(spec=BedrockService)
    
    # Mock successful responses
    mock_service.generate_mockup.return_value = {
        'success': True,
        'image_url': 'http://localhost:8000/api/assets/test.png',
        'filename': 'test.png'
    }
    
    mock_service.generate_description.return_value = {
        'success': True,
        'description': 'Test UI description'
    }
    
    mock_service.generate_components.return_value = {
        'success': True,
        'components': 'Test component specifications'
    }
    
    mock_service.check_bedrock_access.return_value = {
        'success': True,
        'models': ['claude-3-sonnet', 'nova-canvas']
    }
    
    return mock_service


@pytest.fixture
def mock_boto3_client():
    """Create a mock boto3 client."""
    mock_client = Mock()
    
    # Mock successful Bedrock responses
    mock_client.invoke_model.return_value = {
        'body': Mock(read=lambda: json.dumps({
            'content': [{'text': 'Mock response'}]
        }).encode())
    }
    
    mock_client.invoke_model_with_response_stream.return_value = {
        'body': [
            {'chunk': {'bytes': b'mock image data'}}
        ]
    }
    
    return mock_client


@pytest.fixture
def mock_aws_credentials():
    """Mock AWS credentials environment variables."""
    with patch.dict(os.environ, {
        'AWS_ACCESS_KEY_ID': 'test_access_key',
        'AWS_SECRET_ACCESS_KEY': 'test_secret_key',
        'AWS_DEFAULT_REGION': 'us-east-1'
    }):
        yield


@pytest.fixture
def temp_assets_dir():
    """Create a temporary directory for test assets."""
    with tempfile.TemporaryDirectory() as temp_dir:
        assets_dir = os.path.join(temp_dir, 'assets')
        os.makedirs(assets_dir, exist_ok=True)
        
        # Create a test image file
        test_image_path = os.path.join(assets_dir, 'test.png')
        with open(test_image_path, 'wb') as f:
            f.write(b'fake image data')
        
        with patch('server.ASSETS_DIR', assets_dir):
            yield assets_dir


@pytest.fixture
def sample_prompt():
    """Sample prompt for testing."""
    return "Create a modern login form with email and password fields, a login button, and a forgot password link"


@pytest.fixture
def sample_mockup_response():
    """Sample mockup generation response."""
    return {
        'success': True,
        'image_url': 'http://localhost:8000/api/assets/mockup_123.png',
        'filename': 'mockup_123.png'
    }


@pytest.fixture
def sample_description_response():
    """Sample description generation response."""
    return {
        'success': True,
        'description': '''# Login Form UI Design

## Overview
A clean and modern login form with the following components:

## Components
- Email input field
- Password input field
- Login button
- Forgot password link

## Styling
- Modern flat design
- Blue color scheme (#007bff)
- Responsive layout'''
    }


@pytest.fixture
def sample_components_response():
    """Sample components generation response."""
    return {
        'success': True,
        'components': '''# Figma Component Specifications

## Email Input Field
- Width: 300px
- Height: 40px
- Border: 1px solid #ddd
- Border radius: 4px
- Font: 14px Inter

## Password Input Field
- Width: 300px
- Height: 40px
- Border: 1px solid #ddd
- Border radius: 4px
- Font: 14px Inter

## Login Button
- Width: 300px
- Height: 44px
- Background: #007bff
- Color: white
- Border radius: 4px
- Font: 16px Inter, weight 500'''
    }


@pytest.fixture
def mock_config():
    """Mock configuration object."""
    config = Mock(spec=Config)
    config.AWS_REGION = 'us-east-1'
    config.CORS_ORIGINS = ['http://localhost:3000']
    config.CLAUDE_MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0'
    config.NOVA_MODEL_ID = 'amazon.nova-canvas-v1:0'
    return config


@pytest.fixture(autouse=True)
def reset_mocks():
    """Reset all mocks after each test."""
    yield
    # This runs after each test
    pass


@pytest.fixture
def mock_file_operations():
    """Mock file operations for testing."""
    with patch('builtins.open', create=True) as mock_open, \
         patch('os.path.exists') as mock_exists, \
         patch('os.makedirs') as mock_makedirs:
        
        mock_exists.return_value = True
        mock_open.return_value.__enter__.return_value.read.return_value = b'fake image data'
        
        yield {
            'open': mock_open,
            'exists': mock_exists,
            'makedirs': mock_makedirs
        }


@pytest.fixture
def error_responses():
    """Common error responses for testing."""
    return {
        'bedrock_error': {
            'success': False,
            'error': 'Bedrock service unavailable'
        },
        'validation_error': {
            'success': False,
            'error': 'Invalid input parameters'
        },
        'network_error': {
            'success': False,
            'error': 'Network connection failed'
        },
        'auth_error': {
            'success': False,
            'error': 'AWS credentials not found'
        }
    }


# Pytest markers for organizing tests
pytest.mark.unit = pytest.mark.unit
pytest.mark.integration = pytest.mark.integration
pytest.mark.slow = pytest.mark.slow
pytest.mark.aws = pytest.mark.aws
