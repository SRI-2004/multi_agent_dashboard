import React from 'react';
import { ActiveToolCall } from '@/types';
import { Loader2, CheckCircle2, Search, Eye, AlertCircle } from 'lucide-react'; // Added AlertCircle for future error state

interface ToolCallCardProps {
  toolCall: ActiveToolCall;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  // console.log(`ToolCallCard ID: ${toolCall.id}, Status: ${toolCall.status}, DisplayText: ${toolCall.displayText}`); // Uncomment for debugging status

  // const handleViewClick = () => { // View button removed for now
  //   console.log("Tool Call Arguments:", toolCall.arguments);
  //   if (toolCall.response) {
  //     console.log("Tool Call Response:", toolCall.response);
  //   }
  //   if (toolCall.status === 'error' && toolCall.errorMessage) {
  //     console.log("Tool Call Error:", toolCall.errorMessage);
  //   }
  // };

  return (
    <div className="my-2 flex items-center justify-between bg-zinc-700 hover:bg-zinc-600/80 shadow-md p-3 rounded-lg w-full max-w-2xl transition-colors duration-150 ease-in-out">
      <div className="flex items-center overflow-hidden">
        <span className="text-sm font-medium text-zinc-300 mr-2 whitespace-nowrap">
          Using Tool |
        </span>
        <Search size={18} className="text-zinc-400 mr-2 flex-shrink-0" /> 
        <span className="text-sm text-zinc-300 truncate" title={toolCall.displayText}>
          {toolCall.displayText}
        </span>
      </div>

      <div className="flex items-center ml-4 flex-shrink-0">
        {toolCall.status === 'pending' && (
          <Loader2 size={20} className="text-blue-400 animate-spin" />
        )}
        {toolCall.status === 'success' && (
          <CheckCircle2 size={20} className="text-green-400" />
        )}
        {/* Placeholder for future error icon */}
        {/* {toolCall.status === 'error' && (
          <AlertCircle size={20} className="text-red-400" />
        )} */}
        {/* View button removed based on previous request */}
        {/* <button
          onClick={handleViewClick}
          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-900 text-xs text-zinc-300 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 transition-colors duration-150 ease-in-out flex items-center whitespace-nowrap ml-3"
        >
          <Eye size={14} className="mr-1.5" />
          View
        </button> */}
      </div>
    </div>
  );
} 