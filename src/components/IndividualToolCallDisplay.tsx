import React, { useState } from 'react';
// import { ActiveToolCall } from '@/types'; // Changed
import { ToolCallStreamItem } from '@/types'; // Changed
import { CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronRight, Search, Terminal, ChevronsUpDown } from 'lucide-react';

interface IndividualToolCallDisplayProps {
  // toolCall: ActiveToolCall; // Changed
  toolCall: ToolCallStreamItem; // Changed
  onClick?: (toolCall: ToolCallStreamItem) => void;
  isSelected?: boolean;
}

const getToolIcon = (functionName: string) => {
  if (functionName.toLowerCase().includes('search') || functionName.toLowerCase().includes('query')) {
    return <Search className="w-4 h-4 mr-2 flex-shrink-0 text-sky-400" />;
  }
  if (functionName.toLowerCase().includes('code') || functionName.toLowerCase().includes('sandbox') || functionName.toLowerCase().includes('execute')) {
    return <Terminal className="w-4 h-4 mr-2 flex-shrink-0 text-lime-400" />;
  }
  return <ChevronsUpDown className="w-4 h-4 mr-2 flex-shrink-0 text-gray-400" />; // Default icon
};

export function IndividualToolCallDisplay({ toolCall, onClick, isSelected }: IndividualToolCallDisplayProps) {
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed

  return (
    <div className={`p-3 rounded-lg border shadow-md transition-all mb-2 last:mb-0 ${isSelected ? 'border-blue-500 bg-blue-900/30' : 'bg-zinc-800/70 border-zinc-700/80 hover:border-zinc-600/90'}`}>
      <div 
        className="flex items-center justify-between cursor-pointer" 
        onClick={() => {
          setIsCollapsed(!isCollapsed);
          if (onClick && toolCall.status === 'success') onClick(toolCall);
        }}
      >
        <div className="flex items-center min-w-0">
          <div className="flex-shrink-0">
            {toolCall.status === 'pending' && <Loader2 size={16} className="animate-spin text-blue-400 mr-2" />}
            {toolCall.status === 'success' && <CheckCircle2 size={16} className="text-green-400 mr-2" />}
            {toolCall.status === 'error' && <AlertCircle size={16} className="text-red-400 mr-2" />}
          </div>
          {getToolIcon(toolCall.functionName)}
          <span className="text-sm font-semibold text-slate-100 truncate" title={toolCall.functionName}>
            {toolCall.functionName}
          </span>
        </div>
        <button 
          title={isCollapsed ? "Expand tool call details" : "Collapse tool call details"} 
          className="p-1 rounded hover:bg-zinc-700/70"
        >
          {isCollapsed ? <ChevronRight size={18} className="text-zinc-400 hover:text-zinc-200" /> : <ChevronDown size={18} className="text-zinc-300 hover:text-zinc-100" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="mt-2.5 pt-2.5 border-t border-zinc-700/60 space-y-2">
          <div>
            <p className="text-xs font-medium text-slate-300 mb-0.5">Arguments:</p>
            <pre className="bg-zinc-900/70 p-2.5 rounded text-xs text-slate-200/90 overflow-x-auto whitespace-pre-wrap break-words font-mono">
              <code>{toolCall.arguments}</code>
            </pre>
          </div>

          {toolCall.status === 'success' && toolCall.response && (
            <div>
              <p className="text-xs font-medium text-green-400 mb-0.5">Response:</p>
              <pre className="bg-zinc-900/70 p-2.5 rounded text-xs text-green-300/90 overflow-x-auto whitespace-pre-wrap break-words">
                <code>{toolCall.response}</code>
              </pre>
            </div>
          )}
          {toolCall.status === 'error' && toolCall.errorMessage && (
            <div>
              <p className="text-xs font-medium text-red-400 mb-0.5">Error:</p>
              <pre className="bg-red-900/50 p-2.5 rounded text-xs text-red-300/90 overflow-x-auto whitespace-pre-wrap break-words">
                <code>{toolCall.errorMessage}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 