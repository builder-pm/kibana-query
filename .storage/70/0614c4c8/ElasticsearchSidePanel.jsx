import React, { useState, useEffect, useRef } from 'react';
import { ESClusterManager } from '../services/ESClusterManager';
import { ElasticsearchAgentCore } from '../agent/ElasticsearchAgentCore';
import { SchemaManager } from '../services/SchemaManager';
import ChatInterface from './ChatInterface';
import QueryResultCard from './QueryResultCard';
import ESSettingsModal from './ESSettingsModal';

/**
 * ElasticsearchSidePanel component
 * 
 * Main UI container for the Elasticsearch Query Helper extension.
 * Handles state management and orchestration of child components.
 */
const ElasticsearchSidePanel = () => {
  // State for cluster management
  const [clusterState, setClusterState] = useState({
    clusters: [],
    activeCluster: null,
    connectionStatus: 'disconnected',
  });

  // State for query interactions
  const [queryState, setQueryState] = useState({
    history: [],
    isGenerating: false,
    queryOptions: {
      maxResults: 3,
      includeExplanations: true,
    }
  });

  // Results state
  const [results, setResults] = useState([]);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Service instances
  const clusterManager = useRef(new ESClusterManager());
  const schemaManager = useRef(new SchemaManager());
  const agentRef = useRef(null);

  useEffect(() => {
    // Initialize on component mount
    const initializeServices = async () => {
      try {
        // Initialize cluster manager and fetch clusters
        await clusterManager.current.initialize();
        const clusters = await clusterManager.current.getAllClusters();
        const activeCluster = await clusterManager.current.getActiveCluster();
        
        let connectionStatus = 'disconnected';
        if (activeCluster) {
          const health = await clusterManager.current.getClusterHealth(activeCluster.id);
          connectionStatus = health.connected ? 'connected' : 'disconnected';
        }
        
        // Update state
        setClusterState({
          clusters,
          activeCluster: activeCluster?.id || null,
          connectionStatus
        });

        // Show settings modal if no clusters configured
        if (clusters.length === 0) {
          setShowSettings(true);
          showNotification('Welcome! Please configure an Elasticsearch cluster to get started.', 'info');
        }
        
        // Initialize agent if we have an active cluster
        if (activeCluster) {
          initializeAgent(activeCluster.id);
        }
      } catch (err) {
        console.error('Failed to initialize services:', err);
        setError('Failed to initialize. Please check console for details.');
      }
    };
    
    initializeServices();
    
    return () => {
      // Cleanup if needed
    };
  }, []);

  const initializeAgent = async (clusterId) => {
    try {
      // Get cluster config
      const clusterConfig = await clusterManager.current.getClusterInfo(clusterId);
      
      // Create agent with configuration
      agentRef.current = new ElasticsearchAgentCore({
        llmConfig: {
          provider: 'openai',
          modelName: 'gpt-4',
          temperature: 0.3
        },
        clusters: [clusterConfig]
      });
      
      showNotification(`Connected to cluster: ${clusterConfig.name}`, 'success');
    } catch (err) {
      console.error('Failed to initialize Elasticsearch agent:', err);
      setError('Failed to initialize agent. Please check console for details.');
    }
  };

  const handleQuerySubmit = async (queryText) => {
    if (!clusterState.activeCluster) {
      showNotification('Please configure and select an Elasticsearch cluster first', 'error');
      setShowSettings(true);
      return;
    }
    
    // Add query to history
    const newQuery = {
      id: Date.now().toString(),
      text: queryText,
      timestamp: new Date().toISOString()
    };
    
    setQueryState(prev => ({
      ...prev,
      history: [...prev.history, newQuery],
      isGenerating: true
    }));
    
    try {
      setResults([]);
      
      // Generate query using agent
      const generatedQueries = await agentRef.current.generateQuery(
        queryText, 
        clusterState.activeCluster
      );
      
      setResults(generatedQueries);
    } catch (err) {
      console.error('Error generating query:', err);
      setError(`Failed to generate query: ${err.message}`);
    } finally {
      setQueryState(prev => ({
        ...prev,
        isGenerating: false
      }));
    }
  };
  
  const handleClusterAdd = async (clusterConfig) => {
    try {
      const clusterId = await clusterManager.current.addCluster(clusterConfig);
      
      // Refresh clusters list
      const clusters = await clusterManager.current.getAllClusters();
      const activeCluster = await clusterManager.current.getActiveCluster();
      
      setClusterState({
        clusters,
        activeCluster: activeCluster?.id || null,
        connectionStatus: 'connected'
      });
      
      // Initialize agent with new cluster
      if (activeCluster?.id === clusterId) {
        initializeAgent(clusterId);
      }
      
      showNotification(`Cluster "${clusterConfig.name}" added successfully`, 'success');
    } catch (err) {
      console.error('Failed to add cluster:', err);
      setError(`Failed to add cluster: ${err.message}`);
    }
  };
  
  const handleClusterSelect = async (clusterId) => {
    try {
      await clusterManager.current.setActiveCluster(clusterId);
      
      // Check health
      const health = await clusterManager.current.getClusterHealth(clusterId);
      const clusterInfo = await clusterManager.current.getClusterInfo(clusterId);
      
      setClusterState(prev => ({
        ...prev,
        activeCluster: clusterId,
        connectionStatus: health.connected ? 'connected' : 'disconnected'
      }));
      
      // Initialize agent with selected cluster
      initializeAgent(clusterId);
      
      showNotification(`Connected to cluster: ${clusterInfo.name}`, 'success');
    } catch (err) {
      console.error('Failed to select cluster:', err);
      setError(`Failed to select cluster: ${err.message}`);
    }
  };
  
  const handleClusterRemove = async (clusterId) => {
    try {
      await clusterManager.current.removeCluster(clusterId);
      
      // Refresh clusters list
      const clusters = await clusterManager.current.getAllClusters();
      const activeCluster = await clusterManager.current.getActiveCluster();
      
      setClusterState({
        clusters,
        activeCluster: activeCluster?.id || null,
        connectionStatus: activeCluster ? 'connected' : 'disconnected'
      });
      
      // Initialize agent with new active cluster if there is one
      if (activeCluster) {
        initializeAgent(activeCluster.id);
      }
      
      showNotification('Cluster removed successfully', 'success');
    } catch (err) {
      console.error('Failed to remove cluster:', err);
      setError(`Failed to remove cluster: ${err.message}`);
    }
  };
  
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    // Auto-hide after 5 seconds
    setTimeout(() => setNotification(null), 5000);
  };
  
  const handleExecuteQuery = async (queryId) => {
    const query = results.find(q => q.id === queryId);
    if (!query) return;
    
    try {
      setQueryState(prev => ({ ...prev, isGenerating: true }));
      
      // In a real implementation, this would execute the query against Elasticsearch
      // For demo purposes, just show a notification
      showNotification('Query execution is not implemented in this demo version', 'info');
      
      setQueryState(prev => ({ ...prev, isGenerating: false }));
    } catch (err) {
      console.error('Failed to execute query:', err);
      setError(`Failed to execute query: ${err.message}`);
      setQueryState(prev => ({ ...prev, isGenerating: false }));
    }
  };
  
  const handleFeedbackSubmit = (queryId, feedback) => {
    // In a real implementation, this would submit feedback for learning purposes
    console.log('Feedback submitted:', queryId, feedback);
  };
  
  return (
    <div className="elasticsearch-sidepanel bg-white dark:bg-gray-800 flex flex-col h-screen">
      {/* Header Bar */}
      <div className="es-header p-3 flex items-center justify-between bg-blue-600 text-white">
        <div className="flex items-center">
          <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C16.971 3 21 7.029 21 12C21 16.971 16.971 21 12 21C7.029 21 3 16.971 3 12C3 7.029 7.029 3 12 3ZM12 5C8.134 5 5 8.134 5 12C5 15.866 8.134 19 12 19C15.866 19 19 15.866 19 12C19 8.134 15.866 5 12 5ZM11 8V13H15V15H9V8H11Z" />
          </svg>
          <h1 className="text-lg font-bold">Elasticsearch Query Helper</h1>
        </div>
        <div className="flex items-center">
          <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
            clusterState.connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
          }`}></span>
          <button 
            onClick={() => setShowSettings(true)} 
            className="p-1 rounded-full hover:bg-blue-700"
            title="Settings"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Notification */}
      {notification && (
        <div className={`p-3 m-2 rounded-md text-sm ${
          notification.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
          notification.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        }`}>
          {notification.message}
          <button 
            className="float-right" 
            onClick={() => setNotification(null)}
          >
            &times;
          </button>
        </div>
      )}
      
      {/* Error Banner */}
      {error && (
        <div className="p-3 m-2 bg-red-100 text-red-700 rounded-md dark:bg-red-900 dark:text-red-200">
          <strong>Error:</strong> {error}
          <button 
            className="float-right font-bold" 
            onClick={() => setError(null)}
          >
            &times;
          </button>
        </div>
      )}
      
      {/* Main Content Area */}
      <div className="flex-grow overflow-y-auto p-3">
        {/* Results Display */}
        {results.length > 0 && (
          <div className="mb-4">
            <h2 className="text-lg font-bold mb-2 text-gray-800 dark:text-gray-200">Generated Queries</h2>
            <div className="space-y-4">
              {results.map((result) => (
                <QueryResultCard
                  key={result.id}
                  result={result}
                  onExecute={() => handleExecuteQuery(result.id)}
                  onFeedback={(feedback) => handleFeedbackSubmit(result.id, feedback)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Chat Interface */}
      <ChatInterface
        onQuerySubmit={handleQuerySubmit}
        isGenerating={queryState.isGenerating}
        history={queryState.history}
      />
      
      {/* Settings Modal */}
      {showSettings && (
        <ESSettingsModal
          onClose={() => setShowSettings(false)}
          clusters={clusterState.clusters}
          activeCluster={clusterState.activeCluster}
          onClusterAdd={handleClusterAdd}
          onClusterSelect={handleClusterSelect}
          onClusterRemove={handleClusterRemove}
        />
      )}
    </div>
  );
};

export default ElasticsearchSidePanel;
