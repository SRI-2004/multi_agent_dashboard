import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Message, 
  MessageSender,
  QueryExecution,
  GraphFragment,
  SandboxExecutionSuccess,
  SandboxExecutionError,
  SandboxExecutionResult,
  BackendToolCall,
  BackendToolResponse,
  ActiveToolCall,
  UnifiedProgressItem,
  ThinkingStepStreamItem,
  ToolCallStreamItem
} from '@/types';
import { executeCypherQuery, QueryProcessorSetters } from '../lib/queryProcessor';
import { handleGraphFragmentForSandbox, GraphProcessorSetters } from '../lib/graphProcessor';
import { v4 as uuidv4 } from 'uuid';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8082";

const INITIAL_WELCOME_MESSAGE_CONTENT = `## Ad Optimiser Agent\n\nHi, I'm your Ad Optimiser. I'm here to help you analyze and optimize your marketing campaigns across platforms. How can I help you?`;

const initialMessage: Message = {
  sender: 'agent',
  content: INITIAL_WELCOME_MESSAGE_CONTENT,
  timestamp: Date.now(), // Use current time, or a fixed early time if preferred
};

// Helper function to extract text content from a specific tag
const extractTextFromTag = (rawContent: string, tagName: string): string | null => {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = rawContent.match(regex);
  return match && match[1] ? match[1].trim() : null;
};

// Helper to remove all instances of a tag and its content
const removeAllTags = (rawContent: string, tagName: string): string => {
  const regex = new RegExp(`<${tagName}>[\\s\\S]*?<\\/${tagName}>`, 'gi');
  return rawContent.replace(regex, '').trim();
};

interface UseWebSocketChatReturn {
  messages: Message[];
  sendMessage: (message: string) => void;
  queryExecutions: QueryExecution[];
  activeQueryExecutionId: string | null;
  setActiveQueryExecutionId: (id: string | null) => void;
  isQueryPanelVisible: boolean;
  setIsQueryPanelVisible: (visible: boolean) => void;
  isQueryPanelCollapsed: boolean;
  toggleQueryPanelCollapse: () => void;
  clearQueryResults: () => void;
  sandboxResult: SandboxExecutionResult | null;
  isSandboxLoading: boolean;
  activeGraphFragment: GraphFragment | null;
  isSandboxPanelVisible: boolean;
  setIsSandboxPanelVisible: (visible: boolean) => void;
  isSandboxPanelCollapsed: boolean;
  toggleSandboxPanelCollapse: () => void;
  clearSandboxPreview: () => void;
  unifiedProgress: UnifiedProgressItem | null;
  toggleUnifiedProgressCollapse: () => void;
  isAgentProcessing: boolean;
}

export function useWebSocketChat(): UseWebSocketChatReturn {
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const ws = useRef<WebSocket | null>(null);
  const [queryExecutions, setQueryExecutions] = useState<QueryExecution[]>([]);
  const [activeQueryExecutionId, setActiveQueryExecutionId] = useState<string | null>(null);
  const [isQueryPanelVisible, setIsQueryPanelVisible] = useState<boolean>(false);
  const [isQueryPanelCollapsed, setIsQueryPanelCollapsed] = useState<boolean>(false);

  const [sandboxResult, setSandboxResult] = useState<SandboxExecutionResult | null>(null);
  const [isSandboxLoading, setIsSandboxLoading] = useState<boolean>(false);
  const [activeGraphFragment, setActiveGraphFragment] = useState<GraphFragment | null>(null);
  const [isSandboxPanelVisible, setIsSandboxPanelVisible] = useState<boolean>(false);
  const [isSandboxPanelCollapsed, setIsSandboxPanelCollapsed] = useState<boolean>(false);

  const [unifiedProgress, setUnifiedProgress] = useState<UnifiedProgressItem | null>(null);
  const [isAgentProcessing, setIsAgentProcessing] = useState<boolean>(false);

  const toggleUnifiedProgressCollapse = useCallback(() => {
    setUnifiedProgress(prev => prev ? { ...prev, isCollapsed: !prev.isCollapsed } : null);
  }, []);

  const parseAndAddMessage = useCallback((raw: string) => {
    console.log("[DEBUG] Raw message from server:", raw);
    if (!raw || !raw.trim()) {
      console.log("[DEBUG] Empty message received, skipping.");
      return;
    }
    let parsedMessage: any;
    try {
      if (raw.startsWith("{") && raw.endsWith("}")) {
        parsedMessage = JSON.parse(raw);
      } else {
        console.warn("[WARN] WS message is not a JSON object. Raw:", raw);
        return; 
      }
    } catch (e) { 
      console.error("[ERROR] Outer WS JSON parse error:", e, "Raw data:", raw); 
      setMessages(prev => [...prev, { sender: 'system_error', content: `System error: Could not parse message from server.`, timestamp: Date.now() }]);
      return; 
    }

    const currentTimestamp = Date.now();

    // Ensure parsedMessage is an object before accessing type property
    const messageType = (parsedMessage && typeof parsedMessage === 'object' && (parsedMessage as { type?: string }).type) || null;

    // Handle chat_interaction_done_sentinel explicitly
    if (messageType === "chat_interaction_done_sentinel") {
      console.log("[DEBUG] Received chat_interaction_done_sentinel. Agent processing finished.");
      setIsAgentProcessing(false);
      return; // No further processing for this sentinel message
    }

    // NEW: Check for and ignore UserProxy messages embedded in "text" type
    if (messageType === "text" && typeof parsedMessage.content === 'string') {
        try {
            const innerContent = JSON.parse(parsedMessage.content);
            if (innerContent && innerContent.sender === "UserProxy") {
                console.log("[DEBUG] Ignoring UserProxy message forwarded by server:", raw);
                return; // Ignore this message
            }
        } catch (e) {
            // Not a valid JSON or doesn't have the expected structure, proceed with normal parsing
            // console.log("[DEBUG] Message content is string but not a UserProxy JSON, or failed to parse. Will proceed. Content:", parsedMessage.content);
        }
    }

    // Handle new tool_call and tool_response types
    if (messageType === "tool_call" || messageType === "tool_response") {
      try {
        const eventContentPayload = parsedMessage.content; 

        if (!eventContentPayload || typeof eventContentPayload !== 'object') {
          console.error(`[ERROR] Invalid eventContentPayload for ${parsedMessage.type}. Expected object, got:`, eventContentPayload);
          setMessages(prev => [...prev, { sender: 'system_error', content: `System error: Malformed ${parsedMessage.type} structure.`, timestamp: currentTimestamp }]);
          return;
        }

        if (parsedMessage.type === "tool_call") {
          console.log("[DEBUG] Detected tool_call message. Payload:", eventContentPayload);
          const thinkingContentRaw = eventContentPayload.content as string | undefined; 

          setUnifiedProgress(prevProgress => {
            let currentProgress = prevProgress;
            if (!currentProgress) {
                currentProgress = {
                    id: uuidv4(),
                    progressStream: [],
                    isCollapsed: false,
                    lastActivityTimestamp: currentTimestamp,
                };
            }
            
            const newStreamItems: Array<ThinkingStepStreamItem | ToolCallStreamItem> = [];

            if (thinkingContentRaw && typeof thinkingContentRaw === 'string') {
              const thinkingText = extractTextFromTag(thinkingContentRaw, 'thinking');
              if (thinkingText) {
                newStreamItems.push({
                    type: 'thinking_step',
                    id: `thinking-${currentTimestamp}-${Math.random().toString(36).substring(2,9)}`,
                    text: thinkingText,
                    timestamp: currentTimestamp
                });
              }
            }

            const backendToolCalls = eventContentPayload.tool_calls as BackendToolCall[];
            if (backendToolCalls && Array.isArray(backendToolCalls)) {
              backendToolCalls.forEach(btc => {
                const displayText = (() => {
                    try {
                      const args = JSON.parse(btc.function.arguments);
                      if (args.platform_name) return `${btc.function.name} for ${args.platform_name}`;
                      if (args.query) return `${btc.function.name}: ${args.query.substring(0,30)}...`;
                      if (args.description) return `${btc.function.name}: ${args.description.substring(0,30)}...`;
                    } catch (e) { /* ignore */ }
                    return btc.function.name;
                  })();

                newStreamItems.push({
                    type: 'tool_call_log_entry',
                    id: btc.id,
                    functionName: btc.function.name,
                    arguments: btc.function.arguments,
                    status: 'pending',
                    timestamp: currentTimestamp,
                    displayText: displayText
                });
              });
            }
            // Ensure agent is marked as processing when tool calls are made
            setIsAgentProcessing(true); 
            return {
                ...currentProgress,
                progressStream: [...currentProgress.progressStream, ...newStreamItems],
                lastActivityTimestamp: currentTimestamp,
            };
          });

        } else if (parsedMessage.type === "tool_response") {
          console.log("[DEBUG] Detected tool_response message. Payload:", eventContentPayload);
          const backendToolResponses = eventContentPayload.tool_responses as BackendToolResponse[];
          if (backendToolResponses && Array.isArray(backendToolResponses)) {
            setUnifiedProgress(prevProgress => {
              if (!prevProgress) {
                console.warn("[WARN] Received tool_response but no active unifiedProgress. Responses:", backendToolResponses);
                return null; 
              }
              
              const updatedStream = prevProgress.progressStream.map(item => {
                if (item.type === 'tool_call_log_entry') {
                  const responseItem = backendToolResponses.find(r => r.tool_call_id === item.id);
                  if (responseItem) {
                    const isError = false; // Placeholder for actual error detection
                    return { 
                      ...item, 
                      status: isError ? 'error' : 'success' as 'success' | 'error', 
                      response: !isError ? responseItem.content : undefined,
                      errorMessage: isError ? responseItem.content : undefined,
                    }; 
                  }
                }
                return item;
              });
              return { 
                  ...prevProgress, 
                  progressStream: updatedStream, 
                  lastActivityTimestamp: currentTimestamp
              };
            });
          }
        }
      } catch (e: any) {
        console.error(`[ERROR] Error processing ${parsedMessage.type}:`, e, "Original parsedMessage:", parsedMessage);
        setMessages(prev => [...prev, { sender: 'system_error', content: `System error processing ${parsedMessage.type}: ${e.message}`, timestamp: currentTimestamp }]);
      }
      return; 
    }

    // --- Text message parsing logic ---
    let actualContentString: string | undefined;
    let messageSender: MessageSender = 'agent'; 

    if (parsedMessage && typeof parsedMessage.content === 'object' && parsedMessage.content !== null) {
        actualContentString = parsedMessage.content.content;
        if (parsedMessage.content.sender) {
            messageSender = parsedMessage.content.sender; 
        } else if (parsedMessage.sender) {
            messageSender = parsedMessage.sender; 
        }
    } else if (parsedMessage && typeof parsedMessage.content === 'string') {
        try {
            const innerParsedContent = JSON.parse(parsedMessage.content);
            actualContentString = innerParsedContent?.content;
            if (innerParsedContent?.sender) {
                messageSender = innerParsedContent.sender; 
            } else if (parsedMessage.sender) {
                messageSender = parsedMessage.sender; 
            }
        } catch (e) {
            actualContentString = parsedMessage.content;
            if (parsedMessage.sender) { 
                messageSender = parsedMessage.sender;
            }
        }
    } else if (parsedMessage && typeof parsedMessage.message === 'string') {
        actualContentString = parsedMessage.message;
        if (parsedMessage.sender) { 
            messageSender = parsedMessage.sender;
        }
    } else {
        console.warn("[WARN] Unrecognized content structure. Parsed Message:", parsedMessage);
        if (parsedMessage.sender) {
             messageSender = parsedMessage.sender;
        }
    }
    
    if (typeof actualContentString !== 'string') {
        console.warn("[WARN] actualContentString is not a string after initial parsing for 'text' type. Value:", actualContentString);
        if (parsedMessage.type === "text") { 
        }
    }
    
    // **NEW CHECK TO PREVENT ECHOING USER'S RAW MESSAGE OBJECTS FROM NON-USER SENDERS**
    if (messageSender !== 'user' && 
        actualContentString && 
        typeof actualContentString === 'string' && 
        actualContentString.trim().startsWith('{') && 
        actualContentString.trim().endsWith('}')) {
        
        try {
            const parsedEchoCandidate = JSON.parse(actualContentString);
            if (parsedEchoCandidate && 
                parsedEchoCandidate.sender === 'user' && 
                parsedEchoCandidate.type === 'text' && 
                typeof parsedEchoCandidate.content === 'string') {
                
                console.warn(`[WARN] Ignoring message from '${messageSender}' as its content appears to be a stringified echo of a user message. Content:`, actualContentString);
                return; 
            }
        } catch (e) {
            console.log("[DEBUG] Content from sender '" + messageSender + "' is JSON-like but not a user echo, or failed to parse as such. Will proceed. Content:", actualContentString, "Parse error (if any):", e);
        }
    }

    const initialActualContentStringForWarning = actualContentString || ""; 
    console.log("[DEBUG] Processing actualContentString:", actualContentString, "From sender:", messageSender, " (Post-echo check)");

    let contentAdded = false; 
    const DEFAULT_FILE_PATH = "src/components/GeneratedPreview.tsx";
    const DEFAULT_TEMPLATE_ID = "chatbot-ui-nextjs-preview";

    const querySetters: QueryProcessorSetters = {
        setMessages,
        setQueryExecutions,
        setIsQueryPanelVisible,
        setIsQueryPanelCollapsed,
    };

    const graphSetters: GraphProcessorSetters = {
        setMessages,
        setIsSandboxLoading,
        setSandboxResult,
        setActiveGraphFragment,
        setIsSandboxPanelVisible,
        setIsSandboxPanelCollapsed,
    };

    if (parsedMessage.type === "text" && typeof actualContentString === 'string') {
        if (messageSender === "OrchestratorAgent") {
            // If the message from OrchestratorAgent does NOT contain "<thinking>", ignore it.
            if (actualContentString && !actualContentString.includes("<thinking>")) {
                console.log("[DEBUG] OrchestratorAgent text message does not contain <thinking>. Ignoring. Content:", actualContentString);
                return; // Ignore the message
            }

            // If we reach here, the message contains "<thinking>". Proceed with existing logic.
            console.log("[DEBUG] OrchestratorAgent text message (processing for <thinking>):", actualContentString);
            const thinkingText = extractTextFromTag(actualContentString, 'thinking');
            if (thinkingText) {
                setUnifiedProgress(prevProgress => {
                    let currentProgress = prevProgress;
                    if (!currentProgress) {
                        currentProgress = {
                            id: uuidv4(),
                            progressStream: [],
                            isCollapsed: false,
                            lastActivityTimestamp: currentTimestamp,
                        };
                    }
                    const newThinkingStep: ThinkingStepStreamItem = {
                        type: 'thinking_step',
                        id: `thinking-${currentTimestamp}-${Math.random().toString(36).substring(2,9)}`,
                        text: thinkingText,
                        timestamp: currentTimestamp
                    };
                    return {
                        ...currentProgress,
                        progressStream: [...currentProgress.progressStream, newThinkingStep],
                        lastActivityTimestamp: currentTimestamp,
                    };
                });
                actualContentString = removeAllTags(actualContentString, 'thinking');
                contentAdded = true; 
                console.log("[DEBUG] OrchestratorAgent (text mode): actualContentString after <thinking> processing for unifiedProgress:", actualContentString);
            }
        }
        else if (messageSender === "QueryGeneratorAgent") {
            console.log("[DEBUG] Detected QueryGeneratorAgent message. Content:", actualContentString);
            const queryTagRegex = new RegExp("<query>([\\s\\S]*?)<\\/query>", 'i');
            const queryMatch = actualContentString.match(queryTagRegex);
            if (queryMatch && queryMatch[1]) {
                const queryJsonString = queryMatch[1].trim();
                try {
                    const queryData = JSON.parse(queryJsonString);
                    if (queryData && queryData.queries && Array.isArray(queryData.queries) && queryData.queries.length > 0) {
                        let firstExecutionId: string | null = null;
                        queryData.queries.forEach((queryText: string, index: number) => {
                            if (typeof queryText === 'string' && queryText.trim()) {
                                const executionId = `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`;
                                if (index === 0) firstExecutionId = executionId;
                                setQueryExecutions(prev => [...prev, { id: executionId, query: queryText, records: null, status: 'pending', errorDetails: undefined }]);
                                executeCypherQuery(executionId, queryText, querySetters);
                            } else {
                                console.warn("[WARN] Invalid query text in QueryGeneratorAgent at index", index, ":", queryText);
                            }
                        });
                        if (firstExecutionId) {
                            setActiveQueryExecutionId(firstExecutionId);
                            contentAdded = true;
                        }
                        actualContentString = actualContentString.replace(queryTagRegex, '').trim();
                    } else {
                        console.warn("[WARN] QueryGeneratorAgent: <query> tag invalid/empty 'queries' array.", queryData);
                    }
                } catch (e: any) {
                    console.error("[ERROR] QueryGeneratorAgent: Failed to parse JSON from <query>:", e, queryJsonString);
                    setMessages(prev => [...prev, { sender: 'system_error', content: `Error parsing queries from QueryGeneratorAgent: ${e.message}`, timestamp: Date.now() }]);
                    contentAdded = true; 
                    actualContentString = ""; 
                }
            } else {
                 console.log("[DEBUG] QueryGeneratorAgent: No <query> tag or empty. Content:", actualContentString);
            }
        }
        else if (messageSender === "AnalysisAgent") {
            console.log("[DEBUG] Detected AnalysisAgent message. Content:", actualContentString);
            const insightTagRegex = new RegExp("<insight>([\\s\\S]*?)<\\/insight>", 'i');
            const insightMatch = actualContentString.match(insightTagRegex);
            if (insightMatch && insightMatch[1]) {
                const insightText = insightMatch[1].trim();
                if (insightText) {
                    setMessages(prev => [...prev, { sender: messageSender, content: insightText, timestamp: Date.now() }]);
                    contentAdded = true;
                    actualContentString = actualContentString.replace(insightTagRegex, '').trim();
                } else {
                    console.warn("[WARN] AnalysisAgent: <insight> tag was empty.");
                }
            } else {
                console.log("[DEBUG] AnalysisAgent: No <insight> tag or empty. Content:", actualContentString);
            }
        }
        else if (messageSender === "GraphGeneratorAgent") {
            console.log("[DEBUG] Detected GraphGeneratorAgent message. Content:", actualContentString);
            const codeTagRegex = new RegExp("<code>([\\s\\S]*?)<\\/code>", 'i');
            const codeMatch = actualContentString.match(codeTagRegex);
            if (codeMatch && codeMatch[1]) {
                const extractedCode = codeMatch[1].trim();
                if (extractedCode) {
                    const graphFragmentForSandbox: GraphFragment = { template: DEFAULT_TEMPLATE_ID, code: extractedCode, filePath: DEFAULT_FILE_PATH };
                    handleGraphFragmentForSandbox(graphFragmentForSandbox, graphSetters);
                    return;
                } else {
                    console.warn("[WARN] GraphGeneratorAgent: <code> tag was empty.");
                }
            } else {
                console.log("[DEBUG] GraphGeneratorAgent: No <code> tag or empty. Content:", actualContentString);
            }
        }

        // Fallback for plain text
        if (!contentAdded && actualContentString && actualContentString.trim()) {
            console.log(`[DEBUG] Adding message as plain text from ${messageSender}:`, actualContentString);
            setMessages(prev => [...prev, { sender: messageSender, content: actualContentString as string, timestamp: currentTimestamp }]);
            contentAdded = true;
        }
    }  

    if (parsedMessage.type === "text" && !contentAdded && 
        (messageSender === "QueryGeneratorAgent" || 
         messageSender === "AnalysisAgent" || 
         messageSender === "GraphGeneratorAgent" ||
         messageSender === "OrchestratorAgent"
        )
    ) {
        if (actualContentString && actualContentString.trim()) {
             console.warn(`[WARN] Message from specifically handled agent (type text): ${messageSender} resulted in no UI update despite remaining content. Initial content was: "${initialActualContentStringForWarning}". Remaining: "${actualContentString}"`);
        } else {
             console.warn(`[WARN] Message from specifically handled agent (type text): ${messageSender} resulted in no UI update (e.g., expected tags not found or empty, or content became empty after tag processing). Initial content was: "${initialActualContentStringForWarning}"`);
        }
    }

  }, [
    setMessages, 
    setQueryExecutions, 
    setIsQueryPanelVisible, 
    setIsQueryPanelCollapsed, 
    setActiveQueryExecutionId,
    setIsSandboxLoading,
    setSandboxResult,
    setActiveGraphFragment,
    setIsSandboxPanelVisible,
    setIsSandboxPanelCollapsed,
    setUnifiedProgress,
    setIsAgentProcessing
  ]);

  useEffect(() => {
    ws.current = new WebSocket(WS_URL);
    ws.current.onopen = () => {
      console.log("WebSocket Connected. Sending client_ready signal.");
      // ws.current?.send(JSON.stringify({ type: "client_ready", clientName: "ChatbotUI" }));
    };
    ws.current.onclose = () => {
      console.log("WebSocket Disconnected");
      setMessages(prev => [...prev, { sender: "system_error", content: "Connection lost. Please refresh.", timestamp: Date.now() }]);
    };
    ws.current.onerror = (event) => {
      console.error("WebSocket Error:", event);
      setMessages(prev => [...prev, { sender: "system_error", content: "WebSocket error. Check console.", timestamp: Date.now() }]);
    };
    ws.current.onmessage = (event) => {
      parseAndAddMessage(event.data as string);
    };

    return () => {
      ws.current?.close();
    };
  }, [parseAndAddMessage]);

  const sendMessage = (message: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const userMessage: Message = { sender: "user", content: message, timestamp: Date.now() };
      setMessages(prev => [...prev, userMessage]);
      // When user sends a message, agent starts processing
      setIsAgentProcessing(true); 
      ws.current.send(JSON.stringify({ type: "text", content: message, sender: "user", recipient: "chat_manager", timestamp: userMessage.timestamp }));
    } else {
      setMessages(prev => [...prev, { sender: "system_error", content: "Not connected. Cannot send message.", timestamp: Date.now() }]);
    }
  };
  
  const clearQueryResults = useCallback(() => {
    setQueryExecutions([]);
    setActiveQueryExecutionId(null);
    setIsQueryPanelVisible(false); 
  }, []);

  const clearSandboxPreview = useCallback(() => {
    setSandboxResult(null);
    setActiveGraphFragment(null);
    setIsSandboxPanelVisible(false);
  }, []);

  const toggleQueryPanelCollapse = useCallback(() => {
    setIsQueryPanelCollapsed(prev => !prev);
  }, []);

  const toggleSandboxPanelCollapse = useCallback(() => {
    setIsSandboxPanelCollapsed(prev => !prev);
  }, []);

  return {
    messages,
    sendMessage,
    queryExecutions,
    activeQueryExecutionId,
    setActiveQueryExecutionId,
    isQueryPanelVisible,
    setIsQueryPanelVisible,
    isQueryPanelCollapsed,
    toggleQueryPanelCollapse,
    clearQueryResults,
    sandboxResult,
    isSandboxLoading,
    activeGraphFragment,
    isSandboxPanelVisible,
    setIsSandboxPanelVisible,
    isSandboxPanelCollapsed,
    toggleSandboxPanelCollapse,
    clearSandboxPreview,
    unifiedProgress,
    toggleUnifiedProgressCollapse,
    isAgentProcessing,
  };
} 