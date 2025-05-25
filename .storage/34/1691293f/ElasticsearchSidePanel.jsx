// src/components/ElasticsearchSidePanel.jsx
import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import ESSettingsModal from './ESSettingsModal';
import QueryResultCard from './QueryResultCard';

const ElasticsearchSidePanel = ({ 
  activeCluster,
  isConnected,
  showSettings,
  setShowSettings,
  onClusterConnect
}) => {
  const [messages, setMessages] = useState([]);
  const [queryResults, setQueryResults] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Simulated function to call our Elasticsearch agent
  const generateQuery = async (naturalLanguageQuery) => {
    setIsGenerating(true);
    setError(null);
    
    try {
      // In a real implementation, this would call the actual ElasticsearchAgentCore
      // For demo purposes, we'll simulate a delay and return mock data
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock results - in real implementation this would come from ElasticsearchAgentCore
      const results = [
        {
          query: {
            query: {
              bool: {
                must: [
                  { match: { "description": naturalLanguageQuery } }
                ],
                filter: [
                  { term: { "status": "active" } }
                ]
              }
            }
          },
          perspective: {
            name: "Basic Search Approach",
            description: "Simple boolean query with text matching",
            confidence: 0.85
          },
          score: 0.82,
          reasoning: "Direct implementation matching query terms with minimal filters",
          validation: {
            errors: [],
            warnings: [
              { message: "No pagination parameters provided", path: "query" }
            ],
            improvements: [
              { message: "Consider adding size and from parameters", path: "query" }
            ]
          }
        },
        {
          query: {
            query: {
              multi_match: {
                query: naturalLanguageQuery,
                fields: ["title^2", "description", "content"]
              }
            },
            size: 20,
            _source: ["title", "description", "url", "timestamp"]
          },
          perspective: {
            name: "Multi-field Search Approach",
            description: "Search across multiple fields with boosting",
            confidence: 0.78
          },
          score: 0.75,
          reasoning: "More sophisticated approach searching across multiple fields with boosting",
          validation: {
            errors: [],
            warnings: [],
            improvements: [
              { message: "Consider adding highlights for matched terms", path: "query" }
            ]
          }
        }
      ];
      
      // Add to chat history
      setMessages(prev => [...prev, 
        { type: 'user', content: naturalLanguageQuery },
        { type: 'assistant', content: 'I\'ve generated the following Elasticsearch queries based on your request:' }
      ]);
      
      setQueryResults(results);
      return results;
    } catch (err) {
      console.error("Error generating query:", err);
      setError(err.message || "Failed to generate query");
      
      // Add error message to chat
      setMessages(prev => [...prev, 
        { type: 'system', content: `Error: ${err.message || "Failed to generate query"}` }
      ]);
      
      return [];
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuerySubmit = async (query) => {
    if (!isConnected || !activeCluster) {
      setError("Please connect to an Elasticsearch cluster first");
      return;
    }
    
    // Clear previous results
    setQueryResults([]);
    
    // Add user message
    setMessages(prev => [...prev, { type: 'user', content: query }]);
    
    // Generate query
    await generateQuery(query);
  };

  const handleCopyQuery = (query, format) => {
    // In a real implementation, this would format the query based on the selected format
    const formattedQuery = JSON.stringify(query, null, 2);
    
    // Use clipboard API to copy
    navigator.clipboard.writeText(formattedQuery)
      .then(() => {
        // Add system message indicating copy success
        setMessages(prev => [...prev, 
          { type: 'system', content: `Query copied to clipboard (${format} format)` }
        ]);
      })
      .catch(err => {
        console.error("Failed to copy query:", err);
        setError("Failed to copy query to clipboard");
      });
  };

  const handleFeedback = (queryId, feedback) => {
    // In a real implementation, this would send feedback to improve future queries
    console.log("Query feedback received:", queryId, feedback);
    
    // Add feedback to messages
    setMessages(prev => [...prev, 
      { type: 'system', content: `Feedback recorded: ${feedback.rating}/5 - ${feedback.comment}` }
    ]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Main Content Area */}
      <div className="flex-grow overflow-hidden flex flex-col">
        
        {/* Chat and Query Result Area */}
        <div className="flex-grow overflow-auto p-4 space-y-4">
          {/* Message History */}
          <ChatInterface 
            messages={messages}
            onQuerySubmit={handleQuerySubmit}
            isGenerating={isGenerating}
            error={error}
          />
          
          {/* Query Results Section */}
          {queryResults.length > 0 && (
            <div className="mt-6 space-y-4">
              <h2 className="text-lg font-semibold">Generated Queries:</h2>
              {queryResults.map((result, index) => (
                <QueryResultCard
                  key={index}
                  result={result}
                  onCopy={(format) => handleCopyQuery(result.query, format)}
                  onFeedback={(feedback) => handleFeedback(index, feedback)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Settings Modal */}
      {showSettings && (
        <ESSettingsModal
          onClose={() => setShowSettings(false)}
          onConnect={onClusterConnect}
          activeCluster={activeCluster}
        />
      )}
    </div>
  );
};

export default ElasticsearchSidePanel;
