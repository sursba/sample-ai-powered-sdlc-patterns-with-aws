# architecture_template.py
import os
import logging
from datetime import datetime
from io import BytesIO
import boto3
from fpdf import FPDF
import json
from PIL import Image
import tempfile
import traceback
import textwrap
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def sanitize_text(text):
    """Convert Unicode characters to ASCII equivalents"""
    if not text:
        return ""
    
    # Replace common Unicode characters with ASCII equivalents
    replacements = {
        '•': '*',
        '–': '-',
        '—': '--',
        '"': '"',
        '"': '"',
        ''': "'",
        ''': "'",
        '…': '...',
        '™': '(TM)',
        '®': '(R)',
        '©': '(C)',
        '°': ' degrees',
        '±': '+/-',
        '×': 'x',
        '÷': '/',
        '≤': '<=',
        '≥': '>=',
        '≠': '!=',
        '→': '->',
        '←': '<-',
        '↔': '<->',
        '⇒': '=>',
        '⇐': '<=',
        '⇔': '<=>',
    }
    
    # Replace Unicode characters
    for unicode_char, ascii_char in replacements.items():
        text = text.replace(unicode_char, ascii_char)
    
    # Remove any remaining non-ASCII characters
    text = text.encode('ascii', 'ignore').decode('ascii')
    
    return text

def extract_services_from_text(text):
    """Extract AWS services mentioned in the text"""
    services = []
    
    # Common AWS services to look for
    service_patterns = [
        'Lambda', 'EC2', 'S3', 'RDS', 'DynamoDB', 'CloudFront', 'Route53',
        'API Gateway', 'ECS', 'Fargate', 'ElastiCache', 'Redis', 'SQS', 'SNS',
        'Kinesis', 'CloudWatch', 'WAF', 'GuardDuty', 'VPC', 'ALB', 'NLB',
        'Cognito', 'Secrets Manager', 'KMS', 'CloudTrail', 'EventBridge',
        'Step Functions', 'Glue', 'Athena', 'QuickSight', 'SageMaker'
    ]
    
    text_lower = text.lower()
    for service in service_patterns:
        if service.lower() in text_lower:
            services.append(service)
    
    return list(set(services))  # Remove duplicates

def analyze_architecture_from_response(response_text, traces):
    """Analyze the architecture from agent response and traces"""
    architecture_info = {
        'services': [],
        'patterns': [],
        'layers': {},
        'security_features': [],
        'scalability_features': [],
        'data_stores': [],
        'compute_services': [],
        'networking': []
    }
    
    # Extract services from response
    architecture_info['services'] = extract_services_from_text(response_text)
    
    # Analyze patterns and features
    if 'lambda' in response_text.lower():
        architecture_info['patterns'].append('Serverless')
        architecture_info['compute_services'].append('AWS Lambda')
    
    if 'ecs' in response_text.lower() or 'fargate' in response_text.lower():
        architecture_info['patterns'].append('Container-based Microservices')
        architecture_info['compute_services'].append('Amazon ECS/Fargate')
    
    if 'rds' in response_text.lower():
        architecture_info['data_stores'].append('Amazon RDS (Relational Database)')
    
    if 'dynamodb' in response_text.lower():
        architecture_info['data_stores'].append('Amazon DynamoDB (NoSQL)')
        architecture_info['patterns'].append('NoSQL for Session Management')
    
    if 'cloudfront' in response_text.lower():
        architecture_info['patterns'].append('Global Content Delivery')
        architecture_info['networking'].append('CloudFront CDN')
    
    if 'waf' in response_text.lower():
        architecture_info['security_features'].append('Web Application Firewall (WAF)')
    
    if 'guardduty' in response_text.lower():
        architecture_info['security_features'].append('Threat Detection (GuardDuty)')
    
    if 'multi-az' in response_text.lower():
        architecture_info['scalability_features'].append('Multi-AZ Deployment')
    
    if 'auto' in response_text.lower() and 'scal' in response_text.lower():
        architecture_info['scalability_features'].append('Auto Scaling')
    
    # Analyze traces for additional information
    for trace in traces:
        if isinstance(trace, dict) and 'text' in trace:
            trace_text = trace['text']
            # Extract additional services from traces
            trace_services = extract_services_from_text(trace_text)
            architecture_info['services'].extend(trace_services)
    
    # Remove duplicates
    architecture_info['services'] = list(set(architecture_info['services']))
    
    return architecture_info

def generate_dynamic_cloudformation(architecture_info):
    """Generate CloudFormation template based on detected architecture"""
    services = architecture_info.get('services', [])
    
    template = """AWSTemplateFormatVersion: '2010-09-09'
Description: 'Auto-generated CloudFormation template based on architecture design'

Parameters:
  EnvironmentName:
    Type: String
    Default: Production
    Description: Environment name prefix

Resources:"""
    
    # Add VPC if any networking services are used
    if any(svc in services for svc in ['VPC', 'ALB', 'NLB', 'ECS', 'RDS']):
        template += """
  # VPC Configuration
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsSupport: true
      EnableDnsHostnames: true
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-VPC

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true

  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [0, !GetAZs '']"""
    
    # Add RDS if detected
    if 'RDS' in services:
        template += """

  # RDS Database
  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub ${EnvironmentName}-db
      AllocatedStorage: 100
      DBInstanceClass: db.t3.medium
      Engine: postgres
      MasterUsername: admin
      MasterUserPassword: !Ref DBPassword
      VPCSecurityGroups:
        - !Ref DatabaseSecurityGroup"""
    
    # Add DynamoDB if detected
    if 'DynamoDB' in services:
        template += """

  # DynamoDB Table
  DynamoDBTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub ${EnvironmentName}-table
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH"""
    
    # Add S3 if detected
    if 'S3' in services:
        template += """

  # S3 Bucket
  S3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub ${EnvironmentName}-assets-${AWS::AccountId}
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true"""
    
    # Add Lambda if detected
    if 'Lambda' in services:
        template += """

  # Lambda Function
  LambdaFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub ${EnvironmentName}-function
      Runtime: python3.9
      Handler: index.handler
      Code:
        ZipFile: |
          import json
          def handler(event, context):
              return {
                  'statusCode': 200,
                  'body': json.dumps('Hello from Lambda!')
              }
      Role: !GetAtt LambdaExecutionRole.Arn"""
    
    template += """

Outputs:
  EnvironmentName:
    Description: Environment Name
    Value: !Ref EnvironmentName"""
    
    return template

class EnhancedPDF(FPDF):
    def __init__(self):
        super().__init__()
        # Set margins properly
        self.set_margins(20, 20, 20)
        self.set_auto_page_break(True, margin=25)
        self.toc_entries = []
        self.chapter_count = 0
        
    def header(self):
        # Save position
        x = self.get_x()
        y = self.get_y()
        
        # AWS Orange color
        self.set_fill_color(255, 153, 0)
        self.rect(0, 0, 210, 20, 'F')
        
        # Title
        self.set_font("helvetica", "B", 16)
        self.set_text_color(255, 255, 255)
        self.set_y(5)
        self.cell(0, 10, 'AWS Architecture Document', 0, 0, 'C')
        
        # Reset text color and position
        self.set_text_color(0, 0, 0)
        self.set_xy(20, 30)

    def footer(self):
        self.set_y(-20)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        
        # Add page number
        page_text = f'Page {self.page_no()}'
        self.cell(0, 10, page_text, 0, 0, 'C')
        
        # Add timestamp
        self.set_x(20)
        date_text = f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M")}'
        self.cell(0, 10, date_text, 0, 0, 'L')
        
        # Reset text color
        self.set_text_color(0, 0, 0)

    def chapter_title(self, num, title, level=1):
        # Ensure we have space for the title
        if self.get_y() > 250:
            self.add_page()
        
        # Sanitize title
        title = sanitize_text(title)
        
        # Add to TOC
        self.toc_entries.append({
            'level': level,
            'title': title,
            'page': self.page_no(),
            'num': num
        })
        
        if level == 1:
            self.ln(5)
            self.set_font("helvetica", "B", 16)
            self.set_fill_color(255, 153, 0)
            self.set_text_color(255, 255, 255)
            self.cell(0, 12, f'{num}. {title}', 0, 1, 'L', 1)
            self.set_text_color(0, 0, 0)
            self.ln(3)
        elif level == 2:
            self.set_font("helvetica", "B", 14)
            self.set_text_color(80, 80, 80)
            self.cell(0, 10, f'{num} {title}', 0, 1, 'L')
            self.set_text_color(0, 0, 0)
            self.ln(2)
        else:
            self.set_font("helvetica", "B", 12)
            self.set_text_color(100, 100, 100)
            self.cell(0, 8, f'{num} {title}', 0, 1, 'L')
            self.set_text_color(0, 0, 0)
            self.ln(1)

    def chapter_body(self, text, indent=0):
        # Set font and ensure we're in the right position
        self.set_font("helvetica", "", 11)
        
        # Convert text to string and handle None
        if text is None:
            text = ""
        text = sanitize_text(str(text))
        
        # Split text into paragraphs
        paragraphs = text.split('\n')
        
        for paragraph in paragraphs:
            if not paragraph.strip():
                self.ln(3)
                continue
            
            # Handle indentation
            if indent > 0:
                self.set_x(self.get_x() + indent)
            
            # Use textwrap to properly wrap text
            effective_width = int((self.w - self.l_margin - self.r_margin - indent) / 2)
            wrapped_lines = textwrap.wrap(paragraph, width=effective_width, break_long_words=False)
            
            for line in wrapped_lines:
                # Check if we need a new page
                if self.get_y() > 270:
                    self.add_page()
                
                if indent > 0:
                    self.set_x(self.l_margin + indent)
                    
                self.cell(0, 5, line, 0, 1)
                
        self.ln(2)

    def add_bullet_list(self, items):
        """Add a bullet point list"""
        self.set_font("helvetica", "", 11)
        for item in items:
            if self.get_y() > 270:
                self.add_page()
            
            # Add bullet
            self.set_x(self.l_margin + 5)
            self.cell(5, 5, '*', 0, 0)
            
            # Add text
            item_text = sanitize_text(str(item))
            wrapped_lines = textwrap.wrap(item_text, width=75)
            
            for i, line in enumerate(wrapped_lines):
                if i == 0:
                    self.cell(0, 5, line, 0, 1)
                else:
                    if self.get_y() > 270:
                        self.add_page()
                    self.set_x(self.l_margin + 10)
                    self.cell(0, 5, line, 0, 1)
        
        self.ln(2)

    def add_code_block(self, code, language="yaml"):
        # Ensure we have space
        if self.get_y() > 240:
            self.add_page()
            
        self.set_font("helvetica", "I", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, f"[{language}]", 0, 1, 'R')
        self.set_text_color(0, 0, 0)
        
        # Set code font - use helvetica in smaller size
        self.set_font("helvetica", "", 8)
        self.set_fill_color(245, 245, 245)
        
        # Sanitize code
        code = sanitize_text(code) if code else ""
        
        # Split code into lines
        lines = code.split('\n')
        
        # Add code lines with proper wrapping
        for i, line in enumerate(lines[:100]):  # Increased to 100 lines
            if self.get_y() > 270:
                self.add_page()
                self.set_font("helvetica", "", 8)
                
            # Truncate long lines
            if len(line) > 80:
                line = line[:77] + "..."
                
            # Draw background and text
            self.set_x(self.l_margin)
            self.cell(170, 4, line, 0, 1, 'L', 1)
        
        if len(lines) > 100:
            self.set_font("helvetica", "I", 8)
            self.cell(0, 5, f"... ({len(lines) - 100} more lines)", 0, 1, 'C')
        
        self.ln(3)

    def add_table(self, headers, data):
        # Ensure we have space
        if self.get_y() > 240:
            self.add_page()
            
        # Table header
        self.set_font("helvetica", "B", 10)
        self.set_fill_color(240, 240, 240)
        self.set_draw_color(200, 200, 200)
        
        # Calculate column width
        num_cols = len(headers)
        col_width = 170 / num_cols
        
        for header in headers:
            header_text = sanitize_text(str(header)[:20])
            self.cell(col_width, 8, header_text, 1, 0, 'C', 1)
        self.ln()
        
        # Table data
        self.set_font("helvetica", "", 9)
        self.set_fill_color(255, 255, 255)
        
        for row in data:
            if self.get_y() > 270:
                self.add_page()
                # Re-add headers
                self.set_font("helvetica", "B", 10)
                self.set_fill_color(240, 240, 240)
                for header in headers:
                    header_text = sanitize_text(str(header)[:20])
                    self.cell(col_width, 8, header_text, 1, 0, 'C', 1)
                self.ln()
                self.set_font("helvetica", "", 9)
                self.set_fill_color(255, 255, 255)
                
            for item in row:
                item_text = sanitize_text(str(item)[:20])
                self.cell(col_width, 7, item_text, 1, 0, 'L')
            self.ln()
        self.ln(5)

    def add_toc(self):
        """Add enhanced table of contents"""
        self.add_page()
        self.set_font("helvetica", "B", 18)
        self.cell(0, 15, 'Table of Contents', 0, 1, 'C')
        self.ln(10)
        
        self.set_draw_color(200, 200, 200)
        
        for entry in self.toc_entries:
            if self.get_y() > 270:
                self.add_page()
                
            # Set font based on level
            if entry['level'] == 1:
                self.set_font("helvetica", "B", 12)
                self.set_text_color(0, 0, 0)
            elif entry['level'] == 2:
                self.set_font("helvetica", "", 11)
                self.set_text_color(60, 60, 60)
            else:
                self.set_font("helvetica", "", 10)
                self.set_text_color(100, 100, 100)
            
            # Indentation based on level
            indent = (entry['level'] - 1) * 8
            self.set_x(self.l_margin + indent)
            
            # Title and page with dots
            title = f"{entry['num']} {entry['title']}"
            page = str(entry['page'])
            
            # Calculate available width for dots
            title_width = self.get_string_width(title)
            page_width = self.get_string_width(page)
            available_width = 170 - indent - title_width - page_width - 5
            
            # Add title
            self.cell(title_width, 7, title, 0, 0)
            
            # Add dots
            self.set_font("helvetica", "", 10)
            self.set_text_color(150, 150, 150)
            dots = '.' * int(available_width / self.get_string_width('.'))
            self.cell(available_width, 7, dots, 0, 0, 'C')
            
            # Add page number
            self.set_text_color(0, 0, 0)
            self.cell(page_width, 7, page, 0, 1, 'R')
            
        self.set_text_color(0, 0, 0)

class ArchitectureDocumentGenerator:
    def __init__(self, bucket_name):
        """Initialize the document generator"""
        try:
            self.pdf = EnhancedPDF()
            self.s3_client = boto3.client('s3')
            self.bucket_name = bucket_name
            self.architecture_info = None
            logger.info("Successfully initialized ArchitectureDocumentGenerator")
        except Exception as e:
            logger.error(f"Error initializing ArchitectureDocumentGenerator: {str(e)}")
            raise

    def create_cover_page(self, architecture_data):
        """Create a professional cover page"""
        self.pdf.add_page()
        
        # Title section
        self.pdf.set_y(80)
        self.pdf.set_font("helvetica", "B", 28)
        title = sanitize_text(architecture_data.get('title', 'AWS Architecture Document'))
        if len(title) > 40:
            title = title[:37] + "..."
        self.pdf.cell(0, 20, title, 0, 1, 'C')
        
        # Subtitle
        self.pdf.set_font("helvetica", "", 16)
        self.pdf.set_text_color(100, 100, 100)
        self.pdf.cell(0, 10, 'Technical Architecture & Implementation Guide', 0, 1, 'C')
        
        # Divider line
        self.pdf.set_draw_color(255, 153, 0)
        self.pdf.set_line_width(1)
        self.pdf.line(50, 120, 160, 120)
        
        # Author and date
        self.pdf.set_y(140)
        self.pdf.set_font("helvetica", "", 14)
        self.pdf.set_text_color(60, 60, 60)
        author = sanitize_text(architecture_data.get('author', 'AWS Architecture Assistant'))
        self.pdf.cell(0, 10, f"Prepared by: {author}", 0, 1, 'C')
        self.pdf.cell(0, 10, f"Date: {datetime.now().strftime('%B %d, %Y')}", 0, 1, 'C')
        
        # Version
        self.pdf.cell(0, 10, "Version: 1.0", 0, 1, 'C')
        
        # AWS branding
        self.pdf.set_y(220)
        self.pdf.set_font("helvetica", "I", 12)
        self.pdf.set_text_color(150, 150, 150)
        self.pdf.cell(0, 10, "Powered by AWS Architecture Designer", 0, 1, 'C')
        self.pdf.cell(0, 5, "Built with Amazon Bedrock", 0, 1, 'C')
        
        self.pdf.set_text_color(0, 0, 0)

    def add_executive_summary(self, summary, brd_content=None):
        """Add dynamic executive summary based on actual architecture"""
        self.pdf.add_page()
        self.pdf.chapter_title("1", "Executive Summary")
        
        # Add the actual summary from the architecture generation
        if summary:
            self.pdf.chapter_body(summary)
        else:
            self.pdf.chapter_body(
                "This document presents the AWS architecture designed to meet the specified requirements."
            )
        
        # Extract and categorize requirements if BRD provided
        if brd_content:
            self.pdf.chapter_title("1.1", "Requirements Analysis", level=2)
            
            # Extract actual requirements from BRD
            requirements = self.extract_categorized_requirements(brd_content)
            
            for category, items in requirements.items():
                if items:
                    self.pdf.chapter_title(f"1.1.{list(requirements.keys()).index(category)+1}", 
                                         category, level=3)
                    self.pdf.add_bullet_list(items[:5])  # Limit to 5 items per category

    def extract_categorized_requirements(self, brd_content):
        """Extract and categorize actual requirements from BRD"""
        requirements = {
            "Functional Requirements": [],
            "Performance Requirements": [],
            "Security Requirements": [],
            "Scalability Requirements": []
        }
        
        if not brd_content:
            return requirements
        
        lines = sanitize_text(str(brd_content)).split('\n')
        
        for line in lines:
            line = line.strip()
            if len(line) < 10:
                continue
                
            line_lower = line.lower()
            
            # Categorize based on content
            if any(word in line_lower for word in ['user', 'customer', 'feature', 'function', 'support', 'provide', 'enable']):
                requirements["Functional Requirements"].append(line[:100])
            elif any(word in line_lower for word in ['performance', 'latency', 'response', 'speed', 'fast', 'quick']):
                requirements["Performance Requirements"].append(line[:100])
            elif any(word in line_lower for word in ['security', 'secure', 'encrypt', 'auth', 'access', 'compliance']):
                requirements["Security Requirements"].append(line[:100])
            elif any(word in line_lower for word in ['scale', 'growth', 'expand', 'elastic', 'load']):
                requirements["Scalability Requirements"].append(line[:100])
        
        return requirements

    def add_architecture_overview(self, architecture_data):
        """Add architecture overview based on actual generated architecture"""
        self.pdf.add_page()
        self.pdf.chapter_title("2", "Architecture Design")
        
        # Analyze the architecture from the response
        if hasattr(self, 'architecture_info') and self.architecture_info:
            # Introduction based on detected patterns
            patterns = self.architecture_info.get('patterns', [])
            if patterns:
                intro = f"The architecture implements a {', '.join(patterns)} approach using the following AWS services: "
                intro += f"{', '.join(self.architecture_info.get('services', [])[:10])}."
            else:
                intro = "The architecture leverages AWS managed services for scalability and reliability."
            
            self.pdf.chapter_body(intro)
            
            # List detected components
            self.pdf.chapter_title("2.1", "Architecture Components", level=2)
            
            # Group services by layer
            if self.architecture_info.get('compute_services'):
                self.pdf.set_font("helvetica", "B", 12)
                self.pdf.cell(0, 8, "Compute Layer:", 0, 1)
                self.pdf.set_font("helvetica", "", 11)
                self.pdf.add_bullet_list(self.architecture_info['compute_services'])
            
            if self.architecture_info.get('data_stores'):
                self.pdf.set_font("helvetica", "B", 12)
                self.pdf.cell(0, 8, "Data Layer:", 0, 1)
                self.pdf.set_font("helvetica", "", 11)
                self.pdf.add_bullet_list(self.architecture_info['data_stores'])
            
            if self.architecture_info.get('networking'):
                self.pdf.set_font("helvetica", "B", 12)
                self.pdf.cell(0, 8, "Networking Layer:", 0, 1)
                self.pdf.set_font("helvetica", "", 11)
                self.pdf.add_bullet_list(self.architecture_info['networking'])
            
            if self.architecture_info.get('security_features'):
                self.pdf.set_font("helvetica", "B", 12)
                self.pdf.cell(0, 8, "Security Layer:", 0, 1)
                self.pdf.set_font("helvetica", "", 11)
                self.pdf.add_bullet_list(self.architecture_info['security_features'])
        
        # Add architecture diagram
        if architecture_data.get('architecture_diagram'):
            self.pdf.chapter_title("2.2", "Architecture Diagram", level=2)
            
            try:
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                    img_data = architecture_data['architecture_diagram']
                    
                    if isinstance(img_data, Image.Image):
                        img_data.save(temp_file.name, format='PNG')
                    elif isinstance(img_data, bytes):
                        with open(temp_file.name, 'wb') as f:
                            f.write(img_data)
                    elif hasattr(img_data, 'save'):
                        img_data.save(temp_file.name)
                    else:
                        try:
                            Image.fromarray(img_data).save(temp_file.name)
                        except:
                            logger.error("Could not convert image data")
                            raise
                    
                    # Add image with proper dimensions
                    if self.pdf.get_y() > 180:
                        self.pdf.add_page()
                    
                    self.pdf.image(temp_file.name, x=20, w=170)
                
                os.unlink(temp_file.name)
                
            except Exception as e:
                logger.error(f"Error adding architecture diagram: {str(e)}")
                self.pdf.chapter_body("Architecture diagram could not be rendered.")

    def add_design_rationale(self, architecture_data):
        """Add design decisions based on actual architecture choices"""
        self.pdf.add_page()
        self.pdf.chapter_title("3", "Design Decisions & Rationale")
        
        # Get design decisions from traces or generate based on detected services
        design_decisions = architecture_data.get('design_decisions', [])
        
        if not design_decisions and self.architecture_info:
            # Generate decisions based on detected architecture
            design_decisions = self.generate_design_decisions()
        
        if design_decisions:
            for i, decision in enumerate(design_decisions[:5], 1):
                self.pdf.chapter_title(f"3.{i}", f"Decision {i}", level=2)
                self.pdf.chapter_body(str(decision))
        else:
            self.pdf.chapter_body("Design decisions are based on AWS best practices and the specific requirements.")

    def generate_design_decisions(self):
        """Generate design decisions based on detected architecture"""
        decisions = []
        
        if 'Lambda' in self.architecture_info.get('services', []):
            decisions.append(
                "Serverless Computing: AWS Lambda was chosen for event-driven processing to minimize "
                "operational overhead and provide automatic scaling based on demand."
            )
        
        if 'DynamoDB' in self.architecture_info.get('services', []):
            decisions.append(
                "NoSQL Database: DynamoDB was selected for session management and high-throughput "
                "workloads due to its consistent performance and managed scaling."
            )
        
        if 'CloudFront' in self.architecture_info.get('services', []):
            decisions.append(
                "Global Content Delivery: CloudFront CDN ensures low-latency access to content "
                "worldwide and reduces load on origin servers."
            )
        
        if 'Multi-AZ' in str(self.architecture_info.get('scalability_features', [])):
            decisions.append(
                "High Availability: Multi-AZ deployment ensures system resilience and automatic "
                "failover in case of availability zone failures."
            )
        
        if self.architecture_info.get('security_features'):
            decisions.append(
                "Security-First Design: Multiple security layers including " + 
                ", ".join(self.architecture_info['security_features'][:3]) + 
                " provide comprehensive protection."
            )
        
        return decisions

    def add_well_architected_review(self, architecture_data):
        """Add Well-Architected review based on actual architecture"""
        self.pdf.add_page()
        self.pdf.chapter_title("4", "AWS Well-Architected Framework Analysis")
        
        # Analyze architecture against each pillar
        pillars = self.analyze_well_architected_pillars()
        
        for i, (pillar, details) in enumerate(pillars.items(), 1):
            self.pdf.chapter_title(f"4.{i}", pillar, level=2)
            self.pdf.chapter_body(details['description'])
            if details['implementations']:
                self.pdf.add_bullet_list(details['implementations'])

    def analyze_well_architected_pillars(self):
        """Analyze architecture against Well-Architected pillars"""
        services = self.architecture_info.get('services', []) if self.architecture_info else []
        
        pillars = {
            "Operational Excellence": {
                "description": "How the architecture supports operational efficiency:",
                "implementations": []
            },
            "Security": {
                "description": "Security measures implemented in the architecture:",
                "implementations": []
            },
            "Reliability": {
                "description": "Reliability features of the architecture:",
                "implementations": []
            },
            "Performance Efficiency": {
                "description": "Performance optimization strategies:",
                "implementations": []
            },
            "Cost Optimization": {
                "description": "Cost-effective design choices:",
                "implementations": []
            }
        }
        
        # Operational Excellence
        if 'CloudWatch' in services:
            pillars["Operational Excellence"]["implementations"].append(
                "CloudWatch monitoring for comprehensive observability"
            )
        if 'Lambda' in services:
            pillars["Operational Excellence"]["implementations"].append(
                "Serverless functions reduce operational overhead"
            )
        
        # Security
        if self.architecture_info and self.architecture_info.get('security_features'):
            for feature in self.architecture_info['security_features']:
                pillars["Security"]["implementations"].append(feature)
        if 'VPC' in services:
            pillars["Security"]["implementations"].append(
                "Network isolation using VPC"
            )
        
        # Reliability
        if self.architecture_info and 'Multi-AZ' in str(self.architecture_info.get('scalability_features', [])):
            pillars["Reliability"]["implementations"].append(
                "Multi-AZ deployment for high availability"
            )
        if 'Auto Scaling' in str(self.architecture_info.get('scalability_features', [])):
            pillars["Reliability"]["implementations"].append(
                "Auto Scaling for handling variable loads"
            )
        
        # Performance
        if 'ElastiCache' in services:
            pillars["Performance Efficiency"]["implementations"].append(
                "ElastiCache for improved data access performance"
            )
        if 'CloudFront' in services:
            pillars["Performance Efficiency"]["implementations"].append(
                "CloudFront CDN for global content delivery"
            )
        
        # Cost Optimization
        if 'Lambda' in services:
            pillars["Cost Optimization"]["implementations"].append(
                "Pay-per-use Lambda functions for cost efficiency"
            )
        if 'S3' in services:
            pillars["Cost Optimization"]["implementations"].append(
                "S3 lifecycle policies for cost-effective storage"
            )
        
        return pillars

    def add_implementation_guide(self, architecture_data):
        """Add implementation guide based on detected services"""
        self.pdf.add_page()
        self.pdf.chapter_title("5", "Implementation Guide")
        
        # Generate steps based on detected services
        services = self.architecture_info.get('services', []) if self.architecture_info else []
        
        self.pdf.chapter_title("5.1", "Prerequisites", level=2)
        prerequisites = self.generate_prerequisites(services)
        self.pdf.add_bullet_list(prerequisites)
        
        self.pdf.chapter_title("5.2", "Deployment Steps", level=2)
        deployment_steps = self.generate_deployment_steps(services)
        
        for i, step in enumerate(deployment_steps, 1):
            self.pdf.chapter_title(f"5.2.{i}", step['title'], level=3)
            self.pdf.add_bullet_list(step['tasks'])

    def generate_prerequisites(self, services):
        """Generate prerequisites based on services used"""
        prerequisites = [
            "AWS Account with appropriate IAM permissions",
            "AWS CLI installed and configured"
        ]
        
        if 'Route53' in services:
            prerequisites.append("Domain name registered or transferred to Route53")
        if 'CloudFront' in services:
            prerequisites.append("SSL certificate in AWS Certificate Manager")
        if any(svc in services for svc in ['EC2', 'RDS', 'ECS']):
            prerequisites.append("VPC with appropriate subnets configured")
        if 'Lambda' in services:
            prerequisites.append("IAM roles for Lambda execution")
        
        return prerequisites

    def generate_deployment_steps(self, services):
        """Generate deployment steps based on services"""
        steps = []
        
        # Network setup if needed
        if any(svc in services for svc in ['VPC', 'EC2', 'RDS', 'ECS']):
            steps.append({
                'title': 'Network Infrastructure Setup',
                'tasks': [
                    'Create VPC with public and private subnets',
                    'Configure route tables and internet gateway',
                    'Set up NAT gateway for private subnet access',
                    'Configure security groups'
                ]
            })
        
        # Database setup
        if 'RDS' in services:
            steps.append({
                'title': 'RDS Database Setup',
                'tasks': [
                    'Create RDS subnet group',
                    'Launch RDS instance with Multi-AZ if required',
                    'Configure automated backups',
                    'Set up parameter groups'
                ]
            })
        
        if 'DynamoDB' in services:
            steps.append({
                'title': 'DynamoDB Setup',
                'tasks': [
                    'Create DynamoDB tables',
                    'Configure auto-scaling policies',
                    'Set up global secondary indexes if needed',
                    'Enable point-in-time recovery'
                ]
            })
        
        # Compute setup
        if 'Lambda' in services:
            steps.append({
                'title': 'Lambda Functions Deployment',
                'tasks': [
                    'Package Lambda function code',
                    'Create Lambda functions with appropriate runtime',
                    'Configure environment variables',
                    'Set up event triggers'
                ]
            })
        
        if 'ECS' in services:
            steps.append({
                'title': 'ECS Container Setup',
                'tasks': [
                    'Create ECS cluster',
                    'Define task definitions',
                    'Configure services with desired count',
                    'Set up load balancer integration'
                ]
            })
        
        return steps

    def add_cost_estimation(self, architecture_data):
        """Add cost estimation based on detected services"""
        self.pdf.add_page()
        self.pdf.chapter_title("6", "Cost Analysis")
        
        self.pdf.chapter_body(
            "The following estimates are based on the detected services in the architecture. "
            "Actual costs will vary based on usage patterns and specific configurations."
        )
        
        # Generate cost table based on detected services
        services = self.architecture_info.get('services', []) if self.architecture_info else []
        cost_data = self.generate_cost_estimates(services)
        
        if cost_data:
            headers = ["Service", "Typical Configuration", "Estimated Monthly Cost"]
            self.pdf.add_table(headers, cost_data)
        
        self.pdf.chapter_title("6.1", "Cost Optimization Recommendations", level=2)
        optimizations = self.generate_cost_optimizations(services)
        self.pdf.add_bullet_list(optimizations)

    def generate_cost_estimates(self, services):
        """Generate cost estimates based on services"""
        cost_data = []
        total = 0
        
        service_costs = {
            'EC2': ('t3.medium instances', 50),
            'RDS': ('db.t3.small instance', 50),
            'Lambda': ('1M requests/month', 20),
            'DynamoDB': ('On-demand pricing', 25),
            'S3': ('100GB storage', 5),
            'CloudFront': ('1TB transfer', 85),
            'API Gateway': ('1M API calls', 3.50),
            'ElastiCache': ('cache.t3.micro', 25)
        }
        
        for service, (config, cost) in service_costs.items():
            if service in services:
                cost_data.append([service, config, f"${cost:.2f}"])
                total += cost
        
        if cost_data:
            cost_data.append(["Total Estimated", "", f"${total:.2f}"])
        
        return cost_data

    def generate_cost_optimizations(self, services):
        """Generate cost optimization recommendations"""
        optimizations = []
        
        if 'EC2' in services:
            optimizations.append("Consider Reserved Instances for predictable workloads (up to 72% savings)")
        if 'RDS' in services:
            optimizations.append("Use RDS Reserved Instances for production databases")
        if 'Lambda' in services:
            optimizations.append("Optimize Lambda memory allocation to reduce costs")
        if 'S3' in services:
            optimizations.append("Implement S3 lifecycle policies to move old data to cheaper storage classes")
        if any(svc in services for svc in ['EC2', 'ECS']):
            optimizations.append("Use Spot Instances for non-critical workloads")
        
        optimizations.append("Enable AWS Cost Explorer for detailed cost analysis")
        optimizations.append("Set up billing alerts to monitor spending")
        
        return optimizations

    def add_cloudformation_template(self, template, architecture_info):
        """Add CloudFormation template section"""
        self.pdf.add_page()
        self.pdf.chapter_title("7", "Infrastructure as Code")
        
        intro = (
            "The following CloudFormation template provides the infrastructure definition "
            "for the architecture. This template is automatically generated based on the "
            "services detected in your architecture design."
        )
        self.pdf.chapter_body(intro)
        
        # If no template provided, generate one based on architecture
        if not template and architecture_info:
            template = generate_dynamic_cloudformation(architecture_info)
        elif not template:
            template = "# CloudFormation template will be generated based on final architecture"
        
        self.pdf.chapter_title("7.1", "Deployment Instructions", level=2)
        
        instructions = [
            "Save the template to a file (e.g., infrastructure.yaml)",
            "Validate the template: aws cloudformation validate-template --template-body file://infrastructure.yaml",
            "Create the stack: aws cloudformation create-stack --stack-name my-architecture --template-body file://infrastructure.yaml",
            "Monitor the deployment in AWS Console or CLI",
            "Update parameters as needed for your environment"
        ]
        
        self.pdf.add_bullet_list(instructions)
        
        self.pdf.chapter_title("7.2", "CloudFormation Template", level=2)
        self.pdf.add_code_block(template, "yaml")

    def add_security_best_practices(self):
        """Add security best practices based on architecture"""
        self.pdf.add_page()
        self.pdf.chapter_title("8", "Security Best Practices")
        
        services = self.architecture_info.get('services', []) if self.architecture_info else []
        
        practices = []
        
        if 'RDS' in services:
            practices.append("Enable RDS encryption at rest and enforce SSL connections")
        if 'S3' in services:
            practices.append("Enable S3 bucket encryption and block public access")
        if 'Lambda' in services:
            practices.append("Use AWS Secrets Manager for Lambda function credentials")
        if 'API Gateway' in services:
            practices.append("Implement API Gateway request validation and rate limiting")
        
        practices.extend([
            "Regularly rotate IAM access keys and credentials",
            "Enable CloudTrail for API activity logging",
            "Implement least privilege IAM policies",
            "Use VPC endpoints for private connectivity to AWS services",
            "Enable GuardDuty for threat detection",
            "Regular security assessments and penetration testing"
        ])
        
        self.pdf.add_bullet_list(practices)

    def add_monitoring_strategy(self):
        """Add monitoring strategy section"""
        self.pdf.add_page()
        self.pdf.chapter_title("9", "Monitoring & Observability")
        
        self.pdf.chapter_body(
            "Comprehensive monitoring ensures system health and enables rapid issue resolution."
        )
        
        services = self.architecture_info.get('services', []) if self.architecture_info else []
        
        self.pdf.chapter_title("9.1", "Key Metrics to Monitor", level=2)
        
        metrics = []
        if 'Lambda' in services:
            metrics.extend([
                "Lambda function duration and error rates",
                "Lambda concurrent executions",
                "Lambda cold start frequency"
            ])
        if 'RDS' in services:
            metrics.extend([
                "RDS CPU utilization and connection count",
                "Database read/write latency",
                "Storage space utilization"
            ])
        if 'API Gateway' in services:
            metrics.extend([
                "API Gateway 4XX and 5XX error rates",
                "API request latency",
                "API request count per endpoint"
            ])
        
        metrics.extend([
            "Overall system availability",
            "End-to-end transaction response time",
            "Error rates by service"
        ])
        
        self.pdf.add_bullet_list(metrics)
        
        self.pdf.chapter_title("9.2", "Alerting Configuration", level=2)
        
        alerts = [
            "Critical alerts for service failures (PagerDuty/SNS)",
            "Warning alerts for performance degradation",
            "Cost alerts for budget thresholds",
            "Security alerts for suspicious activities"
        ]
        
        self.pdf.add_bullet_list(alerts)

    def add_appendix(self):
        """Add appendix with resources"""
        self.pdf.add_page()
        self.pdf.chapter_title("10", "Appendix")
        
        self.pdf.chapter_title("10.1", "AWS Service Documentation", level=2)
        
        services = self.architecture_info.get('services', []) if self.architecture_info else []
        
        doc_links = []
        service_docs = {
            'Lambda': 'https://docs.aws.amazon.com/lambda/',
            'RDS': 'https://docs.aws.amazon.com/rds/',
            'DynamoDB': 'https://docs.aws.amazon.com/dynamodb/',
            'S3': 'https://docs.aws.amazon.com/s3/',
            'CloudFront': 'https://docs.aws.amazon.com/cloudfront/',
            'API Gateway': 'https://docs.aws.amazon.com/apigateway/',
            'ECS': 'https://docs.aws.amazon.com/ecs/',
            'VPC': 'https://docs.aws.amazon.com/vpc/'
        }
        
        for service in services:
            if service in service_docs:
                doc_links.append(f"{service}: {service_docs[service]}")
        
        if doc_links:
            self.pdf.add_bullet_list(doc_links)
        
        self.pdf.chapter_title("10.2", "Additional Resources", level=2)
        
        resources = [
            "AWS Architecture Center: https://aws.amazon.com/architecture/",
            "AWS Well-Architected Framework: https://aws.amazon.com/well-architected/",
            "AWS Pricing Calculator: https://calculator.aws/",
            "AWS Best Practices: https://aws.amazon.com/architecture/best-practices/"
        ]
        
        self.pdf.add_bullet_list(resources)

    def create_document(self, architecture_data):
        """Generate complete architecture document dynamically"""
        try:
            logger.info("Starting dynamic document creation")
            
            # Analyze architecture from response
            response_text = architecture_data.get('summary', '')
            traces = architecture_data.get('design_decisions', [])
            self.architecture_info = analyze_architecture_from_response(response_text, traces)
            
            # Generate CloudFormation if not provided
            if not architecture_data.get('cloudformation_template'):
                logger.info("Generating dynamic CloudFormation template")
                architecture_data['cloudformation_template'] = generate_dynamic_cloudformation(self.architecture_info)
            
            # Create cover page
            self.create_cover_page(architecture_data)
            
            # Create TOC placeholder
            toc_page = self.pdf.page_no() + 1
            
            # Add all sections
            sections = [
                (self.add_executive_summary, (architecture_data.get('summary', ''), architecture_data.get('brd_content'))),
                (self.add_architecture_overview, (architecture_data,)),
                (self.add_design_rationale, (architecture_data,)),
                (self.add_well_architected_review, (architecture_data,)),
                (self.add_implementation_guide, (architecture_data,)),
                (self.add_cost_estimation, (architecture_data,)),
                (self.add_cloudformation_template, (architecture_data.get('cloudformation_template'), self.architecture_info)),
                (self.add_security_best_practices, ()),
                (self.add_monitoring_strategy, ()),
                (self.add_appendix, ())
            ]
            
            for section_func, args in sections:
                try:
                    section_func(*args)
                except Exception as e:
                    logger.error(f"Error in {section_func.__name__}: {e}")
                    # Add placeholder for failed section
                    self.pdf.add_page()
                    self.pdf.chapter_title("X", "Section Generation Error")
                    self.pdf.chapter_body(f"This section could not be generated. Please check the logs.")
            
            # Insert TOC
            current_page = self.pdf.page_no()
            self.pdf.page = toc_page
            self.pdf.add_toc()
            self.pdf.page = current_page
            
            logger.info("Document creation completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error in create_document: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False

    def upload_to_s3(self, filename):
        """Save document to S3 and return presigned URL"""
        try:
            logger.info(f"Uploading document to S3: {filename}")
            
            # Generate PDF
            pdf_stream = BytesIO()
            self.pdf.output(pdf_stream)
            pdf_stream.seek(0)
            
            # Upload to S3
            s3_path = f"architecture_documents/{filename}"
            self.s3_client.upload_fileobj(
                pdf_stream,
                self.bucket_name,
                s3_path,
                ExtraArgs={
                    'ContentType': 'application/pdf',
                    'ContentDisposition': f'inline; filename="{filename}"'
                }
            )
            
            # Generate presigned URL (valid for 24 hours)
            presigned_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_path
                },
                ExpiresIn=86400  # 24 hours
            )
            
            logger.info(f"Document uploaded successfully with presigned URL")
            return presigned_url
            
        except Exception as e:
            logger.error(f"Error uploading to S3: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None

def create_architecture_document(architecture_data, bucket_name):
    """Create and save dynamic architecture document"""
    try:
        logger.info("Starting architecture document creation process")
        logger.info(f"Input data keys: {architecture_data.keys()}")
        
        # Add BRD content if available
        try:
            import streamlit as st
            if hasattr(st.session_state, 'brd_content') and st.session_state.brd_content:
                architecture_data['brd_content'] = st.session_state.brd_content
        except ImportError:
            pass
        
        doc_generator = ArchitectureDocumentGenerator(bucket_name)
        success = doc_generator.create_document(architecture_data)
        
        if not success:
            logger.error("Failed to create document")
            return False, None
        
        # Generate filename with timestamp
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_Architecture_Document.pdf"
        presigned_url = doc_generator.upload_to_s3(filename)
        
        if presigned_url:
            logger.info(f"Document created successfully with presigned URL")
            return True, presigned_url
        
        logger.error("Failed to generate presigned URL")
        return False, None
        
    except Exception as e:
        logger.error(f"Error in create_architecture_document: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return False, None
