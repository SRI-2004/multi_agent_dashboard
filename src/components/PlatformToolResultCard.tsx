import React from 'react';

interface PlatformToolResultCardProps {
  type: 'schema' | 'rules';
  content: string;
}

export const PlatformToolResultCard: React.FC<PlatformToolResultCardProps> = ({ type, content }) => {
  return (
    <div className="w-full h-full overflow-auto p-2">
      <pre className="whitespace-pre-wrap break-all text-xs bg-muted rounded p-2 border border-muted-foreground/10">
        {content}
      </pre>
    </div>
  );
}; 