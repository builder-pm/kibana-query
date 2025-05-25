// src/agent/ElasticsearchAgentCore.js

import IntentParsingTool from './tools/elasticsearch/IntentParsingTool';
import PerspectiveGenerationTool from './tools/elasticsearch/PerspectiveGenerationTool';
import QueryBuildingTool from './tools/elasticsearch/QueryBuildingTool';
import ValidationTool from './tools/elasticsearch/ValidationTool';
import ConsensusTool from './tools/elasticsearch/ConsensusTool';
import SchemaManager from '../services/SchemaManager';
import ESClusterManager from '../services/ESClusterManager';
import { QueryLibraryManager } from '../services/QueryLibraryManager';
import browserBeeIntegration from './BrowserBeeIntegration';

/**
 * ElasticsearchAgentCore
 * 
 * Acts as the central orchestration layer for Elasticsearch query generation.
 * Manages the flow of data between various specialized tools and coordinates
 * the query generation pipeline.
 */
class ElasticsearchAgentCore {
  /**
   * Initialize the ElasticsearchAgentCore
   * 
   * @param {Object} config - Configuration for the agent
   * @param {Object} config.llmConfig - Configuration for language model
   * @param {Array} config.clusters - Array of Elasticsearch cluster configurations
   */
  constructor(config) {
    this.config = config || {};
    this.clusterManager = new ESClusterManager();
    this.schemaManager = new SchemaManager();
    this.queryLibraryManager = new QueryLibraryManager();
    
    // Initialize tools
    this.tools = {
      intentParsing: new IntentParsingTool(),
      perspectiveGeneration: new PerspectiveGenerationTool(),
      queryBuilding: new QueryBuildingTool(),
      validation: new ValidationTool(),
      consensus: new ConsensusTool()
    };
    
    this.activeCluster = null;
    this.lastGeneratedQueries = [];
    this.useBrowserBee = config.useBrowserBee !== false; // Default to true
    
    // Initialize BrowserBee integration if available
    this.initializeBrowserBee();
  }
  
  /**
   * Initialize BrowserBee integration
   */
  async initializeBrowserBee() {
    if (!this.useBrowserBee) return;
    
    try {
      const initialized = await browserBeeIntegration.initialize(this.config);
      if (initialized) {
        console.log('BrowserBee integration initialized successfully');
      } else {
        console.warn('BrowserBee integration failed to initialize, falling back to local tools');
        this.useBrowserBee = false;
      }
    } catch (error) {
      console.error('Error initializing BrowserBee integration:', error);
      this.useBrowserBee = false;
    }
  }
  
  /**
   * Set the active Elasticsearch cluster
   * 
   * @param {string} clusterId - The ID of the cluster to set as active
   * @returns {Promise<Object>} - The cluster configuration
   */
  async setCluster(clusterId) {
    const clusterConfig = await this.clusterManager.getClusterInfo(clusterId);
    if (!clusterConfig) {
      throw new Error(`Cluster with ID ${clusterId} not found`);
    }
    
    this.activeCluster = clusterConfig;
    return clusterConfig;
  }
  
  /**
   * Generate Elasticsearch query from natural language input
   * 
   * @param {string} userInput - Natural language query description
   * @param {string} clusterId - ID of the cluster to query against (optional)
   * @returns {Promise<Array>} - Array of query options with explanations
   */
  async generateQuery(userInput, clusterId = null) {
    console.log(`Generating query for input: "${userInput}"`);
    
    try {
      // Set cluster if provided
      if (clusterId) {
        await this.setCluster(clusterId);
      }
      
      // Ensure we have an active cluster
      if (!this.activeCluster) {
        throw new Error('No active Elasticsearch cluster configured');
      }
      
      // Try BrowserBee integration first if available
      if (this.useBrowserBee && browserBeeIntegration.isAvailable()) {
        console.log('Using BrowserBee agent for query generation');
        
        try {
          const schema = await this.getSchemaForActiveCluster();
          const context = {
            schema,
            clusterInfo: this.activeCluster,
            queryExamples: await this.queryLibraryManager.getQueryExamples()
          };
          
          const browserBeeResult = await browserBeeIntegration.generateQuery(
            userInput, 
            this.activeCluster.id, 
            context
          );
          
          if (browserBeeResult.success) {
            this.lastGeneratedQueries = browserBeeResult.queries;
            return browserBeeResult.queries;
          } else if (!browserBeeResult.fallback) {
            throw new Error(browserBeeResult.error);
          }
          
          console.warn('BrowserBee failed, falling back to local tools');
        } catch (error) {
          console.warn('BrowserBee error, falling back to local tools:', error);
        }
      }
      
      // Fallback to local tool chain
      console.log('Using local tool chain for query generation');
      return await this.generateQueryWithLocalTools(userInput, clusterId);
      
    } catch (error) {
      console.error('Error generating query:', error);
      throw error;
    }
  }
  
  /**
   * Generate query using local tools (fallback method)
   */
  async generateQueryWithLocalTools(userInput, clusterId = null) {
    // 1. Get schema information
    const schema = await this.getSchemaForActiveCluster();
    
    // 2. Get query examples from library
    const queryExamples = await this.queryLibraryManager.getQueryExamples();
    
    // Build context object for tools
    const context = {
      userInput,
      schema,
      queryExamples,
      clusterInfo: this.activeCluster
    };
    
    // 3. Parse intent using the intent parsing tool
    const intent = await this.tools.intentParsing.execute({
      text: userInput,
      context
    });
    console.log('Intent parsed:', intent);
    
    // 4. Generate query perspectives
    const perspectives = await this.tools.perspectiveGeneration.execute({
      intent,
      context
    });
    console.log('Generated perspectives:', perspectives);
    
    // 5. Build queries based on each perspective
    const queries = [];
    for (const perspective of perspectives) {
      const query = await this.tools.queryBuilding.execute({
        intent,
        perspective,
        context
      });
      
      // 6. Validate each query
      const validation = await this.tools.validation.execute({
        query: query.query,
        context
      });
      
      queries.push({
        id: `query_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        query: query.query,
        explanation: query.explanation,
        perspective,
        validation
      });
    }
    console.log('Generated queries:', queries);
    
    // 7. Rank and provide consensus
    const rankedQueries = await this.tools.consensus.execute({
      queries,
      context
    });
    
    // Store the result
    this.lastGeneratedQueries = rankedQueries;
    
    return rankedQueries;
  }
  
  /**
   * Get schema information for the active cluster
   * 
   * @returns {Promise<Object>} - The schema information
   */
  async getSchemaForActiveCluster() {
    if (!this.activeCluster) {
      throw new Error('No active cluster configured');
    }
    
    try {
      // For demo, we can use a mock index pattern
      const indexPattern = 'logs-*';
      return await this.schemaManager.getSchema(this.activeCluster.id, indexPattern);
    } catch (error) {
      console.warn('Failed to get schema, using default:', error);
      return this.schemaManager.getMockDefaultSchema();
    }
  }
  
  /**
   * Execute a query against the active cluster
   * 
   * @param {Object} query - The Elasticsearch query to execute
   * @param {Object} options - Query execution options
   * @returns {Promise<Object>} - Query results
   */
  async executeQuery(query, options = {}) {
    if (!this.activeCluster) {
      throw new Error('No active cluster configured');
    }
    
    try {
      // Get client for the active cluster
      const client = await this.clusterManager.getClient(this.activeCluster.id);
      
      // Execute query
      const index = options.index || '*';
      const result = await client.search({
        index,
        body: query
      });
      
      return result;
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    }
  }
  
  /**
   * Get health status of all connected clusters
   * 
   * @returns {Promise<Array>} - Array of cluster health information
   */
  async getClusterHealth() {
    try {
      const clusters = await this.clusterManager.getAllClusters();
      const healthPromises = clusters.map(async (cluster) => {
        try {
          const health = await this.clusterManager.getClusterHealth(cluster.id);
          return {
            id: cluster.id,
            name: cluster.name,
            health
          };
        } catch (error) {
          return {
            id: cluster.id,
            name: cluster.name,
            health: {
              connected: false,
              error: error.message
            }
          };
        }
      });
      
      return Promise.all(healthPromises);
    } catch (error) {
      console.error('Error getting cluster health:', error);
      throw error;
    }
  }
  
  /**
   * Get the last generated queries
   * 
   * @returns {Array} - Array of query results
   */
  getLastGeneratedQueries() {
    return this.lastGeneratedQueries;
  }
  
  /**
   * Clear the last generated queries
   */
  clearLastGeneratedQueries() {
    this.lastGeneratedQueries = [];
  }
}

export default ElasticsearchAgentCore;