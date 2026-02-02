# Mobile App Review Prompt

**Team**: Design  
**Purpose**: Mobile app design review checklist  
**Usage**: `/prompt design-mobile-app-review`

## Template

Please conduct a mobile app design review for {{app_name}}.

{{#if platform}}
### Target Platform: {{platform}}
{{/if}}

### Mobile-Specific Design
- **Touch Targets**: Minimum 44px touch targets
- **Thumb Zones**: Easy reach areas for one-handed use
- **Gestures**: Intuitive swipe, pinch, and tap interactions
- **Loading States**: Appropriate feedback during data loading

### Accessibility Checklist
- [ ] Screen reader compatibility
- [ ] Dynamic Type support
- [ ] High contrast mode support
- [ ] Voice control accessibility

### User Experience
- **Onboarding**: Clear and concise first-time experience
- **Navigation**: Intuitive and consistent
- **Error Handling**: Helpful error messages and recovery
- **Offline Experience**: Graceful degradation without connectivity

### Performance Considerations
- Image optimization
- Animation performance (60fps)
- Memory and battery efficiency

Please provide specific recommendations with priority levels (High/Medium/Low).