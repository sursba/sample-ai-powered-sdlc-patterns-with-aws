# ralph-kiro

Ralph Wiggum iterative loop system for [Kiro CLI](https://kiro.dev) — enables autonomous AI development loops that iterate until task completion. Now with a web-based Studio dashboard powered by the Agent Client Protocol (ACP).

Based on [Geoffrey Huntley's Ralph](https://github.com/ghuntley/how-to-ralph-wiggum) methodology.

## Installation

**Prerequisites:** [Kiro CLI](https://kiro.dev/docs/cli/installation/) installed, Node.js

```bash
git clone https://github.com/abhikarode/ralph-kiro.git ~/ralph-kiro
echo 'export PATH="$HOME/ralph-kiro/bin:$PATH"' >> ~/.zshrc  # or ~/.bashrc
source ~/.zshrc
ralph-kiro setup
```

## Quick Start (CLI)

```bash
cd ~/your-project

# Simple prompt
ralph-kiro init "Build a todo app with React and local storage"
ralph-kiro iterate

# Generate PRD from natural language, then build
ralph-kiro plan "I want a serverless API with DynamoDB"
ralph-kiro init "Build the application described in prd.json"
ralph-kiro iterate

# Check progress / run judge review
ralph-kiro status
ralph-kiro review
```

## Quick Start (Studio Dashboard)

```bash
cd ~/your-project
ralph-kiro studio
# Opens http://localhost:3456
```

The Studio provides a visual dashboard for the full Ralph loop lifecycle:
- Set project directory and AWS profile from a dropdown
- Click "Connect ACP" to start the agent
- Type a prompt and click "Init & Iterate" to start building
- Watch real-time agent output in the Agent Feed
- Monitor task graph, git timeline, progress, and AGENTS.md live
- Generate PRDs, run judge reviews, and manage iterations — all from the browser

## AWS Profile Support

```bash
ralph-kiro init "Deploy a serverless API" --aws-profile my-profile
```

The AWS profile persists across iterations. In Studio mode, profiles are auto-loaded from `~/.aws/config`.

> ⚠️ **Security Warning:** When using `--aws-profile`, ensure the profile follows the principle of least privilege. The agent will have access to whatever AWS resources the profile permits.

## PRD Format

Ralph supports two PRD formats:

- **prd.json** — Structured JSON with categories, priorities, and success criteria
- **prd.md** — Human-readable Markdown (bullet points parsed as tasks, `##` headings as categories)

Both formats auto-generate a structured task graph (`.kiro/tasks.json`) on init.

## Commands

| Command | Description |
|---------|-------------|
| `ralph-kiro setup` | Install ralph agent to ~/.kiro/agents/ |
| `ralph-kiro plan "description"` | Generate prd.json from natural language |
| `ralph-kiro init "task"` | Start a new Ralph loop |
| `ralph-kiro iterate` | Continue iterating |
| `ralph-kiro iterate --max 5` | Run up to 5 iterations |
| `ralph-kiro review` | Judge pass — read-only progress assessment |
| `ralph-kiro studio` | Launch web UI dashboard (ACP-powered) |
| `ralph-kiro status` | Show current loop status |
| `ralph-kiro reset` | Clear state and start fresh |

## Options

```
--max-iterations N      Stop after N iterations (default: 50)
--aws-profile NAME      AWS profile for deployments (default: default)
--no-branch             Skip auto-creating a feature branch on init
--max-cost DOLLARS      Stop loop when estimated cost exceeds this amount
--skills-dir DIR        Load agent skills from this directory
--completion-promise S  Phrase that signals completion (default: DONE)
--agent NAME            Custom agent to use (default: ralph)
--delay SECONDS         Delay between iterations (default: 2)
--verbose               Show detailed output
--version, -v           Show version number
--help, -h              Show help message
```

## Studio Dashboard

The Studio is a local web UI powered by the [Agent Client Protocol (ACP)](https://kiro.dev/docs/cli/acp/):

- **Mission Control** — iteration counter, status, cost tracker, stall indicator, task completion %
- **Command Center** — all CLI options exposed as UI controls with AWS profile dropdown
- **Task Graph** — visual `.kiro/tasks.json` with status icons, priority badges, dependencies
- **Agent Feed** — real-time streaming of agent output and tool calls
- **PRD Editor** — generate or edit PRDs (JSON/Markdown)
- **Judge Review** — read-only progress assessment
- **Git Timeline** — commit history
- **Dark/Light Theme** — toggle with persistence

Launch: `ralph-kiro studio` (default port 3456, set `STUDIO_PORT` to customize)

## Key Concepts

### Structured Task Graph
On init, Ralph parses `prd.json` or `prd.md` into `.kiro/tasks.json` — a structured graph with task IDs, priorities, dependencies, and status tracking.

### Agent Skills
Skills are `SKILL.md` files providing domain-specific guidance. Place in `skills/` or use `--skills-dir`. Built-in: `aws-sam`, `react-vite`. Compatible with the [Vercel Agent Skills](https://vercel.com/blog/agent-skills-explained-an-faq) open standard.

### AGENTS.md — Compound Learning
Auto-created on init. The agent appends patterns and gotchas after each iteration. Future iterations read this first, making each loop smarter.

### Iteration Logging
Full output logged to `.kiro/ralph-logs/iteration-N.log` for debugging and post-mortem.

### Git Checkpointing
Tag `ralph-checkpoint-N` created before each iteration. Rollback with `git reset --hard ralph-checkpoint-N`.

### Branch Isolation
Auto-creates `ralph/<timestamp>` feature branch on init. Use `--no-branch` to skip.

### Stall Detection
Auto-stops after 3 consecutive iterations with no new commits.

### Cost Tracking
Per-iteration cost estimates with `--max-cost` budget limit.

### Validation Hooks
Create `validate.sh` or `ralph-validate.sh` for custom validation before commits.

## How It Works

1. You provide a prompt with clear completion criteria
2. The orchestrator runs `kiro-cli chat` with the `ralph` agent (or `kiro-cli acp` in Studio mode)
3. Agent reads `.kiro/tasks.json`, `progress.txt`, and `AGENTS.md`
4. Agent picks highest priority pending task, implements with feedback loops
5. Agent commits, updates task graph and progress
6. If `<promise>DONE</promise>` detected → loop ends
7. Otherwise → next iteration

## Package Contents

```
bin/ralph-kiro              Main orchestrator script (v3.0)
lib/agents/ralph.json       Kiro agent configuration
lib/steering/               Methodology documentation
lib/templates/              PRD templates
lib/sample-prds/            Example PRDs
lib/skills/                 Agent skills (aws-sam, react-vite)
studio/                     Web dashboard (Express + WebSocket + ACP)
```

## Prerequisites

- [Kiro CLI](https://kiro.dev/docs/cli/installation/) installed
- Node.js (for Studio and npx commands)
- Python uv/uvx (for MCP servers)
- jq (for JSON processing)
- AWS SAM CLI (optional, for serverless deployments)

## Credits

- [Geoffrey Huntley's Ralph](https://github.com/ghuntley/how-to-ralph-wiggum) — Original methodology
- [Kiro](https://kiro.dev) — AI-powered IDE and CLI
- [Agent Client Protocol](https://agentclientprotocol.com/) — Studio's communication layer

## License

MIT
