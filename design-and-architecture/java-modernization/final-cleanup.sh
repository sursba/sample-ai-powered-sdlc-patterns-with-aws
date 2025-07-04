#!/bin/bash

echo "🧹 Final Cleanup for Java Modernization Project..."

# Remove .DS_Store files (Mac specific)
echo "Removing .DS_Store files..."
find . -name ".DS_Store" -type f -delete

# Remove log files
echo "Removing log files..."
find . -name "*.log" -type f -delete
find . -name "*.log.*" -type f -delete
find . -name "*.gz" -type f -delete

# Remove Maven target directories
echo "Removing Maven target directories..."
find . -name "target" -type d -exec rm -rf {} + 2>/dev/null || true

# Remove compiled JAR files
echo "Removing JAR files..."
find . -name "*.jar" -type f -delete

# Remove the large zip file
echo "Removing zip files..."
find . -name "*.zip" -type f -delete

# Remove IDE-specific files/directories
echo "Removing IDE-specific files..."
rm -rf .vscode/
find . -name "*.iml" -type f -delete
find . -name ".idea" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name ".classpath" -type f -delete
find . -name ".project" -type f -delete
find . -name ".settings" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.sublime-*" -type f -delete
find . -name ".factorypath" -type f -delete

# Remove any temporary files
echo "Removing temporary files..."
find . -name "*.tmp" -type f -delete
find . -name "*.temp" -type f -delete
find . -name "*~" -type f -delete

# Remove any backup files
echo "Removing backup files..."
find . -name "*.orig" -type f -delete
find . -name "*.bak" -type f -delete

# Clean up any empty directories (except .git)
echo "Removing empty directories..."
find . -type d -empty -not -path "./.git*" -delete 2>/dev/null || true

# Check for potential sensitive information
echo "Checking for potential sensitive information..."
sensitive_files=$(find . -name "application*.properties" -o -name "application*.yml" | xargs grep -l "password\|secret\|key\|token" 2>/dev/null || true)
if [ -n "$sensitive_files" ]; then
  echo "⚠️ Warning: Files with potential sensitive information found:"
  echo "$sensitive_files"
  echo "Please verify these files don't contain actual sensitive data."
else
  echo "✅ No files with potential sensitive information found."
fi

# Check for large files
echo "Checking for large files (>1MB)..."
large_files=$(find . -type f -size +1M -not -path "./.git*" | sort)
if [ -n "$large_files" ]; then
  echo "⚠️ Warning: Large files found that might not be suitable for git:"
  echo "$large_files"
else
  echo "✅ No large files found."
fi

# Final summary
echo ""
echo "📊 Final project statistics:"
echo "Total size: $(du -sh . | cut -f1)"
echo "Total files: $(find . -type f -not -path "./.git/*" | wc -l)"
echo "Java files: $(find . -name "*.java" | wc -l)"
echo "XML files: $(find . -name "*.xml" | wc -l)"
echo "Markdown files: $(find . -name "*.md" | wc -l)"
echo "Shell scripts: $(find . -name "*.sh" | wc -l)"
echo ""
echo "🚀 Project is now ready for git checkin!"
