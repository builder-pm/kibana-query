// src/services/ESClusterManager.js
class ESClusterManager {
  constructor() {
    this.clusters = new Map();
    this.activeCluster = null;
  }

  /**
   * Add a new Elasticsearch cluster
   * @param {Object} config - Cluster configuration
   * @returns {Promise<string>} - Cluster ID
   */
  async addCluster(config) {
    // Generate cluster ID if not provided
    const clusterId = config.id || `${config.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    config.id = clusterId;

    // Test connection before adding
    try {
      await this.testConnection(config);
      
      // Store configuration
      this.clusters.set(clusterId, config);
      
      // Save to persistent storage
      await this.saveClusters();
      
      return clusterId;
    } catch (error) {
      throw new Error(`Failed to add cluster: ${error.message}`);
    }
  }

  /**
   * Test connection to an Elasticsearch cluster
   * @param {Object} config - Cluster configuration
   * @returns {Promise<Object>} - Connection health information
   */
  async testConnection(config) {
    try {
      // In a real implementation, this would create an actual ES client and test the connection
      // For the demo, we'll simulate a successful connection
      
      // Build headers for authentication
      const headers = {};
      
      if (config.auth) {
        if (config.auth.type === 'basic') {
          const credentials = btoa(`${config.auth.username}:${config.auth.password}`);
          headers.Authorization = `Basic ${credentials}`;
        } else if (config.auth.type === 'apiKey') {
          headers.Authorization = `ApiKey ${config.auth.apiKey}`;
        }
      }
      
      // In a real implementation, this would make an actual API call
      // For demo purposes, we're just returning mock data
      return {
        connected: true,
        version: '7.10.0',
        clusterName: 'elasticsearch',
        nodeCount: 1,
        lastChecked: new Date()
      };
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Get all clusters
   * @returns {Array<Object>} - Array of cluster configurations
   */
  getClusters() {
    return Array.from(this.clusters.values());
  }

  /**
   * Get a cluster by ID
   * @param {string} id - Cluster ID
   * @returns {Object|null} - Cluster configuration
   */
  getClusterById(id) {
    return this.clusters.get(id) || null;
  }

  /**
   * Set the active cluster
   * @param {string} id - Cluster ID
   * @returns {Object|null} - Active cluster configuration
   */
  setActiveCluster(id) {
    if (!this.clusters.has(id)) {
      throw new Error(`Cluster ${id} not found`);
    }
    
    this.activeCluster = id;
    
    // In a real implementation, this would be stored in persistent storage
    localStorage.setItem('activeClusterId', id);
    
    return this.getClusterById(id);
  }

  /**
   * Get the active cluster configuration
   * @returns {Object|null} - Active cluster configuration
   */
  getActiveCluster() {
    if (!this.activeCluster) {
      return null;
    }
    
    return this.getClusterById(this.activeCluster);
  }

  /**
   * Delete a cluster
   * @param {string} id - Cluster ID
   * @returns {Promise<boolean>} - Success indicator
   */
  async deleteCluster(id) {
    if (!this.clusters.has(id)) {
      return false;
    }
    
    // Remove from memory
    this.clusters.delete(id);
    
    // If active cluster was deleted, clear active cluster
    if (this.activeCluster === id) {
      this.activeCluster = null;
      localStorage.removeItem('activeClusterId');
    }
    
    // Save to persistent storage
    await this.saveClusters();
    
    return true;
  }

  /**
   * Save clusters to persistent storage
   * @returns {Promise<void>}
   */
  async saveClusters() {
    // Convert Map to Array for storage
    const clustersArray = Array.from(this.clusters.values());
    
    // In a real extension, this would use chrome.storage.local
    localStorage.setItem('esClusters', JSON.stringify(clustersArray));
    
    return Promise.resolve();
  }

  /**
   * Load clusters from persistent storage
   * @returns {Promise<void>}
   */
  async loadClusters() {
    try {
      // In a real extension, this would use chrome.storage.local
      const clustersStr = localStorage.getItem('esClusters');
      
      if (clustersStr) {
        const clustersArray = JSON.parse(clustersStr);
        
        // Reset the clusters map
        this.clusters.clear();
        
        // Load each cluster into the map
        clustersArray.forEach(cluster => {
          this.clusters.set(cluster.id, cluster);
        });
      }
      
      // Load active cluster
      const activeClusterId = localStorage.getItem('activeClusterId');
      if (activeClusterId && this.clusters.has(activeClusterId)) {
        this.activeCluster = activeClusterId;
      }
      
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to load clusters:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Create an Elasticsearch client for a cluster
   * @param {string} clusterId - Cluster ID
   * @returns {Object} - Elasticsearch client
   */
  createClient(clusterId) {
    const cluster = this.getClusterById(clusterId);
    
    if (!cluster) {
      throw new Error(`Cluster ${clusterId} not found`);
    }
    
    // In a real implementation, this would create an actual ES client
    // For demo purposes, we'll just return a mock client with basic methods
    return {
      ping: async () => ({ statusCode: 200 }),
      info: async () => ({
        name: 'mock-node',
        cluster_name: cluster.name,
        version: {
          number: '7.10.0'
        }
      }),
      search: async (params) => {
        // Mock search response
        return {
          took: 30,
          timed_out: false,
          _shards: {
            total: 5,
            successful: 5,
            failed: 0
          },
          hits: {
            total: {
              value: 10,
              relation: 'eq'
            },
            max_score: 1.0,
            hits: []
          }
        };
      }
    };
  }
}

// Export a singleton instance
export default new ESClusterManager();
