// src/services/ESClusterManager.js

/**
 * ESClusterManager
 * 
 * Service for managing Elasticsearch cluster connections, health checking, and client creation.
 * Provides functionality to add, remove, and connect to Elasticsearch clusters.
 */
import { ESConfigManager } from '../storage/ESConfigManager';

class ESClusterManager {
  constructor() {
    this.clusters = new Map(); // Map of cluster ID to config
    this.clients = new Map();  // Map of cluster ID to client instance
    this.healthChecks = new Map(); // Map of cluster ID to health info
    this.activeCluster = null;
    this.configManager = new ESConfigManager();
    this.initialized = false;
  }

  /**
   * Initialize the cluster manager by loading stored clusters
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Load stored clusters
      const clusters = await this.configManager.getAllClusters();
      clusters.forEach(cluster => {
        this.clusters.set(cluster.id, cluster);
      });
      
      // Get active cluster
      const activeCluster = await this.configManager.getActiveCluster();
      if (activeCluster) {
        this.activeCluster = activeCluster;
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize cluster manager:', error);
      throw error;
    }
  }

  /**
   * Add a new Elasticsearch cluster configuration
   * 
   * @param {Object} config - The cluster configuration
   * @returns {Promise<string>} - The cluster ID
   */
  async addCluster(config) {
    if (!this.initialized) await this.initialize();
    
    // Ensure cluster has an ID
    if (!config.id) {
      config.id = this.generateClusterId(config);
    }

    // Validate configuration
    this.validateConfig(config);
    
    // Test connection before adding
    try {
      const health = await this.testConnection(config);
      
      if (!health.connected) {
        throw new Error(`Failed to connect to cluster: ${health.error}`);
      }
      
      // Store health info
      this.healthChecks.set(config.id, health);
      
      // Add cluster to memory and storage
      this.clusters.set(config.id, config);
      await this.configManager.saveCluster(config);
      
      // If it's the only cluster, make it active
      if (this.clusters.size === 1) {
        await this.setActiveCluster(config.id);
      }
      
      return config.id;
    } catch (error) {
      console.error('Failed to add cluster:', error);
      throw error;
    }
  }

  /**
   * Update an existing Elasticsearch cluster configuration
   * 
   * @param {string} clusterId - The cluster ID to update
   * @param {Object} config - The updated cluster configuration
   * @returns {Promise<boolean>} - Success status
   */
  async updateCluster(clusterId, config) {
    if (!this.initialized) await this.initialize();
    
    if (!this.clusters.has(clusterId)) {
      throw new Error(`Cluster ${clusterId} not found`);
    }
    
    // Validate configuration
    this.validateConfig(config);
    
    // Preserve ID
    config.id = clusterId;
    
    // Store updated config
    this.clusters.set(clusterId, config);
    await this.configManager.saveCluster(config);
    
    // Invalidate client cache
    if (this.clients.has(clusterId)) {
      this.clients.delete(clusterId);
    }
    
    return true;
  }

  /**
   * Remove an Elasticsearch cluster configuration
   * 
   * @param {string} clusterId - The cluster ID to remove
   * @returns {Promise<boolean>} - Success status
   */
  async removeCluster(clusterId) {
    if (!this.initialized) await this.initialize();
    
    if (!this.clusters.has(clusterId)) {
      return false;
    }
    
    // Remove from memory
    this.clusters.delete(clusterId);
    this.clients.delete(clusterId);
    this.healthChecks.delete(clusterId);
    
    // Remove from storage
    await this.configManager.removeCluster(clusterId);
    
    // If active cluster was removed, set a new one if available
    if (this.activeCluster === clusterId) {
      this.activeCluster = null;
      
      // Set first available cluster as active if any exist
      if (this.clusters.size > 0) {
        const firstCluster = Array.from(this.clusters.keys())[0];
        await this.setActiveCluster(firstCluster);
      } else {
        await this.configManager.setActiveCluster(null);
      }
    }
    
    return true;
  }

  /**
   * Get all configured clusters
   * 
   * @returns {Promise<Array>} - Array of cluster configurations
   */
  async getAllClusters() {
    if (!this.initialized) await this.initialize();
    return Array.from(this.clusters.values());
  }

  /**
   * Get a specific cluster configuration by ID
   * 
   * @param {string} clusterId - The cluster ID
   * @returns {Promise<Object|null>} - The cluster configuration or null if not found
   */
  async getClusterInfo(clusterId) {
    if (!this.initialized) await this.initialize();
    return this.clusters.get(clusterId) || null;
  }

  /**
   * Get currently active cluster configuration
   * 
   * @returns {Promise<Object|null>} - The active cluster configuration or null
   */
  async getActiveCluster() {
    if (!this.initialized) await this.initialize();
    
    if (!this.activeCluster) {
      return null;
    }
    
    return this.clusters.get(this.activeCluster) || null;
  }

  /**
   * Set a cluster as the active cluster
   * 
   * @param {string} clusterId - The cluster ID to set as active
   * @returns {Promise<boolean>} - Success status
   */
  async setActiveCluster(clusterId) {
    if (!this.initialized) await this.initialize();
    
    if (clusterId && !this.clusters.has(clusterId)) {
      throw new Error(`Cluster ${clusterId} not found`);
    }
    
    this.activeCluster = clusterId;
    await this.configManager.setActiveCluster(clusterId);
    return true;
  }

  /**
   * Test connection to an Elasticsearch cluster
   * 
   * @param {Object} config - The cluster configuration to test
   * @returns {Promise<Object>} - Connection health information
   */
  async testConnection(config) {
    try {
      // For demo purposes, simulate a successful connection
      // In a real implementation, use the elasticsearch client
      
      return {
        connected: true,
        version: '7.10.2',
        clusterName: config.name || 'elasticsearch',
        nodeCount: 1,
        status: 'green',
        lastChecked: new Date(),
        error: null
      };
    } catch (error) {
      return {
        connected: false,
        version: null,
        clusterName: null,
        nodeCount: null,
        status: null,
        lastChecked: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Get health status for a cluster
   * 
   * @param {string} clusterId - The cluster ID
   * @returns {Promise<Object>} - Health information
   */
  async getClusterHealth(clusterId) {
    if (!this.initialized) await this.initialize();
    
    const config = this.clusters.get(clusterId);
    if (!config) {
      throw new Error(`Cluster ${clusterId} not found`);
    }
    
    try {
      const health = await this.testConnection(config);
      
      // Update stored health info
      this.healthChecks.set(clusterId, health);
      
      return health;
    } catch (error) {
      console.error(`Error checking health for cluster ${clusterId}:`, error);
      
      // Return last known health if available
      if (this.healthChecks.has(clusterId)) {
        return this.healthChecks.get(clusterId);
      }
      
      return {
        connected: false,
        version: null,
        clusterName: config.name,
        nodeCount: null,
        status: 'red',
        lastChecked: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Get a client instance for a specific cluster
   * 
   * @param {string} clusterId - The cluster ID
   * @returns {Promise<Object>} - The Elasticsearch client
   */
  async getClient(clusterId) {
    if (!this.initialized) await this.initialize();
    
    // Check if we already have a client for this cluster
    if (this.clients.has(clusterId)) {
      return this.clients.get(clusterId);
    }
    
    const config = this.clusters.get(clusterId);
    if (!config) {
      throw new Error(`Cluster ${clusterId} not found`);
    }
    
    // Create a new mock client
    // In a real implementation, create an actual Elasticsearch client
    const client = this.createMockClient(config);
    
    // Cache the client
    this.clients.set(clusterId, client);
    
    return client;
  }

  /**
   * Create a mock Elasticsearch client (for demonstration purposes)
   * 
   * @param {Object} config - The cluster configuration
   * @returns {Object} - Mock Elasticsearch client
   */
  createMockClient(config) {
    // This is a simplified mock client for demonstration
    // In a real implementation, use an actual Elasticsearch client
    return {
      info: async () => ({
        name: 'mock-node',
        cluster_name: config.name || 'elasticsearch',
        cluster_uuid: 'mock-uuid',
        version: {
          number: '7.10.2',
          build_type: 'mock'
        },
        tagline: 'You Know, for Search'
      }),
      
      ping: async () => true,
      
      search: async (params) => {
        return {
          took: 1,
          timed_out: false,
          _shards: {
            total: 1,
            successful: 1,
            failed: 0
          },
          hits: {
            total: { value: 0, relation: 'eq' },
            max_score: null,
            hits: []
          }
        };
      },
      
      indices: {
        get: async (params) => {
          return {
            'mock-index': {
              aliases: {},
              mappings: {
                properties: {
                  title: { type: 'text' },
                  content: { type: 'text' },
                  date: { type: 'date' },
                  tags: { type: 'keyword' }
                }
              },
              settings: {
                index: {
                  number_of_shards: '1',
                  number_of_replicas: '1'
                }
              }
            }
          };
        }
      }
    };
  }

  /**
   * Validate cluster configuration
   * 
   * @param {Object} config - The cluster configuration to validate
   * @throws {Error} - If configuration is invalid
   */
  validateConfig(config) {
    if (!config) {
      throw new Error('Cluster configuration is required');
    }
    
    if (!config.name) {
      throw new Error('Cluster name is required');
    }
    
    if (!config.host) {
      throw new Error('Cluster host is required');
    }
    
    if (!config.port) {
      throw new Error('Cluster port is required');
    }
    
    if (!config.protocol) {
      config.protocol = 'http'; // Default to http
    }
    
    if (config.protocol !== 'http' && config.protocol !== 'https') {
      throw new Error('Protocol must be "http" or "https"');
    }
  }

  /**
   * Generate a unique ID for a cluster
   * 
   * @param {Object} config - The cluster configuration
   * @returns {string} - The generated cluster ID
   */
  generateClusterId(config) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `es_${config.name.toLowerCase().replace(/\W+/g, '_')}_${timestamp}_${random}`;
  }
}

export default ESClusterManager;