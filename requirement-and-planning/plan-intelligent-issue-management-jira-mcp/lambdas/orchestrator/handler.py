import json

def lambda_handler(event, context):
    # Stage 1 stub: echo payload and return 200 OK
    body = {
        "message": "IssueMgmt Chat Orchestrator is alive (Stage 1 stub)",
        "input": event.get("body") if isinstance(event, dict) else None
    }
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body)
    }
