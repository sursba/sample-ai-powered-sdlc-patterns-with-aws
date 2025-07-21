import React from 'react';

export default function SimpleDocumentationTab({ documentation }) {
  // Safety check to prevent rendering errors
  if (!documentation) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-700">No documentation data available.</p>
      </div>
    );
  }
  // Get the documentation data directly without trying to parse it
  const docs = documentation.parsed_json?.documentation;

  return (
    <div>
      <h5 className="font-bold text-blue-700 mb-3">API Documentation</h5>
      

      
      {docs ? (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <pre className="text-sm overflow-auto max-h-96">
            {JSON.stringify(docs, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700">No API documentation available.</p>
          <p className="text-sm text-yellow-600 mt-2">The documentation generator did not produce any endpoint documentation.</p>
          <p className="text-sm text-yellow-600 mt-2">You can manually add documentation to your OpenAPI specification.</p>
        </div>
      )}
    </div>
  );
}