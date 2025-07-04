#!/bin/bash

# Script to run both Java 8 and Java 17 applications for comparison

echo "Starting Java 8 and Java 17 applications for comparison..."

# Function to check if a port is in use
is_port_in_use() {
    lsof -i :$1 > /dev/null 2>&1
    return $?
}

# Check if ports are available
if is_port_in_use 8080; then
    echo "Error: Port 8080 is already in use. Please free up this port before running the comparison."
    exit 1
fi

if is_port_in_use 8081; then
    echo "Error: Port 8081 is already in use. Please free up this port before running the comparison."
    exit 1
fi

# Start Java 8 application in the background
echo "Starting Java 8 application on port 8080..."
cd ~/workspace/modernization/java8-app
mvn spring-boot:run > java8-app.log 2>&1 &
JAVA8_PID=$!

# Wait for Java 8 application to start
echo "Waiting for Java 8 application to start..."
while ! curl -s http://localhost:8080 > /dev/null; do
    sleep 1
done

echo "Java 8 application started successfully!"
echo "Access at: http://localhost:8080"

# Start Java 17 application in the background
echo "Starting Java 17 application on port 8081..."
cd ~/workspace/modernization/java17-app
mvn spring-boot:run > java17-app.log 2>&1 &
JAVA17_PID=$!

# Wait for Java 17 application to start
echo "Waiting for Java 17 application to start..."
while ! curl -s http://localhost:8081 > /dev/null; do
    sleep 1
done

echo "Java 17 application started successfully!"
echo "Access at: http://localhost:8081"

echo ""
echo "Both applications are now running. Press Ctrl+C to stop both applications."

# Wait for user to press Ctrl+C
trap "kill $JAVA8_PID $JAVA17_PID; echo 'Applications stopped.'; exit 0" INT
wait
