import React from 'react';

export default function StageIndicator({ currentStage }) {
  const stages = [
    { id: 'input', name: 'Domain Input', description: 'Upload image or describe domain' },
    { id: 'analysis', name: 'Domain Analysis', description: 'Review and edit domain analysis' },
    { id: 'openapi', name: 'OpenAPI Generation', description: 'Generate and view API specification' },
    { id: 'security', name: 'Security Specs', description: 'Add security and additional specs' }
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => (
          <React.Fragment key={stage.id}>
            {/* Stage circle */}
            <div className="flex flex-col items-center relative">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                  ${currentStage === stage.id 
                    ? 'bg-primary text-white border-primary' 
                    : stages.indexOf(stages.find(s => s.id === currentStage)) > index 
                      ? 'bg-green-500 text-white border-green-500' 
                      : 'bg-white text-gray-500 border-gray-300'}`}
              >
                {stages.indexOf(stages.find(s => s.id === currentStage)) > index 
                  ? '✓' 
                  : index + 1}
              </div>
              <div className="text-xs mt-2 text-center w-24">
                <div className="font-semibold">{stage.name}</div>
                <div className="text-gray-500 hidden sm:block">{stage.description}</div>
              </div>
            </div>
            
            {/* Connector line */}
            {index < stages.length - 1 && (
              <div 
                className={`flex-1 h-0.5 mx-2 
                  ${stages.indexOf(stages.find(s => s.id === currentStage)) > index 
                    ? 'bg-green-500' 
                    : 'bg-gray-300'}`}
              ></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}