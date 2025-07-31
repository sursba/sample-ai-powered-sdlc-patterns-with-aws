#!/usr/bin/env python3
"""
Helper script to create AWS credentials file if it doesn't exist.
This can help resolve issues with AWS credentials not being found.
"""

import os
import configparser
import getpass

def create_aws_credentials():
    """Create AWS credentials file if it doesn't exist."""
    # Get user's home directory
    home_dir = os.path.expanduser("~")
    aws_dir = os.path.join(home_dir, ".aws")
    credentials_file = os.path.join(aws_dir, "credentials")
    config_file = os.path.join(aws_dir, "config")
    
    # Create .aws directory if it doesn't exist
    if not os.path.exists(aws_dir):
        os.makedirs(aws_dir)
        print(f"Created directory: {aws_dir}")
    
    # Check if credentials file exists
    if os.path.exists(credentials_file):
        print(f"AWS credentials file already exists at: {credentials_file}")
        overwrite = input("Do you want to overwrite it? (y/n): ")
        if overwrite.lower() != 'y':
            print("Skipping credentials file creation.")
            return
    
    # Get AWS credentials from user
    print("\n=== AWS Credentials Setup ===")
    print("Please enter your AWS credentials:")
    aws_access_key = getpass.getpass("AWS Access Key ID: ")
    aws_secret_key = getpass.getpass("AWS Secret Access Key: ")
    
    # Create credentials file
    credentials = configparser.ConfigParser()
    credentials['default'] = {
        'aws_access_key_id': aws_access_key,
        'aws_secret_access_key': aws_secret_key
    }
    
    with open(credentials_file, 'w') as f:
        credentials.write(f)
    
    os.chmod(credentials_file, 0o600)  # Set permissions to user read/write only
    print(f"AWS credentials file created at: {credentials_file}")
    
    # Check if config file exists
    if os.path.exists(config_file):
        print(f"AWS config file already exists at: {config_file}")
    else:
        # Get AWS region from user
        print("\n=== AWS Config Setup ===")
        aws_region = input("AWS Region (e.g., us-east-1): ") or "us-east-1"
        
        # Create config file
        config = configparser.ConfigParser()
        config['default'] = {
            'region': aws_region,
            'output': 'json'
        }
        
        with open(config_file, 'w') as f:
            config.write(f)
        
        os.chmod(config_file, 0o600)  # Set permissions to user read/write only
        print(f"AWS config file created at: {config_file}")
    
    print("\nAWS credentials setup complete!")
    print("You can now use the AWS CLI and SDK with these credentials.")

if __name__ == "__main__":
    create_aws_credentials()
