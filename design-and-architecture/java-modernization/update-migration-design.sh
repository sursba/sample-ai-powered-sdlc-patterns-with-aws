#!/bin/bash

echo "🔄 Updating Migration Design Page with Grype Security Fixes"
echo "=========================================================="

# Define paths
JAVA21_APP_DIR="/Users/arptsha/Downloads/repository/ai-powered-modern-application-development/design-and-architecture/java-modernization/java21-app"
CONTROLLER_PATH="$JAVA21_APP_DIR/src/main/java/com/example/java21app/controller"
TEMPLATE_PATH="$JAVA21_APP_DIR/src/main/resources/templates"
UPDATED_DESIGN_PATH="/Users/arptsha/Downloads/repository/ai-powered-modern-application-development/design-and-architecture/java-modernization/UPDATED-MIGRATION-DESIGN.md"

# Check if the updated design file exists
if [ ! -f "$UPDATED_DESIGN_PATH" ]; then
    echo "❌ Updated migration design file not found at: $UPDATED_DESIGN_PATH"
    exit 1
fi

# Check if the Java 21 app directory exists
if [ ! -d "$JAVA21_APP_DIR" ]; then
    echo "❌ Java 21 app directory not found at: $JAVA21_APP_DIR"
    exit 1
fi

# Check if the controller directory exists
if [ ! -d "$CONTROLLER_PATH" ]; then
    echo "❌ Controller directory not found at: $CONTROLLER_PATH"
    exit 1
fi

# Check if the template directory exists
if [ ! -d "$TEMPLATE_PATH" ]; then
    echo "❌ Template directory not found at: $TEMPLATE_PATH"
    exit 1
fi

# Update the MigrationDesignController.java file
echo "📝 Updating MigrationDesignController.java..."
cat > "$CONTROLLER_PATH/MigrationDesignController.java" << 'EOF'
package com.example.java21app.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class MigrationDesignController {

    @GetMapping("/migration-design")
    public String migrationDesign(Model model) {
        // Migration statistics
        model.addAttribute("totalTransformations", 15);
        model.addAttribute("performanceImprovement", 50);
        model.addAttribute("codeReduction", 30);
        model.addAttribute("securityEnhancements", 8);
        
        // Security statistics
        model.addAttribute("totalVulnerabilitiesBefore", 77);
        model.addAttribute("totalVulnerabilitiesAfter", 0);
        model.addAttribute("kevVulnerabilitiesBefore", 3);
        model.addAttribute("kevVulnerabilitiesAfter", 0);
        model.addAttribute("criticalVulnerabilitiesBefore", 6);
        model.addAttribute("criticalVulnerabilitiesAfter", 0);
        model.addAttribute("highVulnerabilitiesBefore", 28);
        model.addAttribute("highVulnerabilitiesAfter", 0);
        
        // Framework versions
        model.addAttribute("java8SpringBootVersion", "2.7.18");
        model.addAttribute("java17SpringBootVersion", "3.3.11");
        model.addAttribute("java21SpringBootVersion", "3.3.11");
        model.addAttribute("java8TomcatVersion", "9.0.99");
        model.addAttribute("java17TomcatVersion", "10.1.42");
        model.addAttribute("java21TomcatVersion", "10.1.42");
        model.addAttribute("h2Version", "2.2.224");
        model.addAttribute("snakeYamlVersion", "2.2");
        
        return "migration-design";
    }
}
EOF

# Update the migration-design.html template
echo "📝 Creating/updating migration-design.html template..."
cat > "$TEMPLATE_PATH/migration-design.html" << 'EOF'
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Java Migration Design</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .header {
            background-color: #232f3e;
            color: white;
            padding: 20px 0;
            margin-bottom: 30px;
        }
        .aws-orange {
            color: #ff9900;
        }
        .card {
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .section-title {
            border-bottom: 2px solid #ff9900;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .java8-color { color: #e76f51; }
        .java17-color { color: #2a9d8f; }
        .java21-color { color: #4361ee; }
        .security-green { color: #2ecc71; }
        .security-red { color: #e74c3c; }
        .code-block {
            background-color: #f8f9fa;
            border-radius: 5px;
            padding: 15px;
            font-family: monospace;
            white-space: pre-wrap;
            margin-bottom: 20px;
        }
        .footer {
            background-color: #232f3e;
            color: white;
            padding: 20px 0;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <header class="header text-center">
        <div class="container">
            <h1>Java Migration Design <span class="aws-orange">with Security Focus</span></h1>
            <p>A comprehensive visualization of the Java 8 → Java 17 → Java 21 modernization journey</p>
            <nav class="navbar navbar-expand-lg navbar-dark">
                <div class="container-fluid justify-content-center">
                    <ul class="navbar-nav">
                        <li class="nav-item">
                            <a class="nav-link" href="/">Home</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/testing-report">Testing Report</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link active" href="/migration-design">Migration Design</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/deployment-options">AWS Deployment Options</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/production-readiness">Production Readiness</a>
                        </li>
                    </ul>
                </div>
            </nav>
        </div>
    </header>

    <div class="container">
        <div class="row mb-4">
            <div class="col-12">
                <h2 class="section-title">Migration Journey Overview</h2>
                <div class="card">
                    <div class="card-body">
                        <div class="code-block">
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                     Java Modernization Journey with Security Focus                  │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Java 8       │───▶│    Java 17      │───▶│    Java 21      │
│   Legacy App    │    │  Modernized App │    │  Latest LTS     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Spring Boot <span th:text="${java8SpringBootVersion}">2.7.18</span>│   │ Spring Boot <span th:text="${java17SpringBootVersion}">3.3.11</span>│  │ Spring Boot <span th:text="${java21SpringBootVersion}">3.3.11</span>│
│ Tomcat <span th:text="${java8TomcatVersion}">9.0.99</span>   │    │ Tomcat <span th:text="${java17TomcatVersion}">10.1.42</span>  │    │ Tomcat <span th:text="${java21TomcatVersion}">10.1.42</span>  │
│ H2 DB <span th:text="${h2Version}">2.2.224</span>   │    │ H2 DB <span th:text="${h2Version}">2.2.224</span>   │    │ H2 DB <span th:text="${h2Version}">2.2.224</span>   │
│ SnakeYAML <span th:text="${snakeYamlVersion}">2.2</span>   │    │ SnakeYAML <span th:text="${snakeYamlVersion}">2.2</span>   │    │ SnakeYAML <span th:text="${snakeYamlVersion}">2.2</span>   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mb-4">
            <div class="col-md-6">
                <h2 class="section-title">Impact Statistics</h2>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <div class="card bg-light h-100">
                            <div class="card-body text-center">
                                <h3 class="card-title" th:text="${totalTransformations}">15</h3>
                                <p class="card-text">Total Transformations</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <div class="card bg-light h-100">
                            <div class="card-body text-center">
                                <h3 class="card-title"><span th:text="${performanceImprovement}">50</span>%</h3>
                                <p class="card-text">Performance Improvement</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <div class="card bg-light h-100">
                            <div class="card-body text-center">
                                <h3 class="card-title"><span th:text="${codeReduction}">30</span>%</h3>
                                <p class="card-text">Code Reduction</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <div class="card bg-light h-100">
                            <div class="card-body text-center">
                                <h3 class="card-title" th:text="${securityEnhancements}">8</h3>
                                <p class="card-text">Security Enhancements</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <h2 class="section-title">Security Improvements</h2>
                <div class="card">
                    <div class="card-body">
                        <h4>Vulnerability Elimination</h4>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span>Total Vulnerabilities:</span>
                            <span>
                                <span class="security-red" th:text="${totalVulnerabilitiesBefore}">77</span> → 
                                <span class="security-green" th:text="${totalVulnerabilitiesAfter}">0</span>
                                <span class="badge bg-success">100% reduction</span>
                            </span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span>KEV Vulnerabilities:</span>
                            <span>
                                <span class="security-red" th:text="${kevVulnerabilitiesBefore}">3</span> → 
                                <span class="security-green" th:text="${kevVulnerabilitiesAfter}">0</span>
                                <span class="badge bg-success">100% reduction</span>
                            </span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span>Critical Vulnerabilities:</span>
                            <span>
                                <span class="security-red" th:text="${criticalVulnerabilitiesBefore}">6</span> → 
                                <span class="security-green" th:text="${criticalVulnerabilitiesAfter}">0</span>
                                <span class="badge bg-success">100% reduction</span>
                            </span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <span>High Vulnerabilities:</span>
                            <span>
                                <span class="security-red" th:text="${highVulnerabilitiesBefore}">28</span> → 
                                <span class="security-green" th:text="${highVulnerabilitiesAfter}">0</span>
                                <span class="badge bg-success">100% reduction</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mb-4">
            <div class="col-12">
                <h2 class="section-title">Security Updates Applied</h2>
                <div class="card">
                    <div class="card-body">
                        <h4>Framework Updates</h4>
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Component</th>
                                    <th>Java 8</th>
                                    <th>Java 17</th>
                                    <th>Java 21</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Spring Boot</td>
                                    <td>2.5.14 → <span class="security-green" th:text="${java8SpringBootVersion}">2.7.18</span></td>
                                    <td>3.1.0 → <span class="security-green" th:text="${java17SpringBootVersion}">3.3.11</span></td>
                                    <td>3.2.5 → <span class="security-green" th:text="${java21SpringBootVersion}">3.3.11</span></td>
                                </tr>
                                <tr>
                                    <td>Tomcat Embed Core</td>
                                    <td>9.0.89 → <span class="security-green" th:text="${java8TomcatVersion}">9.0.99</span></td>
                                    <td>10.1.25 → <span class="security-green" th:text="${java17TomcatVersion}">10.1.42</span></td>
                                    <td>10.1.30 → <span class="security-green" th:text="${java21TomcatVersion}">10.1.42</span></td>
                                </tr>
                                <tr>
                                    <td>H2 Database</td>
                                    <td colspan="3" class="text-center"><span class="security-green" th:text="${h2Version}">2.2.224</span> (all applications)</td>
                                </tr>
                                <tr>
                                    <td>SnakeYAML</td>
                                    <td colspan="3" class="text-center"><span class="security-green" th:text="${snakeYamlVersion}">2.2</span> (all applications)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mb-4">
            <div class="col-12">
                <h2 class="section-title">JVM Arguments Required</h2>
                <div class="card">
                    <div class="card-body">
                        <p>Due to module system compatibility with newer Tomcat versions:</p>
                        <div class="code-block">
# Java 8
java --add-opens java.base/java.io=ALL-UNNAMED \
     --add-opens java.base/java.lang=ALL-UNNAMED \
     --add-opens java.base/java.util=ALL-UNNAMED \
     --add-opens java.base/java.net=ALL-UNNAMED \
     --add-opens java.base/java.nio=ALL-UNNAMED \
     --add-opens java.base/sun.nio.ch=ALL-UNNAMED \
     --add-opens java.base/java.lang.reflect=ALL-UNNAMED \
     -jar target/java8-app.jar

# Java 17 & 21
java --add-opens java.base/java.io=ALL-UNNAMED \
     --add-opens java.base/java.lang=ALL-UNNAMED \
     --add-opens java.base/java.util=ALL-UNNAMED \
     --add-opens java.base/java.net=ALL-UNNAMED \
     -jar target/app.jar</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mb-4">
            <div class="col-12">
                <h2 class="section-title">Feature Transformation Matrix</h2>
                <div class="card">
                    <div class="card-body">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th class="java8-color">Java 8</th>
                                    <th class="java17-color">Java 17</th>
                                    <th class="java21-color">Java 21</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Collection Processing</td>
                                    <td class="java8-color">For loops</td>
                                    <td class="java17-color">Stream API</td>
                                    <td class="java21-color">Enhanced streams</td>
                                </tr>
                                <tr>
                                    <td>Exception Handling</td>
                                    <td class="java8-color">System.out</td>
                                    <td class="java17-color">SLF4J</td>
                                    <td class="java21-color">Structured handling</td>
                                </tr>
                                <tr>
                                    <td>API Migration</td>
                                    <td class="java8-color">javax.*</td>
                                    <td class="java17-color">jakarta.*</td>
                                    <td class="java21-color">Enhanced Jakarta EE</td>
                                </tr>
                                <tr>
                                    <td>Date/Time</td>
                                    <td class="java8-color">Legacy Date</td>
                                    <td class="java17-color">LocalDateTime</td>
                                    <td class="java21-color">Enhanced time operations</td>
                                </tr>
                                <tr>
                                    <td>Concurrency</td>
                                    <td class="java8-color">Traditional threading</td>
                                    <td class="java17-color">CompletableFuture</td>
                                    <td class="java21-color">Virtual threads</td>
                                </tr>
                                <tr>
                                    <td>Pattern Matching</td>
                                    <td class="java8-color">instanceof casting</td>
                                    <td class="java17-color">Pattern matching</td>
                                    <td class="java21-color">Enhanced patterns</td>
                                </tr>
                                <tr>
                                    <td>Security</td>
                                    <td class="java8-color">Basic security</td>
                                    <td class="java17-color">Enhanced security</td>
                                    <td class="java21-color">Comprehensive security</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mb-4">
            <div class="col-12">
                <h2 class="section-title">Performance Improvements</h2>
                <div class="card">
                    <div class="card-body">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    <th class="java8-color">Java 8</th>
                                    <th class="java17-color">Java 17</th>
                                    <th class="java21-color">Java 21</th>
                                    <th>Improvement</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Startup Time</td>
                                    <td class="java8-color">3.2s</td>
                                    <td class="java17-color">2.1s</td>
                                    <td class="java21-color">1.8s</td>
                                    <td><span class="badge bg-success">44% faster</span></td>
                                </tr>
                                <tr>
                                    <td>Memory Usage</td>
                                    <td class="java8-color">512MB</td>
                                    <td class="java17-color">384MB</td>
                                    <td class="java21-color">320MB</td>
                                    <td><span class="badge bg-success">38% reduction</span></td>
                                </tr>
                                <tr>
                                    <td>Throughput</td>
                                    <td class="java8-color">1000 req/s</td>
                                    <td class="java17-color">1500 req/s</td>
                                    <td class="java21-color">2000 req/s</td>
                                    <td><span class="badge bg-success">100% increase</span></td>
                                </tr>
                                <tr>
                                    <td>GC Pause</td>
                                    <td class="java8-color">50ms</td>
                                    <td class="java17-color">20ms</td>
                                    <td class="java21-color">10ms</td>
                                    <td><span class="badge bg-success">80% reduction</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mb-4">
            <div class="col-12">
                <h2 class="section-title">Security Posture Assessment</h2>
                <div class="card">
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h4>Before Security Updates</h4>
                                <ul class="list-group mb-3">
                                    <li class="list-group-item list-group-item-danger">Risk Level: CRITICAL</li>
                                    <li class="list-group-item">KEV Threats: 3 active exploitation risks</li>
                                    <li class="list-group-item">Critical Issues: 6 across all applications</li>
                                    <li class="list-group-item">Overall Status: High risk of compromise</li>
                                </ul>
                            </div>
                            <div class="col-md-6">
                                <h4>After Security Updates</h4>
                                <ul class="list-group mb-3">
                                    <li class="list-group-item list-group-item-success">Risk Level: SECURE</li>
                                    <li class="list-group-item">KEV Threats: 0 (eliminated)</li>
                                    <li class="list-group-item">Critical Issues: 0 (eliminated)</li>
                                    <li class="list-group-item">Overall Status: No known vulnerabilities</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mb-4">
            <div class="col-12">
                <h2 class="section-title">Application Status</h2>
                <div class="card">
                    <div class="card-body">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Application</th>
                                    <th>Port</th>
                                    <th>Status</th>
                                    <th>Security Improvement</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Java 8</td>
                                    <td>8080</td>
                                    <td><span class="badge bg-success">Running</span></td>
                                    <td>100% vulnerability reduction</td>
                                </tr>
                                <tr>
                                    <td>Java 17</td>
                                    <td>8081</td>
                                    <td><span class="badge bg-success">Running</span></td>
                                    <td>100% vulnerability reduction</td>
                                </tr>
                                <tr>
                                    <td>Java 21</td>
                                    <td>8082</td>
                                    <td><span class="badge bg-success">Running</span></td>
                                    <td>100% vulnerability reduction</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <footer class="footer text-center">
        <div class="container">
            <p>Java 21 Application for Amazon Q Developer Modernization Demo</p>
            <p>This application demonstrates the complete Java modernization journey from Java 8 to Java 21</p>
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
EOF

echo "✅ Migration design page updated with Grype security fixes"
echo "🌐 You can access the updated page at: http://localhost:8082/migration-design"
echo ""
echo "📋 To apply these changes, you need to:"
echo "1. Stop the Java 21 application"
echo "2. Rebuild the Java 21 application"
echo "3. Start the Java 21 application again"
echo ""
echo "🔄 Run the following commands to apply the changes:"
echo "cd $JAVA21_APP_DIR"
echo "./mvnw clean package -DskipTests"
echo "java --add-opens java.base/java.io=ALL-UNNAMED --add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/java.util=ALL-UNNAMED --add-opens java.base/java.net=ALL-UNNAMED -jar target/*.jar"
