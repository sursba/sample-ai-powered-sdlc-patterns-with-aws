# Pull Request Description

**Team**: Engineering  
**Purpose**: Generate comprehensive pull request descriptions with context and testing details  
**Usage**: `/prompt engineering-pull-request`

## Template

Please help me write a pull request description for the following changes:

**Title**: {{title}}

**Changes Made**:
{{changes}}

{{#if ticket}}
**Related Ticket**: {{ticket}}
{{/if}}

Please generate a PR description that includes:

### Summary
- Brief overview of what this PR accomplishes
- Why these changes were needed

### Changes
- Detailed breakdown of modifications
- Any architectural decisions made

### Testing
- How the changes were tested
- Any edge cases considered

{{#if breaking_changes}}
### Breaking Changes
- {{breaking_changes}}
- Migration steps if applicable
{{/if}}

### Checklist
- [ ] Code follows project style guidelines
- [ ] Tests added/updated as needed
- [ ] Documentation updated
- [ ] No sensitive data exposed
