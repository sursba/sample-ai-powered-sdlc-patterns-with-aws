import React from 'react';

export default function SimpleVersioningTab({ documentation }) {
  // Safety check to prevent rendering errors
  if (!documentation) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-700">No documentation data available.</p>
      </div>
    );
  }
  // Helper function to get versioning data
  const getVersioning = () => {
    if (documentation.parsed_json?.versioning?.versioning) {
      return documentation.parsed_json.versioning.versioning;
    } else if (documentation.parsed_json?.versioning) {
      return documentation.parsed_json.versioning;
    }
    return null;
  };

  // Helper function to get recommended approach
  const getRecommendedApproach = () => {
    const versioning = getVersioning();
    if (!versioning) return null;
    
    return versioning.recommendedApproach || 
           versioning.recommended_approach || 
           versioning.approach?.name ||
           null;
  };

  // Helper function to get approach details
  const getApproachDetails = () => {
    const versioning = getVersioning();
    if (!versioning) return null;
    
    return versioning.approach || 
           versioning.approach_details ||
           null;
  };

  // Helper function to get lifecycle management
  const getLifecycleManagement = () => {
    const versioning = getVersioning();
    if (!versioning) return null;
    
    return versioning.lifecycleManagement || 
           versioning.lifecycle_management ||
           null;
  };

  // Helper function to get versioning pattern
  const getVersioningPattern = () => {
    const versioning = getVersioning();
    if (!versioning) return null;
    
    return versioning.versioningPattern || 
           versioning.versioning_pattern ||
           null;
  };

  // Helper function to get backward compatibility
  const getBackwardCompatibility = () => {
    const versioning = getVersioning();
    if (!versioning) return null;
    
    return versioning.backwardCompatibility || 
           versioning.backward_compatibility ||
           null;
  };

  // Helper function to get domain evolution
  const getDomainEvolution = () => {
    const versioning = getVersioning();
    if (!versioning) return null;
    
    return versioning.domainEvolution || 
           versioning.domain_evolution ||
           versioning.domainEvolutionConsiderations ||
           versioning.domain_evolution_considerations ||
           null;
  };

  const versioning = getVersioning();
  const recommendedApproach = getRecommendedApproach();
  const approachDetails = getApproachDetails();
  const lifecycleManagement = getLifecycleManagement();
  const backwardCompatibility = getBackwardCompatibility();
  const domainEvolution = getDomainEvolution();
  const versioningPattern = getVersioningPattern();

  return (
    <div>
      <h5 className="font-bold text-blue-700 mb-3">API Versioning Strategy</h5>
      
      {versioning ? (
        <div className="space-y-6">
          {/* Recommended Approach */}
          {recommendedApproach && (
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold">Recommended Approach</h3>
                  <p className="text-sm text-gray-600">Suggested versioning strategy</p>
                </div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="font-medium text-blue-800">{recommendedApproach}</div>
              </div>

              {versioningPattern && (
                <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500">Pattern</div>
                  <div className="font-medium text-blue-800">{versioningPattern}</div>
                </div>
              )}
              
              {approachDetails && typeof approachDetails === 'object' && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(approachDetails).map(([key, value], index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded">
                      <div className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</div>
                      <div className="text-sm">{value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Lifecycle Management */}
          {lifecycleManagement && typeof lifecycleManagement === 'object' && (
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold">Lifecycle Management</h3>
                  <p className="text-sm text-gray-600">Version lifecycle stages and transitions</p>
                </div>
              </div>
              
              {/* Version Retention */}
              {lifecycleManagement.versionRetention && (
                <div className="mb-4 bg-green-50 p-3 rounded">
                  <h4 className="text-sm font-semibold mb-1">Version Retention</h4>
                  <div className="text-sm">{lifecycleManagement.versionRetention}</div>
                </div>
              )}

              {/* Release Schedule */}
              {lifecycleManagement.releaseSchedule && typeof lifecycleManagement.releaseSchedule === 'object' && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-2">Release Schedule</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {Object.entries(lifecycleManagement.releaseSchedule).map(([key, value], index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</div>
                        <div className="text-sm font-medium">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Deprecation Policy */}
              {lifecycleManagement.deprecationPolicy && typeof lifecycleManagement.deprecationPolicy === 'object' && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-2">Deprecation Policy</h4>
                  <div className="bg-gray-50 p-3 rounded">
                    {Object.entries(lifecycleManagement.deprecationPolicy).map(([key, value], index) => (
                      <div key={index} className="mb-2 last:mb-0">
                        <div className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</div>
                        {Array.isArray(value) ? (
                          <ul className="list-disc pl-5 text-sm">
                            {value.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm">{value}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Support Policy */}
              {lifecycleManagement.supportPolicy && typeof lifecycleManagement.supportPolicy === 'object' && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-2">Support Policy</h4>
                  <div className="bg-gray-50 p-3 rounded">
                    {Object.entries(lifecycleManagement.supportPolicy).map(([key, value], index) => (
                      <div key={index} className="mb-2 last:mb-0">
                        <div className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</div>
                        <div className="text-sm">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Original Lifecycle Management Structure */}
              {lifecycleManagement.stages && Array.isArray(lifecycleManagement.stages) && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-2">Lifecycle Stages</h4>
                  <div className="flex flex-wrap gap-2">
                    {lifecycleManagement.stages.map((stage, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded flex-grow">
                        <div className="font-medium">{stage.name}</div>
                        {stage.duration && <div className="text-sm text-gray-600">Duration: {stage.duration}</div>}
                        {stage.support && <div className="text-sm text-gray-600">Support: {stage.support}</div>}
                        {stage.purpose && <div className="text-sm text-gray-600">Purpose: {stage.purpose}</div>}
                        {stage.stability && <div className="text-sm text-gray-600">Stability: {stage.stability}</div>}
                        {stage.action && <div className="text-sm text-gray-600">Action: {stage.action}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {(lifecycleManagement.communication || lifecycleManagement.transitionStrategy) && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Communication Strategy</h4>
                  <div className="bg-gray-50 p-3 rounded">
                    {Object.entries(lifecycleManagement.communication || lifecycleManagement.transitionStrategy || {}).map(([key, value], index) => (
                      <div key={index} className="mb-2 last:mb-0">
                        <div className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</div>
                        {Array.isArray(value) ? (
                          <ul className="list-disc pl-5 text-sm">
                            {value.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm">{value}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Backward Compatibility */}
          {backwardCompatibility && typeof backwardCompatibility === 'object' && (
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold">Backward Compatibility</h3>
                  <p className="text-sm text-gray-600">Guidelines for maintaining compatibility</p>
                </div>
              </div>
              
              {/* Handle both array and object formats */}
              {Array.isArray(backwardCompatibility.guidelines) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {backwardCompatibility.guidelines && Array.isArray(backwardCompatibility.guidelines) && (
                    <div className="bg-green-50 p-3 rounded">
                      <h4 className="text-sm font-semibold mb-2 text-green-800">Guidelines</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {backwardCompatibility.guidelines.map((guideline, index) => (
                          <li key={index} className="text-sm text-green-900">{guideline}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {backwardCompatibility.breakingChanges && Array.isArray(backwardCompatibility.breakingChanges) && (
                    <div className="bg-red-50 p-3 rounded">
                      <h4 className="text-sm font-semibold mb-2 text-red-800">Breaking Changes</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {backwardCompatibility.breakingChanges.map((change, index) => (
                          <li key={index} className="text-sm text-red-900">{change}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {backwardCompatibility.evolutionPatterns && Array.isArray(backwardCompatibility.evolutionPatterns) && (
                    <div className="bg-blue-50 p-3 rounded">
                      <h4 className="text-sm font-semibold mb-2 text-blue-800">Evolution Patterns</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {backwardCompatibility.evolutionPatterns.map((pattern, index) => (
                          <li key={index} className="text-sm text-blue-900">{pattern}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(backwardCompatibility).map(([key, value], index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded">
                      <h4 className="text-sm font-semibold mb-2 capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</h4>
                      {typeof value === 'string' ? (
                        <div className="text-sm">{value}</div>
                      ) : Array.isArray(value) ? (
                        <ul className="list-disc pl-5 space-y-1">
                          {value.map((item, i) => (
                            <li key={i} className="text-sm">{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <pre className="text-xs overflow-auto max-h-32">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Domain Evolution */}
          {domainEvolution && typeof domainEvolution === 'object' && (
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold">Domain Evolution Considerations</h3>
                  <p className="text-sm text-gray-600">Domain-specific versioning considerations</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {Object.entries(domainEvolution).map(([domain, details], index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded">
                    <h4 className="font-medium mb-2">{formatDomainName(domain)}</h4>
                    
                    {typeof details === 'object' ? (
                      <div className="space-y-2">
                        {Object.entries(details).map(([key, value], i) => (
                          <div key={i}>
                            <div className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</div>
                            {Array.isArray(value) ? (
                              <ul className="list-disc pl-5 text-sm">
                                {value.map((item, j) => (
                                  <li key={j}>{item}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-sm">{value}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm">{details}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          

        </div>
      ) : (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700">No versioning strategy defined.</p>
          <p className="text-sm text-yellow-600 mt-2">Consider adding a versioning strategy to manage API evolution.</p>
        </div>
      )}
    </div>
  );
}

// Helper function to format domain names
function formatDomainName(domain) {
  // Handle camelCase
  const fromCamelCase = domain.replace(/([A-Z])/g, ' $1');
  
  // Handle snake_case
  const fromSnakeCase = fromCamelCase.replace(/_/g, ' ');
  
  // Capitalize first letter of each word
  return fromSnakeCase
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}