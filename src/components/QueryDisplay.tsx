import React from 'react';

interface QueryDisplayProps {
  queries: string[];
}

export function QueryDisplay({ queries }: QueryDisplayProps) {
  if (!queries || queries.length === 0) return null;

  return (
    <div className="bg-muted border border-border rounded-xl p-4 w-full shadow-sm my-2">
      <div className="font-semibold text-muted-foreground mb-2 border-b border-border pb-1 text-sm">
        Generated Cypher Queries:
      </div>
      {queries.map((query, index) => (
        <pre key={index} className="bg-background text-foreground p-3 rounded border border-border overflow-x-auto whitespace-pre-wrap break-words text-xs font-mono mb-2">
          <code>{query}</code>
        </pre>
      ))}
    </div>
  );
} 