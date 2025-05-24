export type MessageSender = 
  | "user" 
  | "agent" 
  | "thinking" 
  | "cypher_queries" 
  | "agent_analysis" 
  | "system_error"
  | "QueryGeneratorAgent"
  | "AnalysisAgent"
  | "GraphGeneratorAgent"
  | "OrchestratorAgent";

export interface Message {
  sender: MessageSender;
  content: string | string[]; // Content can be a string or array of strings (for queries)
  timestamp: number; // Added for chronological sorting with tool calls
}

// Define the structure for individual query executions
export interface QueryExecution {
  id: string; // Unique ID for tab key and identification
  query: string;
  records: Array<Record<string, any>> | null;
  status: 'pending' | 'success' | 'error';
  errorDetails?: string;
}

// Types for Graph Fragment and Sandbox Execution
export interface GraphFragment {
  template?: string;
  filePath?: string;
  code: string;
  dependencies?: Record<string, string>;
  port?: number;
}

export interface SandboxExecutionSuccess {
  url: string;
  code: string; 
  sandboxID: string;
  logs?: {
    mkdir_stdout?: string;
    mkdir_stderr?: string;
  };
}

export interface SandboxExecutionError {
  error: string;
  details?: string;
  templateUsed?: string;
  stack?: string; 
}

export type SandboxExecutionResult = SandboxExecutionSuccess | SandboxExecutionError; 

// Types for Tool Calling Feature

// Represents an item in the 'tool_calls' array from the backend message
export interface BackendToolCall {
  id: string;
  function: {
    name: string;
    arguments: string; // This is a JSON string
  };
  type: 'function'; 
}

// Represents an item in the 'tool_responses' array from the backend message
export interface BackendToolResponse {
  tool_call_id: string;
  role: 'tool';
  content: string; // The actual result string from the tool
}

// Represents an active tool call being displayed (either standalone or within UnifiedProgressItem)
// This existing ActiveToolCall might still be useful for other UI parts if any, or can be deprecated if UnifiedProgressItem fully supersedes its display needs.
// For now, we are introducing new stream-specific item types for UnifiedProgressItem.
export interface ActiveToolCall {
  id: string; 
  functionName: string;
  arguments: string; 
  status: 'pending' | 'success' | 'error';
  response?: string; 
  errorMessage?: string;
  timestamp: number; 
  displayText: string; 
}

// New stream item types for UnifiedProgressItem
export interface ThinkingStepStreamItem {
  type: 'thinking_step';
  id: string; // e.g., `thinking-${timestamp}-${Math.random().toString(36).substring(2, 9)}`
  text: string;
  timestamp: number;
}

export interface ToolCallStreamItem {
  type: 'tool_call_log_entry';
  id: string; // This is the original tool_call_id from the backend
  functionName: string;
  arguments: string;
  status: 'pending' | 'success' | 'error';
  response?: string;
  errorMessage?: string;
  timestamp: number; // Timestamp of initiation (for pending) or update (for success/error)
  displayText: string;
}

// UnifiedProgressItem now holds a single stream of interleaved items
export interface UnifiedProgressItem {
  id: string; // Unique ID for this progress block
  // thinkingSteps: Array<{ text: string; timestamp: number }>; // Removed
  // toolCalls: ActiveToolCall[]; // Removed
  progressStream: Array<ThinkingStepStreamItem | ToolCallStreamItem>; // Added
  isCollapsed: boolean;
  lastActivityTimestamp: number; // Timestamp of the most recent update to this item, to sort this whole block against other chat messages
} 