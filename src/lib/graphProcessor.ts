import React from 'react';
import { 
  Message, 
  GraphFragment, 
  SandboxExecutionResult, 
  SandboxExecutionSuccess, 
  SandboxExecutionError 
} from '@/types'; // Assuming types are in @/types

// Interface for the setters that this utility will use from the main hook
export interface GraphProcessorSetters {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsSandboxLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setSandboxResult: React.Dispatch<React.SetStateAction<SandboxExecutionResult | null>>;
  setActiveGraphFragment: React.Dispatch<React.SetStateAction<GraphFragment | null>>;
  setIsSandboxPanelVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSandboxPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

// Function to handle graph fragment for sandbox execution
export async function handleGraphFragmentForSandbox(
  fragment: GraphFragment,
  setters: GraphProcessorSetters
): Promise<void> {
  const {
    setMessages,
    setIsSandboxLoading,
    setSandboxResult,
    setActiveGraphFragment,
    setIsSandboxPanelVisible,
    setIsSandboxPanelCollapsed,
  } = setters;

  console.log("[DEBUG] (graphProcessor) Inside handleGraphFragmentForSandbox. Fragment data:", fragment);
  setIsSandboxLoading(true);
  setSandboxResult(null);
  setActiveGraphFragment(fragment);
  setIsSandboxPanelVisible(true);
  setIsSandboxPanelCollapsed(false); // Expand sandbox by default

  try {
    console.log("[DEBUG] (graphProcessor) Calling /api/sandbox/graph API with fragment:", fragment);
    const response = await fetch('/api/sandbox/graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fragment),
    });

    const resultData = await response.json();
    console.log(`[DEBUG] (graphProcessor) /api/sandbox/graph response status: ${response.status}, data:`, resultData);

    if (!response.ok) {
      console.error('[ERROR] (graphProcessor) Error from /api/sandbox/graph:', resultData);
      setSandboxResult({ 
          error: resultData.error || 'Failed to execute sandbox code.',
          details: resultData.details,
          templateUsed: resultData.templateUsed,
          stack: resultData.stack 
      } as SandboxExecutionError);
      setMessages(prev => [...prev, { 
        sender: 'system_error', 
        content: `Sandbox Error: ${resultData.details || resultData.error}`, 
        timestamp: Date.now() 
      }]);
    } else {
      console.log('[SUCCESS] (graphProcessor) Success from /api/sandbox/graph:', resultData);
      setSandboxResult(resultData as SandboxExecutionSuccess);
    }
  } catch (error: any) {
    console.error('[CRITICAL_ERROR] (graphProcessor) Failed to call /api/sandbox/graph or parse its response:', error);
    setSandboxResult({ error: 'Network or parsing error when calling sandbox API.', details: error.message } as SandboxExecutionError);
    setMessages(prev => [...prev, { 
      sender: 'system_error', 
      content: `Sandbox API Call Failed: ${error.message}`, 
      timestamp: Date.now() 
    }]);
  } finally {
    setIsSandboxLoading(false);
  }
} 