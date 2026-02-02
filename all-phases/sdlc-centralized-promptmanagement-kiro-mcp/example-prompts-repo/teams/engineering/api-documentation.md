# API Documentation Review Prompt

**Team**: Engineering  
**Purpose**: API documentation review and improvement  
**Usage**: `/prompt engineering-api-documentation`

## Template

Please review and improve the API documentation for {{api_name}}.

{{#if programming_language}}
### Target Language: {{programming_language}}
{{/if}}

### Documentation Completeness
- **Endpoint Coverage**: All endpoints documented with examples
- **Request/Response**: Complete request and response schemas
- **Authentication**: Clear authentication requirements
- **Error Handling**: All possible error codes and messages

### Developer Experience
- **Getting Started**: Clear onboarding flow
- **Code Examples**: Runnable code samples
- **SDKs/Libraries**: Available client libraries

### Quality Checklist
- [ ] All endpoints have clear descriptions
- [ ] Request/response examples are accurate
- [ ] Authentication flow is well documented
- [ ] Error responses include helpful messages
- [ ] Versioning strategy is documented

### Recommendations
Please provide specific suggestions for:
1. Missing information
2. Clarity improvements
3. Additional code examples needed

Prioritize recommendations by impact on developer experience.