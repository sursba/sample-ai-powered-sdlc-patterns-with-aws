import os
import json
import boto3
import base64
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, Any, List

# Import the same AOSS helpers from dedupe_tool
import sys
sys.path.append('/opt/python')

AOSS_COLLECTION = os.environ.get('AOSS_COLLECTION', 'issue-mgmt-issues')
REGION = os.environ.get('BEDROCK_REGION', os.environ.get('AWS_REGION', 'us-east-1'))
EMBED_MODEL_ID = 'cohere.embed-english-v3'

secrets = boto3.client('secretsmanager')
bedrock = boto3.client('bedrock-runtime', region_name=REGION)
aoss = boto3.client('opensearchserverless', region_name=REGION)

# Copy AOSS helper functions from dedupe_tool
import hashlib
import hmac
import datetime
import http.client

SERVICE = 'aoss'

def _aws4_signed_request(method, host, path, body=''):
    creds = boto3.Session().get_credentials().get_frozen_credentials()
    t = datetime.datetime.utcnow()
    amz_date = t.strftime('%Y%m%dT%H%M%SZ')
    datestamp = t.strftime('%Y%m%d')
    canonical_uri = path
    canonical_querystring = ''
    canonical_headers = f'host:{host}\nx-amz-date:{amz_date}\n'
    signed_headers = 'host;x-amz-date'
    payload_hash = hashlib.sha256(body.encode('utf-8')).hexdigest()
    canonical_request = f"{method}\n{canonical_uri}\n{canonical_querystring}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"

    algorithm = 'AWS4-HMAC-SHA256'
    credential_scope = f"{datestamp}/{REGION}/{SERVICE}/aws4_request"
    string_to_sign = f"{algorithm}\n{amz_date}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"

    def sign(key, msg):
        return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()

    k_date = sign(('AWS4' + creds.secret_key).encode('utf-8'), datestamp)
    k_region = sign(k_date, REGION)
    k_service = sign(k_region, SERVICE)
    k_signing = sign(k_service, 'aws4_request')
    signature = hmac.new(k_signing, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()

    authorization_header = (
        f"{algorithm} Credential={creds.access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    headers = {
        'Content-Type': 'application/json',
        'X-Amz-Date': amz_date,
        'Authorization': authorization_header,
    }
    if creds.token:
        headers['X-Amz-Security-Token'] = creds.token

    conn = http.client.HTTPSConnection(host, timeout=30)
    conn.request(method, path, body=body, headers=headers)
    resp = conn.getresponse()
    data = resp.read().decode()
    return resp.status, data

def _get_collection_endpoint():
    desc = aoss.batch_get_collection(names=[AOSS_COLLECTION])
    for coll in desc.get('collectionDetails', []):
        if coll.get('name') == AOSS_COLLECTION:
            return urllib.parse.urlparse(coll['collectionEndpoint']).netloc
    raise RuntimeError('AOSS collection endpoint not found')

def _embed(text: str):
    body = json.dumps({"texts": [text], "input_type": "search_document"})
    out = bedrock.invoke_model(modelId=EMBED_MODEL_ID, body=body)
    payload = json.loads(out.get('body').read())
    return payload['embeddings'][0]

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
            raise RuntimeError(f"Jira HTTP {e.code}: {body}")

    def search_issues(self, jql, max_results=50):
        payload = {
            'jql': jql,
            'maxResults': max_results,
            'fields': ['summary', 'description', 'status', 'created', 'updated']
        }
        return self._req('POST', '/rest/api/3/search/jql', payload)

def lambda_handler(event, context):
    """
    Issue Indexer Lambda Handler
    Supports: {"op":"index","jql":"project=KEY"}
    """
    try:
        body = json.loads(event.get('body', '{}'))
        op = body.get('op')
        
        if op == 'index':
            jql = body.get('jql', f'project = {os.environ.get("DEFAULT_PROJECT", "QBusiness")}')
            result = index_issues(jql)
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps(result)
            }
        elif op == 'create_index':
            result = create_index_manually()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps(result)
            }
        elif op == 'test_write':
            result = test_write_document()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps(result)
            }
        else:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': f'Unknown operation: {op}'})
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }

def test_write_document():
    """Test writing a simple document to OpenSearch"""
    try:
        host = _get_collection_endpoint()
        
        # Ensure index exists
        _ensure_index(host)
        
        # Create a test document with embedding
        test_text = "This is a test issue for debugging"
        embedding = _embed(test_text)
        
        doc = {
            'issueKey': 'TEST-001',
            'title': 'Test Issue',
            'summary': test_text,
            'embedding': embedding
        }
        
        # Try to write document
        status, response = _aws4_signed_request(
            'PUT', 
            host, 
            '/issues/_doc/TEST-001', 
            body=json.dumps(doc)
        )
        
        return {
            'write_status': status,
            'write_response': response,
            'host': host
        }
        
    except Exception as e:
        return {'error': str(e)}

def create_index_manually():
    """Manually create OpenSearch index for testing"""
    try:
        host = _get_collection_endpoint()
        
        # Try to get index first
        status, response = _aws4_signed_request('GET', host, '/issues')
        if status == 200:
            return {'status': 'Index already exists', 'response': response}
        
        # Create index
        _ensure_index(host)
        
        # Verify creation
        status, response = _aws4_signed_request('GET', host, '/issues')
        return {
            'status': 'Index created',
            'get_status': status,
            'response': response
        }
        
    except Exception as e:
        return {'error': str(e)}

def index_issues(jql: str):
    """Index Jira issues into OpenSearch"""
    try:
        # Get Jira issues
        jira = JiraClient()
        response = jira.search_issues(jql)
        issues = response.get('issues', [])
        
        if not issues:
            return {'indexed': 0, 'message': 'No issues found'}
        
        # Get OpenSearch endpoint
        host = _get_collection_endpoint()
        
        # Ensure index exists
        _ensure_index(host)
        
        indexed_count = 0
        errors = []
        
        for issue in issues:
            try:
                # Extract issue data
                key = issue.get('key')
                fields = issue.get('fields', {})
                title = fields.get('summary', '')
                description = fields.get('description', '')
                
                # Create text for embedding
                text = f"{title} {description}".strip()
                if not text:
                    continue
                
                # Generate embedding
                embedding = _embed(text)
                
                # Create document
                doc = {
                    'issueKey': key,
                    'title': title,
                    'summary': description,
                    'embedding': embedding
                }
                
                # Index document
                status, response = _aws4_signed_request(
                    'PUT', 
                    host, 
                    f'/issues/_doc/{key}', 
                    body=json.dumps(doc)
                )
                
                if status in [200, 201]:
                    indexed_count += 1
                else:
                    errors.append(f'{key}: {status} {response}')
                    
            except Exception as e:
                errors.append(f'{issue.get("key", "unknown")}: {str(e)}')
        
        return {
            'indexed': indexed_count,
            'total_issues': len(issues),
            'errors': errors[:5]  # Limit error list
        }
        
    except Exception as e:
        return {'indexed': 0, 'error': str(e)}

def _ensure_index(host: str):
    """Create index if missing with vector + BM25 fields"""
    mapping = {
        "settings": {
            "index": {
                "knn": True,
                "knn.algo_param.ef_search": 100
            }
        },
        "mappings": {
            "properties": {
                "issueKey": {"type": "keyword"},
                "title": {"type": "text"},
                "summary": {"type": "text"},
                "embedding": {"type": "knn_vector", "dimension": 1024, "method": {"name": "hnsw", "engine": "faiss", "space_type": "cosinesimil"}}
            }
        }
    }
    status, _ = _aws4_signed_request('GET', host, '/issues')
    if status == 200:
        return
    _aws4_signed_request('PUT', host, '/issues', body=json.dumps(mapping))
