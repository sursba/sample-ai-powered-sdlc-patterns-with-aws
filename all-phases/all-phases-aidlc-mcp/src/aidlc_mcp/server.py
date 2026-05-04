#!/usr/bin/env python3
"""AI-DLC MCP Server - Python Implementation

This server implements the AI-Driven Development Life Cycle methodology
through the Model Context Protocol, providing structured guidance for
AI-assisted software development.
"""

import json
import os
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Any
import sys

# Import MCP SDK
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
except ImportError:
    print("Error: MCP SDK not installed. Run: pip install mcp", file=sys.stderr)
    sys.exit(1)

# Import prompts
from .prompts import PROMPTS

# AI-DLC Phase Progression
PHASE_SEQUENCE_FULL = [
    "discovery-0.1",
    "inception-1.1",
    "inception-1.2",
    "construction-2.1",
    "construction-2.2",
    "construction-2.3"
]

PHASE_SEQUENCE_ABBREVIATED = [
    "discovery-0.1-lite",
    "inception-1.1-lite",
    "construction-2.2-lite",
    "operations-3.1",
    "deployment-2.3-lite"
]

# Legacy alias for backward compatibility
PHASE_SEQUENCE = PHASE_SEQUENCE_FULL

# Note: Phase prompts are now in prompts.py for easier customization

# Helper functions
def get_next_phase(current_phase: str, flow_type: str = "full") -> Optional[str]:
    """Get the next phase in the sequence based on flow type."""
    sequence = PHASE_SEQUENCE_ABBREVIATED if flow_type == "abbreviated" else PHASE_SEQUENCE_FULL
    try:
        current_index = sequence.index(current_phase)
        if current_index == len(sequence) - 1:
            return None
        return sequence[current_index + 1]
    except ValueError:
        return None


def get_flow_type(project_path: str) -> str:
    """Read flow type from current_phase.json. Defaults to 'full'."""
    phase_file = Path(project_path) / '.aidlc' / 'current_phase.json'
    if phase_file.exists():
        try:
            with open(phase_file, 'r') as f:
                ft = json.load(f).get('flowType', 'full')
                if ft in ('full', 'abbreviated'):
                    return ft
        except (json.JSONDecodeError, IOError):
            pass
    return 'full'

def has_existing_code(project_path: str) -> bool:
    """Check if project has existing code files."""
    if not os.path.exists(project_path):
        return False
    
    code_extensions = ['.js', '.ts', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.cs', '.php', '.rb', '.swift', '.kt']
    config_files = ['package.json', 'requirements.txt', 'Cargo.toml', 'pom.xml', 'go.mod', 'Gemfile', 'composer.json']
    files_scanned = [0]
    MAX_SCAN_FILES = 10000
    
    def scan_directory(dir_path: str, depth: int = 0) -> bool:
        if depth > 3 or files_scanned[0] >= MAX_SCAN_FILES:
            return False
        
        try:
            for item in os.listdir(dir_path):
                files_scanned[0] += 1
                if files_scanned[0] >= MAX_SCAN_FILES:
                    return False
                if item.startswith('.') and item not in ['.env', '.aidlc']:
                    continue
                if item in ['node_modules', '__pycache__', 'target']:
                    continue
                
                item_path = os.path.join(dir_path, item)
                
                if os.path.isfile(item_path):
                    ext = os.path.splitext(item)[1]
                    if ext in code_extensions or item in config_files:
                        return True
                elif os.path.isdir(item_path):
                    if scan_directory(item_path, depth + 1):
                        return True
        except (PermissionError, OSError):
            pass
        
        return False
    
    return scan_directory(project_path)

def detect_current_phase(project_path: str) -> Optional[str]:
    """Detect current phase from current_phase.json."""
    aidlc_path = Path(project_path) / '.aidlc'
    if not aidlc_path.exists():
        return None
    
    phase_file = aidlc_path / 'current_phase.json'
    if phase_file.exists():
        try:
            with open(phase_file, 'r') as f:
                phase_data = json.load(f)
                if not isinstance(phase_data, dict):
                    return None
                phase = phase_data.get('currentPhase')
                if not phase or not isinstance(phase, str):
                    return None
                # Build valid set (including -ready variants) inline to avoid circular ref
                all_phases = set(PHASE_SEQUENCE_FULL + PHASE_SEQUENCE_ABBREVIATED)
                all_valid = all_phases | {p + '-ready' for p in all_phases}
                if phase not in all_valid:
                    return None
                return phase
        except (json.JSONDecodeError, IOError):
            pass
    
    return None

def detect_feature_name(project_path: str) -> Optional[str]:
    """Detect feature name from .aidlc directory."""
    aidlc_path = Path(project_path) / '.aidlc'
    if not aidlc_path.exists():
        return None
    
    try:
        feature_dirs = [d for d in aidlc_path.iterdir() if d.is_dir()]
        if feature_dirs:
            return feature_dirs[0].name
    except (PermissionError, OSError):
        pass
    
    return None

def detect_project_state(project_path: str) -> Dict[str, Any]:
    """Detect project state (Greenfield/Brownfield)."""
    aidlc_exists = (Path(project_path) / '.aidlc').exists()
    has_code = has_existing_code(project_path)
    
    if aidlc_exists:
        phase = detect_current_phase(project_path)
        if phase:
            # Existing AI-DLC project — resume regardless of code presence
            return {'type': 'Brownfield' if has_code else 'Greenfield', 'phase': phase, 'action': 'resume'}
        else:
            # .aidlc exists but no phase — stale, treat as fresh start
            return {'type': 'Brownfield' if has_code else 'Greenfield', 'phase': None, 'action': 'start'}
    
    # No .aidlc directory
    if has_code:
        return {'type': 'Brownfield', 'phase': None, 'action': 'start'}
    
    return {'type': 'Greenfield', 'phase': None, 'action': 'start'}

# --- Security helpers ---

def validate_project_path(path: str, must_exist: bool = True) -> str:
    """Validate and resolve project path. Raises ValueError on invalid input."""
    if not path or not isinstance(path, str):
        raise ValueError("projectPath must be a non-empty string")
    resolved = str(Path(path).resolve())
    if '..' in Path(path).parts:
        raise ValueError("projectPath must not contain '..' path traversal")
    if must_exist:
        if not os.path.exists(resolved):
            raise ValueError(f"projectPath does not exist: {resolved}")
        if not os.path.isdir(resolved):
            raise ValueError(f"projectPath is not a directory: {resolved}")
    return resolved


import re as _re

def sanitize_use_case(text: str, max_length: int = 1000) -> tuple:
    """Sanitize use case text. Returns (sanitized_text, was_truncated)."""
    if not isinstance(text, str):
        return ('', False)
    # Strip control characters (keep printable + common whitespace)
    cleaned = _re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text).strip()
    was_truncated = len(cleaned) > max_length
    return (cleaned[:max_length], was_truncated)


def validate_plan_file_path(path: str) -> str:
    """Validate plan file path resolves inside a .aidlc/ directory."""
    if not path or not isinstance(path, str):
        raise ValueError("planFile must be a non-empty string")
    resolved = Path(path).resolve()
    if '..' in Path(path).parts:
        raise ValueError("planFile must not contain '..' path traversal")
    parts = resolved.parts
    if '.aidlc' not in parts:
        raise ValueError("planFile must be inside a .aidlc/ directory")
    if not resolved.exists():
        raise ValueError(f"planFile does not exist: {resolved}")
    return str(resolved)


VALID_PHASES = set(PHASE_SEQUENCE_FULL + PHASE_SEQUENCE_ABBREVIATED)
VALID_PHASES_WITH_READY = VALID_PHASES | {p + '-ready' for p in VALID_PHASES}
VALID_FLOW_TYPES = {'full', 'abbreviated', 'auto'}
VALID_PROJECT_TYPES = {'Greenfield', 'Brownfield'}


def validate_required_string(args: dict, key: str) -> str:
    """Validate a required string parameter. Raises ValueError if missing/empty/not-string."""
    val = args.get(key)
    if not val or not isinstance(val, str):
        raise ValueError(f"'{key}' must be a non-empty string")
    return val


# MCP Server
app = Server("aidlc-mcp")

@app.list_tools()
async def list_tools() -> List[Tool]:
    """List available AI-DLC tools."""
    return [
        Tool(
            name="aidlc_start_project",
            description="Initialize AI-DLC project structure. Use when: starting a new AI-DLC workflow in an empty or existing codebase. Automatically detects Greenfield (new code) vs Brownfield (existing code). Defaults to full flow for both. Use abbreviated flow ONLY for simple bug fixes, typos, minor config changes, or small enhancements that don't require architectural decisions or unit decomposition.",
            inputSchema={
                "type": "object",
                "properties": {
                    "projectPath": {
                        "type": "string",
                        "description": "Absolute path to project directory (example: /Users/name/projects/my-app)"
                    },
                    "useCase": {
                        "type": "string",
                        "description": "What you want to build or fix (example: 'REST API for task management' or 'fix login timeout bug')"
                    },
                    "projectType": {
                        "type": "string",
                        "enum": ["Greenfield", "Brownfield"],
                        "description": "Optional override for auto-detection. Greenfield = new project with no existing code, Brownfield = existing codebase to enhance"
                    },
                    "flowType": {
                        "type": "string",
                        "enum": ["full", "abbreviated", "auto"],
                        "description": "Flow type: 'full' (default) = complete AI-DLC cycle with all phases including unit decomposition and domain modeling. Use for new features, major enhancements, migrations, or anything requiring architectural decisions. 'abbreviated' = streamlined lite phases for simple bug fixes, typos, minor config changes, or small enhancements that follow existing patterns without new architecture. 'auto' = defaults to full. Default: auto"
                    }
                },
                "required": ["projectPath", "useCase"]
            }
        ),
        Tool(
            name="aidlc_get_next_phase",
            description="Check current AI-DLC project status and get next phase to execute. Use when: resuming work on an existing AI-DLC project or after completing a phase. ALWAYS call this FIRST before other tools to understand project state.",
            inputSchema={
                "type": "object",
                "properties": {
                    "projectPath": {
                        "type": "string",
                        "description": "Absolute path to AI-DLC project directory (example: /Users/name/projects/my-app)"
                    }
                },
                "required": ["projectPath"]
            }
        ),
        Tool(
            name="aidlc_get_phase_prompt",
            description="Get detailed instructions for executing a specific AI-DLC phase. Use when: aidlc_get_next_phase tells you which phase to execute next. Returns complete prompt with planning steps, approval gates, and deliverables for that phase.",
            inputSchema={
                "type": "object",
                "properties": {
                    "phase": {
                        "type": "string",
                        "enum": ["discovery-0.1", "inception-1.1", "inception-1.2", "construction-2.1", "construction-2.2", "construction-2.3", "discovery-0.1-lite", "inception-1.1-lite", "construction-2.2-lite", "operations-3.1", "deployment-2.3-lite"],
                        "description": "AI-DLC phase: Full flow: discovery-0.1, inception-1.1, inception-1.2, construction-2.1, construction-2.2, construction-2.3. Abbreviated flow: discovery-0.1-lite, inception-1.1-lite, construction-2.2-lite, operations-3.1, deployment-2.3-lite."
                    },
                    "useCase": {
                        "type": "string",
                        "description": "Your use case description to inject into the prompt (example: 'task management app')"
                    },
                    "projectPath": {
                        "type": "string",
                        "description": "Project path for validation (example: /Users/name/projects/my-app)"
                    }
                },
                "required": ["phase"]
            }
        ),
        Tool(
            name="aidlc_update_project_plan",
            description="Update project plan file with answers to clarifying questions. Use when: you've asked the user clarifying questions and received answers that need to be incorporated into the plan before requesting approval.",
            inputSchema={
                "type": "object",
                "properties": {
                    "planFile": {
                        "type": "string",
                        "description": "Absolute path to plan markdown file (example: /Users/name/projects/my-app/.aidlc/feature/inception/stories_plan.md)"
                    },
                    "updates": {
                        "type": "string",
                        "description": "Updates to incorporate into the plan (example: 'User confirmed PostgreSQL database and REST API architecture')"
                    },
                    "title": {
                        "type": "string",
                        "description": "Title for approval request (example: 'Updated User Stories Plan with Database Choice')"
                    }
                },
                "required": ["planFile", "updates", "title"]
            }
        ),
        Tool(
            name="aidlc_request_phase_approval",
            description="Request human approval before proceeding with plan execution. Use when: you've created a plan and need explicit approval before executing it. This is a required gate in the AI-DLC methodology.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Approval request title (example: 'User Stories Plan Ready for Review')"
                    },
                    "steps": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of plan steps to approve (example: ['Analyze requirements', 'Create user stories', 'Define acceptance criteria'])"
                    }
                },
                "required": ["title", "steps"]
            }
        ),
        Tool(
            name="aidlc_set_phase_status",
            description="Update current AI-DLC phase status after completing deliverables. Use when: you've finished all deliverables for a phase and are ready to mark it complete or ready for next phase.",
            inputSchema={
                "type": "object",
                "properties": {
                    "projectPath": {
                        "type": "string",
                        "description": "Project directory absolute path (example: /Users/name/projects/my-app)"
                    },
                    "phase": {
                        "type": "string",
                        "enum": ["discovery-0.1", "discovery-0.1-ready", "inception-1.1", "inception-1.1-ready", "inception-1.2", "inception-1.2-ready", "construction-2.1", "construction-2.1-ready", "construction-2.2", "construction-2.2-ready", "construction-2.3", "construction-2.3-ready", "discovery-0.1-lite", "discovery-0.1-lite-ready", "inception-1.1-lite", "inception-1.1-lite-ready", "construction-2.2-lite", "construction-2.2-lite-ready", "operations-3.1", "operations-3.1-ready", "deployment-2.3-lite", "deployment-2.3-lite-ready"],
                        "description": "Phase status. Append '-ready' when phase is complete. Full flow: discovery-0.1, inception-1.1, inception-1.2, construction-2.1, construction-2.2, construction-2.3. Abbreviated flow: discovery-0.1-lite, inception-1.1-lite, construction-2.2-lite, operations-3.1, deployment-2.3-lite."
                    },
                    "feature": {
                        "type": "string",
                        "description": "Feature name (optional, auto-detected if not provided)"
                    }
                },
                "required": ["projectPath", "phase"]
            }
        ),
        Tool(
            name="aidlc_integrate_code",
            description="Move generated code from .aidlc staging area into main repository structure. Use when: construction-2.2 (implementation) or construction-2.3 (deployment) phases are complete. Behavior: Greenfield projects integrate both implementation and deployment code automatically. Brownfield projects integrate deployment code only (ask user before integrating implementation to avoid conflicts).",
            inputSchema={
                "type": "object",
                "properties": {
                    "projectPath": {
                        "type": "string",
                        "description": "Project directory absolute path (example: /Users/name/projects/my-app)"
                    },
                    "feature": {
                        "type": "string",
                        "description": "Feature name to integrate (optional, auto-detected if not provided)"
                    }
                },
                "required": ["projectPath"]
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
    """Handle tool calls."""
    try:
        if name == "aidlc_start_project":
            return await start_project(arguments)
        elif name == "aidlc_get_next_phase":
            return await get_next_phase_tool(arguments)
        elif name == "aidlc_get_phase_prompt":
            return await get_prompt(arguments)
        elif name == "aidlc_update_project_plan":
            return await update_plan(arguments)
        elif name == "aidlc_request_phase_approval":
            return await request_approval(arguments)
        elif name == "aidlc_set_phase_status":
            return await update_phase(arguments)
        elif name == "aidlc_integrate_code":
            return await integrate_code(arguments)
        else:
            raise ValueError(f"Unknown tool: {name}")
    except ValueError as e:
        return [TextContent(type="text", text=f"❌ Validation error: {e}")]
    except Exception as e:
        print(f"Error in {name}: {type(e).__name__}: {e}", file=sys.stderr)
        return [TextContent(type="text", text=f"❌ Operation failed: {type(e).__name__}. Check server logs for details.")]

# Tool implementations (simplified for initial conversion)
async def start_project(args: Dict[str, Any]) -> List[TextContent]:
    """Initialize AI-DLC project."""
    project_path = validate_project_path(args['projectPath'], must_exist=False)
    use_case, use_case_truncated = sanitize_use_case(validate_required_string(args, 'useCase'))
    flow_type = args.get('flowType', 'auto')
    if flow_type not in VALID_FLOW_TYPES:
        raise ValueError(f"flowType must be one of: {', '.join(VALID_FLOW_TYPES)}")
    project_type_override = args.get('projectType')
    if project_type_override and project_type_override not in VALID_PROJECT_TYPES:
        raise ValueError(f"projectType must be one of: {', '.join(VALID_PROJECT_TYPES)}")
    
    # Detect project state
    state = detect_project_state(project_path)
    
    # Determine flow type
    if flow_type == 'auto':
        # Both Greenfield and Brownfield default to full flow
        # Abbreviated (lite) is only used when explicitly requested
        flow_type = 'full'
    
    # Create .aidlc structure
    aidlc_path = Path(project_path) / '.aidlc'
    aidlc_path.mkdir(exist_ok=True)
    
    # Create feature directory
    feature_name = use_case.lower().replace(' ', '-')[:50]
    feature_path = aidlc_path / feature_name
    feature_path.mkdir(exist_ok=True)
    
    # Create phase subdirectories based on flow type
    if flow_type == 'abbreviated':
        for subdir in ['discovery', 'inception', 'construction', 'operations', 'deployment']:
            (feature_path / subdir).mkdir(exist_ok=True)
    else:
        for subdir in ['discovery', 'inception', 'inception/units', 'construction', 'deployment']:
            (feature_path / subdir).mkdir(parents=True, exist_ok=True)
    
    # Determine initial phase based on flow type
    if flow_type == 'abbreviated':
        initial_phase = 'discovery-0.1-lite'
    elif state['type'] == 'Brownfield':
        initial_phase = 'discovery-0.1'
    else:
        initial_phase = 'inception-1.1'
    
    # Initialize current_phase.json
    phase_file = aidlc_path / 'current_phase.json'
    phase_data = {
        'currentPhase': initial_phase,
        'feature': feature_name,
        'flowType': flow_type,
        'lastUpdated': datetime.now().isoformat()
    }
    
    with open(phase_file, 'w') as f:
        json.dump(phase_data, f, indent=2)
    
    flow_label = "Abbreviated (bug fix / minor enhancement)" if flow_type == "abbreviated" else "Full AI-DLC"
    truncation_warning = "\n\n⚠️ **Warning**: Your use case description was truncated to 1000 characters." if use_case_truncated else ""
    
    return [TextContent(
        type="text",
        text=f"✅ **AI-DLC Project Initialized**\n\nProject Type: {state['type']}\nFlow: {flow_label}\nFeature: {feature_name}\nStarting Phase: {initial_phase}\n\nUse `aidlc_get_next_phase` to continue.{truncation_warning}"
    )]

async def get_next_phase_tool(args: Dict[str, Any]) -> List[TextContent]:
    """Get next phase information."""
    project_path = validate_project_path(args.get('projectPath', '.'))
    
    current_phase = detect_current_phase(project_path)
    flow_type = get_flow_type(project_path)
    
    if not current_phase:
        return [TextContent(
            type="text",
            text="No AI-DLC project found. Use `aidlc_start_project` to initialize."
        )]
    
    # Strip -ready suffix for phase lookup
    phase_for_lookup = current_phase.replace('-ready', '')
    next_phase = get_next_phase(phase_for_lookup, flow_type)
    
    if next_phase:
        return [TextContent(
            type="text",
            text=f"Current Phase: {current_phase}\nFlow: {flow_type}\nNext Phase: {next_phase}\n\nUse `aidlc_get_prompt` with step=\"{next_phase}\" to continue."
        )]
    else:
        return [TextContent(
            type="text",
            text=f"✅ All phases complete!\n\nCurrent Phase: {current_phase}\nFlow: {flow_type}"
        )]

async def get_prompt(args: Dict[str, Any]) -> List[TextContent]:
    """Get prompt for a specific phase."""
    phase = validate_required_string(args, 'phase')
    if phase not in VALID_PHASES:
        raise ValueError(f"phase must be one of: {', '.join(sorted(VALID_PHASES))}")
    use_case = args.get('useCase', '')
    if use_case:
        use_case, _ = sanitize_use_case(use_case)
    project_path = args.get('projectPath', '.')
    if args.get('projectPath'):
        project_path = validate_project_path(project_path)
    
    prompt = PROMPTS.get(phase, "Prompt not found for this phase.")
    
    if use_case:
        prompt = prompt.replace('{use-case}', use_case)
    
    feature = detect_feature_name(project_path)
    if feature:
        prompt = prompt.replace('{current-feature}', feature)
    
    return [TextContent(type="text", text=prompt)]

async def update_plan(args: Dict[str, Any]) -> List[TextContent]:
    """Update plan file."""
    plan_file = validate_plan_file_path(args['planFile'])
    updates = validate_required_string(args, 'updates')
    
    # Read existing plan
    with open(plan_file, 'r') as f:
        content = f.read()
    
    # Append updates
    updated_content = f"{content}\n\n## Updates\n\n{updates}"
    
    with open(plan_file, 'w') as f:
        f.write(updated_content)
    
    return [TextContent(
        type="text",
        text=f"✅ Plan updated: {plan_file}"
    )]

async def request_approval(args: Dict[str, Any]) -> List[TextContent]:
    """Request approval."""
    title = validate_required_string(args, 'title')
    steps = args.get('steps')
    if not steps or not isinstance(steps, list) or not all(isinstance(s, str) for s in steps):
        raise ValueError("'steps' must be a non-empty list of strings")
    
    steps_text = '\n'.join(f"- {step}" for step in steps)
    
    return [TextContent(
        type="text",
        text=f"📋 **Approval Required: {title}**\n\n{steps_text}\n\n⛔ WAITING FOR USER APPROVAL. Do NOT proceed until the user explicitly approves. Ask the user to review the plan above and confirm."
    )]

async def update_phase(args: Dict[str, Any]) -> List[TextContent]:
    """Update current phase."""
    project_path = validate_project_path(args['projectPath'])
    phase = validate_required_string(args, 'phase')
    if phase not in VALID_PHASES_WITH_READY:
        raise ValueError(f"phase must be a valid AI-DLC phase or phase-ready value")
    feature = args.get('feature')
    
    aidlc_path = Path(project_path) / '.aidlc'
    phase_file = aidlc_path / 'current_phase.json'
    
    # Read existing data to preserve flowType
    flow_type = get_flow_type(project_path)
    
    # Get feature name if not provided
    if not feature:
        feature_dirs = [d for d in aidlc_path.iterdir() if d.is_dir()]
        if feature_dirs:
            feature = feature_dirs[0].name
    
    phase_data = {
        'currentPhase': phase,
        'feature': feature,
        'flowType': flow_type,
        'lastUpdated': datetime.now().isoformat()
    }
    
    with open(phase_file, 'w') as f:
        json.dump(phase_data, f, indent=2)
    
    return [TextContent(
        type="text",
        text=f"""✅ **Phase Updated**

Current phase: {phase}
Feature: {feature}
Updated: {phase_data['lastUpdated']}

Use `aidlc_get_next_phase` to see what's next."""
    )]

def detect_project_structure(project_path: str) -> Dict[str, Any]:
    """Detect project language, type, and structure."""
    config_files = {
        'package.json': {'language': 'JavaScript/TypeScript', 'type': 'Node.js'},
        'requirements.txt': {'language': 'Python', 'type': 'Python'},
        'setup.py': {'language': 'Python', 'type': 'Python'},
        'pom.xml': {'language': 'Java', 'type': 'Maven'},
        'build.gradle': {'language': 'Java', 'type': 'Gradle'},
        'Cargo.toml': {'language': 'Rust', 'type': 'Rust'},
        'go.mod': {'language': 'Go', 'type': 'Go'},
        'Gemfile': {'language': 'Ruby', 'type': 'Ruby'}
    }
    
    project_info = {'language': 'Unknown', 'type': 'Unknown', 'isGreenfield': True}
    
    for file, info in config_files.items():
        if (Path(project_path) / file).exists():
            project_info.update(info)
            break
    
    # Check if Brownfield
    project_info['isGreenfield'] = not has_existing_code(project_path)
    
    # Analyze structure
    if not project_info['isGreenfield']:
        project_info['structure'] = analyze_existing_structure(project_path)
    else:
        project_info['structure'] = get_best_practice_structure(project_info['type'])
    
    return project_info

def analyze_existing_structure(project_path: str) -> Dict[str, Optional[str]]:
    """Analyze existing project structure."""
    structure = {
        'models': None,
        'services': None,
        'controllers': None,
        'handlers': None,
        'utils': None,
        'tests': None
    }
    
    search_patterns = {
        'models': ['models', 'model', 'domain', 'entities', 'entity'],
        'services': ['services', 'service'],
        'controllers': ['controllers', 'controller'],
        'handlers': ['handlers', 'handler', 'routes', 'api'],
        'utils': ['utils', 'util', 'helpers', 'helper', 'lib'],
        'tests': ['tests', 'test', '__tests__', 'spec']
    }
    
    items_scanned = [0]
    MAX_SCAN = 10000

    def scan_dir(dir_path: Path, depth: int = 0):
        if depth > 3 or not dir_path.exists() or items_scanned[0] >= MAX_SCAN:
            return
        
        try:
            for item in dir_path.iterdir():
                items_scanned[0] += 1
                if items_scanned[0] >= MAX_SCAN:
                    return
                if item.name in ['.aidlc', 'node_modules', '.git']:
                    continue
                
                if not item.is_dir():
                    continue
                
                item_lower = item.name.lower()
                for type_name, patterns in search_patterns.items():
                    if any(p in item_lower for p in patterns) and not structure[type_name]:
                        structure[type_name] = str(item.relative_to(project_path))
                
                scan_dir(item, depth + 1)
        except Exception:
            pass
    
    scan_dir(Path(project_path))
    return structure

def get_best_practice_structure(project_type: str) -> Dict[str, str]:
    """Get best practice directory structure."""
    structures = {
        'Node.js': {
            'models': 'src/models',
            'services': 'src/services',
            'controllers': 'src/controllers',
            'handlers': 'src/handlers',
            'utils': 'src/utils',
            'tests': 'tests'
        },
        'Python': {
            'models': 'src/models',
            'services': 'src/services',
            'controllers': 'src/controllers',
            'handlers': 'src/handlers',
            'utils': 'src/utils',
            'tests': 'tests'
        },
        'Maven': {
            'models': 'src/main/java/models',
            'services': 'src/main/java/services',
            'controllers': 'src/main/java/controllers',
            'handlers': 'src/main/java/handlers',
            'utils': 'src/main/java/utils',
            'tests': 'src/test/java'
        },
        'Go': {
            'models': 'internal/models',
            'services': 'internal/services',
            'controllers': 'internal/controllers',
            'handlers': 'internal/handlers',
            'utils': 'pkg/utils',
            'tests': 'tests'
        },
        'Rust': {
            'models': 'src/models',
            'services': 'src/services',
            'controllers': 'src/controllers',
            'handlers': 'src/handlers',
            'utils': 'src/utils',
            'tests': 'tests'
        }
    }
    
    return structures.get(project_type, structures['Node.js'])

def classify_file(filename: str, file_path: str) -> str:
    """Classify file type based on name and content."""
    lower = filename.lower()
    
    # Check filename patterns
    if 'model' in lower or 'entity' in lower:
        return 'models'
    if 'service' in lower:
        return 'services'
    if 'controller' in lower:
        return 'controllers'
    if 'handler' in lower or 'route' in lower:
        return 'handlers'
    if 'util' in lower or 'helper' in lower:
        return 'utils'
    if 'test' in lower or 'spec' in lower:
        return 'tests'
    
    # Check content
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        if 'class' in content and 'Model' in content:
            return 'models'
        if 'Service' in content or 'service' in content:
            return 'services'
        if 'Controller' in content or 'controller' in content:
            return 'controllers'
        if 'handler' in content or 'Handler' in content:
            return 'handlers'
    except Exception:
        pass
    
    return 'services'

def get_destination_path(project_path: str, project_info: Dict, file_type: str, filename: str) -> str:
    """Get destination path for file."""
    structure = project_info['structure']
    target_dir = structure.get(file_type) or structure.get('services') or 'src'
    return str(Path(project_path) / target_dir / filename)

def get_infrastructure_path(project_path: str) -> str:
    """Get infrastructure directory path."""
    infra_dirs = ['infrastructure', 'infra', 'cdk', 'terraform', 'cloudformation', 'iac']
    
    for dir_name in infra_dirs:
        dir_path = Path(project_path) / dir_name
        if dir_path.exists():
            return str(dir_path)
    
    return str(Path(project_path) / 'infrastructure')

async def integrate_code(args: Dict[str, Any]) -> List[TextContent]:
    """Integrate code from .aidlc into project."""
    project_path = validate_project_path(args['projectPath'])
    feature = args.get('feature')
    
    aidlc_path = Path(project_path) / '.aidlc'
    project_root = Path(project_path).resolve()
    
    def validate_dest(dest: Path):
        """Ensure destination resolves within project root and is not a symlink."""
        if dest.is_symlink():
            raise ValueError(f"Destination is a symlink (rejected): {dest}")
        resolved = dest.resolve()
        if not str(resolved).startswith(str(project_root)):
            raise ValueError(f"Destination escapes project root: {resolved}")
        return resolved

    def backup_if_exists(dest: Path):
        """Backup existing file to .aidlc/backups/latest/ before overwriting."""
        if dest.exists():
            backup_dir = aidlc_path / 'backups' / 'latest'
            backup_dir.mkdir(parents=True, exist_ok=True)
            rel = dest.relative_to(project_root)
            backup_dest = backup_dir / rel
            backup_dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.is_dir():
                if backup_dest.exists():
                    shutil.rmtree(backup_dest)
                shutil.copytree(dest, backup_dest)
            else:
                shutil.copy2(dest, backup_dest)

    def log_operation(src: str, dest: str):
        """Append to integration log."""
        log_file = aidlc_path / 'integration.log'
        with open(log_file, 'a') as f:
            f.write(f"{datetime.now().isoformat()} COPY {src} -> {dest}\n")

    # Get feature name
    if not feature:
        feature_dirs = [d for d in aidlc_path.iterdir() if d.is_dir() and d.name != 'backups']
        if feature_dirs:
            feature = feature_dirs[0].name
    
    if not feature:
        raise ValueError('No feature found in .aidlc directory')
    
    # Clear previous backup
    backup_latest = aidlc_path / 'backups' / 'latest'
    if backup_latest.exists():
        shutil.rmtree(backup_latest)
    
    feature_path = aidlc_path / feature
    construction_path = feature_path / 'construction'
    deployment_path = feature_path / 'deployment'
    
    # Detect project structure
    project_info = detect_project_structure(project_path)
    is_greenfield = project_info['isGreenfield']
    moved_files = []
    
    # Move implementation files (only for Greenfield)
    if is_greenfield and construction_path.exists():
        for unit_dir in construction_path.iterdir():
            if not unit_dir.is_dir():
                continue
            
            for file in unit_dir.iterdir():
                if file.suffix == '.md' or file.name.startswith('.') or file.name == '__pycache__':
                    continue
                
                if file.is_file():
                    file_type = classify_file(file.name, str(file))
                    dest_path = Path(get_destination_path(project_path, project_info, file_type, file.name))
                    validate_dest(dest_path)
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    backup_if_exists(dest_path)
                    shutil.copy2(file, dest_path)
                    log_operation(str(file), str(dest_path))
                    moved_files.append(str(dest_path.relative_to(project_path)))
    
    # Move deployment files
    if deployment_path.exists():
        infra_path = get_infrastructure_path(project_path)
        Path(infra_path).mkdir(parents=True, exist_ok=True)
        
        for item in deployment_path.iterdir():
            if item.name.startswith('.') or item.name == '__pycache__':
                continue
            
            if item.is_file():
                if item.suffix != '.md':
                    dest_file = Path(infra_path) / item.name
                    validate_dest(dest_file)
                    backup_if_exists(dest_file)
                    shutil.copy2(item, dest_file)
                    log_operation(str(item), str(dest_file))
                    moved_files.append(str(dest_file.relative_to(project_path)))
            elif item.is_dir():
                dest_dir = Path(infra_path) / item.name
                validate_dest(dest_dir)
                backup_if_exists(dest_dir)
                if dest_dir.exists():
                    shutil.rmtree(dest_dir)
                shutil.copytree(item, dest_dir)
                log_operation(str(item), str(dest_dir))
                moved_files.append(str(dest_dir.relative_to(project_path)) + '/')
    
    files_list = '\n'.join(f"- {f}" for f in moved_files)
    
    integration_type = "Greenfield (implementation + deployment)" if is_greenfield else "Brownfield (deployment only)"
    
    return [TextContent(
        type="text",
        text=f"""✅ **Code Integration Complete!**

Project Type: {project_info['type']} ({'Greenfield' if is_greenfield else 'Brownfield'})
Integration: {integration_type}
Language: {project_info['language']}

Moved {len(moved_files)} items from `.aidlc/{feature}/` to your repository:

{files_list}

All planning artifacts remain in `.aidlc/{feature}/` for reference.

Your code is now integrated and ready to use! 🚀"""
    )]

async def async_main():
    """Async main entry point."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())

def main():
    """Sync entry point for console scripts."""
    import asyncio
    asyncio.run(async_main())

if __name__ == "__main__":
    main()
