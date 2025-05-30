import React from 'react';
import { Message } from "@/types";
import { QueryDisplay } from "./QueryDisplay";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageItemProps {
  msg: Message;
  onUrlClick?: (url: string) => void;
}

export function ChatMessageItem({ msg, onUrlClick }: ChatMessageItemProps) {
  const isUser = msg.sender === "user";

  const rowClasses = (isUser ? "flex justify-end" : "flex justify-start") + " mb-3";
  
  const bubbleBaseClasses = "font-sans text-base leading-relaxed px-5 py-3 max-w-[75%] break-words shadow-md prose prose-sm prose-invert";

  const userBubbleClasses = `${bubbleBaseClasses} bg-primary text-primary-foreground rounded-2xl rounded-br-md font-medium`;
  const agentBubbleClasses = `${bubbleBaseClasses} bg-muted text-muted-foreground rounded-2xl rounded-bl-md font-normal`;
  
  const analysisAgentBubbleClasses = `${bubbleBaseClasses.replace('prose-invert', '')} bg-slate-100 text-slate-900 rounded-2xl rounded-bl-md font-normal`;

  const errorBubbleClasses = `${bubbleBaseClasses} bg-destructive text-destructive-foreground rounded-2xl font-medium`;
  const thinkingTextClasses = "italic text-muted-foreground/80 text-sm";

  const markdownComponents = {
    p: ({node, ...props}: {node?: any, [key: string]: any}) => <p className="mb-2 last:mb-0" {...props} />,
    ul: ({node, ...props}: {node?: any, [key: string]: any}) => <ul className="list-disc list-inside my-2 ml-2" {...props} />,
    ol: ({node, ...props}: {node?: any, [key: string]: any}) => <ol className="list-decimal list-inside my-2 ml-2" {...props} />,
    li: ({node, ...props}: {node?: any, [key: string]: any}) => <li className="mb-1" {...props} />,
    blockquote: ({node, ...props}: {node?: any, [key: string]: any}) => <blockquote className="pl-4 border-l-4 border-gray-300 italic my-2 text-gray-600" {...props} />,
    code: ({node, inline, className, children, ...props}: {node?:any, inline?:boolean, className?:string, children?:React.ReactNode, [key: string]: any}) => {
      const match = /language-(\w+)/.exec(className || '')
      const isLightParent = msg.sender === "AnalysisAgent"; 
      const codeBlockBg = isLightParent ? "bg-slate-200/80" : "bg-zinc-800/70";
      const codeBlockText = isLightParent ? "text-slate-800" : "text-zinc-300";
      const inlineCodeBg = isLightParent ? "bg-slate-200 text-slate-700" : "bg-zinc-600/50 text-zinc-300";

      return !inline && match ? (
        <pre className={`${codeBlockBg} p-3 rounded-md my-2 overflow-x-auto text-xs font-mono`}><code className={codeBlockText}>{children}</code></pre>
      ) : (
        <code className={`${className} ${inlineCodeBg} px-1 py-0.5 rounded-sm text-xs font-mono`} {...props}>
          {children}
        </code>
      )
    }
  };

  if (msg.sender === "cypher_queries") {
    const queries = typeof msg.content === 'string' ? [msg.content] : (Array.isArray(msg.content) ? msg.content : []);
    return (
      <div className={`${rowClasses} w-full`}>
        <div className={`${agentBubbleClasses} p-0 overflow-hidden w-full`}>
          <QueryDisplay queries={queries} />
        </div>
      </div>
    );
  }

  if (msg.sender === "system_error") {
    return (
      <div className={rowClasses}>
        <div className={errorBubbleClasses}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {msg.content as string}
          </ReactMarkdown>
        </div>
      </div>
    );
  }
  
  if (msg.sender === "AnalysisAgent") {
    let content = msg.content as string;
    const urlRegex = /<url>([\s\S]*?)<\/url>/g;
    const titleRegex = /<title>([\s\S]*?)<\/title>/i;
    const parts: (string | { url: string, title: string })[] = [];
    let lastIndex = 0;
    let match;
    while ((match = urlRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      const urlBlock = match[1];
      const titleMatch = urlBlock.match(titleRegex);
      const title = titleMatch ? titleMatch[1] : match[1];
      const url = urlBlock.replace(titleRegex, '').replace(/<title>[\s\S]*?<\/title>/i, '').trim();
      parts.push({ url, title });
      lastIndex = urlRegex.lastIndex;
    }
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }
    return (
      <div className={rowClasses}>
        <div className={analysisAgentBubbleClasses}>
          {parts.map((part, i) => {
            if (typeof part === 'string') {
              return <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={markdownComponents}>{part}</ReactMarkdown>;
            } else {
              return (
                <a
                  key={i}
                  href={part.url}
                  className="text-blue-600 underline break-all hover:text-blue-800 cursor-pointer"
                  onClick={e => {
                    e.preventDefault();
                    if (onUrlClick) onUrlClick(part.url);
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {part.title}
                </a>
              );
            }
          })}
        </div>
      </div>
    );
  }

  if (msg.sender === "OrchestratorAgent") {
    let content = msg.content as string;
    // Parse <analysis>...</analysis> tags
    const analysisTagRegex = /<analysis>([\s\S]*?)<\/analysis>/i;
    const analysisMatch = content.match(analysisTagRegex);
    if (analysisMatch && analysisMatch[1]) {
      // Remove TERMINATE from the end if present
      let analysisText = analysisMatch[1].replace(/\s*TERMINATE\s*$/i, '').trim();
      return (
        <div className={rowClasses}>
          <div className={analysisAgentBubbleClasses}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {analysisText}
            </ReactMarkdown>
          </div>
        </div>
      );
    }
    // Fallback: render as normal agent message
    return (
      <div className={rowClasses}>
        <div className={agentBubbleClasses}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className={rowClasses}>
        <div className={userBubbleClasses}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {msg.content as string}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className={rowClasses}>
      <div className={agentBubbleClasses}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {msg.content as string}
        </ReactMarkdown>
      </div>
    </div>
  );
} 