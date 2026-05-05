# AI-DLC MCP Server

## Introduction

This pattern provides a **Model Context Protocol (MCP) server** that implements the [AI-Driven Development Life Cycle (AI-DLC)](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/) methodology as structured tool calls. Instead of relying on AI agents to interpret markdown rules, the server enforces the workflow programmatically — with validated inputs, phase gate transitions, persistent state tracking, and centralized prompt customization.

This is a **complementary approach** to the rules-based [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows). Both can be used independently or together:

| | Rules-based (aidlc-workflows) | Server-based (this pattern) |
|---|---|---|
| **How it works** | Agent reads markdown context files | Agent calls MCP tools with typed parameters |
| **Phase enforcement** | Agent interprets rules | Server validates transitions programmatically |
| **Cross-session state** | Agent re-reads rules each session | `current_phase.json` persists across sessions |
| **Prompt customization** | Edit scattered markdown files | Single `prompts.py` module |
| **Dependencies** | None (copy files) | Python 3.10+, `mcp` package |

### Key Features

- **Full & Abbreviated Flows**: Full cycle for complex features (all phases from inception through deployment); abbreviated for bug fixes and minor enhancements (streamlined phases, no unit decomposition or domain modeling). Both Greenfield and Brownfield default to the full flow — abbreviated (lite) is only used when explicitly requested via `flowType: "abbreviated"`
- **Intelligent Project Detection**: Auto-detects Greenfield vs Brownfield projects
- **Human-in-the-Loop Approval**: Agents request approval before executing plans
- **Security Hardened**: Path traversal prevention, input sanitization, error sanitization, symlink rejection
- **Resume Support**: Pick up where you left off across chat sessions

## Solution Architecture

```
┌─────────────────┐
│   MCP Client    │  (Kiro CLI, Q CLI, Claude Desktop, Cursor, Cline)
│  (AI Assistant) │
└────────┬────────┘
         │ MCP Protocol (stdio)
         ▼
┌─────────────────┐     ┌──────────────────┐
│  AI-DLC MCP     │────▶│  prompts.py      │
│  Server         │     │  (customizable)  │
│  (server.py)    │     └──────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  .aidlc/        │  Project state, plans, artifacts, backups
│  (persistent)   │
└─────────────────┘
```

### How It Works

1. **Start**: Agent calls `aidlc_start_project` — detects project type, creates `.aidlc/` structure, selects flow
2. **Guide**: Agent calls `aidlc_get_phase_prompt` — gets phase-specific instructions with sanitized use case
3. **Plan**: Agent creates plan with checkboxes, asks clarifying questions, requests human approval
4. **Execute**: Agent follows approved plan step-by-step, updates plan via `aidlc_update_project_plan`
5. **Progress**: Agent calls `aidlc_set_phase_status` to advance — server validates the transition
6. **Integrate**: Agent calls `aidlc_integrate_code` to move generated code into the project (with backup + logging)

### MCP Tools

| Tool | Description |
|------|-------------|
| `aidlc_start_project` | Initialize AI-DLC project, detect Greenfield/Brownfield, select flow |
| `aidlc_get_phase_prompt` | Get phase-specific prompt with use case interpolation |
| `aidlc_get_next_phase` | Get the next recommended phase based on current project state |
| `aidlc_set_phase_status` | Advance phase with validated transitions |
| `aidlc_update_project_plan` | Update plan with clarifying question answers |
| `aidlc_request_phase_approval` | Request mandatory human approval before executing a plan |
| `aidlc_integrate_code` | Copy generated code into project with dest validation, backup, logging |

## Repository Structure

```
all-phases-aidlc-mcp/
├── README.md                    # This file
├── pyproject.toml               # Python package configuration
├── PROMPTS_CUSTOMIZATION.md     # Guide to customizing phase prompts
├── src/
│   └── aidlc_mcp/
│       ├── __init__.py
│       ├── server.py            # MCP server with security controls
│       └── prompts.py           # Phase-specific prompt templates
└── tests/
    ├── test_flows.py            # Flow and phase transition tests
    └── test_security.py         # Security control tests
```

## Prerequisites

- **Python** 3.10 or higher
- **pip** (Python package manager)
- **MCP-compatible client**: Kiro CLI, Amazon Q CLI, Claude Desktop, Cursor, Cline, or any MCP client

## Deployment Instructions

### Step 1: Install the MCP Server

```bash
cd all-phases/all-phases-aidlc-mcp
pip install -e .
```

### Step 2: Configure Your MCP Client

Add to your MCP client configuration:

**Kiro CLI** (`~/.kiro/settings/mcp.json`):
```json
{
  "mcpServers": {
    "aidlc": {
      "command": "python",
      "args": ["-m", "aidlc_mcp.server"]
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "aidlc": {
      "command": "python",
      "args": ["-m", "aidlc_mcp.server"]
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "aidlc": {
      "command": "python",
      "args": ["-m", "aidlc_mcp.server"]
    }
  }
}
```

### Step 3: Start Using AI-DLC

Tell your AI agent what you want to build:

> "I want to start an AI-DLC project to build a task management API"

The agent will automatically call the MCP tools to initialize the project, guide you through phases, and request approvals at each gate.

## Prompt Customization

All phase prompts are centralized in a single `prompts.py` module, making it easy to customize the AI-DLC workflow for your organization's standards, frameworks, or domain-specific requirements. See [PROMPTS_CUSTOMIZATION.md](PROMPTS_CUSTOMIZATION.md) for the full guide.

Key customization options:
- Modify phase-specific instructions (e.g., require specific design patterns or testing frameworks)
- Add organization-specific context to every phase prompt
- Inject project-specific guidance via the `useCase` parameter
- Add custom phases to the sequence

This is a key differentiator from the rules-based approach — instead of editing scattered markdown files and hoping the agent interprets your changes consistently, you modify a single Python module and every tool call reflects the change deterministically.

## Test

### Verify Installation

```bash
# Server should start and wait for MCP messages on stdin
python -m aidlc_mcp.server
# Press Ctrl+C to exit
```

### Verify with MCP Client

1. Start your MCP client
2. Ask: "What AI-DLC tools do you have?" (should list 7 tools)
3. Create a new directory and say: "Start an AI-DLC project to build a hello world app"
4. Verify the agent creates `.aidlc/` and begins the inception phase

## Clean Up

```bash
# Uninstall the package
pip uninstall aidlc-mcp

# Remove MCP configuration entry from your client config file

# Remove AI-DLC artifacts from a project
rm -rf .aidlc/
```

## Security

This server includes security hardening:

- **Path traversal prevention**: Rejects `..` in all path parameters
- **Input sanitization**: Type checking, enum validation, required field enforcement
- **Use case sanitization**: 1000 character limit, control character stripping
- **Error sanitization**: Generic errors to client, details to stderr
- **Symlink rejection**: `integrate_code` rejects symlink destinations
- **Resource limits**: 10K file cap on filesystem scanning
- **Pinned dependency**: `mcp~=1.16.0`

See [CONTRIBUTING](../../CONTRIBUTING.md) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](../../LICENSE) file.

## Disclaimer

The solution architecture sample code is provided without any guarantees, and you're not recommended to use it for production-grade workloads. The intention is to provide content to build and learn. Be sure of reading the licensing terms.
