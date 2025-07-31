"""
Unit tests for the configuration module.
"""

import pytest
import os
from unittest.mock import patch

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from config import Config, get_config


@pytest.mark.unit
class TestConfig:
    """Test the Config class."""
    
    def test_default_values(self):
        """Test default configuration values."""
        config = Config()
        
        assert config.AWS_REGION == 'us-east-1'
        assert config.CORS_ORIGINS == ['http://localhost:3000', 'http://localhost:8000']
        assert config.CLAUDE_MODEL_ID == 'anthropic.claude-3-sonnet-20240229-v1:0'
        assert config.NOVA_MODEL_ID == 'amazon.nova-canvas-v1:0'
        assert config.MAX_IMAGE_SIZE == 5 * 1024 * 1024  # 5MB
        assert config.ALLOWED_IMAGE_FORMATS == ['png', 'jpg', 'jpeg', 'gif', 'webp']
        assert config.DEFAULT_IMAGE_WIDTH == 1024
        assert config.DEFAULT_IMAGE_HEIGHT == 1024
        assert config.MAX_IMAGES_PER_REQUEST == 8
        assert config.REQUEST_TIMEOUT == 300
    
    @patch.dict(os.environ, {
        'AWS_REGION': 'us-west-2',
        'CORS_ORIGINS': 'http://example.com,https://app.example.com',
        'CLAUDE_MODEL_ID': 'custom-claude-model',
        'NOVA_MODEL_ID': 'custom-nova-model'
    })
    def test_environment_variable_override(self):
        """Test configuration override from environment variables."""
        config = Config()
        
        assert config.AWS_REGION == 'us-west-2'
        assert config.CORS_ORIGINS == ['http://example.com', 'https://app.example.com']
        assert config.CLAUDE_MODEL_ID == 'custom-claude-model'
        assert config.NOVA_MODEL_ID == 'custom-nova-model'
    
    @patch.dict(os.environ, {
        'MAX_IMAGE_SIZE': '10485760',  # 10MB
        'MAX_IMAGES_PER_REQUEST': '4',
        'REQUEST_TIMEOUT': '600'
    })
    def test_numeric_environment_variables(self):
        """Test numeric configuration from environment variables."""
        config = Config()
        
        assert config.MAX_IMAGE_SIZE == 10485760
        assert config.MAX_IMAGES_PER_REQUEST == 4
        assert config.REQUEST_TIMEOUT == 600
    
    @patch.dict(os.environ, {
        'ALLOWED_IMAGE_FORMATS': 'png,jpg,svg'
    })
    def test_list_environment_variables(self):
        """Test list configuration from environment variables."""
        config = Config()
        
        assert config.ALLOWED_IMAGE_FORMATS == ['png', 'jpg', 'svg']
    
    @patch.dict(os.environ, {
        'MAX_IMAGE_SIZE': 'invalid',
        'MAX_IMAGES_PER_REQUEST': 'not_a_number'
    })
    def test_invalid_numeric_environment_variables(self):
        """Test handling of invalid numeric environment variables."""
        config = Config()
        
        # Should fall back to defaults when invalid values are provided
        assert config.MAX_IMAGE_SIZE == 5 * 1024 * 1024  # Default
        assert config.MAX_IMAGES_PER_REQUEST == 8  # Default
    
    def test_cors_origins_single_value(self):
        """Test CORS origins with single value."""
        with patch.dict(os.environ, {'CORS_ORIGINS': 'http://single-origin.com'}):
            config = Config()
            assert config.CORS_ORIGINS == ['http://single-origin.com']
    
    def test_cors_origins_empty_value(self):
        """Test CORS origins with empty value."""
        with patch.dict(os.environ, {'CORS_ORIGINS': ''}):
            config = Config()
            # Should fall back to default
            assert config.CORS_ORIGINS == ['http://localhost:3000', 'http://localhost:8000']
    
    def test_allowed_formats_empty_value(self):
        """Test allowed image formats with empty value."""
        with patch.dict(os.environ, {'ALLOWED_IMAGE_FORMATS': ''}):
            config = Config()
            # Should fall back to default
            assert config.ALLOWED_IMAGE_FORMATS == ['png', 'jpg', 'jpeg', 'gif', 'webp']
    
    def test_config_validation(self):
        """Test configuration validation."""
        config = Config()
        
        # Test that all required attributes exist
        required_attrs = [
            'AWS_REGION', 'CORS_ORIGINS', 'CLAUDE_MODEL_ID', 'NOVA_MODEL_ID',
            'MAX_IMAGE_SIZE', 'ALLOWED_IMAGE_FORMATS', 'DEFAULT_IMAGE_WIDTH',
            'DEFAULT_IMAGE_HEIGHT', 'MAX_IMAGES_PER_REQUEST', 'REQUEST_TIMEOUT'
        ]
        
        for attr in required_attrs:
            assert hasattr(config, attr), f"Config missing required attribute: {attr}"
            assert getattr(config, attr) is not None, f"Config attribute {attr} is None"
    
    def test_config_types(self):
        """Test configuration value types."""
        config = Config()
        
        assert isinstance(config.AWS_REGION, str)
        assert isinstance(config.CORS_ORIGINS, list)
        assert isinstance(config.CLAUDE_MODEL_ID, str)
        assert isinstance(config.NOVA_MODEL_ID, str)
        assert isinstance(config.MAX_IMAGE_SIZE, int)
        assert isinstance(config.ALLOWED_IMAGE_FORMATS, list)
        assert isinstance(config.DEFAULT_IMAGE_WIDTH, int)
        assert isinstance(config.DEFAULT_IMAGE_HEIGHT, int)
        assert isinstance(config.MAX_IMAGES_PER_REQUEST, int)
        assert isinstance(config.REQUEST_TIMEOUT, int)
    
    def test_config_reasonable_values(self):
        """Test that configuration values are reasonable."""
        config = Config()
        
        # Test reasonable ranges
        assert 0 < config.MAX_IMAGE_SIZE <= 100 * 1024 * 1024  # Up to 100MB
        assert 0 < config.DEFAULT_IMAGE_WIDTH <= 4096
        assert 0 < config.DEFAULT_IMAGE_HEIGHT <= 4096
        assert 0 < config.MAX_IMAGES_PER_REQUEST <= 100
        assert 0 < config.REQUEST_TIMEOUT <= 3600  # Up to 1 hour
        
        # Test that lists are not empty
        assert len(config.CORS_ORIGINS) > 0
        assert len(config.ALLOWED_IMAGE_FORMATS) > 0
        
        # Test that strings are not empty
        assert len(config.AWS_REGION) > 0
        assert len(config.CLAUDE_MODEL_ID) > 0
        assert len(config.NOVA_MODEL_ID) > 0


@pytest.mark.unit
class TestGetConfig:
    """Test the get_config function."""
    
    def test_get_config_returns_config_instance(self):
        """Test that get_config returns a Config instance."""
        config = get_config()
        
        assert isinstance(config, Config)
    
    def test_get_config_singleton_behavior(self):
        """Test that get_config returns the same instance (singleton behavior)."""
        config1 = get_config()
        config2 = get_config()
        
        # Should return the same instance
        assert config1 is config2
    
    @patch.dict(os.environ, {'AWS_REGION': 'test-region'})
    def test_get_config_with_environment_override(self):
        """Test get_config with environment variable override."""
        # Clear any cached config first
        if hasattr(get_config, '_config'):
            delattr(get_config, '_config')
        
        config = get_config()
        
        assert config.AWS_REGION == 'test-region'
    
    def test_get_config_caching(self):
        """Test that get_config caches the configuration."""
        # Clear any cached config first
        if hasattr(get_config, '_config'):
            delattr(get_config, '_config')
        
        # First call should create the config
        config1 = get_config()
        
        # Modify environment and call again
        with patch.dict(os.environ, {'AWS_REGION': 'different-region'}):
            config2 = get_config()
        
        # Should return the same cached instance, not affected by env change
        assert config1 is config2
        assert config1.AWS_REGION == config2.AWS_REGION


@pytest.mark.unit
class TestConfigurationEdgeCases:
    """Test edge cases in configuration."""
    
    @patch.dict(os.environ, {
        'DEFAULT_IMAGE_WIDTH': '0',
        'DEFAULT_IMAGE_HEIGHT': '0'
    })
    def test_zero_dimensions(self):
        """Test handling of zero dimensions."""
        config = Config()
        
        # Should fall back to reasonable defaults
        assert config.DEFAULT_IMAGE_WIDTH > 0
        assert config.DEFAULT_IMAGE_HEIGHT > 0
    
    @patch.dict(os.environ, {
        'MAX_IMAGES_PER_REQUEST': '0'
    })
    def test_zero_max_images(self):
        """Test handling of zero max images."""
        config = Config()
        
        # Should fall back to reasonable default
        assert config.MAX_IMAGES_PER_REQUEST > 0
    
    @patch.dict(os.environ, {
        'REQUEST_TIMEOUT': '0'
    })
    def test_zero_timeout(self):
        """Test handling of zero timeout."""
        config = Config()
        
        # Should fall back to reasonable default
        assert config.REQUEST_TIMEOUT > 0
    
    @patch.dict(os.environ, {
        'CORS_ORIGINS': 'http://example.com,,https://app.example.com'
    })
    def test_cors_origins_with_empty_values(self):
        """Test CORS origins with empty values in the list."""
        config = Config()
        
        # Should filter out empty values
        expected = ['http://example.com', 'https://app.example.com']
        assert config.CORS_ORIGINS == expected
    
    @patch.dict(os.environ, {
        'ALLOWED_IMAGE_FORMATS': 'png,,jpg,,'
    })
    def test_allowed_formats_with_empty_values(self):
        """Test allowed formats with empty values in the list."""
        config = Config()
        
        # Should filter out empty values
        expected = ['png', 'jpg']
        assert config.ALLOWED_IMAGE_FORMATS == expected
    
    def test_config_immutability(self):
        """Test that configuration values don't change unexpectedly."""
        config1 = get_config()
        original_region = config1.AWS_REGION
        
        # Get config again
        config2 = get_config()
        
        # Values should be the same
        assert config2.AWS_REGION == original_region
    
    @patch.dict(os.environ, {
        'CLAUDE_MODEL_ID': '',
        'NOVA_MODEL_ID': ''
    })
    def test_empty_model_ids(self):
        """Test handling of empty model IDs."""
        config = Config()
        
        # Should fall back to defaults
        assert len(config.CLAUDE_MODEL_ID) > 0
        assert len(config.NOVA_MODEL_ID) > 0
        assert config.CLAUDE_MODEL_ID == 'anthropic.claude-3-sonnet-20240229-v1:0'
        assert config.NOVA_MODEL_ID == 'amazon.nova-canvas-v1:0'


@pytest.mark.unit
class TestConfigurationSecurity:
    """Test security-related configuration aspects."""
    
    def test_cors_origins_security(self):
        """Test CORS origins for security considerations."""
        config = Config()
        
        # Should not allow wildcard by default
        assert '*' not in config.CORS_ORIGINS
        
        # Should use specific origins
        for origin in config.CORS_ORIGINS:
            assert origin.startswith('http://') or origin.startswith('https://')
    
    def test_model_ids_format(self):
        """Test that model IDs follow expected format."""
        config = Config()
        
        # Claude model ID should follow AWS Bedrock format
        assert '.' in config.CLAUDE_MODEL_ID
        assert ':' in config.CLAUDE_MODEL_ID
        
        # Nova model ID should follow AWS Bedrock format
        assert '.' in config.NOVA_MODEL_ID
        assert ':' in config.NOVA_MODEL_ID
    
    def test_reasonable_limits(self):
        """Test that limits are reasonable for security."""
        config = Config()
        
        # Image size should have reasonable upper limit
        assert config.MAX_IMAGE_SIZE <= 50 * 1024 * 1024  # 50MB max
        
        # Number of images should be limited
        assert config.MAX_IMAGES_PER_REQUEST <= 20
        
        # Timeout should be reasonable
        assert config.REQUEST_TIMEOUT <= 1800  # 30 minutes max
