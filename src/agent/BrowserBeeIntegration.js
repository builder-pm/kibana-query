// src/agent/BrowserBeeIntegration.js

import { ElasticsearchAgentCore } from '../../browserbee-main/src/agent/elasticsearch/ElasticsearchAgentCore';

/**
 * Integration layer between the main Elasticsearch Query Helper and BrowserBee
 * This provides a bridge to use BrowserBee's agent system while maintaining
 * the existing React UI components.
 */
class BrowserBeeIntegration {
  constructor() {
    this.elasticsearchAgent = null;
    this.initialized = false;
  }

  /**
   * Initialize the BrowserBee Elasticsearch agent
   */
  async initialize(config = {}) {
    try {
      // In a real Chrome extension, we would get the page context
      // For now, we'll create a mock page context
      const mockPage = {
        url: () => 'chrome-extension://mock',
        goto: async (url) => console.log('Navigate to:', url),
        evaluate: async (fn) => fn(),
        waitForSelector: async (selector) => ({ click: () => {} })
      };

      const llmConfig = {
        provider: 'openai',
        apiKey: config.apiKey || '',
        model: config.model || 'gpt-4',
        ...config.llmConfig
      };

      // Initialize the BrowserBee Elasticsearch agent
      this.elasticsearchAgent = new ElasticsearchAgentCore(mockPage, llmConfig);
      this.initialized = true;

      console.log('BrowserBee Elasticsearch Agent initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize BrowserBee agent:', error);
      return false;
    }
  }

  /**
   * Generate query using BrowserBee's agent system
   */
  async generateQuery(userInput, clusterId, context = {}) {
    if (!this.initialized || !this.elasticsearchAgent) {
      throw new Error('BrowserBee agent not initialized');
    }

    try {
      // Set the active cluster
      if (clusterId) {
        await this.elasticsearchAgent.setActiveCluster(clusterId);
      }

      // Generate query using BrowserBee agent
      const result = await this.elasticsearchAgent.generateQuery(userInput, context);
      
      return {
        success: true,
        queries: Array.isArray(result) ? result : [result],
        agentHistory: this.elasticsearchAgent.getQueryHistory().slice(-5) // Last 5 queries
      };
    } catch (error) {
      console.error('Error generating query with BrowserBee:', error);
      return {
        success: false,
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Execute query using BrowserBee's agent system
   */
  async executeQuery(query, clusterId) {
    if (!this.initialized || !this.elasticsearchAgent) {
      throw new Error('BrowserBee agent not initialized');
    }

    try {
      if (clusterId) {
        await this.elasticsearchAgent.setActiveCluster(clusterId);
      }

      const result = await this.elasticsearchAgent.executeQuery(query);
      return {
        success: true,
        result
      };
    } catch (error) {
      console.error('Error executing query with BrowserBee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate query using BrowserBee's agent system
   */
  async validateQuery(query) {
    if (!this.initialized || !this.elasticsearchAgent) {
      throw new Error('BrowserBee agent not initialized');
    }

    try {
      const validation = await this.elasticsearchAgent.validateQuery(query);
      return validation;
    } catch (error) {
      console.error('Error validating query with BrowserBee:', error);
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Get schema information using BrowserBee's agent system
   */
  async getSchemaInfo(clusterId, indexPattern = '*') {
    if (!this.initialized || !this.elasticsearchAgent) {
      throw new Error('BrowserBee agent not initialized');
    }

    try {
      if (clusterId) {
        await this.elasticsearchAgent.setActiveCluster(clusterId);
      }

      const schema = await this.elasticsearchAgent.getSchemaInfo(indexPattern);
      return {
        success: true,
        schema
      };
    } catch (error) {
      console.error('Error getting schema with BrowserBee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get query history from BrowserBee agent
   */
  getQueryHistory() {
    if (!this.initialized || !this.elasticsearchAgent) {
      return [];
    }

    return this.elasticsearchAgent.getQueryHistory();
  }

  /**
   * Clear query history
   */
  clearQueryHistory() {
    if (this.initialized && this.elasticsearchAgent) {
      this.elasticsearchAgent.clearQueryHistory();
    }
  }

  /**
   * Check if BrowserBee integration is available and initialized
   */
  isAvailable() {
    return this.initialized && this.elasticsearchAgent !== null;
  }
}

// Create a singleton instance
const browserBeeIntegration = new BrowserBeeIntegration();

export default browserBeeIntegration;
