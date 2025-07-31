"""
Unit tests for the BedrockService class.
"""

import pytest
import json
import base64
from unittest.mock import Mock, patch, MagicMock
from botocore.exceptions import ClientError, NoCredentialsError

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from bedrock_service import BedrockService


@pytest.mark.unit
class TestBedrockServiceInitialization:
    """Test BedrockService initialization."""
    
    @patch('bedrock_service.boto3.client')
    def test_initialization_success(self, mock_boto_client):
        """Test successful BedrockService initialization."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        service = BedrockService(region_name='us-east-1')
        
        assert service.region_name == 'us-east-1'
        assert service.bedrock_client == mock_client
        mock_boto_client.assert_called_once_with('bedrock-runtime', region_name='us-east-1')
    
    @patch('bedrock_service.boto3.client')
    def test_initialization_with_default_region(self, mock_boto_client):
        """Test BedrockService initialization with default region."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        service = BedrockService()
        
        assert service.region_name == 'us-east-1'
        mock_boto_client.assert_called_once_with('bedrock-runtime', region_name='us-east-1')
    
    @patch('bedrock_service.boto3.client')
    def test_initialization_client_error(self, mock_boto_client):
        """Test BedrockService initialization with client error."""
        mock_boto_client.side_effect = NoCredentialsError()
        
        with pytest.raises(NoCredentialsError):
            BedrockService(region_name='us-east-1')


@pytest.mark.unit
class TestGenerateMockup:
    """Test mockup generation functionality."""
    
    @patch('bedrock_service.boto3.client')
    def test_generate_mockup_success(self, mock_boto_client):
        """Test successful mockup generation."""
        # Setup mock client
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock the response
        mock_image_data = b'fake_image_data'
        mock_response = {
            'body': [
                {'chunk': {'bytes': base64.b64encode(mock_image_data)}}
            ]
        }
        mock_client.invoke_model_with_response_stream.return_value = mock_response
        
        # Mock file operations
        with patch('bedrock_service.os.makedirs'), \
             patch('bedrock_service.open', create=True) as mock_open, \
             patch('bedrock_service.uuid.uuid4') as mock_uuid:
            
            mock_uuid.return_value.hex = 'test123'
            mock_file = Mock()
            mock_open.return_value.__enter__.return_value = mock_file
            
            service = BedrockService()
            result = service.generate_mockup('Create a login form', 1024, 1024, 'standard')
            
            assert result['success'] is True
            assert 'image_url' in result
            assert 'filename' in result
            assert result['filename'] == 'mockup_test123.png'
    
    @patch('bedrock_service.boto3.client')
    def test_generate_mockup_client_error(self, mock_boto_client):
        """Test mockup generation with client error."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock client error
        error_response = {'Error': {'Code': 'ValidationException', 'Message': 'Invalid input'}}
        mock_client.invoke_model_with_response_stream.side_effect = ClientError(
            error_response, 'InvokeModelWithResponseStream'
        )
        
        service = BedrockService()
        result = service.generate_mockup('Create a login form')
        
        assert result['success'] is False
        assert 'error' in result
        assert 'ValidationException' in result['error']
    
    @patch('bedrock_service.boto3.client')
    def test_generate_mockup_invalid_prompt(self, mock_boto_client):
        """Test mockup generation with invalid prompt."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        service = BedrockService()
        
        # Test empty prompt
        result = service.generate_mockup('')
        assert result['success'] is False
        assert 'error' in result
        
        # Test None prompt
        result = service.generate_mockup(None)
        assert result['success'] is False
        assert 'error' in result
    
    @patch('bedrock_service.boto3.client')
    def test_generate_mockup_invalid_dimensions(self, mock_boto_client):
        """Test mockup generation with invalid dimensions."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        service = BedrockService()
        
        # Test invalid width
        result = service.generate_mockup('test', width=0)
        assert result['success'] is False
        
        # Test invalid height
        result = service.generate_mockup('test', height=-100)
        assert result['success'] is False
    
    @patch('bedrock_service.boto3.client')
    def test_generate_mockup_file_write_error(self, mock_boto_client):
        """Test mockup generation with file write error."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock successful API response
        mock_image_data = b'fake_image_data'
        mock_response = {
            'body': [
                {'chunk': {'bytes': base64.b64encode(mock_image_data)}}
            ]
        }
        mock_client.invoke_model_with_response_stream.return_value = mock_response
        
        # Mock file write error
        with patch('bedrock_service.os.makedirs'), \
             patch('bedrock_service.open', side_effect=IOError('Permission denied')):
            
            service = BedrockService()
            result = service.generate_mockup('Create a login form')
            
            assert result['success'] is False
            assert 'error' in result


@pytest.mark.unit
class TestGenerateDescription:
    """Test description generation functionality."""
    
    @patch('bedrock_service.boto3.client')
    def test_generate_description_success(self, mock_boto_client):
        """Test successful description generation."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock the response
        mock_response_body = {
            'content': [{'text': 'Generated UI description'}]
        }
        mock_response = {
            'body': Mock(read=lambda: json.dumps(mock_response_body).encode())
        }
        mock_client.invoke_model.return_value = mock_response
        
        service = BedrockService()
        result = service.generate_description('Create a login form')
        
        assert result['success'] is True
        assert result['description'] == 'Generated UI description'
        
        # Verify the API call
        mock_client.invoke_model.assert_called_once()
        call_args = mock_client.invoke_model.call_args
        assert call_args[1]['modelId'] == 'anthropic.claude-3-haiku-20240307-v1:0'
    
    @patch('bedrock_service.boto3.client')
    def test_generate_description_client_error(self, mock_boto_client):
        """Test description generation with client error."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock client error
        error_response = {'Error': {'Code': 'ThrottlingException', 'Message': 'Rate limit exceeded'}}
        mock_client.invoke_model.side_effect = ClientError(
            error_response, 'InvokeModel'
        )
        
        service = BedrockService()
        result = service.generate_description('Create a login form')
        
        assert result['success'] is False
        assert 'error' in result
        assert 'ThrottlingException' in result['error']
    
    @patch('bedrock_service.boto3.client')
    def test_generate_description_invalid_response(self, mock_boto_client):
        """Test description generation with invalid response format."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock invalid response
        mock_response = {
            'body': Mock(read=lambda: b'invalid json')
        }
        mock_client.invoke_model.return_value = mock_response
        
        service = BedrockService()
        result = service.generate_description('Create a login form')
        
        assert result['success'] is False
        assert 'error' in result


@pytest.mark.unit
class TestGenerateComponents:
    """Test components generation functionality."""
    
    @patch('bedrock_service.boto3.client')
    def test_generate_components_success(self, mock_boto_client):
        """Test successful components generation."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock the response
        mock_response_body = {
            'content': [{'text': 'Generated component specifications'}]
        }
        mock_response = {
            'body': Mock(read=lambda: json.dumps(mock_response_body).encode())
        }
        mock_client.invoke_model.return_value = mock_response
        
        service = BedrockService()
        result = service.generate_components('Create a login form')
        
        assert result['success'] is True
        assert result['components'] == 'Generated component specifications'
        
        # Verify the API call
        mock_client.invoke_model.assert_called_once()
        call_args = mock_client.invoke_model.call_args
        assert call_args[1]['modelId'] == 'anthropic.claude-3-haiku-20240307-v1:0'
    
    @patch('bedrock_service.boto3.client')
    def test_generate_components_empty_prompt(self, mock_boto_client):
        """Test components generation with empty prompt."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        service = BedrockService()
        result = service.generate_components('')
        
        assert result['success'] is False
        assert 'error' in result


@pytest.mark.unit
class TestGenerateMultipleMockups:
    """Test multiple mockups generation functionality."""
    
    @patch('bedrock_service.boto3.client')
    def test_generate_multiple_mockups_success(self, mock_boto_client):
        """Test successful multiple mockups generation."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock the response for each image
        mock_image_data = b'fake_image_data'
        mock_response = {
            'body': [
                {'chunk': {'bytes': base64.b64encode(mock_image_data)}}
            ]
        }
        mock_client.invoke_model_with_response_stream.return_value = mock_response
        
        # Mock file operations
        with patch('bedrock_service.os.makedirs'), \
             patch('bedrock_service.open', create=True) as mock_open, \
             patch('bedrock_service.uuid.uuid4') as mock_uuid:
            
            mock_uuid.return_value.hex = 'test123'
            mock_file = Mock()
            mock_open.return_value.__enter__.return_value = mock_file
            
            service = BedrockService()
            result = service.generate_multiple_mockups('Create login forms', num_images=2)
            
            assert result['success'] is True
            assert 'images' in result
            assert len(result['images']) == 2
            
            # Verify each image has required fields
            for image in result['images']:
                assert 'filename' in image
                assert 'image_url' in image
    
    @patch('bedrock_service.boto3.client')
    def test_generate_multiple_mockups_invalid_num_images(self, mock_boto_client):
        """Test multiple mockups generation with invalid number of images."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        service = BedrockService()
        
        # Test zero images
        result = service.generate_multiple_mockups('test', num_images=0)
        assert result['success'] is False
        
        # Test negative images
        result = service.generate_multiple_mockups('test', num_images=-1)
        assert result['success'] is False
        
        # Test too many images
        result = service.generate_multiple_mockups('test', num_images=100)
        assert result['success'] is False
    
    @patch('bedrock_service.boto3.client')
    def test_generate_multiple_mockups_partial_failure(self, mock_boto_client):
        """Test multiple mockups generation with partial failure."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock first call success, second call failure
        mock_image_data = b'fake_image_data'
        success_response = {
            'body': [
                {'chunk': {'bytes': base64.b64encode(mock_image_data)}}
            ]
        }
        
        error_response = {'Error': {'Code': 'ValidationException', 'Message': 'Invalid input'}}
        mock_client.invoke_model_with_response_stream.side_effect = [
            success_response,
            ClientError(error_response, 'InvokeModelWithResponseStream')
        ]
        
        with patch('bedrock_service.os.makedirs'), \
             patch('bedrock_service.open', create=True) as mock_open, \
             patch('bedrock_service.uuid.uuid4') as mock_uuid:
            
            mock_uuid.return_value.hex = 'test123'
            mock_file = Mock()
            mock_open.return_value.__enter__.return_value = mock_file
            
            service = BedrockService()
            result = service.generate_multiple_mockups('Create login forms', num_images=2)
            
            # Should return partial success
            assert result['success'] is True
            assert len(result['images']) == 1  # Only one successful image


@pytest.mark.unit
class TestCheckBedrockAccess:
    """Test Bedrock access checking functionality."""
    
    @patch('bedrock_service.boto3.client')
    def test_check_bedrock_access_success(self, mock_boto_client):
        """Test successful Bedrock access check."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock successful responses for both models
        mock_response_body = {
            'content': [{'text': 'Test response'}]
        }
        mock_response = {
            'body': Mock(read=lambda: json.dumps(mock_response_body).encode())
        }
        mock_client.invoke_model.return_value = mock_response
        
        mock_image_response = {
            'body': [
                {'chunk': {'bytes': base64.b64encode(b'test')}}
            ]
        }
        mock_client.invoke_model_with_response_stream.return_value = mock_image_response
        
        service = BedrockService()
        result = service.check_bedrock_access()
        
        assert result['success'] is True
        assert 'models' in result
        assert len(result['models']) == 2
        assert 'claude-3-haiku' in result['models']
        assert 'nova-canvas' in result['models']
    
    @patch('bedrock_service.boto3.client')
    def test_check_bedrock_access_partial_failure(self, mock_boto_client):
        """Test Bedrock access check with partial failure."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock Claude success, Nova failure
        mock_response_body = {
            'content': [{'text': 'Test response'}]
        }
        mock_response = {
            'body': Mock(read=lambda: json.dumps(mock_response_body).encode())
        }
        mock_client.invoke_model.return_value = mock_response
        
        error_response = {'Error': {'Code': 'AccessDeniedException', 'Message': 'Access denied'}}
        mock_client.invoke_model_with_response_stream.side_effect = ClientError(
            error_response, 'InvokeModelWithResponseStream'
        )
        
        service = BedrockService()
        result = service.check_bedrock_access()
        
        assert result['success'] is True
        assert len(result['models']) == 1
        assert 'claude-3-haiku' in result['models']
        assert 'nova-canvas' not in result['models']
    
    @patch('bedrock_service.boto3.client')
    def test_check_bedrock_access_complete_failure(self, mock_boto_client):
        """Test Bedrock access check with complete failure."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock both models failing
        error_response = {'Error': {'Code': 'AccessDeniedException', 'Message': 'Access denied'}}
        mock_client.invoke_model.side_effect = ClientError(
            error_response, 'InvokeModel'
        )
        mock_client.invoke_model_with_response_stream.side_effect = ClientError(
            error_response, 'InvokeModelWithResponseStream'
        )
        
        service = BedrockService()
        result = service.check_bedrock_access()
        
        assert result['success'] is False
        assert 'error' in result


@pytest.mark.unit
class TestUtilityMethods:
    """Test utility methods."""
    
    @patch('bedrock_service.boto3.client')
    def test_validate_prompt(self, mock_boto_client):
        """Test prompt validation."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        service = BedrockService()
        
        # Valid prompts
        assert service._validate_prompt('Valid prompt') is True
        assert service._validate_prompt('A' * 1000) is True  # Long but valid
        
        # Invalid prompts
        assert service._validate_prompt('') is False
        assert service._validate_prompt(None) is False
        assert service._validate_prompt('   ') is False  # Only whitespace
    
    @patch('bedrock_service.boto3.client')
    def test_validate_dimensions(self, mock_boto_client):
        """Test dimension validation."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        service = BedrockService()
        
        # Valid dimensions
        assert service._validate_dimensions(1024, 1024) is True
        assert service._validate_dimensions(512, 768) is True
        
        # Invalid dimensions
        assert service._validate_dimensions(0, 1024) is False
        assert service._validate_dimensions(1024, 0) is False
        assert service._validate_dimensions(-100, 1024) is False
        assert service._validate_dimensions(1024, -100) is False
        assert service._validate_dimensions(10000, 1024) is False  # Too large
        assert service._validate_dimensions(1024, 10000) is False  # Too large
    
    @patch('bedrock_service.boto3.client')
    def test_create_image_url(self, mock_boto_client):
        """Test image URL creation."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        service = BedrockService()
        
        filename = 'test_image.png'
        url = service._create_image_url(filename)
        
        assert url.endswith(f'/api/assets/{filename}')
        assert url.startswith('http')
    
    @patch('bedrock_service.boto3.client')
    def test_generate_filename(self, mock_boto_client):
        """Test filename generation."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        with patch('bedrock_service.uuid.uuid4') as mock_uuid:
            mock_uuid.return_value.hex = 'test123'
            
            service = BedrockService()
            
            filename = service._generate_filename('mockup')
            assert filename == 'mockup_test123.png'
            
            filename = service._generate_filename('component')
            assert filename == 'component_test123.png'

    @patch('bedrock_service.boto3.client')
    def test_generate_multiple_ui_mockups_batch(self, mock_boto_client):
        """Test batch generation of multiple UI mockups."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock successful batch response with multiple images
        mock_response_body = {
            'images': [
                'base64_image_data_1',
                'base64_image_data_2',
                'base64_image_data_3'
            ]
        }
        
        mock_response = Mock()
        mock_response.read.return_value = json.dumps(mock_response_body).encode()
        mock_client.invoke_model.return_value = {'body': mock_response}
        
        service = BedrockService()
        result = service.generate_multiple_ui_mockups("Test prompt", num_images=3)
        
        # Verify successful batch generation
        assert result['success'] is True
        assert result['total_count'] == 3
        assert result['requested_count'] == 3
        assert len(result['images']) == 3
        
        # Verify single API call was made (batch generation)
        mock_client.invoke_model.assert_called_once()
        call_args = mock_client.invoke_model.call_args
        request_body = json.loads(call_args[1]['body'])
        assert request_body['imageGenerationConfig']['numberOfImages'] == 3
        assert call_args[1]['modelId'] == 'amazon.nova-canvas-v1:0'

    @patch('bedrock_service.boto3.client')
    def test_generate_multiple_ui_mockups_max_limit(self, mock_boto_client):
        """Test batch generation respects 4 image limit."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock successful batch response with 4 images
        mock_response_body = {
            'images': [
                'base64_image_data_1',
                'base64_image_data_2',
                'base64_image_data_3',
                'base64_image_data_4'
            ]
        }
        
        mock_response = Mock()
        mock_response.read.return_value = json.dumps(mock_response_body).encode()
        mock_client.invoke_model.return_value = {'body': mock_response}
        
        service = BedrockService()
        result = service.generate_multiple_ui_mockups("Test prompt", num_images=4)
        
        # Verify successful batch generation with max limit
        assert result['success'] is True
        assert result['total_count'] == 4
        assert result['requested_count'] == 4
        assert len(result['images']) == 4
        
        # Verify single API call was made
        mock_client.invoke_model.assert_called_once()
        call_args = mock_client.invoke_model.call_args
        request_body = json.loads(call_args[1]['body'])
        assert request_body['imageGenerationConfig']['numberOfImages'] == 4

    @patch('bedrock_service.boto3.client')
    def test_claude_model_fallback_to_opus(self, mock_boto_client):
        """Test fallback from Claude 3 Haiku to Claude 3 Opus."""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock Haiku failure, then Opus success
        haiku_error = ClientError(
            error_response={
                'Error': {
                    'Code': 'ValidationException',
                    'Message': 'Invocation of model ID anthropic.claude-3-haiku-20240307-v1:0 failed'
                }
            },
            operation_name='InvokeModel'
        )
        
        opus_response_body = {
            'content': [{'text': 'Generated with Claude 3 Opus'}]
        }
        opus_response = Mock()
        opus_response.read.return_value = json.dumps(opus_response_body).encode()
        
        # First call fails (Haiku), second call succeeds (Opus)
        mock_client.invoke_model.side_effect = [
            haiku_error,
            {'body': opus_response}
        ]
        
        service = BedrockService()
        result = service.generate_ui_description("Test prompt")
        
        # Verify successful fallback to Opus
        assert result['success'] is True
        assert result['description'] == 'Generated with Claude 3 Opus'
        
        # Verify two API calls were made (Haiku failed, Opus succeeded)
        assert mock_client.invoke_model.call_count == 2
        
        # Verify first call was to Haiku
        first_call_args = mock_client.invoke_model.call_args_list[0]
        assert first_call_args[1]['modelId'] == 'anthropic.claude-3-haiku-20240307-v1:0'
        
        # Verify second call was to Opus
        second_call_args = mock_client.invoke_model.call_args_list[1]
        assert second_call_args[1]['modelId'] == 'anthropic.claude-3-opus-20240229-v1:0'
