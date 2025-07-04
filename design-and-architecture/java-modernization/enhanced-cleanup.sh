#!/bin/bash

echo "🧹 Enhanced Cleanup for Java Modernization Project..."

# Run the existing cleanup script first
echo "Running existing cleanup script..."
./cleanup.sh

# Additional cleanup operations
echo "Performing additional cleanup operations..."

# Check for any IDE-specific files/directories
echo "Removing IDE-specific files..."
find . -name "*.iml" -type f -delete
find . -name ".idea" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name ".classpath" -type f -delete
find . -name ".project" -type f -delete
find . -name ".settings" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.sublime-*" -type f -delete
find . -name ".factorypath" -type f -delete

# Remove any potential sensitive information
echo "Checking for potential sensitive information..."
find . -name "application*.properties" -o -name "application*.yml" | xargs grep -l "password\|secret\|key\|token" 2>/dev/null || true

# Check for large files
echo "Checking for large files (>1MB)..."
large_files=$(find . -type f -size +1M -not -path "./.git*" | sort)
if [ -n "$large_files" ]; then
  echo "⚠️ Warning: Large files found that might not be suitable for git:"
  echo "$large_files"
else
  echo "✅ No large files found."
fi

# Check for binary files
echo "Checking for binary files..."
binary_files=$(find . -type f -not -path "./.git*" -not -path "*/src/main/resources/*" -not -name "*.md" -not -name "*.java" -not -name "*.xml" -not -name "*.properties" -not -name "*.yml" -not -name "*.yaml" -not -name "*.sh" -not -name "*.html" -not -name "*.css" -not -name "*.js" -not -name "*.txt" -not -name "*.json" -not -name "*.feature" | sort)
if [ -n "$binary_files" ]; then
  echo "⚠️ Warning: Binary files found that might not be suitable for git:"
  echo "$binary_files"
else
  echo "✅ No unexpected binary files found."
fi

# Verify .gitignore files
echo "Verifying .gitignore files..."
if [ ! -f ".gitignore" ]; then
  echo "⚠️ Warning: No root .gitignore file found."
else
  echo "✅ Root .gitignore file exists."
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
