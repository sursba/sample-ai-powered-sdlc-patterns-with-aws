# Example Organizational Prompts Repository

This is an **example repository** demonstrating the organizational prompts pattern. Use this as a template to create your own organizational prompts repository.

## 🎯 **How to Use This Example**

1. **Fork or copy** this repository structure
2. **Rename** to match your organization (e.g., `acme-org-prompts`)
3. **Customize prompts** for your teams and workflows
4. **Update team directories** to match your organization structure
5. **Configure MCP server** to point to your repository

## 🏗️ **Example Structure**

This example includes prompts for common organizational functions:

```
.
├── teams/                  # Team-specific prompts
│   ├── engineering/        # Engineering team prompts
│   │   ├── code-review.md
│   │   └── architecture-review.md
│   ├── product/           # Product team prompts
│   │   ├── user-story.md
│   │   └── requirements.md
│   └── design/            # Design team prompts
│       ├── ui-review.md
│       └── accessibility-audit.md
├── shared/                # Cross-team prompts
│   ├── meeting-notes.md
│   └── project-kickoff.md
└── README.md             # This file
```

## 📝 **Example Prompts Included**

### Engineering Team
- **`/prompt engineering-code-review`** - Standardized code review guidelines with language-specific checks

### Product Team  
- **`/prompt product-user-story`** - Comprehensive user story creation with acceptance criteria

### Design Team
- **`/prompt design-ui-review`** - UI/UX review guidelines with accessibility checklist
- **`/prompt design-mobile-review`** - Mobile app design review with platform-specific considerations

### Shared (All Teams)
- **`/prompt shared-meeting-notes`** - Standardized meeting documentation template

## 🔧 **Customizing for Your Organization**

### **1. Update Team Structure**
Replace example teams with your organization's structure:
```
teams/
├── your-team-1/
├── your-team-2/
└── your-team-3/
```

### **2. Create Your Prompts**
Follow the template format:
```markdown
# Your Prompt Title

**Team**: Your Team Name  
**Purpose**: What this prompt does  
**Usage**: `/prompt your-command`

## Template

Your prompt content with {{variables}}.
```

### **3. Test Your Prompts**
- Ensure metadata headers are correct
- Test variable substitution
- Verify prompt commands work as expected

## 🚀 **Getting Started**

1. **Copy this repository structure** to your own GitHub repository
2. **Update prompts** to match your organizational needs
3. **Configure the MCP server** to point to your repository
4. **Test with your team** using kiro-cli or compatible IDE

This example provides a proven foundation for organizational prompt management that scales from small teams to large enterprises.