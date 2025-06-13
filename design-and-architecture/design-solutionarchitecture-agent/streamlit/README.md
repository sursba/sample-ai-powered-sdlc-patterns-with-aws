### Streamlit UI for AWS SA AGENT

**Create and activate a virtual environment:**
```
python3 -m venv .venv
source .venv/bin/activate
```

**Install Python dependencies**
```
pip install -r requirements.txt
```

**Set environment variables**
```
export AWS_DEFAULT_REGION=us-west-2
export AGENT_ID=LUE8K3JCCP # WRITE YOUR BEDROCK AGENT ID
# SET ALSO AWS CREDENTIALS
```


**Run the Streamlit app:**
```
streamlit run chatbot.py
```