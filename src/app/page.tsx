'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useWebSocketChat } from '@/hooks/useWebSocket';
import type { QueryExecution, Message as MessageType, UnifiedProgressItem as UnifiedProgressItemType } from '@/types';
import { ChatMessageItem } from '@/components/ChatMessageItem';
import { TableView } from '@/components/TableView';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { X, Loader2, AlertCircle, CheckCircle2, Maximize, Minimize } from 'lucide-react';
import SandboxPreviewPanel from '@/components/SandboxPreviewPanel';
import { UnifiedProgressCard } from '@/components/UnifiedProgressCard';

// Define a discriminated union for display items
type DisplayItem = 
  | { type: 'message'; data: MessageType; timestamp: number; id: string; }
  | { type: 'unified_progress'; data: UnifiedProgressItemType; timestamp: number; id: string; };

export default function ChatPage() {
  const {
    messages,
    sendMessage,
    queryExecutions,
    activeQueryExecutionId,
    setActiveQueryExecutionId,
    isQueryPanelVisible,
    clearQueryResults,
    isQueryPanelCollapsed,
    toggleQueryPanelCollapse,
    sandboxResult,
    isSandboxLoading,
    activeGraphFragment,
    isSandboxPanelVisible,
    clearSandboxPreview,
    isSandboxPanelCollapsed,
    toggleSandboxPanelCollapse,
    unifiedProgress,
    toggleUnifiedProgressCollapse,
  } = useWebSocketChat();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const displayItems: DisplayItem[] = useMemo(() => {
    // 1. Map all messages from state to DisplayItem structure
    const allMessageItems: DisplayItem[] = messages.map((msg, index) => ({
      type: 'message' as 'message',
      data: msg,
      timestamp: msg.timestamp,
      id: `msg-${msg.timestamp}-${index}-${msg.sender}`
    })); 

    // 2. Sort these message items chronologically
    const sortedMessageItems = allMessageItems.sort((a, b) => a.timestamp - b.timestamp);

    // 3. If unifiedProgress exists, prepare its display item and insert it strategically
    if (unifiedProgress) {
      const progressDisplayItem: DisplayItem = {
        type: 'unified_progress' as 'unified_progress',
        data: unifiedProgress,
        timestamp: unifiedProgress.lastActivityTimestamp, // This timestamp is for the UProgress item itself
        id: `progress-${unifiedProgress.id}`
      };

      // Find the index of the last user message
      let lastUserMessageIndex = -1;
      for (let i = sortedMessageItems.length - 1; i >= 0; i--) {
        const item = sortedMessageItems[i];
        // Check if the item is a message and its sender is 'user'
        if (item.type === 'message' && item.data.sender === 'user') {
          lastUserMessageIndex = i;
          break;
        }
      }

      // Insert unifiedProgress after the last user message, or at the beginning if no user message
      if (lastUserMessageIndex !== -1) {
        sortedMessageItems.splice(lastUserMessageIndex + 1, 0, progressDisplayItem);
      } else {
        // If no user messages, or if we want it strictly at the top before any agent message following no user interaction
        sortedMessageItems.unshift(progressDisplayItem);
      }
      return sortedMessageItems;
    }

    // If no unifiedProgress, just return the sorted messages
    return sortedMessageItems;
  }, [messages, unifiedProgress]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [displayItems]); // Scroll when displayItems change

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage(newMessage.trim());
      setNewMessage('');
    }
  };
  
  const getStatusIcon = (status: QueryExecution['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin mr-1" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500 mr-1" />;
      default:
        return null;
    }
  };

  const chatCardWidthClass = isQueryPanelVisible || isSandboxPanelVisible ? "w-1/2" : "w-full max-w-2xl";
  const chatCardHeightClass = "h-[90vh]";

  let queryResultsCardHeight = "h-full";
  let sandboxWrapperHeight = "h-0";
  const rightPanelGap = "gap-4";
  const minCardHeight = "min-h-[6rem]";

  if (isQueryPanelVisible && isSandboxPanelVisible) {
    if (isQueryPanelCollapsed && isSandboxPanelCollapsed) {
      queryResultsCardHeight = `h-14 ${minCardHeight}`;
      sandboxWrapperHeight = `h-14 ${minCardHeight}`;
    } else if (isQueryPanelCollapsed) {
      queryResultsCardHeight = `h-14 ${minCardHeight}`;
      sandboxWrapperHeight = `flex-grow ${minCardHeight}`;
    } else if (isSandboxPanelCollapsed) {
      queryResultsCardHeight = `flex-grow ${minCardHeight}`;
      sandboxWrapperHeight = `h-14 ${minCardHeight}`;
    } else {
      queryResultsCardHeight = `flex-1 ${minCardHeight}`;
      sandboxWrapperHeight = `flex-1 ${minCardHeight}`;
    }
  } else if (isQueryPanelVisible) {
    queryResultsCardHeight = isQueryPanelCollapsed ? `h-14 ${minCardHeight}` : `h-full ${minCardHeight}`;
    sandboxWrapperHeight = "h-0 hidden";
  } else if (isSandboxPanelVisible) {
    queryResultsCardHeight = "h-0 hidden";
    sandboxWrapperHeight = isSandboxPanelCollapsed ? `h-14 ${minCardHeight}` : `h-full ${minCardHeight}`;
  } else {
    queryResultsCardHeight = "h-0 hidden";
    sandboxWrapperHeight = "h-0 hidden";
  }

  const handleClearSandboxPreview = () => {
    clearSandboxPreview();
  };

  const mainContentRowJustifyClass = isQueryPanelVisible || isSandboxPanelVisible ? "justify-start" : "justify-center";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className={`flex w-full mx-auto gap-4 h-[90vh] ${mainContentRowJustifyClass}`}>
        <Card className={`flex flex-col ${chatCardWidthClass} ${chatCardHeightClass}`}>
          <CardHeader>
            <CardTitle>Chatbot</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow overflow-y-auto p-6 space-y-4">
            {displayItems.map((item) => {
              if (item.type === 'message') {
                return <ChatMessageItem key={item.id} msg={item.data as MessageType} />;
              }
              if (item.type === 'unified_progress') {
                return <UnifiedProgressCard key={item.id} item={item.data as UnifiedProgressItemType} onToggleCollapse={toggleUnifiedProgressCollapse} />;
              }
              return null;
            })}
            <div ref={messagesEndRef} />
          </CardContent>
          <CardFooter className="p-6 border-t">
            <form onSubmit={handleSendMessage} className="flex w-full space-x-2">
              <Input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-grow"
                autoFocus
              />
              <Button type="submit">Send</Button>
            </form>
          </CardFooter>
        </Card>

        {(isQueryPanelVisible || isSandboxPanelVisible) && (
          <div className={`w-1/2 flex flex-col ${rightPanelGap} h-full`}>
            {isQueryPanelVisible && (
              <Card className={`flex flex-col w-full ${queryResultsCardHeight} transition-all duration-300 ease-in-out`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle>Query Results</CardTitle>
                    {!isQueryPanelCollapsed && <CardDescription>Data from executed Cypher queries.</CardDescription>}
                  </div>
                  <div className="flex items-center">
                    <Button variant="ghost" size="icon" onClick={toggleQueryPanelCollapse} aria-label={isQueryPanelCollapsed ? "Expand Query Results" : "Collapse Query Results"} className="mr-1">
                      {isQueryPanelCollapsed ? <Maximize className="h-4 w-4" /> : <Minimize className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={clearQueryResults} aria-label="Close query panel">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>
                {!isQueryPanelCollapsed && (
                  <>
                    <CardContent className="flex-grow overflow-hidden p-0 relative flex flex-col">
                      {queryExecutions.length > 0 && activeQueryExecutionId ? (
                        <Tabs value={activeQueryExecutionId} onValueChange={setActiveQueryExecutionId} className="flex flex-col flex-grow h-full w-full">
                          <TabsList className="mx-2 mt-2 shrink-0 overflow-x-auto whitespace-nowrap justify-start">
                            {queryExecutions.map((exec, index) => (
                              <TabsTrigger key={exec.id} value={exec.id} className="text-xs px-2 py-1.5 h-auto flex items-center">
                                {getStatusIcon(exec.status)}
                                Tab {index + 1}                        
                              </TabsTrigger>
                            ))}
                          </TabsList>
                          {queryExecutions.map((exec) => (
                            <TabsContent key={exec.id} value={exec.id} className="flex-grow overflow-y-auto p-1 m-0 h-full">
                              {exec.status === 'pending' && (
                                <div className="p-6 text-center text-muted-foreground flex items-center justify-center h-full">
                                  <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading results...
                                </div>
                              )}
                              {exec.status === 'success' && (
                                <TableView data={exec.records} title={`Results for Query ${queryExecutions.findIndex(e => e.id === exec.id) + 1}`} />
                              )}
                              {exec.status === 'error' && (
                                <div className="p-6 text-red-500">
                                  <p className="font-semibold">Error executing query:</p>
                                  <p className="text-sm mt-1 whitespace-pre-wrap">{exec.errorDetails || 'Unknown error'}</p>
                                  <p className="text-xs mt-2 text-muted-foreground">Query: <pre className="inline whitespace-pre-wrap">{exec.query}</pre></p>
                                </div>
                              )}
                            </TabsContent>
                          ))}
                        </Tabs>
                      ) : (
                        <div className="p-6 text-center text-muted-foreground flex items-center justify-center h-full">
                          {isQueryPanelVisible && queryExecutions.length === 0 ? "No queries executed yet or panel was cleared." : "Processing..."}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="p-3 border-t text-xs text-muted-foreground shrink-0">
                      {activeQueryExecutionId && queryExecutions.find(e => e.id === activeQueryExecutionId) ? 
                        `${queryExecutions.find(e => e.id === activeQueryExecutionId)?.records?.length || 0} record(s) in active tab. Total queries: ${queryExecutions.length}` 
                        : "No active query or data."}
                      {activeQueryExecutionId && queryExecutions.find(e => e.id === activeQueryExecutionId)?.status === 'success' && "Query executed successfully."}
                      {activeQueryExecutionId && queryExecutions.find(e => e.id === activeQueryExecutionId)?.status === 'error' && "Query execution failed."}
                      {activeQueryExecutionId && queryExecutions.find(e => e.id === activeQueryExecutionId)?.status === 'pending' && "Query pending..."}
                    </CardFooter>
                  </>
                )}
              </Card>
            )}

            {isSandboxPanelVisible && (
              <SandboxPreviewPanel 
                isPanelVisible={isSandboxPanelVisible}
                isPanelCollapsed={isSandboxPanelCollapsed}
                togglePanelCollapse={toggleSandboxPanelCollapse}
                sandboxResult={sandboxResult}
                isLoading={isSandboxLoading}
                activeFragment={activeGraphFragment}
                clearSandboxPreview={handleClearSandboxPreview}
                heightClass={sandboxWrapperHeight}
              />
            )}
          </div>
        )}
        </div>
    </div>
  );
}
