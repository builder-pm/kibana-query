import React, { useState, useRef, useEffect } from 'react';
import QueryResultCard from './QueryResultCard';

/**
 * ChatInterface component
 * 
 * Provides an interface for users to interact with the Elasticsearch Query Helper,
 * submit natural language queries, and view generated query results.
 */
const ChatInterface = ({ 
  isConnected, 
  activeCluster, 
  onExecuteQuery, 
  onSaveQuery,
  schemaManager,
  queryLibraryManager 
}) => {
  // State for the user's input
  const [userInput, setUserInput] = useState('');
  
  // State for the chat history
  const [chatHistory, setChatHistory] = useState([
    {
      type: 'assistant',
      content: 'Welcome to Elasticsearch Query Helper! How can I help you with your queries today?',
      timestamp: new Date()
    }
  ]);
  
  // State for query results
  const [queryResults, setQueryResults] = useState([]);
  
  // State for loading status
  const [loading, setLoading] = useState(false);
  
  // State to show/hide the thinking process
  const [showThinking, setShowThinking] = useState(false);
  
  // State for the current thinking step
  const [thinkingStep, setThinkingStep] = useState('');
  
  // Reference to chat container for auto-scrolling
  const chatContainerRef = useRef(null);
  
  // Auto-scroll when chat history changes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, queryResults]);
  
  // Mock data for the thinking process steps
  const thinkingSteps = [
    { step: 'intent', message: 'Parsing your request to understand intent...' },
    { step: 'schema', message: 'Analyzing index schema and available fields...' },
    { step: 'perspectives', message: 'Generating multiple query approaches...' },
    { step: 'dsl', message: 'Converting to Elasticsearch DSL...' },
    { step: 'validation', message: 'Validating query syntax and semantics...' },
    { step: 'ranking', message: 'Ranking query options by relevance...' }
  ];
  
  // Submit a new query
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!userInput.trim() || !isConnected) return;
    
    const newUserMessage = {
      type: 'user',
      content: userInput,
      timestamp: new Date()
    };
    
    // Add the user message to chat history
    setChatHistory(prevHistory => [...prevHistory, newUserMessage]);
    
    // Clear input and start loading
    setUserInput('');
    setLoading(true);
    setThinkingStep('intent');
    setShowThinking(true);
    
    // Clear any previous results
    setQueryResults([]);
    
    try {
      // Simulate the thinking process
      for (let i = 0; i < thinkingSteps.length; i++) {
        setThinkingStep(thinkingSteps[i].step);
        // Wait a bit between steps for a realistic effect
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      
      // Get mock schema for the active cluster
      let schema = null;
      if (schemaManager && activeCluster) {
        try {
          // Try to get schema for "logs-*" index pattern
          schema = await schemaManager.getSchema(activeCluster, 'logs-*');
        } catch (error) {
          console.error('Error getting schema:', error);
        }
      }
      
      // Generate query results using mock data
      const results = generateMockResults(userInput, schema);
      setQueryResults(results);
      
      // Add the assistant's response
      const newAssistantMessage = {
        type: 'assistant',
        content: `I've generated ${results.length} query options based on your request.`,
        timestamp: new Date()
      };
      
      setChatHistory(prevHistory => [...prevHistory, newAssistantMessage]);
    } catch (error) {
      console.error('Error generating query:', error);
      
      // Add error message
      const errorMessage = {
        type: 'assistant',
        content: 'Sorry, I encountered an error while generating your query. Please try again.',
        error: true,
        timestamp: new Date()
      };
      
      setChatHistory(prevHistory => [...prevHistory, errorMessage]);
    } finally {
      setLoading(false);
      setShowThinking(false);
    }
  };
  
  // Handle executing a query
  const handleExecuteQuery = (queryId) => {
    const selectedQuery = queryResults.find(result => result.id === queryId);
    if (selectedQuery && onExecuteQuery) {
      onExecuteQuery(selectedQuery.query);
    }
  };
  
  // Handle feedback for a query
  const handleQueryFeedback = (feedback) => {
    // In a real implementation, this would be sent to a feedback API
    console.log('Query feedback received:', feedback);
    
    // Add confirmation message
    const feedbackMessage = {
      type: 'assistant',
      content: `Thanks for your feedback! ${feedback.type === 'helpful' ? 'I\'m glad that was useful.' : 'I\'ll try to improve my suggestions.'}`,
      timestamp: new Date()
    };
    
    setChatHistory(prevHistory => [...prevHistory, feedbackMessage]);
  };
  
  // Generate mock query results
  const generateMockResults = (input, schema) => {
    const perspectives = [
      { 
        name: 'Simple Match Query', 
        approach: 'Direct match on relevant fields with minimal complexity'
      },
      { 
        name: 'Boolean Query with Filters', 
        approach: 'More precise approach using bool query with filters for better performance'
      },
      { 
        name: 'Multi-field Search', 
        approach: 'Search across multiple relevant fields with boosting important ones'
      }
    ];
    
    const baseQuery = input.toLowerCase();
    const results = [];
    
    // Helper to generate a unique ID
    const generateId = () => Math.random().toString(36).substring(2, 15);
    
    // Simple match query
    if (baseQuery.includes('error') || baseQuery.includes('logs')) {
      results.push({
        id: generateId(),
        perspective: perspectives[0],
        query: {
          query: {
            match: {
              message: baseQuery.includes('error') ? 'error' : 'log'
            }
          }
        },
        rankingScore: 0.85,
        explanation: `This straightforward match query looks for the term "${baseQuery.includes('error') ? 'error' : 'log'}" in the message field of your documents.`,
        validation: { warnings: [], errors: [] },
        recommendations: [
          'Consider using a more specific field than "message" if available',
          'Add a time range filter if you need recent results'
        ]
      });
    }
    
    // Boolean query with filters
    if (schema && schema.analysis) {
      // Use fields from schema if available
      const dateFields = schema.analysis.dateFields || ['@timestamp'];
      const searchableFields = schema.analysis.searchableFields || ['message', 'log.level'];
      
      const timeFilter = baseQuery.includes('last 24 hours') || baseQuery.includes('today');
      const errorFilter = baseQuery.includes('error');
      const infoFilter = baseQuery.includes('info');
      const warningFilter = baseQuery.includes('warn') || baseQuery.includes('warning');
      
      const boolQuery = {
        query: {
          bool: {
            must: [],
            filter: []
          }
        }
      };
      
      if (timeFilter) {
        boolQuery.query.bool.filter.push({
          range: {
            [dateFields[0]]: {
              gte: 'now-24h/h',
              lte: 'now'
            }
          }
        });
      }
      
      if (errorFilter || infoFilter || warningFilter) {
        const levels = [];
        if (errorFilter) levels.push('error');
        if (infoFilter) levels.push('info'); 
        if (warningFilter) levels.push('warn');
        
        if (levels.length === 1) {
          boolQuery.query.bool.filter.push({
            term: {
              'log.level': levels[0]
            }
          });
        } else if (levels.length > 1) {
          boolQuery.query.bool.filter.push({
            terms: {
              'log.level': levels
            }
          });
        }
      }
      
      if (baseQuery.includes('search') || baseQuery.includes('find')) {
        const textToSearch = baseQuery
          .replace('search for', '')
          .replace('search', '')
          .replace('find', '')
          .replace('in logs', '')
          .replace('in log', '')
          .replace('in the last 24 hours', '')
          .replace('in the last day', '')
          .replace('today', '')
          .trim();
          
        if (textToSearch && textToSearch !== 'error' && textToSearch !== 'info' && textToSearch !== 'warn' && textToSearch !== 'warning') {
          boolQuery.query.bool.must.push({
            multi_match: {
              query: textToSearch,
              fields: searchableFields
            }
          });
        }
      }
      
      // Only add if we have actual filters or must clauses
      if (boolQuery.query.bool.filter.length > 0 || boolQuery.query.bool.must.length > 0) {
        results.push({
          id: generateId(),
          perspective: perspectives[1],
          query: boolQuery,
          rankingScore: 0.92,
          explanation: `This boolean query combines precise filters with text matching. Filters are used for exact matches which are more efficient than regular queries.`,
          validation: { warnings: [], errors: [] },
          recommendations: []
        });
      }
    }
    
    // Multi-field search
    if (baseQuery.includes('search') || baseQuery.includes('find') || baseQuery.includes('show me')) {
      const textToSearch = baseQuery
        .replace('search for', '')
        .replace('search', '')
        .replace('find', '')
        .replace('show me', '')
        .replace('in logs', '')
        .replace('in log', '')
        .replace('in the last 24 hours', '')
        .replace('in the last day', '')
        .replace('today', '')
        .trim();
        
      if (textToSearch && textToSearch.length > 3) {
        const multiFieldQuery = {
          query: {
            multi_match: {
              query: textToSearch,
              fields: ['message^3', 'log.logger', 'service.name'],
              type: 'best_fields',
              fuzziness: 'AUTO'
            }
          }
        };
        
        results.push({
          id: generateId(),
          perspective: perspectives[2],
          query: multiFieldQuery,
          rankingScore: 0.78,
          explanation: `This query searches across multiple fields for the terms "${textToSearch}", with boosting on the message field (^3). The fuzziness parameter allows for slight misspellings.`,
          validation: { warnings: ['Fuzzy queries may impact performance on large indices'], errors: [] },
          recommendations: [
            'Consider removing fuzziness if exact matches are required',
            'Add specific field filters if you know which fields should contain the terms'
          ]
        });
      }
    }
    
    // If no specific queries were generated, create a generic one
    if (results.length === 0) {
      results.push({
        id: generateId(),
        perspective: perspectives[0],
        query: {
          query: {
            multi_match: {
              query: input,
              fields: ['message', 'log.level', 'service.name']
            }
          }
        },
        rankingScore: 0.7,
        explanation: `This is a generic query based on your input. It searches across multiple fields for terms in your request.`,
        validation: { 
          warnings: ['This is a generic query and might not be optimized for your specific use case'], 
          errors: [] 
        },
        recommendations: [
          'Try being more specific about what fields or values you are looking for',
          'Specify time ranges if applicable (e.g., "in the last hour")',
          'Mention specific log levels or other attributes you want to filter by'
        ]
      });
    }
    
    // Sort by ranking score, descending
    return results.sort((a, b) => b.rankingScore - a.rankingScore);
  };
  
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Chat history */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Messages */}
        {chatHistory.map((message, index) => (
          <div 
            key={index} 
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-3/4 rounded-lg px-4 py-2 ${ 
                message.type === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : message.error 
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-bl-none' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-bl-none'
              }`}
            >
              {message.content}
              <div className="text-xs opacity-70 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {/* Thinking process */}
        {showThinking && (
          <div className="flex justify-start">
            <div className="max-w-3/4 rounded-lg px-4 py-2 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>
                  {thinkingSteps.find(step => step.step === thinkingStep)?.message || 'Thinking...'}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* Query results */}
        {queryResults.length > 0 && (
          <div className="space-y-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Query Options:</h3>
            {queryResults.map(result => (
              <QueryResultCard
                key={result.id}
                result={result}
                onExecute={handleExecuteQuery}
                onFeedback={handleQueryFeedback}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Input form */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSubmit} className="flex items-center">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={loading || !isConnected}
            placeholder={isConnected ? "Describe the query you want to create..." : "Connect to Elasticsearch to start..."}
            className="flex-1 rounded-l-lg border border-gray-300 dark:border-gray-600 py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 disabled:dark:bg-gray-800 disabled:text-gray-500 disabled:dark:text-gray-400"
          />
          <button
            type="submit"
            disabled={loading || !isConnected || !userInput.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-r-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </form>
        {!isConnected && (
          <p className="text-center text-sm text-yellow-600 dark:text-yellow-400 mt-2">
            Please configure and connect to an Elasticsearch cluster to use the query helper.
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;