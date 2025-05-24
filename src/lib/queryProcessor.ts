import React from 'react';
import { Message, QueryExecution } from '@/types'; // Assuming types are in @/types

// Interface for the setters that this utility will use from the main hook
export interface QueryProcessorSetters {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setQueryExecutions: React.Dispatch<React.SetStateAction<QueryExecution[]>>;
  setIsQueryPanelVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsQueryPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

// Function to execute a Cypher query
export async function executeCypherQuery(
  executionId: string,
  cypherQuery: string,
  setters: QueryProcessorSetters
): Promise<void> {
  const { 
    setMessages, 
    setQueryExecutions, 
    setIsQueryPanelVisible, 
    setIsQueryPanelCollapsed 
  } = setters;

  console.log(`Executing Cypher (ID: ${executionId}):`, cypherQuery);
  try {
    const response = await fetch('/api/neo4j', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: cypherQuery }),
    });

    let statusUpdate: Partial<QueryExecution> = {};
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Error executing Cypher (ID: ${executionId}):`, errorData);
      setMessages(prev => [...prev, { 
        sender: 'system_error', 
        content: `API Error for query (ID ${executionId}): ${errorData.details || response.statusText}`, 
        timestamp: Date.now() 
      }]);
      statusUpdate = { status: 'error', records: null, errorDetails: errorData.details || response.statusText };
    } else {
      const data = await response.json();
      console.log(`API Query Results (ID: ${executionId}):`, data.records);
      statusUpdate = { status: 'success', records: (data.records && data.records.length > 0) ? data.records : [] };
      if (!(data.records && data.records.length > 0)){
          setMessages(prev => [...prev, { 
            sender: 'agent', 
            content: `Query (ID ${executionId}) executed successfully but returned no data.`, 
            timestamp: Date.now() 
          }]);
      }
    }
    setQueryExecutions(prevExecutions => 
      prevExecutions.map(exec => exec.id === executionId ? { ...exec, ...statusUpdate } : exec)
    );
    setIsQueryPanelVisible(true);
    setIsQueryPanelCollapsed(false);

  } catch (error: any) {
    console.error(`Failed to call /api/neo4j for query (ID: ${executionId}):`, error);
    setMessages(prev => [...prev, { 
      sender: 'system_error', 
      content: `Failed to execute query (ID ${executionId}): ${error.message}`, 
      timestamp: Date.now() 
    }]);
    setQueryExecutions(prevExecutions => 
      prevExecutions.map(exec => exec.id === executionId ? { ...exec, status: 'error', records: null, errorDetails: error.message } : exec)
    );
  }
} 