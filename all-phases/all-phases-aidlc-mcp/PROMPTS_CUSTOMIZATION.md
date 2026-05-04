# Customizing AI-DLC Prompts

The AI-DLC MCP server uses phase-specific prompts to guide AI assistants through the development lifecycle. These prompts are defined in `src/aidlc_mcp/prompts.py` and can be customized for your organization's needs.

## ⚠️ Important Warning

Modifying prompts may change the AI-DLC workflow behavior and could break the intended phase progression. Always test modifications with a sample project before deploying to production use.

## Prompt Structure

Each phase prompt (both full and abbreviated) includes:

1. **Role Definition**: Sets the AI's expertise and perspective
2. **Planning Requirements**: Defines how to create execution plans with checkboxes
3. **Approval Gates**: Specifies when human approval is required (every phase)
4. **Task Description**: Details what needs to be accomplished
5. **Deliverables**: Specifies output files and locations
6. **Phase Transition**: Instructions for moving to the next phase

## Prompt Sets

The server maintains two sets of prompts:

### Full Flow Prompts
- `DISCOVERY_0_1` — Full system analysis (Brownfield only)
- `INCEPTION_1_1` — User stories creation
- `INCEPTION_1_2` — Unit grouping
- `CONSTRUCTION_2_1` — Domain model design (DDD)
- `CONSTRUCTION_2_2` — Implementation
- `CONSTRUCTION_2_3` — Deployment

### Abbreviated Flow Prompts
- `DISCOVERY_0_1_LITE` — Targeted analysis of affected area
- `INCEPTION_1_1_LITE` — User stories as single unit (includes regression criteria)
- `CONSTRUCTION_2_2_LITE` — Implement following existing patterns
- `OPERATIONS_3_1` — Validate and regression check
- `DEPLOYMENT_2_3_LITE` — Assess existing deploy, adapt if needed

## Available Variables

Prompts support variable substitution:

- `{use-case}`: User's project description from `aidlc_start_project`
- `{current-feature}`: Feature name from `.aidlc/` directory structure

## Customization Examples

### 1. Change Role Expertise Level

**Before:**
```python
INCEPTION_1_1 = """Your Role: You are an expert product manager..."""
```

**After:**
```python
INCEPTION_1_1 = """Your Role: You are a senior product owner with 10+ years of Agile experience..."""
```

### 2. Add Organization-Specific Standards

**Before:**
```python
Your Task: Build user stories for the high-level requirement...
```

**After:**
```python
Your Task: Build user stories following our company's Agile standards (see https://wiki.company.com/agile-standards). 
Ensure all stories include:
- Business value statement
- Acceptance criteria in Given-When-Then format
- Estimated story points
Build user stories for the high-level requirement...
```

### 3. Modify Approval Gates

**Before:**
```python
**STOP and wait for my explicit approval before proceeding.**
```

**After (for trusted environments):**
```python
**Present the plan for review. You may proceed after 30 seconds if no objections.**
```

### 4. Change Deliverable Formats

**Before:**
```python
Create the analysis in .aidlc/{current-feature}/discovery/current_state_analysis.md file.
```

**After:**
```python
Create the analysis in .aidlc/{current-feature}/discovery/current_state_analysis.md file.
Also generate a summary presentation in .aidlc/{current-feature}/discovery/executive_summary.pptx.
```

### 5. Add Security Review Steps

**Before (Construction 2.2):**
```python
Include a final step in your plan to review deliverables for completeness and quality...
```

**After:**
```python
Include a final step in your plan to review deliverables for completeness and quality...
Add a security review step to check for:
- Input validation
- Authentication/authorization
- Sensitive data handling
- Dependency vulnerabilities
```

## Testing Your Changes

After modifying prompts:

1. **Verify Import**:
   ```bash
   python -c "from src.aidlc_mcp.prompts import PROMPTS; print(f'{len(PROMPTS)} prompts loaded')"
   ```

2. **Test with Sample Project**:
   ```bash
   # Start a test project in an empty directory
   mkdir /tmp/aidlc-test && cd /tmp/aidlc-test
   # Use your MCP client to run: aidlc_start_project
   ```

3. **Verify Phase Transitions**:
   - Ensure each phase completes successfully
   - Check that `aidlc_get_phase_prompt` returns the correct next phase
   - Verify `aidlc_set_phase_status` updates tracking correctly

## Common Pitfalls

### ❌ Breaking Phase Transitions

**Problem**: Removing phase transition instructions
```python
# DON'T remove this line:
After completing all steps, automatically get the next prompt using aidlc_get_phase_prompt...
```

**Solution**: Keep phase transition instructions intact or update them carefully.

### ❌ Invalid Variable Names

**Problem**: Using undefined variables
```python
# This will fail - {project-name} is not defined:
Your Task: Build {project-name} according to...
```

**Solution**: Only use `{use-case}` and `{current-feature}`.

### ❌ Inconsistent Tool Names

**Problem**: Using old tool names
```python
# Old tool names (don't use):
aidlc_update_plan  # Now: aidlc_update_project_plan
aidlc_update_phase # Now: aidlc_set_phase_status
aidlc_get_prompt   # Now: aidlc_get_phase_prompt
```

**Solution**: Use current tool names from the MCP server.

## Best Practices

1. **Keep Approval Gates**: Human oversight prevents costly mistakes
2. **Maintain Deliverable Structure**: Other phases depend on specific file locations
3. **Test Incrementally**: Change one prompt at a time and test
4. **Document Changes**: Add comments explaining why you modified prompts
5. **Version Control**: Commit prompt changes separately for easy rollback

## Phase-Specific Considerations

### Discovery (0.1 / 0.1-lite)
- Full: Critical for Brownfield projects, analyzes entire system
- Lite: Targeted analysis of only the affected area — don't over-analyze
- Sets context for all subsequent phases

### Inception (1.1, 1.2 / 1.1-lite)
- Full: User stories drive the entire project; unit grouping affects team structure
- Lite: Single unit, includes regression criteria; no decomposition step
- Changes here cascade to construction phases

### Construction (2.1, 2.2, 2.3 / 2.2-lite)
- Full: Domain design influences implementation; implementation stays in `.aidlc/` until deployment
- Lite: Skips domain modeling; writes directly to source following existing patterns

### Operations (3.1 — abbreviated only)
- Validates changes against acceptance criteria
- Checks for regressions before deployment
- Documents validation results for deployment phase

### Deployment (2.3 / 2.3-lite)
- Full: Creates new deployment procedures from scratch
- Lite: Assesses existing deployment, only modifies if the changes require it

## Getting Help

- 🐛 [Report Issues](https://gitlab.aws.dev/jordthur/aidlc-mcp/-/issues)
- 💡 [Request Features](https://gitlab.aws.dev/jordthur/aidlc-mcp/-/issues)
- 📖 [Main Documentation](README.md)

## Contributing

If you develop useful prompt customizations, consider contributing them back:

1. Fork the repository
2. Create a feature branch
3. Add your customization as an optional variant
4. Submit a merge request with examples and use cases

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.
