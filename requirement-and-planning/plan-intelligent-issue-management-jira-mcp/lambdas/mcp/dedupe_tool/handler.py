import os
import json
import time
import hashlib
import hmac
import boto3
import datetime
import urllib.parse
import http.client

AOSS_COLLECTION = os.environ.get('AOSS_COLLECTION', 'issue-mgmt-issues')
REGION = os.environ.get('BEDROCK_REGION', os.environ.get('AWS_REGION', 'us-east-1'))
EMBED_MODEL_ID = 'cohere.embed-english-v3'  # 1024-dim

bedrock = boto3.client('bedrock-runtime', region_name=REGION)
aoss = boto3.client('opensearchserverless', region_name=REGION)

# SigV4 helper for AOSS HTTPS requests
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

    conn = http.client.HTTPSConnection(host, timeout=10)
    conn.request(method, path, body=body, headers=headers)
    resp = conn.getresponse()
    data = resp.read().decode()
    return resp.status, data

def _get_collection_endpoint():
    desc = aoss.batch_get_collection(names=[AOSS_COLLECTION])
    for coll in desc.get('collectionDetails', []):
        if coll.get('name') == AOSS_COLLECTION:
            # endpoint is like https://<id>.<region>.aoss.amazonaws.com
            return urllib.parse.urlparse(coll['collectionEndpoint']).netloc
    raise RuntimeError('AOSS collection endpoint not found')

def _embed(text: str):
    body = json.dumps({"texts": [text], "input_type": "search_document"})
    out = bedrock.invoke_model(modelId=EMBED_MODEL_ID, body=body)
    payload = json.loads(out.get('body').read())
    vector = payload['embeddings'][0]
    return vector

def _ensure_index(host: str):
    # Create index if missing with vector + BM25 fields
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

def _knn_search(host: str, vector, top_k: int):
    query = {
        "size": top_k,
        "query": {
            "knn": {"embedding": {"vector": vector, "k": top_k}}
        }
    }
    status, data = _aws4_signed_request('POST', host, '/issues/_search', body=json.dumps(query))
    if status != 200:
        raise RuntimeError(f'Search failed: {status} {data}')
    return json.loads(data)

def lambda_handler(event, context):
    """
    Dedupe MCP Tool Lambda Handler
    Supports: dedupe.find_similar
    """
    try:
        body = json.loads(event.get('body', '{}'))
        tool = body.get('tool')
        params = body.get('params', {})
        
        if tool == 'dedupe.find_similar':
            result = find_similar(params)
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps(result)
            }
        else:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': f'Unknown tool: {tool}'})
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }

def find_similar(params):
    """Find similar issues using vector search"""
    description = params.get('description', '')
    title = params.get('title', '')
    top_k = params.get('top_k', 5)
    
    if not description and not title:
        return {'similar_issues': [], 'message': 'No description or title provided'}
    
    # Combine title and description for embedding
    text = f"{title} {description}".strip()
    
    try:
        # Get collection endpoint
        host = _get_collection_endpoint()
        
        # Ensure index exists
        _ensure_index(host)
        
        # Generate embedding
        vector = _embed(text)
        
        # Search for similar issues
        results = _knn_search(host, vector, top_k)
        
        # Format results
        similar_issues = []
        for hit in results.get('hits', {}).get('hits', []):
            source = hit.get('_source', {})
            similar_issues.append({
                'issueKey': source.get('issueKey'),
                'title': source.get('title'),
                'summary': source.get('summary'),
                'score': hit.get('_score', 0)
            })
        
        return {
            'similar_issues': similar_issues,
            'total_found': len(similar_issues)
        }
        
    except Exception as e:
        return {
            'similar_issues': [],
            'error': str(e)
        }
