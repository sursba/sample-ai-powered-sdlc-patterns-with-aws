import json
import os
import boto3
from typing import Dict, Any, List
from datetime import datetime
import re
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')

def decimal_to_float(obj):
    """Convert Decimal objects to float for JSON serialization"""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [decimal_to_float(v) for v in obj]
    return obj

def lambda_handler(event, context):
    """
    Assignment MCP Tool Lambda Handler
    Supports: assign.compute_recommendation
    """
    try:
        body = json.loads(event.get('body', '{}'))
        tool = body.get('tool')
        params = body.get('params', {})
        
        if tool == 'assign.compute_recommendation':
            result = compute_recommendation(params)
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

def compute_recommendation(params: Dict[str, Any]) -> Dict[str, Any]:
    """Compute assignment recommendation based on skills, WIP, and other factors"""
    
    # Get input parameters
    issue_key = params.get('issueKey')
    description = params.get('description', '')
    component = params.get('component')
    labels = params.get('labels', [])
    
    # Load people and config data
    people = get_people()
    config = get_config()
    severity_matrix = get_severity_matrix()
    
    # Determine required skills from component and description
    required_skills = determine_skills(component, description, labels)
    
    # Get severity for scoring
    severity = determine_severity(component, severity_matrix)
    
    # Score each person
    candidates = []
    for person in people:
        score_data = score_person(person, required_skills, severity, config, issue_key)
        candidates.append({
            'person': person,
            'score': score_data['total_score'],
            'breakdown': score_data['breakdown']
        })
    
    # Sort by score (highest first)
    candidates.sort(key=lambda x: x['score'], reverse=True)
    
    if not candidates:
        return {
            'assigneeEmail': None,
            'rationale': 'No suitable assignee found',
            'scoreBreakdown': {}
        }
    
    best_candidate = candidates[0]
    
    return {
        'assigneeEmail': best_candidate['person']['email'],
        'rationale': generate_rationale(best_candidate, required_skills),
        'scoreBreakdown': best_candidate['breakdown'],
        'allCandidates': [
            {
                'email': c['person']['email'],
                'name': c['person']['name'],
                'score': c['score']
            } for c in candidates[:3]  # Top 3
        ]
    }

def get_people() -> List[Dict[str, Any]]:
    """Get all people from DynamoDB"""
    table = dynamodb.Table(os.environ['PEOPLE_TABLE'])
    
    response = table.scan(
        FilterExpression='begins_with(pk, :pk_prefix)',
        ExpressionAttributeValues={':pk_prefix': 'user#'}
    )
    
    return decimal_to_float(response.get('Items', []))

def get_config() -> Dict[str, Any]:
    """Get prioritization config from DynamoDB"""
    table = dynamodb.Table(os.environ['CONFIG_TABLE'])
    
    response = table.get_item(Key={'pk': 'config#prioritization'})
    return decimal_to_float(response.get('Item', {}))

def get_severity_matrix() -> Dict[str, Any]:
    """Get severity matrix config from DynamoDB"""
    table = dynamodb.Table(os.environ['CONFIG_TABLE'])
    
    response = table.get_item(Key={'pk': 'config#severity-matrix'})
    return decimal_to_float(response.get('Item', {}))

def determine_skills(component: str, description: str, labels: List[str]) -> List[str]:
    """Determine required skills from component, description, and labels"""
    skills = set()
    
    # Map component to skills
    component_skills = {
        'payments': ['payments', 'backend'],
        'checkout': ['checkout', 'frontend'],
        'auth': ['auth', 'backend'],
        'frontend': ['frontend'],
        'backend': ['backend'],
        'infra': ['infra'],
        'observability': ['observability']
    }
    
    if component and component.lower() in component_skills:
        skills.update(component_skills[component.lower()])
    
    # Extract skills from description and labels
    text = f"{description} {' '.join(labels)}".lower()
    
    skill_keywords = {
        'payments': ['payment', 'billing', 'stripe', 'paypal'],
        'checkout': ['checkout', 'cart', 'order'],
        'auth': ['auth', 'login', 'oauth', 'jwt', 'session'],
        'frontend': ['ui', 'react', 'vue', 'angular', 'css', 'html'],
        'backend': ['api', 'server', 'database', 'sql'],
        'infra': ['deploy', 'docker', 'k8s', 'aws', 'infrastructure'],
        'observability': ['monitoring', 'logging', 'metrics', 'alert']
    }
    
    for skill, keywords in skill_keywords.items():
        if any(keyword in text for keyword in keywords):
            skills.add(skill)
    
    return list(skills)

def determine_severity(component: str, severity_matrix: Dict[str, Any]) -> str:
    """Determine severity based on component"""
    if not severity_matrix:
        return 'medium'
    
    component_severity = severity_matrix.get('component_severity', {})
    return component_severity.get(component, severity_matrix.get('default_severity', 'medium'))

def score_person(person: Dict[str, Any], required_skills: List[str], severity: str, config: Dict[str, Any], issue_key: str = None) -> Dict[str, Any]:
    """Score a person for assignment"""
    
    breakdown = {}
    total_score = 0
    
    # Skill match score
    person_skills = set(person.get('skills', []))
    required_skills_set = set(required_skills)
    skill_matches = len(person_skills.intersection(required_skills_set))
    skill_total = len(required_skills_set) if required_skills_set else 1
    
    skill_score = (skill_matches / skill_total) * 100
    skill_bonus = config.get('skill_match_bonus', 0.3) * skill_score
    breakdown['skill_match'] = skill_score
    breakdown['skill_bonus'] = skill_bonus
    total_score += skill_bonus
    
    # WIP capacity score
    wip_limit = person.get('wipLimit', 3)
    current_wip = person.get('currentWip', 0)
    wip_ratio = current_wip / wip_limit if wip_limit > 0 else 1
    wip_penalty = config.get('wip_penalty_factor', 0.5) * wip_ratio * 100
    breakdown['wip_ratio'] = wip_ratio
    breakdown['wip_penalty'] = -wip_penalty
    total_score -= wip_penalty
    
    # Base availability score (inverse of WIP ratio)
    availability_score = (1 - wip_ratio) * 100
    breakdown['availability'] = availability_score
    total_score += availability_score
    
    # Continuity bonus (simplified - would check related issues in real implementation)
    continuity_bonus = 0
    if issue_key:
        # In real implementation, check if person worked on related issues
        continuity_bonus = config.get('continuity_bonus', 0.2) * 50  # Mock bonus
    breakdown['continuity_bonus'] = continuity_bonus
    total_score += continuity_bonus
    
    # Timezone bonus (simplified - assume current time is EST)
    timezone = person.get('timezone', 'UTC')
    timezone_bonus = 0
    if 'America' in timezone:  # Simplified timezone matching
        timezone_bonus = config.get('timezone_bonus', 0.1) * 100
    breakdown['timezone_bonus'] = timezone_bonus
    total_score += timezone_bonus
    
    return {
        'total_score': max(0, total_score),  # Ensure non-negative
        'breakdown': breakdown
    }

def generate_rationale(candidate: Dict[str, Any], required_skills: List[str]) -> str:
    """Generate human-readable rationale for assignment"""
    person = candidate['person']
    breakdown = candidate['breakdown']
    
    rationale_parts = []
    
    # Skill match
    person_skills = set(person.get('skills', []))
    matching_skills = person_skills.intersection(set(required_skills))
    if matching_skills:
        rationale_parts.append(f"Has relevant skills: {', '.join(matching_skills)}")
    
    # Availability
    wip_ratio = breakdown.get('wip_ratio', 0)
    if wip_ratio < 0.8:
        rationale_parts.append(f"Good availability ({person.get('currentWip', 0)}/{person.get('wipLimit', 3)} WIP)")
    elif wip_ratio >= 1.0:
        rationale_parts.append(f"At capacity but best match ({person.get('currentWip', 0)}/{person.get('wipLimit', 3)} WIP)")
    
    # Timezone
    if breakdown.get('timezone_bonus', 0) > 0:
        rationale_parts.append(f"In compatible timezone ({person.get('timezone', 'UTC')})")
    
    return f"{person.get('name', 'Unknown')} - " + "; ".join(rationale_parts)
