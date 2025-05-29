'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useWebSocketChat } from '@/hooks/useWebSocket';
import type { QueryExecution, Message as MessageType, UnifiedProgressItem as UnifiedProgressItemType, ToolCallStreamItem } from '@/types';
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
import { PlatformToolResultCard } from '@/components/PlatformToolResultCard';

// Define a discriminated union for display items
type DisplayItem = 
  | { type: 'message'; data: MessageType; timestamp: number; id: string; }
  | { type: 'unified_progress'; data: UnifiedProgressItemType; timestamp: number; id: string; };

const AD_PREVIEW_SELECTOR = "div.x1thq5gd.x1t2f2mz.x1xvdf8d.x1s688f.x1ix68h3.x1pi1tsx.x1l90r2v.x1tu34mt.x1a2a7pz.x1qjc9v5.x1q0g3np";

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
    isAgentProcessing,
    platformToolResult,
    clearPlatformToolResult,
    isToolPanelVisible,
    setIsToolPanelVisible,
    setIsQueryPanelVisible,
    setPlatformToolResult,
    setIsSandboxPanelVisible,
  } = useWebSocketChat();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const unifiedProgressCardRef = useRef<null | HTMLDivElement>(null);
  const [selectedToolCall, setSelectedToolCall] = useState<{ id: string; functionName: string } | null>(null);
  const [isUrlPreviewVisible, setIsUrlPreviewVisible] = useState(false);
  const [urlToPreview, setUrlToPreview] = useState<string | null>(null);
  const [scrapedImage, setScrapedImage] = useState<string | null>(null);

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

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const lastItem = displayItems.length > 0 ? displayItems[displayItems.length - 1] : null;
    const lastActivityTimestamp = lastItem?.timestamp;
    const unifiedProgressTimestamp = unifiedProgress?.lastActivityTimestamp;

    // If agent is processing, card exists and is not collapsed, ensure it's in view.
    if (isAgentProcessing && unifiedProgress && !unifiedProgress.isCollapsed && unifiedProgressCardRef.current) {
      // If the URS card was the last thing to update, scroll to it.
      if (unifiedProgressTimestamp && lastActivityTimestamp && unifiedProgressTimestamp >= lastActivityTimestamp) {
        unifiedProgressCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else {
        // Agent is processing, URS is open, but a new message might have arrived.
        // We want to keep URS in view, so if it's not already fully visible, scroll to it.
        // This is a bit tricky to do perfectly without knowing if it's *already* fully in view.
        // For now, if agent is busy, let's prioritize URS card by scrolling to it if it received the latest update.
        // If a new regular message is the latest, the existing scrollToBottom below will handle it if agent ISN'T processing.
        // If agent IS processing and a new message is latest, we *don't* want to scroll to bottom of chat, potentially hiding URS.
        // So, if unifiedProgressTimestamp is older, we simply do nothing here, preventing scroll to bottom.
        // This effectively keeps the current view if URS is visible and agent is busy.
        if (!(unifiedProgressTimestamp && lastActivityTimestamp && unifiedProgressTimestamp >= lastActivityTimestamp)) {
            // If URS is not the latest, but agent is busy and URS is open, do nothing to prevent scroll to bottom.
            // User might be looking at URS.
            console.log("[Scroll] Agent processing, URS open, new message likely. Preventing scroll to bottom.");
        } else {
             unifiedProgressCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }
    } else if (messagesEndRef.current) { // Agent not processing, or URS collapsed/non-existent
      scrollToBottom();
    }
  }, [displayItems, unifiedProgress, scrollToBottom, isAgentProcessing]);

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

  // Determine when to show the tool card
  const showToolCard = platformToolResult && isToolPanelVisible && (
    !isQueryPanelVisible ||
    (isQueryPanelVisible && (
      queryExecutions.length === 0 ||
      queryExecutions.every(exec => exec.status === 'pending')
    ))
  );

  // Debug log for tool card visibility
  console.log({
    platformToolResult,
    isToolPanelVisible,
    isQueryPanelVisible,
    queryExecutions,
    showToolCard
  });

  // Handler for tool call click
  const handleToolCallClick = (toolCall: ToolCallStreamItem) => {
    setSelectedToolCall({ id: toolCall.id, functionName: toolCall.functionName });
    if (toolCall.functionName === 'get_platform_schema') {
      setPlatformToolResult({ type: 'schema', content: toolCall.response || '' });
      setIsToolPanelVisible(true);
    } else if (toolCall.functionName === 'get_platform_prompt_rules') {
      setPlatformToolResult({ type: 'rules', content: toolCall.response || '' });
      setIsToolPanelVisible(true);
    } else if (toolCall.functionName === 'execute_cypher_query') {
      setIsQueryPanelVisible(true);
    } else if (toolCall.functionName === 'sandbox_preview') {
      setIsSandboxPanelVisible(true);
    }
  };

  // Handler to open URL preview overlay
  const handleUrlPreview = async (url: string) => {
    setUrlToPreview(url);
    setIsUrlPreviewVisible(true);
    setScrapedImage(null);
    try {
      const res = await fetch('http://localhost:8082/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.image_base64) {
        setScrapedImage(data.image_base64);
      }
    } catch (e: any) {
      setScrapedImage(null);
    }
  };
  const handleCloseUrlPreview = () => {
    setIsUrlPreviewVisible(false);
    setUrlToPreview(null);
    setScrapedImage(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className={`flex w-full mx-auto gap-4 h-[90vh] ${mainContentRowJustifyClass}`}>
          <Card className={`flex flex-col ${chatCardWidthClass} ${chatCardHeightClass}`}>
            <CardHeader>
              <CardTitle>Chatbot</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto p-6 space-y-4">
              {displayItems.map((item) => {
                if (item.type === 'message') {
                  return <ChatMessageItem key={item.id} msg={item.data as MessageType} onUrlClick={handleUrlPreview} />;
                }
                if (item.type === 'unified_progress') {
                  return (
                    <div key={item.id} ref={unifiedProgressCardRef}>
                      <UnifiedProgressCard 
                        item={item.data as UnifiedProgressItemType} 
                        onToggleCollapse={toggleUnifiedProgressCollapse} 
                        isAgentProcessing={isAgentProcessing}
                        onToolCallClick={handleToolCallClick}
                        selectedToolCallId={selectedToolCall?.id}
                      />
                    </div>
                  );
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

          {(isQueryPanelVisible || isSandboxPanelVisible || isToolPanelVisible || isUrlPreviewVisible) && (
            <div className={`w-1/2 flex flex-col ${rightPanelGap} h-full relative`}>
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
                      <Button variant="ghost" size="icon" onClick={() => setIsQueryPanelVisible(false)} aria-label="Close query panel">
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
                                  {exec.title || `Query ${index + 1}`}
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
                  clearSandboxPreview={() => setIsSandboxPanelVisible(false)}
                  heightClass={sandboxWrapperHeight}
                />
              )}

              {showToolCard && isQueryPanelVisible && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 pointer-events-auto">
                  <Card className="flex flex-col w-5/6 max-w-2xl h-fit shadow-2xl border-2 border-primary">
                    <CardHeader>
                      <CardTitle>{platformToolResult.type === 'schema' ? 'Platform Schema' : 'Platform Prompt Rules'}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-auto">
                      <PlatformToolResultCard type={platformToolResult.type} content={platformToolResult.content} />
                    </CardContent>
                    <CardFooter className="p-3 border-t text-xs text-muted-foreground shrink-0">
                      <Button variant="ghost" size="icon" onClick={clearPlatformToolResult} aria-label="Close platform tool card">
                        <X className="h-5 w-5" />
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )}
              {showToolCard && !isQueryPanelVisible && (
                <Card className="flex flex-col w-full h-full transition-all duration-300 ease-in-out">
                  <CardHeader>
                    <CardTitle>{platformToolResult.type === 'schema' ? 'Platform Schema' : 'Platform Prompt Rules'}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow overflow-auto">
                    <PlatformToolResultCard type={platformToolResult.type} content={platformToolResult.content} />
                  </CardContent>
                  <CardFooter className="p-3 border-t text-xs text-muted-foreground shrink-0">
                    <Button variant="ghost" size="icon" onClick={clearPlatformToolResult} aria-label="Close platform tool card">
                      <X className="h-5 w-5" />
                    </Button>
                  </CardFooter>
                </Card>
              )}

              {isUrlPreviewVisible && urlToPreview && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 pointer-events-auto">
                  <div className="flex flex-col w-5/6 max-w-2xl h-[80vh] shadow-2xl border-2 border-primary bg-background relative">
                    <div className="flex items-center justify-between p-4 border-b border-border">
                      <span className="font-semibold text-lg truncate">Ad Preview Screenshot</span>
                      <button onClick={handleCloseUrlPreview} className="text-gray-400 hover:text-white p-2 rounded transition-colors" title="Close Preview">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="flex-grow overflow-y-auto p-4 flex items-center justify-center" style={{ background: '#fafafa' }}>
                      {scrapedImage ? (
                        <img src={`data:image/png;base64,${scrapedImage}`} alt="Ad Preview" style={{ maxWidth: '100%', maxHeight: '60vh', display: 'block', margin: '0 auto' }} />
                      ) : (
                        <div className="text-center text-gray-500">Loading screenshot...</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
