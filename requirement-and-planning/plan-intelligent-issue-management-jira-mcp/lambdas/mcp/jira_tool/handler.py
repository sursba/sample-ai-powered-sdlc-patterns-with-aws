import json
import os
import base64
import boto3
import urllib.request
import urllib.error
import urllib.parse  # needed for JQL encoding

secrets = boto3.client('secretsmanager')

class JiraClient:
    def __init__(self):
        raw = secrets.get_secret_value(SecretId=os.environ['JIRA_SECRET_ARN'])['SecretString']
        cfg = json.loads(raw)
        self.base = cfg['baseUrl'].rstrip('/')
        self.project = cfg['projectKey']
        self.email = cfg['email']
        self.pat = cfg['pat']

    def _req(self, method, path, payload=None):
        url = f"{self.base}{path}"
        data = None
        if payload is not None:
            data = json.dumps(payload).encode('utf-8')
        auth = base64.b64encode(f"{self.email}:{self.pat}".encode()).decode()
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header('Authorization', f'Basic {auth}')
        req.add_header('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                content = resp.read().decode()
                return json.loads(content) if content else {}
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            # Return a readable error to the caller (don't leak secrets)
            raise RuntimeError(f"Jira HTTP {e.code}: {body}")

    # ---- Tools ----

    # jira.search
    def search(self, jql, max_results=20):
        payload = {
            'jql': jql,
            'maxResults': int(max_results),
            'fields': ['summary', 'status', 'assignee', 'created', 'updated']
        }
        data = self._req('POST', '/rest/api/3/search/jql', payload)
        items = []
        for issue in data.get('issues', []):
            fields = issue.get('fields', {})
            items.append({
                "issueKey": issue.get('key'),
                "summary": fields.get('summary', ''),
                "status": (fields.get('status') or {}).get('name', '')
            })
        return {"issues": items}

    # jira.create_issue
    def create_issue(self, title, description, labels=None, severity=None, component=None):
        fields = {
            "project": {"key": self.project},
            "summary": title,
            "description": description,
            "issuetype": {"name": "Bug"}
        }
        if labels:
            fields["labels"] = labels
        if component:
            fields["components"] = [{"name": component}]
        # NOTE: If your Jira has a custom field for severity, map it here (e.g., customfield_12345)
        payload = {"fields": fields}
        out = self._req('POST', '/rest/api/3/issue', payload)
        key = out.get('key')
        return {"issueKey": key, "url": f"{self.base}/browse/{key}"}

    # jira.comment
    def comment(self, issue_key, note):
        self._req('POST', f'/rest/api/3/issue/{issue_key}/comment', {"body": note})
        return {"status": "ok"}

    # jira.link_duplicate
    def link_duplicate(self, source, target):
        payload = {
            "type": {"name": "Duplicate"},
            "inwardIssue": {"key": target},   # target = canonical/original
            "outwardIssue": {"key": source}   # source = duplicate being linked
        }
        self._req('POST', '/rest/api/3/issueLink', payload)
        return {"status": "linked"}


def bad_request(msg: str):
    return {
        "statusCode": 400,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"error": msg})
    }

def ok(body_obj):
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body_obj)
    }

def lambda_handler(event, _context):
    try:
        body = event.get('body')
        if isinstance(body, str):
            body = json.loads(body)
        if not isinstance(body, dict):
            return bad_request("Body must be a JSON object")
        tool = body.get('tool')
        params = body.get('params', {})
        if not tool:
            return bad_request('Missing "tool"')

        jira = JiraClient()

        if tool == 'jira.search':
            jql = params['jql']
            max_results = int(params.get('maxResults', 20))
            return ok(jira.search(jql, max_results))

        elif tool == 'jira.create_issue':
            title = params['title']
            description = params.get('description', '')
            labels = params.get('labels')
            severity = params.get('severity')
            component = params.get('component')
            return ok(jira.create_issue(title, description, labels, severity, component))

        elif tool == 'jira.comment':
            return ok(jira.comment(params['issueKey'], params['note']))

        elif tool == 'jira.link_duplicate':
            return ok(jira.link_duplicate(params['source'], params['target']))

        else:
            return bad_request(f"Unknown tool: {tool}")

    except KeyError as ke:
        return bad_request(f"Missing required field: {str(ke)}")
    except Exception as e:
        # Return clean error; details will be in Lambda logs/X-Ray
        return bad_request(str(e))
