"""
Configuration module for the UI Generator application.

This module provides configuration settings for different environments:
- development: Used during development (default)
- production: Used in production environments
- testing: Used for testing

Usage:
    from config import get_config
    config = get_config()
    app.run(host=config.HOST, port=config.PORT)
"""

import os
from dataclasses import dataclass

@dataclass
class Config:
    """Base configuration class with common settings."""
    # Flask settings
    HOST: str = '0.0.0.0'  # Bind to all interfaces
    PORT: int = 8000
    DEBUG: bool = False
    TESTING: bool = False
    
    # AWS settings
    # In Lambda, the region can be extracted from the function ARN if not explicitly set
    AWS_REGION: str = os.environ.get('AWS_REGION', 'us-east-1')
    # Flag to indicate if running in Lambda
    IS_LAMBDA: bool = 'AWS_LAMBDA_FUNCTION_NAME' in os.environ
    
    # CORS settings
    CORS_ORIGINS: str = '*'  # In production, this should be restricted
    
    # API settings
    API_PREFIX: str = '/api'
    
    # Frontend settings
    FRONTEND_URL: str = 'http://localhost:3000'
    
    # Assets directory
    ASSETS_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                                 'frontend', 'src', 'assets', 'generated')

@dataclass
class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG: bool = True
    
@dataclass
class ProductionConfig(Config):
    """Production configuration."""
    DEBUG: bool = False
    # In production, CORS should be restricted to specific origins
    CORS_ORIGINS: str = os.environ.get('ALLOWED_ORIGINS', '*')

@dataclass
class TestingConfig(Config):
    """Testing configuration."""
    TESTING: bool = True
    DEBUG: bool = True

def get_config():
    """Return the appropriate configuration based on the environment."""
    env = os.environ.get('FLASK_ENV', 'development')
    
    if env == 'production':
        return ProductionConfig()
    elif env == 'testing':
        return TestingConfig()
    else:
        return DevelopmentConfig()