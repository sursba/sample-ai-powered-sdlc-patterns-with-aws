# Code Review Prompt

**Team**: Engineering  
**Purpose**: Standardized code review guidelines  
**Usage**: `/prompt engineering-code-review`

## Template

Please conduct a code review for {{developer_name}} focusing on the following areas:

### Code Quality Assessment
- **Correctness**: Verify logic and implementation
- **Performance**: Identify potential bottlenecks
- **Security**: Check for vulnerabilities
- **Maintainability**: Assess code clarity and structure

{{#if language}}
### Language-Specific Guidelines for {{language}}
- Follow {{language}} best practices
- Ensure proper error handling
- Check test coverage
{{/if}}

### Review Checklist
- [ ] Code builds without errors
- [ ] Tests pass and cover new functionality
- [ ] Documentation updated if needed
- [ ] No sensitive data exposed
- [ ] Performance impact considered

### Pull Request Details
- **Branch**: {{branch_name}}
- **Files Changed**: {{files_changed}}

Please provide constructive feedback with specific suggestions for improvement.