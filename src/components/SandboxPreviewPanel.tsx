import React, { useState } from 'react';
import { SandboxExecutionResult, SandboxExecutionSuccess, SandboxExecutionError, GraphFragment } from '@/types';
import { Maximize2, Minimize2, X, ExternalLink } from 'lucide-react';

// Updated prop names for clarity and to match what page.tsx will provide
export interface SandboxPreviewPanelProps {
  sandboxResult: SandboxExecutionResult | null;
  isLoading: boolean;
  activeFragment: GraphFragment | null; // For context, like showing the file path
  clearSandboxPreview: () => void; // Renamed from onClose for clarity with hook action
  isPanelVisible: boolean;       // Renamed from isVisible
  isPanelCollapsed: boolean;     // Renamed from isCollapsed
  togglePanelCollapse: () => void; // Renamed from onToggleCollapse
  heightClass: string;             // Added to accept dynamic height
}

const SandboxPreviewPanel: React.FC<SandboxPreviewPanelProps> = ({
  sandboxResult,
  isLoading,
  activeFragment,
  clearSandboxPreview, // Use renamed prop
  isPanelVisible,    // Use renamed prop
  isPanelCollapsed,  // Use renamed prop
  togglePanelCollapse, // Use renamed prop
  heightClass        // Use new prop
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code'); // State for active tab

  if (!isPanelVisible) {
    return null; // Don't render anything if not visible
  }

  const isSuccess = (result: SandboxExecutionResult | null): result is SandboxExecutionSuccess => {
    return result !== null && 'url' in result && typeof result.url === 'string' && result.url.length > 0;
  };

  const isError = (result: SandboxExecutionResult | null): result is SandboxExecutionError => {
    return result !== null && 'error' in result;
  };

  const codeToShow = activeFragment?.code;
  const canOpenInNewTab = isSuccess(sandboxResult) && sandboxResult.url;

  return (
    <div className={`bg-gray-800 p-4 shadow-lg flex flex-col border border-gray-700 rounded-lg ${heightClass}`}>
      <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white truncate shrink min-w-0 mr-2">
          E2B Sandbox Preview {activeFragment?.filePath ? <span className="text-sm text-gray-400">({activeFragment.filePath})</span> : ''}
        </h3>
        <div className="flex items-center space-x-2 flex-shrink-0">
          {canOpenInNewTab && (
            <button
              onClick={() => window.open(sandboxResult.url, '_blank', 'noopener,noreferrer')}
              className="text-gray-400 hover:text-sky-400 px-2 py-1 rounded-md text-sm bg-gray-700 hover:bg-gray-600 transition-colors"
              title="Open Preview in New Tab"
            >
              <ExternalLink size={16} />
            </button>
          )}
          <button 
            onClick={togglePanelCollapse}
            className="text-gray-400 hover:text-white px-2 py-1 rounded-md text-sm bg-gray-700 hover:bg-gray-600 transition-colors"
            title={isPanelCollapsed ? "Expand Preview" : "Collapse Preview"}
          >
            {isPanelCollapsed ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button 
            onClick={clearSandboxPreview}
            className="text-gray-400 hover:text-white px-2 py-1 rounded-md text-sm bg-gray-700 hover:bg-gray-600 transition-colors"
            title="Close Preview Panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tab Buttons - only show if not collapsed */}
      {!isPanelCollapsed && (
        <div className="mb-3 flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2 text-sm font-medium rounded-t-md ${activeTab === 'code' ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-700/50' : 'text-gray-400 hover:text-white hover:bg-gray-700/30'} focus:outline-none transition-colors duration-150`}
          >
            Code
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 text-sm font-medium rounded-t-md ${activeTab === 'preview' ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-700/50' : 'text-gray-400 hover:text-white hover:bg-gray-700/30'} focus:outline-none transition-colors duration-150`}
          >
            Preview
          </button>
        </div>
      )}

      <div className={`flex-grow overflow-auto ${isPanelCollapsed ? 'hidden' : ''}`}>
          {/* Code Tab Content */}
          {activeTab === 'code' && (
            <div className="p-2 bg-gray-900 rounded-md h-full">
              {codeToShow ? (
                <pre className="text-sm text-gray-200 whitespace-pre-wrap break-all overflow-auto h-full">
                  <code>{codeToShow}</code>
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No code available to display.
                </div>
              )}
            </div>
          )}

          {/* Preview Tab Content */}
          {activeTab === 'preview' && (
            <>
              {isLoading && (
                <div className="flex items-center justify-center h-full text-white">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading Sandbox Preview...
                </div>
              )}

              {!isLoading && isError(sandboxResult) && (
                <div className="text-red-400 p-4 bg-red-900/30 rounded-md h-full">
                  <p className="font-semibold">Error: {sandboxResult.error}</p>
                  {sandboxResult.details && <p className="text-sm mt-1">Details: {sandboxResult.details}</p>}
                  {sandboxResult.templateUsed && <p className="text-sm mt-1">Template Used: {sandboxResult.templateUsed}</p>}
                  {process.env.NODE_ENV === 'development' && sandboxResult.stack && (
                    <pre className="text-xs mt-2 p-2 bg-gray-900 rounded overflow-auto max-h-40">{sandboxResult.stack}</pre>
                  )}
                </div>
              )}

              {!isLoading && isSuccess(sandboxResult) && (
                <iframe 
                  src={sandboxResult.url}
                  title={activeFragment?.filePath || 'E2B Sandbox Preview'}
                  className="w-full h-full border-0 rounded-md"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox"
                />
              )}
              
              {!isLoading && !sandboxResult && (
                  <div className="flex items-center justify-center h-full text-gray-400">
                      Waiting for preview content from the agent...
                  </div>
              )}
            </>
          )}
      </div>
      {isPanelCollapsed && (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm flex-grow">
          E2B Sandbox Preview Collapsed
        </div>
      )}
    </div>
  );
};

export default SandboxPreviewPanel; 