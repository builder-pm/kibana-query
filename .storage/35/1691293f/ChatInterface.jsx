// src/components/ChatInterface.jsx
import React, { useState, useEffect, useRef } from 'react';

const ChatInterface = ({ messages, onQuerySubmit, isGenerating, error }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    
    onQuerySubmit(input);
    setInput('');
  };

  const getMessageStyle = (type) => {
    switch (type) {
      case 'user':
        return 'bg-blue-100 ml-12';
      case 'assistant':
        return 'bg-gray-100 mr-12';
      case 'system':
        return 'bg-yellow-50 text-center text-sm italic';
      default:
        return 'bg-gray-100';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Display */}
      <div className="flex-grow overflow-auto mb-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <p className="text-lg mb-3">Welcome to Elasticsearch Query Helper</p>
            <p className="text-sm">Ask me to create an Elasticsearch query in plain English</p>
            <p className="text-xs mt-4">Example: "Find all documents where the title contains 'elasticsearch' and the date is within the last 7 days"</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index} 
              className={`p-3 rounded-lg shadow-sm ${getMessageStyle(msg.type)}`}
            >
              {msg.type === 'user' && (
                <div className="text-xs text-gray-500 mb-1">You:</div>
              )}
              {msg.type === 'assistant' && (
                <div className="text-xs text-gray-500 mb-1">Assistant:</div>
              )}
              <div>{msg.content}</div>
            </div>
          ))
        )}
        
        {isGenerating && (
          <div className="bg-gray-100 p-3 rounded-lg shadow-sm mr-12 flex items-center">
            <div className="text-xs text-gray-500 mb-1">Assistant:</div>
            <div className="ml-2">
              <span className="inline-block animate-pulse">Generating query</span>
              <span className="inline-block w-1 animate-bounce mx-0.5">.</span>
              <span className="inline-block w-1 animate-bounce mx-0.5 animation-delay-200">.</span>
              <span className="inline-block w-1 animate-bounce mx-0.5 animation-delay-400">.</span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 p-3 rounded-lg text-red-700 text-center">
            {error}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex items-center mb-2 bg-white rounded-lg shadow-md">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me to create an Elasticsearch query..."
          className="flex-grow px-4 py-3 rounded-l-lg focus:outline-none"
          disabled={isGenerating}
        />
        <button
          type="submit"
          className={`px-4 py-3 rounded-r-lg font-medium text-white ${
            isGenerating || !input.trim() 
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          disabled={isGenerating || !input.trim()}
        >
          {isGenerating ? 'Generating...' : 'Generate Query'}
        </button>
      </form>
      
      <div className="text-xs text-gray-500 text-center">
        Powered by BrowserBee's multi-agent AI architecture
      </div>
    </div>
  );
};

export default ChatInterface;
