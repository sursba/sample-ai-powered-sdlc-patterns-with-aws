# AWS SAM Skill

Domain-specific guidance for building serverless applications with AWS SAM.

## Patterns

- Always use `sam init` patterns: template.yaml at root, functions in separate directories
- Use `Globals` section in template.yaml for shared Lambda configuration
- Prefer `AWS::Serverless::Function` over raw `AWS::Lambda::Function`
- Use `sam build` before `sam deploy` — never deploy without building first
- Use `sam validate` to check template syntax before deploying

## DynamoDB

- Use on-demand billing (`BillingMode: PAY_PER_REQUEST`) for dev/PoC
- Always define `KeySchema` with both partition and sort key if needed
- Use `AWS::Serverless::SimpleTable` for simple key-value tables

## API Gateway

- Use `Events` property on `AWS::Serverless::Function` for API routes
- Prefer `Api` event type for REST APIs, `HttpApi` for HTTP APIs (cheaper, faster)
- Always enable CORS if frontend will call the API

## Testing

- Use `sam local invoke` for local Lambda testing
- Use `sam local start-api` for local API testing (remember to background it)
- Write pytest tests that mock boto3 calls using moto or unittest.mock

## Common Gotchas

- `sam deploy --guided` is interactive — use `sam deploy --no-confirm-changeset` in automation
- Lambda handler path must match the directory structure exactly
- Python dependencies go in `requirements.txt` per function directory
- Always set `Timeout` on Lambda functions (default 3s is too short for most tasks)
