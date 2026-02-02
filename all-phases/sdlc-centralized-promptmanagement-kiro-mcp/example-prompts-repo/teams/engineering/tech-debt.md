# Technical Debt Assessment

**Team**: Engineering  
**Purpose**: Document and prioritize technical debt items  
**Usage**: `/prompt engineering-tech-debt`

## Template

Please help me document a technical debt item:

**Area**: {{area}}
**Component**: {{component}}

{{#if description}}
**Description**: {{description}}
{{/if}}

Generate a technical debt assessment including:

### Impact Analysis
- Current pain points
- Risk if not addressed
- Affected systems/teams

### Effort Estimation
- Complexity (Low/Medium/High)
- Estimated time to resolve
- Dependencies

### Recommendation
- Priority level
- Suggested approach
- Quick wins vs long-term fixes
