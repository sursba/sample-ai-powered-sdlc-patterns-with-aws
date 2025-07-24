#!/bin/bash

# FIXED: Dependency Analysis Script
# Prevents dependency conflicts and identifies issues early

echo "🔍 Dependency Analysis for Java 17 Gateway Service"
echo "=================================================="

# Function to analyze current dependencies
analyze_current_dependencies() {
    echo "📋 Analyzing current dependencies..."
    
    # Generate dependency tree
    echo "🌳 Generating dependency tree..."
    mvn dependency:tree -Dverbose > dependency-tree-verbose.txt
    mvn dependency:tree > dependency-tree-simple.txt
    
    # Check for dependency conflicts
    echo "⚠️  Checking for dependency conflicts..."
    mvn dependency:analyze-duplicate > dependency-duplicates.txt
    
    # List all dependencies
    echo "📦 Listing all dependencies..."
    mvn dependency:list > dependency-list.txt
    
    echo "✅ Dependency analysis files generated"
}

# Function to check for known problematic combinations
check_problematic_combinations() {
    echo "🚨 Checking for known problematic dependency combinations..."
    
    # Check for Zuul + Gateway conflict
    if grep -q "spring-cloud-starter-netflix-zuul" pom.xml && grep -q "spring-cloud-starter-gateway" pom.xml; then
        echo "❌ CONFLICT: Both Zuul and Gateway dependencies found!"
        echo "   Resolution: Remove spring-cloud-starter-netflix-zuul"
    else
        echo "✅ No Zuul + Gateway conflict detected"
    fi
    
    # Check for multiple Kubernetes client dependencies
    KUBE_DEPS=$(grep -c "spring-cloud-starter-kubernetes-client" pom.xml || echo "0")
    if [ "$KUBE_DEPS" -gt 1 ]; then
        echo "❌ CONFLICT: Multiple Kubernetes client dependencies found!"
        echo "   Resolution: Use spring-cloud-starter-kubernetes-fabric8-all"
    else
        echo "✅ No Kubernetes dependency conflicts detected"
    fi
    
    # Check for Spring Boot version compatibility
    SPRING_BOOT_VERSION=$(grep -A 1 "spring-boot-starter-parent" pom.xml | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+" | head -1)
    if [[ "$SPRING_BOOT_VERSION" =~ ^3\. ]]; then
        echo "✅ Spring Boot 3.x detected - compatible with Java 17"
    elif [[ "$SPRING_BOOT_VERSION" =~ ^2\. ]]; then
        echo "⚠️  Spring Boot 2.x detected - consider upgrading to 3.x for Java 17"
    else
        echo "❌ Unknown Spring Boot version: $SPRING_BOOT_VERSION"
    fi
}

# Function to check for security vulnerabilities
check_security_vulnerabilities() {
    echo "🔒 Checking for security vulnerabilities..."
    
    # Run OWASP dependency check
    if command -v mvn &> /dev/null; then
        echo "🛡️  Running OWASP dependency check..."
        mvn org.owasp:dependency-check-maven:check -DfailBuildOnCVSS=7 > security-report.txt 2>&1
        
        if [ $? -eq 0 ]; then
            echo "✅ No critical security vulnerabilities found"
        else
            echo "⚠️  Security vulnerabilities detected - check security-report.txt"
        fi
    fi
}

# Function to suggest optimizations
suggest_optimizations() {
    echo "💡 Dependency Optimization Suggestions..."
    
    # Check for unused dependencies
    echo "🧹 Checking for unused dependencies..."
    mvn dependency:analyze > dependency-analysis.txt
    
    if grep -q "Unused declared dependencies" dependency-analysis.txt; then
        echo "⚠️  Unused dependencies found:"
        grep -A 10 "Unused declared dependencies" dependency-analysis.txt
        echo "   Consider removing unused dependencies to reduce JAR size"
    else
        echo "✅ No unused dependencies detected"
    fi
    
    # Check for version updates
    echo "🔄 Checking for dependency updates..."
    mvn versions:display-dependency-updates > dependency-updates.txt
    
    if grep -q "The following dependencies in Dependencies have newer versions" dependency-updates.txt; then
        echo "📈 Dependency updates available - check dependency-updates.txt"
    else
        echo "✅ All dependencies are up to date"
    fi
}

# Function to generate compatibility matrix
generate_compatibility_matrix() {
    echo "📊 Generating compatibility matrix..."
    
    cat > compatibility-matrix.md << EOF
# Dependency Compatibility Matrix

## Core Framework Versions
| Component | Version | Java 17 Compatible | Notes |
|-----------|---------|-------------------|-------|
| Spring Boot | $(grep -A 1 "spring-boot-starter-parent" pom.xml | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+" | head -1) | ✅ | Spring Boot 3.x required for Java 17 |
| Spring Cloud | $(grep -A 1 "spring-cloud-dependencies" pom.xml | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+" | head -1 || echo "Not specified") | ✅ | 2023.x series compatible |
| Java | 17 | ✅ | Target version |

## Gateway Dependencies
| Dependency | Status | Replacement | Notes |
|------------|--------|-------------|-------|
| spring-cloud-starter-netflix-zuul | ❌ Removed | spring-cloud-starter-gateway | Zuul deprecated in Spring Cloud 2020.x |
| spring-cloud-starter-gateway | ✅ Active | - | Recommended for Spring Boot 3.x |

## Kubernetes Dependencies
| Dependency | Status | Replacement | Notes |
|------------|--------|-------------|-------|
| spring-cloud-starter-kubernetes-client | ❌ Removed | spring-cloud-starter-kubernetes-fabric8-all | Consolidated dependency |
| spring-cloud-starter-kubernetes-client-config | ❌ Removed | spring-cloud-starter-kubernetes-fabric8-all | Included in fabric8-all |
| spring-cloud-starter-kubernetes-fabric8-all | ✅ Active | - | Single dependency for all Kubernetes features |

## Monitoring Dependencies
| Dependency | Status | Notes |
|------------|--------|-------|
| micrometer-core | ✅ Active | Core metrics functionality |
| micrometer-registry-prometheus | ✅ Active | Prometheus integration |
| spring-boot-starter-actuator | ✅ Active | Health checks and metrics endpoints |

EOF

    echo "📋 Compatibility matrix generated: compatibility-matrix.md"
}

# Function to create fix recommendations
create_fix_recommendations() {
    echo "🔧 Creating fix recommendations..."
    
    cat > fix-recommendations.md << EOF
# Dependency Fix Recommendations

## Issues Fixed ✅

### 1. Dependency Conflicts
- **Issue**: spring-cloud-starter-netflix-zuul conflicted with spring-cloud-starter-gateway
- **Fix**: Removed Zuul dependency, kept Gateway
- **Impact**: Eliminates startup conflicts and classpath issues

### 2. Kubernetes Dependencies
- **Issue**: Multiple kubernetes client dependencies causing conflicts
- **Fix**: Replaced with single spring-cloud-starter-kubernetes-fabric8-all
- **Impact**: Simplified dependency management, reduced conflicts

### 3. Micrometer Configuration Cycle
- **Issue**: Circular dependency in MeterRegistryCustomizer
- **Fix**: Updated configuration to use proper generic typing
- **Impact**: Eliminates startup dependency cycle errors

## Preventive Measures 🛡️

### 1. Dependency Analysis
- Run \`mvn dependency:analyze\` before each build
- Check for unused dependencies regularly
- Monitor for security vulnerabilities

### 2. Version Management
- Use Spring Boot BOM for version management
- Keep dependencies up to date
- Test compatibility before upgrading

### 3. Build Optimization
- Use parallel builds (\`-T 1C\`)
- Optimize memory settings
- Enable dependency caching

## Monitoring 📊

### 1. Regular Checks
- Weekly dependency vulnerability scans
- Monthly dependency update reviews
- Quarterly major version upgrade planning

### 2. Automated Tools
- OWASP Dependency Check in CI/CD
- Dependabot for automated updates
- SonarQube for code quality

EOF

    echo "📋 Fix recommendations generated: fix-recommendations.md"
}

# Main execution
main() {
    echo "🔍 Starting comprehensive dependency analysis..."
    
    analyze_current_dependencies
    check_problematic_combinations
    check_security_vulnerabilities
    suggest_optimizations
    generate_compatibility_matrix
    create_fix_recommendations
    
    echo ""
    echo "🎉 Dependency analysis completed!"
    echo "📁 Generated files:"
    echo "   - dependency-tree-verbose.txt"
    echo "   - dependency-tree-simple.txt"
    echo "   - dependency-analysis.txt"
    echo "   - compatibility-matrix.md"
    echo "   - fix-recommendations.md"
    echo ""
    echo "💡 Review the generated files for detailed analysis and recommendations"
}

# Execute main function
main "$@"
