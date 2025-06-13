FROM amazon/aws-lambda-python:3.13

# Create directory for the layer
RUN mkdir -p /opt/python

# Install Pillow
RUN pip install Pillow -t /opt/python/

# Remove unnecessary files to reduce size
RUN cd /opt/python && \
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    find . -type f -name "*.pyc" -delete && \
    find . -type f -name "*.pyo" -delete && \
    find . -type f -name "*.dist-info" -exec rm -rf {} + 2>/dev/null || true && \
    find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
