#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = require("aws-cdk-lib");
const ui_generator_stack_1 = require("../lib/ui-generator-stack");
const config_1 = require("../lib/config");
const app = new cdk.App();
new ui_generator_stack_1.UiGeneratorStack(app, 'UiGeneratorStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: config_1.config.region || process.env.CDK_DEFAULT_REGION
    },
    description: 'UI/UX Generator application using AWS Bedrock',
    tags: {
        Application: 'UiGenerator',
        Environment: config_1.config.environment,
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWktZ2VuZXJhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vYmluL3VpLWdlbmVyYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSx1Q0FBcUM7QUFDckMsbUNBQW1DO0FBQ25DLGtFQUE2RDtBQUM3RCwwQ0FBdUM7QUFFdkMsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDMUIsSUFBSSxxQ0FBZ0IsQ0FBQyxHQUFHLEVBQUUsa0JBQWtCLEVBQUU7SUFDNUMsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxlQUFNLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCO0tBQ3hEO0lBQ0QsV0FBVyxFQUFFLCtDQUErQztJQUM1RCxJQUFJLEVBQUU7UUFDSixXQUFXLEVBQUUsYUFBYTtRQUMxQixXQUFXLEVBQUUsZUFBTSxDQUFDLFdBQVc7S0FDaEM7Q0FDRixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgVWlHZW5lcmF0b3JTdGFjayB9IGZyb20gJy4uL2xpYi91aS1nZW5lcmF0b3Itc3RhY2snO1xuaW1wb3J0IHsgY29uZmlnIH0gZnJvbSAnLi4vbGliL2NvbmZpZyc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5uZXcgVWlHZW5lcmF0b3JTdGFjayhhcHAsICdVaUdlbmVyYXRvclN0YWNrJywge1xuICBlbnY6IHsgXG4gICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCwgXG4gICAgcmVnaW9uOiBjb25maWcucmVnaW9uIHx8IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiBcbiAgfSxcbiAgZGVzY3JpcHRpb246ICdVSS9VWCBHZW5lcmF0b3IgYXBwbGljYXRpb24gdXNpbmcgQVdTIEJlZHJvY2snLFxuICB0YWdzOiB7XG4gICAgQXBwbGljYXRpb246ICdVaUdlbmVyYXRvcicsXG4gICAgRW52aXJvbm1lbnQ6IGNvbmZpZy5lbnZpcm9ubWVudCxcbiAgfSxcbn0pOyJdfQ==