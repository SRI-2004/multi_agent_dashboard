import React from 'react';
import { UnifiedProgressItem, ThinkingStepStreamItem, ToolCallStreamItem } from '@/types';
import { Maximize2, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IndividualToolCallDisplay } from './IndividualToolCallDisplay';

interface UnifiedProgressCardProps {
  item: UnifiedProgressItem;
  onToggleCollapse: () => void;
}

const markdownComponents = {
  p: ({node, ...props}: {node?: any, [key: string]: any}) => <p className="mb-1 last:mb-0 text-sm" {...props} />,
  ul: ({node, ...props}: {node?: any, [key: string]: any}) => <ul className="list-disc list-inside my-1 ml-3 text-sm" {...props} />,
  ol: ({node, ...props}: {node?: any, [key: string]: any}) => <ol className="list-decimal list-inside my-1 ml-3 text-sm" {...props} />,
  li: ({node, ...props}: {node?: any, [key: string]: any}) => <li className="mb-0.5 text-sm" {...props} />,
  code: ({node, inline, className, children, ...props}: {node?:any, inline?:boolean, className?:string, children?:React.ReactNode, [key: string]: any}) => {
    const match = /language-(\w+)/.exec(className || '')
    return !inline && match ? (
      <pre className="bg-zinc-800/70 p-2 rounded-md my-1 overflow-x-auto text-xs font-mono">
        <code>{children}</code>
      </pre>
    ) : (
      <code className={`${className} bg-zinc-700/50 text-zinc-300 px-1 py-0.5 rounded-sm text-xs font-mono`} {...props}>
        {children}
      </code>
    )
  },
  strong: ({node, ...props}: {node?: any, [key: string]: any}) => <strong className="font-semibold" {...props} />,
  em: ({node, ...props}: {node?: any, [key: string]: any}) => <em className="italic" {...props} />,
};

export function UnifiedProgressCard({ item, onToggleCollapse }: UnifiedProgressCardProps) {
  return (
    <div className="bg-muted/60 border border-border rounded-xl shadow-sm my-3 w-full max-w-[85%] relative group">
      <div 
        className="flex items-center justify-between px-4 py-2 border-b border-border cursor-pointer hover:bg-muted/80 transition-colors" 
        onClick={onToggleCollapse}
      >
        <h3 className="font-semibold text-sm text-muted-foreground">
          Agent Activity Log {item.isCollapsed ? '(Click to expand)' : ''}
        </h3>
        <button 
          title={item.isCollapsed ? "Expand" : "Collapse"} 
          className="p-1 rounded hover:bg-zinc-700 transition-colors"
        >
          {item.isCollapsed ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        </button>
      </div>

      {!item.isCollapsed && (
        <div className="p-4 space-y-3">
          {item.progressStream && item.progressStream.length > 0 ? (
            item.progressStream.map((streamItem) => {
              if (streamItem.type === 'thinking_step') {
                const thinkingStep = streamItem as ThinkingStepStreamItem;
                return (
                  <div key={thinkingStep.id} className="text-sm text-muted-foreground/90 pl-2 border-l-2 border-zinc-600/50 py-1 my-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {thinkingStep.text}
                    </ReactMarkdown>
                  </div>
                );
              } else if (streamItem.type === 'tool_call_log_entry') {
                const toolCall = streamItem as ToolCallStreamItem;
                return (
                  <IndividualToolCallDisplay key={toolCall.id} toolCall={toolCall} />
                );
              }
              return null; // Should not happen if types are correct
            })
          ) : (
             <p className="text-sm text-muted-foreground/70 italic text-center py-2">No agent activity recorded yet for this block.</p>
          )}
        </div>
      )}
    </div>
  );
} 