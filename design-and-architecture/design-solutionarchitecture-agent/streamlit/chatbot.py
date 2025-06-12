import streamlit as st
import boto3
import os
import logging
from datetime import datetime
import uuid
import json
import base64
import requests
from PIL import Image
from io import BytesIO
from docx import Document
from PyPDF2 import PdfReader
from architecture_template import create_architecture_document

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
S3_BUCKET_NAME = "mybuckbuck3"
AGENT_ID = "IJWJWHUA7D"
REGION = "us-west-2"

# Initialize AWS clients
s3_client = boto3.client("s3")
bedrock_runtime = boto3.client(
    service_name="bedrock-runtime",
    region_name=REGION,
)
bedrock_agent_runtime = boto3.client(
    service_name="bedrock-agent-runtime", 
    region_name=REGION
)

# Load agent tools
try:
    import agent2_tools as agent_tools
    AGENT_AVAILABLE = True
except ImportError:
    try:
        from drawings import agent2_tools as agent_tools
        AGENT_AVAILABLE = True
    except ImportError:
        logger.warning("agent_tools not available")
        AGENT_AVAILABLE = False

# Sample questions dictionary
SAMPLE_QUESTIONS = {
    "Architecture Design": [
        "Draw an AWS diagram that shows an ecommerce architecture",
        "Draw AWS architecture including all the services for this architecture?",
        "Create an architecture diagram for a serverless web application?"
    ],
    "Templates & Analysis": [
        "Create Cloud Formation template for this architecture including all the services and test it?",
        "Calculate estimated cost for this architecture?",
        "Analyze this architecture and provide cost optimization opportunities?",
        "Explain the attached architecture?"
    ]
}

def initialize_session_state():
    """Initialize session state variables"""
    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "processing_question" not in st.session_state:
        st.session_state.processing_question = False
    if "doc_url" not in st.session_state:
        st.session_state.doc_url = None
    if "architecture_data" not in st.session_state:
        st.session_state.architecture_data = None
    if "last_response" not in st.session_state:
        st.session_state.last_response = ""
    if "cloudformation_template" not in st.session_state:
        st.session_state.cloudformation_template = None
    if "context" not in st.session_state:
        st.session_state.context = {
            "last_architecture": None,
            "recent_interactions": [],
            "last_template": None,
            "last_response": ""
        }
    if "brd_content" not in st.session_state:
        st.session_state.brd_content = None
    if "s3_client" not in st.session_state:
        st.session_state.s3_client = s3_client
    if "bedrock_runtime" not in st.session_state:
        st.session_state.bedrock_runtime = bedrock_runtime
    if "bedrock_agent_runtime" not in st.session_state:
        st.session_state.bedrock_agent_runtime = bedrock_agent_runtime

def add_enhanced_styling():
    """Add enhanced AWS-inspired styling to the app"""
    st.markdown("""
        <style>
        /* Import fonts */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        /* Global styles */
        .stApp {
            font-family: 'Inter', sans-serif;
            background-color: #f5f7fa;
        }
        
        /* Main container styling */
        .main-header {
            background: linear-gradient(135deg, #FF9900 0%, #FF6600 100%);
            padding: 2rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            box-shadow: 0 4px 20px rgba(255, 153, 0, 0.15);
        }
        
        .main-header h1 {
            color: white;
            font-size: 2.5rem;
            font-weight: 700;
            margin: 0;
        }
        
        .main-header p {
            color: rgba(255, 255, 255, 0.9);
            font-size: 1.1rem;
            margin-top: 0.5rem;
        }
        
        /* Card styling */
        .card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(0, 0, 0, 0.06);
            transition: all 0.3s ease;
        }
        
        .card:hover {
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
            transform: translateY(-2px);
        }
        
        /* Enhanced button styling */
        .stButton > button {
            background: linear-gradient(135deg, #FF9900 0%, #FF6600 100%);
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            font-weight: 600;
            border-radius: 8px;
            transition: all 0.3s ease;
            width: 100%;
            box-shadow: 0 2px 8px rgba(255, 153, 0, 0.2);
        }
        
        .stButton > button:hover {
            background: linear-gradient(135deg, #FF6600 0%, #FF4400 100%);
            box-shadow: 0 4px 12px rgba(255, 153, 0, 0.3);
            transform: translateY(-1px);
        }
        
        /* Quick action buttons */
        .quick-action-btn {
            background: white;
            border: 2px solid #FF9900;
            color: #FF9900;
            padding: 0.6rem 1.2rem;
            font-weight: 500;
            border-radius: 8px;
            transition: all 0.3s ease;
            text-align: left;
            width: 100%;
            margin-bottom: 0.5rem;
        }
        
        .quick-action-btn:hover {
            background: #FF9900;
            color: white;
            transform: translateX(5px);
        }
        
        /* Section headers */
        .section-header {
            font-size: 1.3rem;
            font-weight: 600;
            color: #232F3E;
            margin: 1.5rem 0 1rem 0;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .section-header::before {
            content: "";
            width: 4px;
            height: 24px;
            background: #FF9900;
            border-radius: 2px;
        }
        
        /* Upload area styling */
        .upload-area {
            background: linear-gradient(135deg, #fef9f3 0%, #fef4e6 100%);
            border: 2px dashed #FF9900;
            border-radius: 12px;
            padding: 2rem;
            text-align: center;
            transition: all 0.3s ease;
        }
        
        .upload-area:hover {
            background: linear-gradient(135deg, #fef4e6 0%, #fee9d3 100%);
            border-color: #FF6600;
        }
        
        /* Status indicators */
        .status-indicator {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 500;
        }
        
        .status-success {
            background: #e6f9e6;
            color: #2ea02e;
        }
        
        .status-error {
            background: #ffe6e6;
            color: #dc3545;
        }
        
        .status-info {
            background: #e6f3ff;
            color: #0066cc;
        }
        
        /* Chat interface styling */
        .stChatMessage {
            background: white;
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 0.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        
        /* Expander styling */
        .streamlit-expanderHeader {
            background: #f8f9fa;
            border-radius: 8px;
            font-weight: 600;
        }
        
        /* Code block styling */
        .stCodeBlock {
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        
        /* Sidebar styling */
        .css-1d391kg {
            background: white;
            border-right: 1px solid #e0e0e0;
        }
        
        /* AWS badge */
        .aws-badge {
            background: #232F3E;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 1rem;
        }
        
        /* Feature cards */
        .feature-card {
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            transition: all 0.3s ease;
        }
        
        .feature-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
            border-color: #FF9900;
        }
        
        .feature-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        
        /* Progress indicator */
        .progress-bar {
            background: #e0e0e0;
            border-radius: 10px;
            height: 6px;
            overflow: hidden;
            margin: 1rem 0;
        }
        
        .progress-fill {
            background: linear-gradient(90deg, #FF9900 0%, #FF6600 100%);
            height: 100%;
            border-radius: 10px;
            animation: progress 2s ease-in-out infinite;
        }
        
        @keyframes progress {
            0% { width: 0%; }
            100% { width: 100%; }
        }
        
        /* Tooltips */
        .tooltip {
            position: relative;
            display: inline-block;
            cursor: help;
        }
        
        .tooltip:hover::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: #232F3E;
            color: white;
            padding: 0.5rem;
            border-radius: 6px;
            font-size: 0.8rem;
            white-space: nowrap;
            z-index: 1000;
        }
        </style>
    """, unsafe_allow_html=True)

def display_enhanced_header():
    """Display enhanced header with gradient and better typography"""
    st.markdown("""
        <div class="main-header">
            <h1>🏗️ AWS Architecture Designer</h1>
            <p>Powered by Amazon Bedrock • Design, Analyze, and Optimize Cloud Architectures</p>
        </div>
    """, unsafe_allow_html=True)
    
def display_aws_status():
    """Display AWS connection status"""
    try:
        boto3.client('sts').get_caller_identity()
        st.markdown("""
            <div class="status-indicator status-success">
                <span>✅</span> AWS Connected
            </div>
        """, unsafe_allow_html=True)
    except Exception as e:
        st.markdown("""
            <div class="status-indicator status-error">
                <span>❌</span> AWS Connection Failed
            </div>
        """, unsafe_allow_html=True)

def display_message(message):
    """Display message content including text and images"""
    content = message["content"]
    if isinstance(content, dict):
        if "text" in content:
            text = content["text"]
            if not text.startswith("```") and "use the drawlambda function" not in text.lower() and "i apologize" not in text.lower():
                st.markdown(text)
        
        if "images" in content and content["images"]:
            for image in content["images"]:
                try:
                    if isinstance(image, dict):
                        if "image" in image:
                            with st.container():
                                st.image(image["image"],
                                       caption=image.get("caption", "Generated Architecture"),
                                       use_container_width=True)
                        elif "base64" in image:
                            image_bytes = base64.b64decode(image["base64"])
                            image_data = BytesIO(image_bytes)
                            with st.container():
                                st.image(image_data, use_container_width=True)
                        elif "url" in image:
                            with st.container():
                                st.image(image["url"], use_container_width=True)
                    else:
                        with st.container():
                            st.image(image, use_container_width=True)
                except Exception as e:
                    logger.error(f"Failed to display image: {str(e)}")
        
        if "traces" in content and content["traces"]:
            for trace in content["traces"]:
                if isinstance(trace, dict) and "text" in trace:
                    if "Resources:" in trace["text"]:
                        st.markdown("### CloudFormation Template")
                        st.code(trace["text"], language="yaml")
                        st.session_state.cloudformation_template = trace["text"]
    else:
        if not str(content).startswith("```") and "use the drawlambda function" not in str(content).lower():
            st.markdown(str(content))

def process_query(prompt, uploaded_file=None, maintain_context=True):
    """Process user query through agent with context awareness"""
    if not AGENT_AVAILABLE:
        st.error("Query processing unavailable - agent_tools not loaded")
        return {"text": "Agent tools not available", "images": []}

    try:
        # Get context and ensure it includes BRD content if available
        context = get_conversation_context() if maintain_context else {}
        if st.session_state.brd_content:
            context["brd_content"] = st.session_state.brd_content

        # Handle CloudFormation template requests
        if "cloudformation template" in prompt.lower() or "cf template" in prompt.lower():
            if context and "last_architecture" in context and context["last_architecture"]:
                enhanced_prompt = f"""
Based on the existing architecture, please generate a CloudFormation template that includes all necessary resources and their configurations and create this template in several parts to be sure not to lose any part of code..
"""
                response = agent_tools.process_aws_query(
                    enhanced_prompt,
                    uploaded_file,
                    previous_context=context
                )
                
                if isinstance(response, dict) and "text" in response:
                    return response
                return {"text": "Failed to generate CloudFormation template. Please try again."}
            return {"text": "No architecture found. Please generate an architecture diagram first."}

        # Handle regular queries and architecture generation
        # If we have BRD content and this is an architecture request, enhance the prompt
        if context.get("brd_content") and ("architecture" in prompt.lower() or "diagram" in prompt.lower()):
            enhanced_prompt = f"""
Based on the following requirements document:

{context['brd_content']}

User request:
{prompt}

Please analyze these requirements and create an appropriate AWS architecture by only using the service lists in diag_mapping.json file.
Do not use any other service names that are not in the diag_mapping.json file.Create an architecture that is as much detailed as possible and comprehensive.
"""
            response = agent_tools.process_aws_query(
                enhanced_prompt,
                uploaded_file,
                previous_context=context
            )
        else:
            # For architecture-related queries without BRD
            if "architecture" in prompt.lower() or "diagram" in prompt.lower():
                enhanced_prompt = f"""
{prompt}

Important: When creating the architecture, please only use the AWS services listed in diag_mapping.json file.
Do not use any other service names that are not in the diag_mapping.json file.
"""
                response = agent_tools.process_aws_query(
                    enhanced_prompt,
                    uploaded_file,
                    previous_context=context
                )
            else:
                # For other queries
                response = agent_tools.process_aws_query(
                    prompt,
                    uploaded_file,
                    previous_context=context
                )
        
        if isinstance(response, dict):
            if "images" in response and response["images"]:
                st.session_state.context["last_architecture"] = response["images"]
            if "traces" in response:
                for trace in response["traces"]:
                    if isinstance(trace, dict) and "text" in trace:
                        if "Resources:" in trace["text"]:
                            st.session_state.context["last_template"] = trace["text"]
            return response
        return {"text": str(response), "images": []}

    except Exception as e:
        logger.error(f"Error in process_query: {str(e)}")
        return {"text": f"Error processing query: {str(e)}", "images": []}

def get_conversation_context():
    """Get recent conversation context from session state"""
    if not hasattr(st.session_state, 'context'):
        st.session_state.context = {
            "last_architecture": None,
            "recent_interactions": [],
            "last_template": None,
            "brd_content": None
        }
    
    # Ensure BRD content is included in context if available
    if hasattr(st.session_state, 'brd_content') and st.session_state.brd_content:
        st.session_state.context["brd_content"] = st.session_state.brd_content
    
    if st.session_state.messages:
        recent_messages = st.session_state.messages[-3:]  # Get last 3 messages
        for msg in recent_messages:
            if isinstance(msg["content"], dict):
                if "text" in msg["content"]:
                    st.session_state.context["recent_interactions"].append(msg["content"]["text"])
                if "images" in msg["content"] and msg["content"]["images"]:
                    st.session_state.context["last_architecture"] = msg["content"]["images"]
                if "traces" in msg["content"]:
                    for trace in msg["content"]["traces"]:
                        if isinstance(trace, dict) and "text" in trace:
                            if "Resources:" in trace["text"]:
                                st.session_state.context["last_template"] = trace["text"]
    
    # Keep only the most recent interactions
    st.session_state.context["recent_interactions"] = st.session_state.context["recent_interactions"][-5:]
    return st.session_state.context

def is_follow_up_question(prompt):
    """Determine if the prompt is a follow-up question"""
    follow_up_indicators = [
        "this", "that", "the", "these", "those", "it", "previous",
        "above", "existing", "current", "mentioned", "created",
        "architecture", "diagram", "template", "cost", "yes", "no"
    ]
    prompt_lower = prompt.lower()
    return any(indicator in prompt_lower for indicator in follow_up_indicators)

def main():
    try:
        st.set_page_config(
            page_title="AWS Architecture Designer", 
            layout="wide",
            initial_sidebar_state="expanded",
            menu_items={
                'Get Help': 'https://aws.amazon.com/architecture/',
                'Report a bug': None,
                'About': 'AWS Architecture Designer powered by Amazon Bedrock'
            }
        )
    except:
        pass

    add_enhanced_styling()
    initialize_session_state()

    # Enhanced sidebar
    with st.sidebar:
        st.markdown("""
            <div class="aws-badge">
                <img src="https://d1.awsstatic.com/logos/aws-logo-lockups/poweredbyaws/PB_AWS_logo_RGB_stacked_REV_SQ.91cd4af40773cbfbd15577a3c2b8a346fe3e8fa2.png" 
                     alt="AWS" style="height: 20px;">
                <span>Powered by AWS</span>
            </div>
        """, unsafe_allow_html=True)
        
        display_aws_status()
        
        st.markdown('<h3 class="section-header">Upload & Analyze</h3>', unsafe_allow_html=True)
        
        with st.container():
            st.markdown('<div class="card">', unsafe_allow_html=True)
            uploaded_file = st.file_uploader(
                "📄 Upload document or image", 
                type=["txt", "doc", "docx", "pdf", "png", "jpg", "jpeg"],
                help="Upload requirements documents or existing architecture diagrams"
            )
            
            if uploaded_file is not None:
                if uploaded_file.type.startswith('image/'):
                    st.image(uploaded_file, caption="Uploaded Image", use_container_width=True)
                    if st.button("🔍 Analyze Architecture", use_container_width=True):
                        with st.spinner("Analyzing architecture..."):
                            response = process_query(
                                "Please analyze this architecture diagram and explain its components and design.",
                                uploaded_file,
                                maintain_context=False
                            )
                            st.session_state.messages.append({"role": "assistant", "content": response})
                            st.rerun()
                else:
                    st.success(f"✅ Uploaded: {uploaded_file.name}")
                    try:
                        doc_content = agent_tools.process_uploaded_document(uploaded_file)
                        st.session_state.brd_content = doc_content
                        st.info("📋 BRD document loaded successfully!")
                        
                        if st.button("🏗️ Generate Architecture from BRD", use_container_width=True):
                            with st.spinner("Analyzing BRD and generating architecture..."):
                                maintain_context = True
                                prompt = "Please analyze the requirements document and create an AWS architecture diagram by using the services in the diag_mapping.json file"
                                
                                if "context" not in st.session_state:
                                    st.session_state.context = {}
                                st.session_state.context["brd_content"] = st.session_state.brd_content
                                
                                response = process_query(
                                    prompt,
                                    uploaded_file=uploaded_file,
                                    maintain_context=maintain_context
                                )
                                
                                # Store the response for document generation
                                st.session_state.architecture_data = {
                                    "title": f"AWS Architecture for {uploaded_file.name}",
                                    "author": "AWS Architecture Assistant",
                                    "summary": response.get("text", ""),
                                    "architecture_diagram": response.get("images", [{}])[0].get("image") if response.get("images") else None,
                                    "cloudformation_template": next((trace["text"] for trace in response.get("traces", []) 
                                                                  if "Resources:" in trace["text"]), None),
                                    "design_decisions": [trace["text"] for trace in response.get("traces", []) 
                                                      if trace.get("trace_type") == "rationale"],
                                }
                                
                                st.session_state.last_response = response.get("text", "")
                                st.session_state.messages.append({"role": "assistant", "content": response})
                            st.rerun()
                        
                        if st.button("📄 Generate Architecture Document", use_container_width=True):
                            with st.spinner("Generating architecture document..."):
                                if not st.session_state.get("architecture_data"):
                                    st.warning("Please generate the architecture first!")
                                else:
                                    success, doc_url = create_architecture_document(
                                        st.session_state.architecture_data,
                                        S3_BUCKET_NAME
                                    )
                                    if success and doc_url:
                                        st.success("✅ Document generated!")
                                        st.markdown(f"[📥 Download Document]({doc_url})")
                                    else:
                                        st.error("Failed to generate document.")
                    except Exception as e:
                        st.error(f"Error processing document: {str(e)}")
                        st.session_state.brd_content = None
            st.markdown('</div>', unsafe_allow_html=True)

        if st.session_state.cloudformation_template:
            st.markdown('<h3 class="section-header">Downloads</h3>', unsafe_allow_html=True)
            st.download_button(
                label="📥 Download CloudFormation Template",
                data=st.session_state.cloudformation_template,
                file_name="architecture_template.yaml",
                mime="text/yaml",
                use_container_width=True
            )

    # Main content area
    display_enhanced_header()
    
    # Feature cards
    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown("""
            <div class="feature-card">
                <div class="feature-icon">🎨</div>
                <h4>Design Architectures</h4>
                <p>Create AWS architecture diagrams from requirements or descriptions</p>
            </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown("""
            <div class="feature-card">
                <div class="feature-icon">📊</div>
                <h4>Analyze & Optimize</h4>
                <p>Get cost estimates and optimization recommendations</p>
            </div>
        """, unsafe_allow_html=True)
    
    with col3:
        st.markdown("""
            <div class="feature-card">
                <div class="feature-icon">🚀</div>
                <h4>Generate Templates</h4>
                <p>Create CloudFormation templates ready for deployment</p>
            </div>
        """, unsafe_allow_html=True)

    # Chat interface
    st.markdown('<h3 class="section-header">Architecture Assistant</h3>', unsafe_allow_html=True)
    
    # Display chat messages
    chat_container = st.container()
    with chat_container:
        if "messages" in st.session_state:
            for message in st.session_state.messages:
                with st.chat_message(message["role"]):
                    display_message(message)

    # Chat input
    if prompt := st.chat_input("💬 Ask about AWS architecture..."):
        with st.chat_message("user"):
            st.markdown(prompt)
        st.session_state.messages.append({"role": "user", "content": prompt})
        
        with st.spinner("🤔 Thinking..."):
            maintain_context = is_follow_up_question(prompt)
            response = process_query(prompt, maintain_context=maintain_context)
            st.session_state.last_response = response.get("text", "")
            st.session_state.messages.append({"role": "assistant", "content": response})
        st.rerun()

    # Quick actions with enhanced UI
    st.markdown('<h3 class="section-header">Quick Actions</h3>', unsafe_allow_html=True)
    
    # Use tabs for better organization
    tab1, tab2 = st.tabs(["🎨 Architecture Design", "📊 Templates & Analysis"])
    
    with tab1:
        cols = st.columns(2)
        for idx, question in enumerate(SAMPLE_QUESTIONS["Architecture Design"]):
            col = cols[idx % 2]
            with col:
                if st.button(f"{question}", key=f"design_{idx}", use_container_width=True):
                    with st.spinner("Processing..."):
                        response = process_query(question, maintain_context=False)
                        st.session_state.messages.append({"role": "assistant", "content": response})
                    st.rerun()

    with tab2:
        cols = st.columns(2)
        for idx, question in enumerate(SAMPLE_QUESTIONS["Templates & Analysis"]):
            col = cols[idx % 2]
            with col:
                if st.button(f"{question}", key=f"analysis_{idx}", use_container_width=True):
                    with st.spinner("Processing..."):
                        response = process_query(question, maintain_context=True)
                        st.session_state.messages.append({"role": "assistant", "content": response})
                    st.rerun()

    # Footer
    st.markdown("---")
    st.markdown("""
        <div style="text-align: center; color: #666; font-size: 0.9rem;">
            <p>Built with ❤️ using Amazon Bedrock and AWS Services</p>
        </div>
    """, unsafe_allow_html=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        st.error(f"Application error: {str(e)}")
