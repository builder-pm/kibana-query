import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import ESSettingsModal from './ESSettingsModal';
import Welcome from './Welcome';
import { SchemaManager } from '../services/SchemaManager';
import { QueryLibraryManager } from '../services/QueryLibraryManager';

/**
 * ElasticsearchSidePanel component
 * 
 * Main container for the Elasticsearch Query Helper extension.
 * Manages cluster connections, settings, and integrates all UI components.
 */
const ElasticsearchSidePanel = ({ 
  activeCluster,
  isConnected,
  showSettings,
  setShowSettings,
  onClusterConnect
}) => {
  // State for clusters
  const [clusters, setClusters] = useState([]);
  // State to track if this is the first launch
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
  // State for showing the welcome screen
  const [showWelcome, setShowWelcome] = useState(false);
  // State for schema manager
  const [schemaManager] = useState(new SchemaManager());
  // State for query library manager
  const [queryLibraryManager] = useState(new QueryLibraryManager());
  // State for query execution history
  const [queryHistory, setQueryHistory] = useState([]);
  
  // Check if this is the first launch
  useEffect(() => {
    const hasLaunchedBefore = localStorage.getItem('es_helper_has_launched');
    
    if (!hasLaunchedBefore) {
      setIsFirstLaunch(true);
      setShowWelcome(true);
      localStorage.setItem('es_helper_has_launched', 'true');
    }
    
    // Load saved clusters from localStorage
    loadClusters();
  }, []);
  
  // Load clusters from localStorage
  const loadClusters = () => {
    try {
      const savedClusters = localStorage.getItem('es_helper_clusters');
      if (savedClusters) {
        setClusters(JSON.parse(savedClusters));
      }
    } catch (error) {
      console.error('Error loading clusters from localStorage:', error);
    }
  };
  
  // Save clusters to localStorage
  const saveClusters = (updatedClusters) => {
    try {
      localStorage.setItem('es_helper_clusters', JSON.stringify(updatedClusters));
    } catch (error) {
      console.error('Error saving clusters to localStorage:', error);
    }
  };
  
  // Handle adding a new cluster
  const handleClusterAdd = (clusterConfig) => {
    // Generate a unique ID
    const id = `cluster_${Date.now()}`;
    const newCluster = { id, ...clusterConfig };
    
    const updatedClusters = [...clusters, newCluster];
    setClusters(updatedClusters);
    saveClusters(updatedClusters);
    
    // Automatically connect to the new cluster
    onClusterConnect(id);
  };
  
  // Handle selecting a cluster
  const handleClusterSelect = (clusterId) => {
    onClusterConnect(clusterId);
  };
  
  // Handle removing a cluster
  const handleClusterRemove = (clusterId) => {
    const updatedClusters = clusters.filter(cluster => cluster.id !== clusterId);
    setClusters(updatedClusters);
    saveClusters(updatedClusters);
    
    // If the active cluster was removed, disconnect
    if (activeCluster === clusterId) {
      onClusterConnect(null);
    }
  };
  
  // Handle executing a query
  const handleExecuteQuery = (query) => {
    // Add to history
    const newHistoryItem = {
      id: Date.now(),
      query,
      timestamp: new Date(),
      executionTime: Math.floor(Math.random() * 300) + 50, // Mock execution time between 50-350ms
      resultCount: Math.floor(Math.random() * 1000) // Mock result count
    };
    
    setQueryHistory(prev => [newHistoryItem, ...prev].slice(0, 10)); // Keep only last 10 queries
    
    // For demo purposes, just log the query that would be executed
    console.log('Executing query:', query);
  };
  
  // Handle saving a query
  const handleSaveQuery = (query, name) => {
    // For demo purposes, just log the query that would be saved
    console.log('Saving query:', name, query);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {isConnected ? (
          <ChatInterface
            isConnected={isConnected}
            activeCluster={activeCluster}
            onExecuteQuery={handleExecuteQuery}
            onSaveQuery={handleSaveQuery}
            schemaManager={schemaManager}
            queryLibraryManager={queryLibraryManager}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800">
            <div className="text-center max-w-md">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                </div>
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Connect to Elasticsearch
              </h2>
              
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                To start using the Elasticsearch Query Helper, configure a connection to your Elasticsearch cluster.
              </p>
              
              <button
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                Configure Elasticsearch
              </button>
              
              {isFirstLaunch && (
                <button
                  onClick={() => setShowWelcome(true)}
                  className="inline-flex items-center px-4 py-2 mt-4 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Tutorial
                </button>
              )}
              
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                For demo purposes, you can use mock data without a real connection
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Settings modal */}
      {showSettings && (
        <ESSettingsModal
          onClose={() => setShowSettings(false)}
          clusters={clusters}
          activeCluster={activeCluster}
          onClusterAdd={handleClusterAdd}
          onClusterSelect={handleClusterSelect}
          onClusterRemove={handleClusterRemove}
        />
      )}
      
      {/* Welcome screen */}
      {showWelcome && (
        <Welcome
          onClose={() => setShowWelcome(false)}
          onAddCluster={() => {
            setShowWelcome(false);
            setShowSettings(true);
          }}
        />
      )}
    </div>
  );
};

export default ElasticsearchSidePanel;