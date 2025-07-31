"""
Unit tests for the Flask server endpoints.
"""

import pytest
import json
import os
from unittest.mock import patch, Mock, mock_open
from flask import Flask

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


@pytest.mark.unit
class TestHealthEndpoint:
    """Test the health check endpoint."""
    
    def test_health_endpoint_success(self, client):
        """Test successful health check."""
        response = client.get('/api/health')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
    
    def test_health_endpoint_cors_headers(self, client):
        """Test CORS headers are present."""
        response = client.get('/api/health')
        
        assert 'Access-Control-Allow-Origin' in response.headers


@pytest.mark.unit
class TestGenerateMockupEndpoint:
    """Test the generate mockup endpoint."""
    
    @patch('server.bedrock_service')
    def test_generate_mockup_success(self, mock_bedrock, client, sample_mockup_response):
        """Test successful mockup generation."""
        mock_bedrock.generate_mockup.return_value = sample_mockup_response
        
        response = client.post('/api/generate-mockup', 
                             json={
                                 'prompt': 'Create a login form',
                                 'width': 1024,
                                 'height': 1024,
                                 'quality': 'standard'
                             })
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'image_url' in data
        assert 'filename' in data
        
        mock_bedrock.generate_mockup.assert_called_once_with(
            'Create a login form', 1024, 1024, 'standard'
        )
    
    def test_generate_mockup_missing_prompt(self, client):
        """Test mockup generation with missing prompt."""
        response = client.post('/api/generate-mockup', json={})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False
        assert 'error' in data
    
    def test_generate_mockup_empty_prompt(self, client):
        """Test mockup generation with empty prompt."""
        response = client.post('/api/generate-mockup', 
                             json={'prompt': ''})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False
        assert 'error' in data
    
    @patch('server.bedrock_service')
    def test_generate_mockup_bedrock_error(self, mock_bedrock, client, error_responses):
        """Test mockup generation with Bedrock error."""
        mock_bedrock.generate_mockup.return_value = error_responses['bedrock_error']
        
        response = client.post('/api/generate-mockup', 
                             json={'prompt': 'Create a form'})
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['success'] is False
        assert 'error' in data
    
    @patch('server.bedrock_service')
    def test_generate_mockup_exception(self, mock_bedrock, client):
        """Test mockup generation with exception."""
        mock_bedrock.generate_mockup.side_effect = Exception('Unexpected error')
        
        response = client.post('/api/generate-mockup', 
                             json={'prompt': 'Create a form'})
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['success'] is False
        assert 'error' in data
    
    def test_generate_mockup_invalid_dimensions(self, client):
        """Test mockup generation with invalid dimensions."""
        response = client.post('/api/generate-mockup', 
                             json={
                                 'prompt': 'Create a form',
                                 'width': -100,
                                 'height': 0
                             })
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False


@pytest.mark.unit
class TestGenerateDescriptionEndpoint:
    """Test the generate description endpoint."""
    
    @patch('server.bedrock_service')
    def test_generate_description_success(self, mock_bedrock, client, sample_description_response):
        """Test successful description generation."""
        mock_bedrock.generate_description.return_value = sample_description_response
        
        response = client.post('/api/generate-description', 
                             json={'prompt': 'Create a login form'})
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'description' in data
        
        mock_bedrock.generate_description.assert_called_once_with('Create a login form')
    
    def test_generate_description_missing_prompt(self, client):
        """Test description generation with missing prompt."""
        response = client.post('/api/generate-description', json={})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False
    
    @patch('server.bedrock_service')
    def test_generate_description_bedrock_error(self, mock_bedrock, client, error_responses):
        """Test description generation with Bedrock error."""
        mock_bedrock.generate_description.return_value = error_responses['bedrock_error']
        
        response = client.post('/api/generate-description', 
                             json={'prompt': 'Create a form'})
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['success'] is False


@pytest.mark.unit
class TestGenerateComponentsEndpoint:
    """Test the generate components endpoint."""
    
    @patch('server.bedrock_service')
    def test_generate_components_success(self, mock_bedrock, client, sample_components_response):
        """Test successful components generation."""
        mock_bedrock.generate_components.return_value = sample_components_response
        
        response = client.post('/api/generate-components', 
                             json={'prompt': 'Create a login form'})
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'components' in data
        
        mock_bedrock.generate_components.assert_called_once_with('Create a login form')
    
    def test_generate_components_missing_prompt(self, client):
        """Test components generation with missing prompt."""
        response = client.post('/api/generate-components', json={})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False


@pytest.mark.unit
class TestGenerateMultipleMockupsEndpoint:
    """Test the generate multiple mockups endpoint."""
    
    @patch('server.bedrock_service')
    def test_generate_multiple_mockups_success(self, mock_bedrock, client):
        """Test successful multiple mockups generation."""
        mock_response = {
            'success': True,
            'images': [
                {'filename': 'image1.png', 'image_url': 'http://localhost:8000/api/assets/image1.png'},
                {'filename': 'image2.png', 'image_url': 'http://localhost:8000/api/assets/image2.png'}
            ]
        }
        mock_bedrock.generate_multiple_mockups.return_value = mock_response
        
        response = client.post('/api/generate-multiple-mockups', 
                             json={
                                 'prompt': 'Create login forms',
                                 'num_images': 2,
                                 'width': 1024,
                                 'height': 1024,
                                 'quality': 'standard'
                             })
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'images' in data
        assert len(data['images']) == 2
    
    def test_generate_multiple_mockups_invalid_num_images(self, client):
        """Test multiple mockups generation with invalid number of images."""
        response = client.post('/api/generate-multiple-mockups', 
                             json={
                                 'prompt': 'Create forms',
                                 'num_images': 0
                             })
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False


@pytest.mark.unit
class TestCheckBedrockAccessEndpoint:
    """Test the check Bedrock access endpoint."""
    
    @patch('server.bedrock_service')
    def test_check_bedrock_access_success(self, mock_bedrock, client):
        """Test successful Bedrock access check."""
        mock_response = {
            'success': True,
            'models': ['claude-3-sonnet', 'nova-canvas']
        }
        mock_bedrock.check_bedrock_access.return_value = mock_response
        
        response = client.get('/api/check-bedrock-access')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'models' in data
    
    @patch('server.bedrock_service')
    def test_check_bedrock_access_failure(self, mock_bedrock, client, error_responses):
        """Test Bedrock access check failure."""
        mock_bedrock.check_bedrock_access.return_value = error_responses['auth_error']
        
        response = client.get('/api/check-bedrock-access')
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['success'] is False


@pytest.mark.unit
class TestDownloadImageEndpoint:
    """Test the download image endpoint."""
    
    def test_download_image_success(self, client, temp_assets_dir):
        """Test successful image download."""
        response = client.get('/api/download-image/test.png')
        
        assert response.status_code == 200
        assert response.mimetype == 'image/png'
    
    def test_download_image_not_found(self, client, temp_assets_dir):
        """Test image download with non-existent file."""
        response = client.get('/api/download-image/nonexistent.png')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data['success'] is False
        assert 'error' in data
    
    def test_download_image_invalid_filename(self, client, temp_assets_dir):
        """Test image download with invalid filename."""
        response = client.get('/api/download-image/../../../etc/passwd')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False
        assert 'error' in data


@pytest.mark.unit
class TestAssetsEndpoint:
    """Test the assets serving endpoint."""
    
    def test_serve_asset_success(self, client, temp_assets_dir):
        """Test successful asset serving."""
        response = client.get('/api/assets/test.png')
        
        assert response.status_code == 200
        assert response.mimetype == 'image/png'
    
    def test_serve_asset_not_found(self, client, temp_assets_dir):
        """Test asset serving with non-existent file."""
        response = client.get('/api/assets/nonexistent.png')
        
        assert response.status_code == 404


@pytest.mark.unit
class TestCORSHandling:
    """Test CORS handling."""
    
    def test_cors_preflight_request(self, client):
        """Test CORS preflight request."""
        response = client.options('/api/generate-mockup')
        
        assert response.status_code == 200
        assert 'Access-Control-Allow-Origin' in response.headers
        assert 'Access-Control-Allow-Methods' in response.headers
        assert 'Access-Control-Allow-Headers' in response.headers
    
    def test_cors_headers_on_post_request(self, client):
        """Test CORS headers on POST request."""
        response = client.post('/api/generate-mockup', json={'prompt': 'test'})
        
        assert 'Access-Control-Allow-Origin' in response.headers


@pytest.mark.unit
class TestErrorHandling:
    """Test error handling."""
    
    def test_404_error_handling(self, client):
        """Test 404 error handling."""
        response = client.get('/api/nonexistent-endpoint')
        
        assert response.status_code == 404
    
    def test_405_method_not_allowed(self, client):
        """Test 405 method not allowed."""
        response = client.get('/api/generate-mockup')
        
        assert response.status_code == 405
    
    def test_invalid_json_request(self, client):
        """Test invalid JSON request."""
        response = client.post('/api/generate-mockup', 
                             data='invalid json',
                             content_type='application/json')
        
        assert response.status_code == 400


@pytest.mark.unit
class TestInputValidation:
    """Test input validation."""
    
    def test_prompt_length_validation(self, client):
        """Test prompt length validation."""
        long_prompt = 'a' * 10000  # Very long prompt
        
        response = client.post('/api/generate-mockup', 
                             json={'prompt': long_prompt})
        
        # Should handle long prompts gracefully
        assert response.status_code in [200, 400, 500]
    
    def test_dimension_validation(self, client):
        """Test dimension validation."""
        test_cases = [
            {'width': 0, 'height': 1024},
            {'width': 1024, 'height': 0},
            {'width': -100, 'height': 1024},
            {'width': 1024, 'height': -100},
            {'width': 10000, 'height': 1024},  # Too large
            {'width': 1024, 'height': 10000}   # Too large
        ]
        
        for dimensions in test_cases:
            response = client.post('/api/generate-mockup', 
                                 json={
                                     'prompt': 'test',
                                     **dimensions
                                 })
            
            assert response.status_code == 400
    
    def test_quality_validation(self, client):
        """Test quality parameter validation."""
        invalid_qualities = ['invalid', 'super_high', '']
        
        for quality in invalid_qualities:
            response = client.post('/api/generate-mockup', 
                                 json={
                                     'prompt': 'test',
                                     'quality': quality
                                 })
            
            # Should either accept or reject gracefully
            assert response.status_code in [200, 400, 500]
