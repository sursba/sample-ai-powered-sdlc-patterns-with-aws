"""
Integration tests for the API endpoints.
These tests verify the interaction between different components.
"""

import pytest
import json
import os
from unittest.mock import patch, Mock

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


@pytest.mark.integration
class TestAPIIntegration:
    """Integration tests for API endpoints."""
    
    @patch('server.bedrock_service')
    def test_full_ui_generation_workflow(self, mock_bedrock, client):
        """Test the complete UI generation workflow."""
        # Mock all Bedrock service responses
        mock_bedrock.generate_mockup.return_value = {
            'success': True,
            'image_url': 'http://localhost:8000/api/assets/mockup_123.png',
            'filename': 'mockup_123.png'
        }
        
        mock_bedrock.generate_description.return_value = {
            'success': True,
            'description': 'Generated UI description'
        }
        
        mock_bedrock.generate_components.return_value = {
            'success': True,
            'components': 'Generated component specifications'
        }
        
        prompt = "Create a modern login form with email and password fields"
        
        # Step 1: Generate mockup
        mockup_response = client.post('/api/generate-mockup', 
                                    json={
                                        'prompt': prompt,
                                        'width': 1024,
                                        'height': 1024,
                                        'quality': 'standard'
                                    })
        
        assert mockup_response.status_code == 200
        mockup_data = json.loads(mockup_response.data)
        assert mockup_data['success'] is True
        
        # Step 2: Generate description
        description_response = client.post('/api/generate-description', 
                                         json={'prompt': prompt})
        
        assert description_response.status_code == 200
        description_data = json.loads(description_response.data)
        assert description_data['success'] is True
        
        # Step 3: Generate components
        components_response = client.post('/api/generate-components', 
                                        json={'prompt': prompt})
        
        assert components_response.status_code == 200
        components_data = json.loads(components_response.data)
        assert components_data['success'] is True
        
        # Verify all services were called with correct parameters
        mock_bedrock.generate_mockup.assert_called_once_with(prompt, 1024, 1024, 'standard')
        mock_bedrock.generate_description.assert_called_once_with(prompt)
        mock_bedrock.generate_components.assert_called_once_with(prompt)
    
    @patch('server.bedrock_service')
    def test_multiple_mockups_generation_workflow(self, mock_bedrock, client):
        """Test the multiple mockups generation workflow."""
        mock_bedrock.generate_multiple_mockups.return_value = {
            'success': True,
            'images': [
                {'filename': 'image1.png', 'image_url': 'http://localhost:8000/api/assets/image1.png'},
                {'filename': 'image2.png', 'image_url': 'http://localhost:8000/api/assets/image2.png'},
                {'filename': 'image3.png', 'image_url': 'http://localhost:8000/api/assets/image3.png'}
            ]
        }
        
        response = client.post('/api/generate-multiple-mockups', 
                             json={
                                 'prompt': 'Create different login form variations',
                                 'num_images': 3,
                                 'width': 800,
                                 'height': 600,
                                 'quality': 'high'
                             })
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert len(data['images']) == 3
        
        mock_bedrock.generate_multiple_mockups.assert_called_once_with(
            'Create different login form variations', 3, 800, 600, 'high'
        )
    
    @patch('server.bedrock_service')
    def test_error_handling_across_endpoints(self, mock_bedrock, client):
        """Test error handling consistency across endpoints."""
        # Mock Bedrock service to return errors
        error_response = {
            'success': False,
            'error': 'Bedrock service unavailable'
        }
        
        mock_bedrock.generate_mockup.return_value = error_response
        mock_bedrock.generate_description.return_value = error_response
        mock_bedrock.generate_components.return_value = error_response
        
        endpoints = [
            ('/api/generate-mockup', {'prompt': 'test'}),
            ('/api/generate-description', {'prompt': 'test'}),
            ('/api/generate-components', {'prompt': 'test'})
        ]
        
        for endpoint, payload in endpoints:
            response = client.post(endpoint, json=payload)
            
            assert response.status_code == 500
            data = json.loads(response.data)
            assert data['success'] is False
            assert 'error' in data
    
    def test_cors_headers_consistency(self, client):
        """Test CORS headers are consistent across all endpoints."""
        endpoints = [
            '/api/health',
            '/api/check-bedrock-access'
        ]
        
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert 'Access-Control-Allow-Origin' in response.headers
    
    @patch('server.bedrock_service')
    def test_input_validation_consistency(self, mock_bedrock, client):
        """Test input validation is consistent across endpoints."""
        # Test empty prompt validation
        endpoints_requiring_prompt = [
            '/api/generate-mockup',
            '/api/generate-description',
            '/api/generate-components',
            '/api/generate-multiple-mockups'
        ]
        
        for endpoint in endpoints_requiring_prompt:
            response = client.post(endpoint, json={'prompt': ''})
            assert response.status_code == 400
            
            data = json.loads(response.data)
            assert data['success'] is False
            assert 'error' in data
    
    def test_content_type_handling(self, client):
        """Test content type handling across endpoints."""
        # Test with correct content type
        response = client.post('/api/generate-mockup', 
                             json={'prompt': 'test'},
                             content_type='application/json')
        
        # Should not fail due to content type (may fail for other reasons)
        assert response.status_code in [200, 400, 500]
        
        # Test with incorrect content type
        response = client.post('/api/generate-mockup', 
                             data='{"prompt": "test"}',
                             content_type='text/plain')
        
        assert response.status_code == 400


@pytest.mark.integration
@pytest.mark.slow
class TestBedrockServiceIntegration:
    """Integration tests for BedrockService with mocked AWS."""
    
    @patch('bedrock_service.boto3.client')
    def test_bedrock_service_initialization_and_usage(self, mock_boto_client):
        """Test BedrockService initialization and basic usage."""
        from bedrock_service import BedrockService
        
        # Mock the boto3 client
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock successful responses
        mock_response_body = {
            'content': [{'text': 'Generated description'}]
        }
        mock_response = {
            'body': Mock(read=lambda: json.dumps(mock_response_body).encode())
        }
        mock_client.invoke_model.return_value = mock_response
        
        # Initialize service
        service = BedrockService(region_name='us-east-1')
        
        # Test description generation
        result = service.generate_description('Create a login form')
        
        assert result['success'] is True
        assert result['description'] == 'Generated description'
        
        # Verify boto3 client was called correctly
        mock_boto_client.assert_called_once_with('bedrock-runtime', region_name='us-east-1')
        mock_client.invoke_model.assert_called_once()
    
    @patch('bedrock_service.boto3.client')
    def test_bedrock_service_error_propagation(self, mock_boto_client):
        """Test error propagation from BedrockService to API endpoints."""
        from bedrock_service import BedrockService
        from botocore.exceptions import ClientError
        
        # Mock the boto3 client
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        
        # Mock client error
        error_response = {'Error': {'Code': 'AccessDeniedException', 'Message': 'Access denied'}}
        mock_client.invoke_model.side_effect = ClientError(error_response, 'InvokeModel')
        
        # Initialize service
        service = BedrockService()
        
        # Test that error is properly handled
        result = service.generate_description('test prompt')
        
        assert result['success'] is False
        assert 'error' in result
        assert 'AccessDeniedException' in result['error']


@pytest.mark.integration
class TestFileHandlingIntegration:
    """Integration tests for file handling operations."""
    
    def test_asset_serving_integration(self, client, temp_assets_dir):
        """Test asset serving integration."""
        # Test serving existing asset
        response = client.get('/api/assets/test.png')
        
        assert response.status_code == 200
        assert response.mimetype == 'image/png'
        assert len(response.data) > 0
    
    def test_download_integration(self, client, temp_assets_dir):
        """Test download integration."""
        # Test downloading existing file
        response = client.get('/api/download-image/test.png')
        
        assert response.status_code == 200
        assert response.mimetype == 'image/png'
        assert 'attachment' in response.headers.get('Content-Disposition', '')
    
    def test_file_security_integration(self, client, temp_assets_dir):
        """Test file security integration."""
        # Test path traversal protection
        malicious_paths = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\config\\sam',
            '/etc/passwd',
            'C:\\Windows\\System32\\config\\SAM'
        ]
        
        for path in malicious_paths:
            response = client.get(f'/api/assets/{path}')
            assert response.status_code in [400, 404]  # Should be blocked or not found
            
            response = client.get(f'/api/download-image/{path}')
            assert response.status_code in [400, 404]  # Should be blocked or not found


@pytest.mark.integration
class TestConfigurationIntegration:
    """Integration tests for configuration usage."""
    
    @patch.dict(os.environ, {
        'AWS_REGION': 'us-west-2',
        'CORS_ORIGINS': 'http://test.com'
    })
    def test_configuration_integration_with_server(self, client):
        """Test configuration integration with server."""
        # The server should use the configuration
        response = client.get('/api/health')
        
        assert response.status_code == 200
        # CORS header should reflect the configured origin
        assert 'Access-Control-Allow-Origin' in response.headers
    
    def test_bedrock_model_configuration_integration(self):
        """Test Bedrock model configuration integration."""
        from config import get_config
        from bedrock_service import BedrockService
        
        config = get_config()
        
        # Verify configuration values are reasonable
        assert config.CLAUDE_MODEL_ID.startswith('anthropic.')
        assert config.NOVA_MODEL_ID.startswith('amazon.')
        
        # These should be valid model IDs
        assert ':' in config.CLAUDE_MODEL_ID
        assert ':' in config.NOVA_MODEL_ID


@pytest.mark.integration
@pytest.mark.aws
class TestAWSIntegration:
    """Integration tests that require AWS credentials (marked as aws)."""
    
    def test_aws_credentials_check_integration(self, client):
        """Test AWS credentials check integration."""
        # This test requires actual AWS credentials
        response = client.get('/api/check-aws-credentials')
        
        # Should return either success or failure, but not crash
        assert response.status_code in [200, 500]
        
        data = json.loads(response.data)
        assert 'success' in data
    
    @patch('server.bedrock_service')
    def test_bedrock_access_check_integration(self, mock_bedrock, client):
        """Test Bedrock access check integration."""
        mock_bedrock.check_bedrock_access.return_value = {
            'success': True,
            'models': ['claude-3-sonnet', 'nova-canvas']
        }
        
        response = client.get('/api/check-bedrock-access')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'models' in data


@pytest.mark.integration
class TestPerformanceIntegration:
    """Integration tests for performance characteristics."""
    
    def test_concurrent_requests_handling(self, client):
        """Test handling of concurrent requests."""
        import threading
        import time
        
        results = []
        
        def make_request():
            response = client.get('/api/health')
            results.append(response.status_code)
        
        # Create multiple threads
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
        
        # Start all threads
        start_time = time.time()
        for thread in threads:
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        end_time = time.time()
        
        # All requests should succeed
        assert all(status == 200 for status in results)
        assert len(results) == 5
        
        # Should complete reasonably quickly
        assert end_time - start_time < 5.0  # 5 seconds max
    
    @patch('server.bedrock_service')
    def test_large_prompt_handling(self, mock_bedrock, client):
        """Test handling of large prompts."""
        mock_bedrock.generate_description.return_value = {
            'success': True,
            'description': 'Generated description for large prompt'
        }
        
        # Create a large prompt (but not too large to avoid timeout)
        large_prompt = "Create a complex dashboard " * 100  # ~2500 characters
        
        response = client.post('/api/generate-description', 
                             json={'prompt': large_prompt})
        
        # Should handle large prompts gracefully
        assert response.status_code in [200, 400, 500]
        
        if response.status_code == 200:
            data = json.loads(response.data)
            assert 'success' in data
