---
inclusion: fileMatch
fileMatchPattern: '**/ralph-state.json'
---

# Ralph Loop Methodology

You are operating in a **Ralph loop** - an iterative, autonomous AI development methodology.

## The Ralph Philosophy

Named after Ralph Wiggum from The Simpsons, this methodology embodies persistent iteration. As Geoffrey Huntley describes it: "Ralph is a Bash loop" - continuous AI agent iterations that refine work until completion.

## Core Principles

### 1. Progress File Is Your Memory
Read `progress.txt` FIRST every iteration. It tells you:
- Tasks completed in previous iterations
- Decisions made and why
- Blockers encountered
- Files changed

This short-circuits exploration. Don't waste tokens re-discovering what's already documented.

### 2. Agent Chooses The Task
YOU decide what to work on next from the PRD/task list - not necessarily the first item. Prioritize:
1. Architectural decisions and core abstractions (HIGH)
2. Integration points between modules (HIGH)
3. Unknown unknowns and spike work (HIGH)
4. Standard features and implementation (MEDIUM)
5. Polish, cleanup, and quick wins (LOW)

Fail fast on risky work. Save easy wins for later.

### 3. Small Steps Compound
- One logical change per commit
- If a task feels too large, break it into subtasks
- Run feedback loops after each change, not at the end
- Quality over speed

Context windows are limited. LLMs get worse as they fill up (context rot). Smaller tasks = tighter feedback = higher quality.

### 4. Feedback Loops Are Non-Negotiable
Before committing, run ALL feedback loops:
- Types: must pass with no errors
- Tests: must pass
- Lint: must pass

Do NOT commit if any feedback loop fails. Fix issues first. The best setup blocks commits unless everything passes.

### 5. Commit After Each Feature
Each commit gives future iterations:
- A clean `git log` showing what changed
- The ability to `git diff` against previous work
- A rollback point if something breaks

### 6. Update Progress File
After completing each task, append to `progress.txt`:
- Task completed and reference
- Key decisions made and reasoning
- Files changed
- Any blockers or notes for next iteration

Keep entries concise. This file helps future iterations skip exploration.

## Completion Rules

**CRITICAL**: Output `<promise>COMPLETION_PROMISE</promise>` ONLY when:
- ALL requirements in the original prompt are genuinely met
- All feedback loops pass (tests, types, lint)
- The task is truly, completely done

**DO NOT** output the promise to escape the loop. Agents sometimes take shortcuts, declaring victory before the job is done. The loop is designed to continue until genuine completion.

## Alternative Loop Types

Ralph isn't just for feature backlogs:

**Test Coverage Loop**: Find uncovered lines, write tests, iterate until coverage target hit.

**Linting Loop**: Fix linting errors one by one, running linter between iterations.

**Entropy Loop**: Scan for code smells (unused exports, dead code), clean them up.

**Duplication Loop**: Find duplicate code, refactor into shared utilities.

Any task that can be described as "look at repo, improve something, verify" fits the Ralph pattern.

## The Repo Wins

Your instructions compete with the codebase. When you explore the repo, you see two sources of truth: instructions and existing code. The codebase is thousands of lines of evidence.

Agents amplify what they see. Poor code leads to poorer code. Follow the patterns you see, but fight entropy - leave the codebase better than you found it.
