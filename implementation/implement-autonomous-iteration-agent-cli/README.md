# ralph-kiro

Ralph Wiggum iterative loop system for [Kiro CLI](https://kiro.dev) - enables autonomous AI development loops that iterate until task completion.

Based on [Geoffrey Huntley's Ralph](https://github.com/ghuntley/how-to-ralph-wiggum) methodology.

## What is Ralph?

Ralph is a bash orchestrator that runs Kiro CLI in a loop, allowing the AI agent to work autonomously on a task until completion. The agent:

1. Reads `progress.txt` to see what's already done
2. Chooses the highest priority task (not necessarily the first)
3. Implements it with proper feedback loops (tests, types, lint)
4. Commits and updates progress
5. Continues until outputting a completion promise

## Installation

**Prerequisites:** [Kiro CLI](https://kiro.dev) must be installed (`kiro` command available)

```bash
# Clone to home directory
git clone https://github.com/aws-samples/sample-ai-powered-sdlc-patterns-with-aws.git ~/sample-ai-powered-sdlc-patterns-with-aws

# Add to PATH permanently
echo 'export PATH="$HOME/sample-ai-powered-sdlc-patterns-with-aws/implementation/implement-autonomous-iteration-agent-cli/bin:$PATH"' >> ~/.zshrc  # or ~/.bashrc
source ~/.zshrc

# Install the Ralph agent to Kiro CLI
ralph-kiro setup
```

## Quick Start

```bash
# Navigate to your project
cd ~/your-project

# Create a prd.json or prd.md with requirements (see examples below)

# Run Ralph loop
ralph-kiro init "Build the app described in prd.json"
ralph-kiro iterate           # Continue iterating
ralph-kiro status            # Check progress
```

## AWS Profile Support

Deploy to AWS with a specific profile:

```bash
ralph-kiro init "Deploy a serverless API" --aws-profile my-profile
```

Or use your default profile:
```bash
ralph-kiro init "Deploy a Lambda function"  # Uses 'default' profile
```

The AWS profile is persisted across iterations, so `ralph-kiro iterate` will continue using the same profile.

> ⚠️ **Security Warning:** When using `--aws-profile`, ensure the profile follows the principle of least privilege with only the permissions required for your specific task. The agent will have access to whatever AWS resources the profile permits.

## PRD Format

Ralph supports two PRD formats:

- **prd.json** - Structured JSON format (examples below)
- **prd.md** - Human-readable Markdown format (easier to write and edit)

Both formats work identically. Use whichever you prefer!

## Examples

### Serverless Hello World API

**prd.json:**
```json
{
  "name": "Serverless Hello World API",
  "description": "A simple serverless REST API using AWS SAM",
  "requirements": [
    "Create an AWS SAM application with API Gateway and Lambda",
    "Lambda function returns JSON: {\"message\": \"Hello from Ralph!\"}",
    "Use Python 3.12 runtime",
    "Deploy to AWS using sam build && sam deploy --guided",
    "Test the endpoint returns 200 OK with the message"
  ],
  "success_criteria": [
    "API endpoint is accessible via HTTPS",
    "Returns correct JSON response",
    "Deployed stack visible in CloudFormation"
  ]
}
```

**Run it:**
```bash
mkdir my-serverless-app && cd my-serverless-app
# Save the PRD above as prd.json

ralph-kiro init "Build and deploy the serverless app described in prd.json" --aws-profile default
ralph-kiro iterate
```

### UI Dashboard

**prd.json:**
```json
{
  "name": "Sales Dashboard",
  "description": "A React dashboard showing sales metrics",
  "requirements": [
    "Create a React app with Vite",
    "Show 4 metric cards: Revenue, Orders, Customers, Conversion Rate",
    "Use mock data (no backend needed)",
    "Add a simple bar chart using recharts",
    "Make it responsive for mobile"
  ],
  "success_criteria": [
    "App runs without errors",
    "All 4 metrics display correctly",
    "Chart renders with sample data"
  ]
}
```

```bash
mkdir sales-dashboard && cd sales-dashboard
ralph-kiro init "Build the dashboard from prd.json"
ralph-kiro iterate
```

### Simple Todo App

**prd.json:**
```json
{
  "name": "todo-app",
  "description": "A simple todo list application",
  "requirements": [
    "Create index.html with a todo list UI",
    "Add ability to add new todos",
    "Add ability to mark todos as complete",
    "Add ability to delete todos"
  ],
  "testCases": [
    "index.html exists",
    "Can add a new todo item",
    "Can mark todo as complete",
    "Can delete a todo"
  ]
}
```

## How It Works

1. You provide a prompt with clear completion criteria
2. The orchestrator runs `kiro-cli chat` with the `ralph` agent
3. Agent reads `progress.txt` to see what's already done
4. Agent chooses highest priority task (not necessarily first)
5. Agent implements, runs feedback loops (tests/types/lint)
6. Agent commits and updates `progress.txt`
7. If `<promise>COMPLETION_PROMISE</promise>` detected → loop ends
8. Otherwise → next iteration

## Commands

| Command | Description |
|---------|-------------|
| `ralph-kiro setup` | Install ralph agent to ~/.kiro/agents/ |
| `ralph-kiro init "task"` | Start a new project |
| `ralph-kiro init "task" --aws-profile NAME` | Start with specific AWS profile |
| `ralph-kiro iterate` | Continue working |
| `ralph-kiro iterate --max 5` | Run up to 5 iterations |
| `ralph-kiro status` | Check progress |
| `ralph-kiro reset` | Start fresh |

## Options

```
--max-iterations N      Stop after N iterations (default: 50)
--aws-profile NAME      AWS profile for deployments (default: default)
--completion-promise S  Phrase that signals completion (default: DONE)
--agent NAME            Custom agent to use (default: ralph)
--delay SECONDS         Delay between iterations (default: 2)
--verbose               Show detailed output
--version, -v           Show version number
--help, -h              Show help message
```

## Key Concepts

### Progress File
Create `progress.txt` in your project. The agent reads it each iteration to avoid re-exploring completed work.

### Structured PRDs
Use `prd.json` (structured JSON) or `prd.md` (human-readable Markdown) with clear requirements and success criteria. Both formats work identically - choose whichever is easier for you to write and maintain.

### Prioritization Order
1. Architectural decisions (HIGH)
2. Integration points (HIGH)
3. Unknown unknowns (HIGH)
4. Standard features (MEDIUM)
5. Polish/quick wins (LOW)

## Prerequisites

- [Kiro CLI](https://kiro.dev) installed
- Node.js (for npx commands)
- Python uv/uvx (for MCP servers)
- jq (for JSON processing)
- AWS SAM CLI (for serverless deployments)

## Package Contents

- `bin/ralph-kiro` - Main orchestrator script
- `lib/agents/ralph.json` - Kiro agent configuration
- `lib/steering/ralph-methodology.md` - Methodology documentation
- `lib/templates/prd-example.json` - PRD template

## Uninstall

```bash
rm -rf ~/sample-ai-powered-sdlc-patterns-with-aws/implementation/implement-autonomous-iteration-agent-cli ~/.kiro/agents/ralph.json
# Remove the PATH line from ~/.zshrc
```

## Credits

- [Geoffrey Huntley's Ralph](https://github.com/ghuntley/how-to-ralph-wiggum) - Original Ralph methodology
- [Kiro](https://kiro.dev) - AI-powered IDE

## License

This library is licensed under the MIT-0 License. See the LICENSE file.


