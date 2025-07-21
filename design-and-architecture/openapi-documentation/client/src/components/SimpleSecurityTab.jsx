import React from 'react';

export default function SimpleSecurityTab({ documentation }) {
  // Safety check to prevent rendering errors
  if (!documentation) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-700">No documentation data available.</p>
      </div>
    );
  }
  


  // Helper function to get security schemes from either nested or non-nested structure
  const getSecuritySchemes = () => {
    try {
      if (!documentation?.parsed_json?.securityDefinitions) return null;
      

      
      // Direct access to schemes property
      if (documentation.parsed_json.securityDefinitions.schemes) {
        return documentation.parsed_json.securityDefinitions.schemes;
      }
      
      // Handle different possible structures
      if (documentation.parsed_json.securityDefinitions.securityDefinitions?.schemes) {
        return documentation.parsed_json.securityDefinitions.securityDefinitions.schemes;
      } else if (documentation.parsed_json.securityDefinitions.recommendedSchemes) {
        return documentation.parsed_json.securityDefinitions.recommendedSchemes;
      } else {
        // If we can't find schemes in the expected locations, try to find any array in the securityDefinitions
        const secDefs = documentation.parsed_json.securityDefinitions;
        for (const key in secDefs) {
          if (Array.isArray(secDefs[key])) {
            // Check if this array contains objects with a 'type' property, which is likely to be security schemes
            if (secDefs[key].length > 0 && secDefs[key][0] && secDefs[key][0].type) {

              return secDefs[key];
            }
          }
        }
      }
    } catch (error) {
      // Handle error silently
    }
    return null;
  };

  // Helper function to get recommendations from either nested or non-nested structure
  const getRecommendations = () => {
    try {
      if (!documentation?.parsed_json?.securityDefinitions) return null;
      
      // Direct access to recommendations property
      if (documentation.parsed_json.securityDefinitions.recommendations) {
        return documentation.parsed_json.securityDefinitions.recommendations;
      }
      
      if (documentation.parsed_json.securityDefinitions.securityDefinitions?.recommendations) {
        return documentation.parsed_json.securityDefinitions.securityDefinitions.recommendations;
      } else if (documentation.parsed_json.securityDefinitions.securityRecommendations) {
        return documentation.parsed_json.securityDefinitions.securityRecommendations;
      }
    } catch (error) {
      // Handle error silently
    }
    return null;
  };

  // Helper function to get access patterns or roles from either nested or non-nested structure
  const getAccessPatterns = () => {
    try {
      if (!documentation?.parsed_json?.securityDefinitions) return null;
      
      // Check for roles property which is used in the current data
      if (documentation.parsed_json.securityDefinitions.roles) {
        return documentation.parsed_json.securityDefinitions.roles;
      }
      
      if (documentation.parsed_json.securityDefinitions.securityDefinitions?.accessPatterns) {
        return documentation.parsed_json.securityDefinitions.securityDefinitions.accessPatterns;
      } else if (documentation.parsed_json.securityDefinitions.accessPatterns) {
        return documentation.parsed_json.securityDefinitions.accessPatterns;
      } else if (documentation.parsed_json.securityDefinitions.securityDefinitions?.accessControlPatterns) {
        return documentation.parsed_json.securityDefinitions.securityDefinitions.accessControlPatterns;
      } else if (documentation.parsed_json.securityDefinitions.accessControlPatterns) {
        return documentation.parsed_json.securityDefinitions.accessControlPatterns;
      }
    } catch (error) {
      // Handle error silently
    }
    return null;
  };

  const securitySchemes = getSecuritySchemes();
  const recommendations = getRecommendations();
  const accessPatterns = getAccessPatterns();

  return (
    <div>
      <h5 className="font-bold text-blue-700 mb-3">Security Definitions</h5>
      
      {/* Security Schemes Section */}
      {securitySchemes && (
        <div className="mb-6 mt-4">
          <h6 className="font-semibold text-gray-700 mb-2">Security Schemes</h6>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.isArray(securitySchemes) ? (
              securitySchemes.map((scheme, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                      {scheme.type === 'oauth2' && (
                        <span className="text-blue-600 font-bold">O</span>
                      )}
                      {scheme.type === 'http' && (
                        <span className="text-green-600 font-bold">H</span>
                      )}
                      {scheme.type === 'apiKey' && (
                        <span className="text-purple-600 font-bold">K</span>
                      )}
                      {!['oauth2', 'http', 'apiKey'].includes(scheme.type) && (
                        <span className="text-gray-600 font-bold">?</span>
                      )}
                    </div>
                    <h3 className="font-bold text-lg">{scheme.name || `Scheme ${index + 1}`}</h3>
                  </div>
                  <div className="px-2 py-1 bg-gray-100 text-xs rounded inline-block mb-2">
                    {scheme.type}
                    {scheme.scheme && ` (${scheme.scheme})`}
                  </div>
                  {scheme.description && (
                    <p className="text-sm text-gray-600 mt-2">{scheme.description}</p>
                  )}
                  {scheme.flows && scheme.flows.authorizationCode && (
                    <div className="mt-2 border-t pt-2">
                      <div className="text-xs font-semibold text-gray-500">Authorization URL:</div>
                      <div className="text-xs text-gray-600 truncate">{scheme.flows.authorizationCode.authorizationUrl}</div>
                      <div className="text-xs font-semibold text-gray-500 mt-1">Token URL:</div>
                      <div className="text-xs text-gray-600 truncate">{scheme.flows.authorizationCode.tokenUrl}</div>
                      {scheme.flows.authorizationCode.scopes && Object.keys(scheme.flows.authorizationCode.scopes).length > 0 && (
                        <div className="mt-1">
                          <div className="text-xs font-semibold text-gray-500">Scopes:</div>
                          <div className="max-h-24 overflow-y-auto">
                            {Object.entries(scheme.flows.authorizationCode.scopes).map(([scope, description], i) => (
                              <div key={i} className="text-xs mt-1">
                                <span className="bg-blue-100 text-blue-800 px-1 rounded">{scope}</span>
                                <span className="text-gray-600 ml-1">{description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {scheme.in && (
                    <div className="mt-2">
                      <span className="text-xs font-semibold text-gray-500">Location:</span>
                      <span className="text-xs ml-1">{scheme.in}</span>
                    </div>
                  )}
                  {scheme.bearerFormat && (
                    <div className="text-xs mt-1">
                      <span className="font-semibold text-gray-500">Bearer Format:</span>
                      <span className="ml-1">{scheme.bearerFormat}</span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              Object.entries(securitySchemes).map(([key, scheme]) => (
                <div key={key} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                      {scheme.type === 'oauth2' && (
                        <span className="text-blue-600 font-bold">O</span>
                      )}
                      {scheme.type === 'http' && (
                        <span className="text-green-600 font-bold">H</span>
                      )}
                      {scheme.type === 'apiKey' && (
                        <span className="text-purple-600 font-bold">K</span>
                      )}
                      {!['oauth2', 'http', 'apiKey'].includes(scheme.type) && (
                        <span className="text-gray-600 font-bold">?</span>
                      )}
                    </div>
                    <h3 className="font-bold text-lg">{key}</h3>
                  </div>
                  <div className="px-2 py-1 bg-gray-100 text-xs rounded inline-block mb-2">
                    {scheme.type}
                    {scheme.scheme && ` (${scheme.scheme})`}
                  </div>
                  {scheme.description && (
                    <p className="text-sm text-gray-600 mt-2">{scheme.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Access Patterns / Roles Section */}
      {accessPatterns && (
        <div className="mb-6">
          <h6 className="font-semibold text-gray-700 mb-2">Access Control Roles</h6>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            {Array.isArray(accessPatterns) ? (
              accessPatterns.map((pattern, index) => (
                <div key={index} className="mb-4 last:mb-0">
                  <div className="flex items-center mb-2">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mr-2">
                      <span className="text-green-600 font-bold text-xs">{pattern.name?.charAt(0) || 'R'}</span>
                    </div>
                    <h3 className="font-semibold">{pattern.name}</h3>
                    {pattern.description && (
                      <span className="text-sm text-gray-600 ml-2">- {pattern.description}</span>
                    )}
                  </div>
                  {pattern.permissions && (
                    <div className="ml-8">
                      <div className="text-xs font-semibold text-gray-500 mb-1">Permissions:</div>
                      <div className="bg-gray-50 p-2 rounded">
                        {Array.isArray(pattern.permissions) ? (
                          pattern.permissions.map((permission, i) => (
                            <div key={i} className="text-xs mb-1 last:mb-0">
                              <span className="text-gray-600">• {permission}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-gray-600">{pattern.permissions}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <pre className="text-xs overflow-auto max-h-64">
                {JSON.stringify(accessPatterns, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Recommendations Section */}
      {recommendations && (
        <div className="mb-4">
          <h6 className="font-semibold text-gray-700 mb-2">Security Recommendations</h6>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            {Array.isArray(recommendations) ? (
              <ul className="space-y-2">
                {recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <div className="text-green-500 mr-2 mt-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {typeof rec === 'string' ? (
                      <span className="text-sm">{rec}</span>
                    ) : rec.recommendation ? (
                      <div className="text-sm">
                        <span className="font-medium">{rec.context}: </span>
                        <span>{rec.recommendation}</span>
                      </div>
                    ) : (
                      <span className="text-sm">{JSON.stringify(rec)}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : typeof recommendations === 'object' ? (
              Object.entries(recommendations).map(([category, items], index) => (
                <div key={index} className="mb-3 last:mb-0">
                  <h4 className="text-sm font-semibold mb-1 capitalize">{category}</h4>
                  {Array.isArray(items) ? (
                    <ul className="space-y-1 ml-5">
                      {items.map((item, i) => (
                        <li key={i} className="text-sm list-disc text-gray-700">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm ml-5 text-gray-700">{items}</p>
                  )}
                </div>
              ))
            ) : (
              <pre className="text-xs overflow-auto max-h-64">
                {JSON.stringify(recommendations, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}