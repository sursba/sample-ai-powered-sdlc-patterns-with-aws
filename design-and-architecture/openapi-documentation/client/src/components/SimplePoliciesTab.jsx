import React from 'react';

export default function SimplePoliciesTab({ documentation }) {
  // Safety check to prevent rendering errors
  if (!documentation) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-700">No documentation data available.</p>
      </div>
    );
  }
  


  // Helper function to get rate limiting info
  const getRateLimiting = () => {
    const policies = documentation?.parsed_json?.policies;
    if (!policies) return null;

    try {

      
      // Direct access to rateLimiting property
      if (policies.rateLimiting) {
        return { type: 'complex', data: policies.rateLimiting };
      } else if (policies.rate || policies.requestsPerMinute) {
        return { 
          type: 'simple', 
          data: {
            rate: policies.rate,
            requestsPerMinute: policies.requestsPerMinute,
            period: policies.period,
            burst: policies.burst,
            burstLimit: policies.burstLimit
          }
        };
      } else {
        // Try to find rate limiting in any nested structure
        for (const key in policies) {
          if (policies[key] && typeof policies[key] === 'object' && policies[key].rateLimiting) {

            return { type: 'complex', data: policies[key].rateLimiting };
          }
        }
      }
    } catch (error) {
      // Handle error silently
    }
    return null;
  };

  // Helper function to get caching info
  const getCaching = () => {
    const policies = documentation?.parsed_json?.policies;
    if (!policies) return null;
    try {
      // Direct access to caching property
      if (policies.caching) {
        return policies.caching;
      } else {
        // Try to find caching in any nested structure
        for (const key in policies) {
          if (policies[key] && typeof policies[key] === 'object' && policies[key].caching) {

            return policies[key].caching;
          }
        }
      }
      return null;
    } catch (error) {
      // Handle error silently
      return null;
    }
  };

  // Helper function to get validation info
  const getValidation = () => {
    const policies = documentation?.parsed_json?.policies;
    if (!policies) return null;
    try {
      // Direct access to validation property
      if (policies.validation) {
        return policies.validation;
      } else {
        // Try to find validation in any nested structure
        for (const key in policies) {
          if (policies[key] && typeof policies[key] === 'object' && policies[key].validation) {

            return policies[key].validation;
          }
        }
      }
      return null;
    } catch (error) {
      // Handle error silently
      return null;
    }
  };

  // Helper function to get recommendations
  const getRecommendations = () => {
    const policies = documentation?.parsed_json?.policies;
    if (!policies) return null;
    try {
      // Direct access to recommendations property
      if (policies.recommendations) {
        return policies.recommendations;
      } else {
        // Try to find recommendations in any nested structure
        for (const key in policies) {
          if (policies[key] && typeof policies[key] === 'object' && policies[key].recommendations) {

            return policies[key].recommendations;
          }
        }
      }
      return null;
    } catch (error) {
      // Handle error silently
      return null;
    }
  };

  const rateLimiting = getRateLimiting();
  const caching = getCaching();
  const validation = getValidation();
  const recommendations = getRecommendations();

  return (
    <div>
      <h5 className="font-bold text-blue-700 mb-3">API Governance Policies</h5>
      
      {/* Rate Limiting Section */}
      {rateLimiting && (
        <div className="mb-6 mt-4">
          <h6 className="font-semibold text-gray-700 mb-2">Rate Limiting</h6>
          
          {rateLimiting.type === 'simple' ? (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold">Default Rate Limit</h3>
                  <p className="text-sm text-gray-600">Global rate limiting configuration</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                {rateLimiting.data.rate && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-500">Rate</div>
                    <div className="font-medium">{rateLimiting.data.rate} requests</div>
                  </div>
                )}
                {rateLimiting.data.requestsPerMinute && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-500">Requests Per Minute</div>
                    <div className="font-medium">{rateLimiting.data.requestsPerMinute}</div>
                  </div>
                )}
                {rateLimiting.data.period && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-500">Period</div>
                    <div className="font-medium">{rateLimiting.data.period}</div>
                  </div>
                )}
                {(rateLimiting.data.burst || rateLimiting.data.burstLimit) && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-500">Burst Limit</div>
                    <div className="font-medium">{rateLimiting.data.burst || rateLimiting.data.burstLimit} requests</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              {typeof rateLimiting.data === 'object' && !Array.isArray(rateLimiting.data) ? (
                <div className="space-y-4">
                  {Object.entries(rateLimiting.data).map(([path, limits], index) => (
                    <div key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
                      <h3 className="font-semibold text-gray-800 mb-2">{path}</h3>
                      {typeof limits === 'object' ? (
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(limits).map(([key, value], i) => (
                            <div key={i} className="bg-gray-50 p-2 rounded">
                              <div className="text-xs text-gray-500 capitalize">{key}</div>
                              <div className="text-sm">{typeof value === 'object' ? JSON.stringify(value) : value}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm bg-gray-50 p-2 rounded">{limits}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="text-xs overflow-auto max-h-64">
                  {JSON.stringify(rateLimiting.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Caching Section */}
      {caching && (
        <div className="mb-6">
          <h6 className="font-semibold text-gray-700 mb-2">Caching Strategies</h6>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            {typeof caching === 'object' && !Array.isArray(caching) ? (
              <div className="space-y-4">
                {Object.entries(caching).map(([path, strategy], index) => (
                  <div key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
                    <h3 className="font-semibold text-gray-800 mb-2">{path}</h3>
                    {typeof strategy === 'object' ? (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(strategy).map(([key, value], i) => (
                          <div key={i} className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 capitalize">{key}</div>
                            <div className="text-sm">
                              {Array.isArray(value) 
                                ? value.join(', ') 
                                : typeof value === 'object' 
                                  ? JSON.stringify(value) 
                                  : value}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm bg-gray-50 p-2 rounded">{strategy}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <pre className="text-xs overflow-auto max-h-64">
                {JSON.stringify(caching, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Validation Section */}
      {validation && (
        <div className="mb-6">
          <h6 className="font-semibold text-gray-700 mb-2">Validation Rules</h6>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            {typeof validation === 'object' ? (
              <div className="space-y-3">
                {Object.entries(validation).map(([key, value], index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded">
                    <div className="font-medium mb-1">{key}</div>
                    {typeof value === 'object' ? (
                      <pre className="text-xs overflow-auto max-h-32">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-sm text-gray-700">{value}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm">{validation}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendations Section */}
      {recommendations && (
        <div className="mb-6">
          <h6 className="font-semibold text-gray-700 mb-2">Policy Recommendations</h6>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            {typeof recommendations === 'object' && !Array.isArray(recommendations) ? (
              <div className="space-y-4">
                {Object.entries(recommendations).map(([category, items], index) => (
                  <div key={index} className="mb-3 last:mb-0">
                    <h4 className="text-sm font-semibold mb-1 capitalize">{category}</h4>
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="text-sm">{typeof items === 'object' ? JSON.stringify(items) : items}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : Array.isArray(recommendations) ? (
              <ul className="space-y-2">
                {recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <div className="text-blue-500 mr-2 mt-0.5">
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
            ) : (
              <pre className="text-xs overflow-auto max-h-64">
                {JSON.stringify(recommendations, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* No Policies Message */}
      {!rateLimiting && !caching && !validation && !recommendations && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mb-4 mt-4">
          <p className="text-yellow-700">No structured API governance policies available.</p>
          <p className="text-sm text-yellow-600 mt-2">Using raw data view instead.</p>
        </div>
      )}
    </div>
  );
}