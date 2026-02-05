# Incident Report

**Team**: Engineering  
**Purpose**: Document production incidents with timeline and root cause analysis  
**Usage**: `/prompt engineering-incident-report`

## Template

Please help me create an incident report:

**Incident Title**: {{title}}
**Severity**: {{severity}}
**Date**: {{date}}

### Summary
{{summary}}

{{#if timeline}}
### Timeline
{{timeline}}
{{/if}}

Generate a comprehensive incident report including:

### Impact
- Services affected
- Users impacted
- Duration of incident

### Root Cause
- What caused the incident
- Contributing factors

### Resolution
- Steps taken to resolve
- Time to resolution

### Action Items
- Preventive measures
- Follow-up tasks

### Lessons Learned
- What went well
- What could be improved
