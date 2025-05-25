import React, { useState, useEffect, useRef } from 'react';

/**
 * ChatInterface component
 * 
 * Provides a text input area for users to submit natural language queries,
 * displays chat history, and includes typing indicators when queries are being processed.
 */
const ChatInterface = ({ onQuerySubmit, isGenerating, history = [] }) => {
  const [inputValue, setInputValue] = useState('');
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  
  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [history, isGenerating]);
  
  // Focus input field on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const query = inputValue.trim();
    
    if (query && !isGenerating) {
      onQuerySubmit(query);
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (but not with Shift+Enter which allows multi-line input)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Generate example queries
  const exampleQueries = [
    "Find documents where status is 'error' in the last 24 hours",
    "Show me top 10 users by transaction count",
    "Create a time series of login failures by hour",
    "Find products with price between $50 and $100"
  ];

  const handleExampleClick = (query) => {
    setInputValue(query);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="chat-interface flex flex-col border-t border-gray-200 dark:border-gray-700">
      {/* Chat History */}
      <div 
        ref={chatContainerRef}
        className="chat-history flex-grow p-3 overflow-y-auto max-h-64"
      >
        {history.length === 0 ? (
          <div className="text-center py-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Elasticsearch Query Helper
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Ask me to build an Elasticsearch query in plain English
            </p>
            
            <div className="example-queries grid grid-cols-1 md:grid-cols-2 gap-2">
              {exampleQueries.map((query, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(query)}
                  className="text-sm text-left p-2 rounded border border-gray-300 dark:border-gray-600 
                            hover:bg-blue-50 dark:hover:bg-blue-900 transition duration-200"
                >
                  "{query}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="flex items-start">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-2">
                  <span className="text-blue-600 dark:text-blue-300 text-xs font-semibold">U</span>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 max-w-3xl">
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{item.text}</p>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Typing indicator when generating */}
            {isGenerating && (
              <div className="flex items-start">
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mr-2">
                  <span className="text-green-600 dark:text-green-300 text-xs font-semibold">AI</span>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                  <div className="typing-indicator flex space-x-2">
                    <div className="dot animate-bounce bg-gray-600 dark:bg-gray-400 h-2 w-2 rounded-full"></div>
                    <div className="dot animate-bounce bg-gray-600 dark:bg-gray-400 h-2 w-2 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                    <div className="dot animate-bounce bg-gray-600 dark:bg-gray-400 h-2 w-2 rounded-full" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="chat-input-form border-t border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-end rounded-lg border border-gray-300 dark:border-gray-600 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-500 dark:focus-within:ring-blue-400">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the Elasticsearch query you need..."
            className="block w-full resize-none border-0 bg-transparent py-2.5 px-3 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-0 sm:text-sm"
            rows={1}
            onInput={(e) => {
              // Auto expand textarea
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
            }}
            disabled={isGenerating}
          ></textarea>
          
          <button
            type="submit"
            disabled={!inputValue.trim() || isGenerating}
            className={`flex-shrink-0 p-2 mr-1 mb-1 rounded-lg ${
              !inputValue.trim() || isGenerating
                ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'text-blue-600 dark:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;