// src/storage/ESConfigManager.js
/**
 * ESConfigManager - Manages Chrome Storage for Elasticsearch cluster configurations
 * This class provides methods to store, retrieve, and manage Elasticsearch cluster configs
 */
class ESConfigManager {
  constructor() {
    // Storage keys
    this.CLUSTERS_KEY = 'es_clusters';
    this.ACTIVE_CLUSTER_KEY = 'es_active_cluster';
    this.QUERY_HISTORY_KEY = 'es_query_history';
  }

  /**
   * Store a cluster configuration
   * @param {Object} clusterConfig - Elasticsearch cluster configuration
   * @returns {Promise<string>} - ID of the stored cluster
   */
  async storeCluster(clusterConfig) {
    try {
      // Generate an ID if not provided
      if (!clusterConfig.id) {
        clusterConfig.id = `${clusterConfig.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      }

      // Get existing clusters
      const clusters = await this.getClusters();
      
      // Add or update cluster
      const existingIndex = clusters.findIndex(c => c.id === clusterConfig.id);
      if (existingIndex >= 0) {
        clusters[existingIndex] = clusterConfig;
      } else {
        clusters.push(clusterConfig);
      }
      
      // Store updated list - use localStorage for our demo
      // In a real extension, we would use chrome.storage.local
      localStorage.setItem(this.CLUSTERS_KEY, JSON.stringify(clusters));
      
      return clusterConfig.id;
    } catch (error) {
      console.error('Failed to store cluster config:', error);
      throw new Error(`Storage error: ${error.message}`);
    }
  }

  /**
   * Get all stored cluster configurations
   * @returns {Promise<Array>} - Array of cluster configurations
   */
  async getClusters() {
    try {
      let clusters = [];
      
      // Get clusters from localStorage
      const clustersJson = localStorage.getItem(this.CLUSTERS_KEY);
      clusters = clustersJson ? JSON.parse(clustersJson) : [];
      
      return clusters;
    } catch (error) {
      console.error('Failed to get clusters:', error);
      return [];
    }
  }

  /**
   * Get a specific cluster configuration by ID
   * @param {string} clusterId - ID of the cluster
   * @returns {Promise<Object|null>} - Cluster configuration or null if not found
   */
  async getClusterById(clusterId) {
    try {
      const clusters = await this.getClusters();
      return clusters.find(c => c.id === clusterId) || null;
    } catch (error) {
      console.error('Failed to get cluster by ID:', error);
      return null;
    }
  }

  /**
   * Delete a cluster configuration
   * @param {string} clusterId - ID of the cluster to delete
   * @returns {Promise<boolean>} - Success indicator
   */
  async deleteCluster(clusterId) {
    try {
      // Get existing clusters
      const clusters = await this.getClusters();
      
      // Filter out the cluster to delete
      const filteredClusters = clusters.filter(c => c.id !== clusterId);
      
      // If no clusters were removed, return false
      if (filteredClusters.length === clusters.length) {
        return false;
      }
      
      // Store updated list to localStorage
      localStorage.setItem(this.CLUSTERS_KEY, JSON.stringify(filteredClusters));
      
      // If this was the active cluster, clear the active cluster
      const activeCluster = await this.getActiveCluster();
      if (activeCluster === clusterId) {
        await this.clearActiveCluster();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to delete cluster:', error);
      return false;
    }
  }

  /**
   * Set the active Elasticsearch cluster
   * @param {string} clusterId - ID of the cluster
   * @returns {Promise<boolean>} - Success indicator
   */
  async setActiveCluster(clusterId) {
    try {
      // Verify the cluster exists before setting it as active
      const cluster = await this.getClusterById(clusterId);
      if (!cluster) {
        return false;
      }
      
      // Set active cluster in localStorage
      localStorage.setItem(this.ACTIVE_CLUSTER_KEY, clusterId);
      
      return true;
    } catch (error) {
      console.error('Failed to set active cluster:', error);
      return false;
    }
  }

  /**
   * Get the active cluster ID
   * @returns {Promise<string|null>} - Active cluster ID or null
   */
  async getActiveCluster() {
    try {
      // Get active cluster from localStorage
      return localStorage.getItem(this.ACTIVE_CLUSTER_KEY);
    } catch (error) {
      console.error('Failed to get active cluster:', error);
      return null;
    }
  }

  /**
   * Clear the active cluster
   * @returns {Promise<boolean>} - Success indicator
   */
  async clearActiveCluster() {
    try {
      // Remove active cluster from localStorage
      localStorage.removeItem(this.ACTIVE_CLUSTER_KEY);
      
      return true;
    } catch (error) {
      console.error('Failed to clear active cluster:', error);
      return false;
    }
  }

  /**
   * Store a query in history
   * @param {string} clusterId - ID of the cluster
   * @param {string} naturalLanguage - Natural language query
   * @param {Object} dsl - Elasticsearch DSL query
   * @returns {Promise<boolean>} - Success indicator
   */
  async storeQueryHistory(clusterId, naturalLanguage, dsl) {
    try {
      // Get existing history
      const history = await this.getQueryHistory();
      
      // Add new entry
      const entry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        clusterId,
        naturalLanguage,
        dsl
      };
      
      // Add to beginning of array (most recent first)
      history.unshift(entry);
      
      // Limit history to 50 entries
      const limitedHistory = history.slice(0, 50);
      
      // Store updated history in localStorage
      localStorage.setItem(this.QUERY_HISTORY_KEY, JSON.stringify(limitedHistory));
      
      return true;
    } catch (error) {
      console.error('Failed to store query history:', error);
      return false;
    }
  }

  /**
   * Get query history
   * @param {string} [clusterId] - Optional cluster ID filter
   * @returns {Promise<Array>} - Query history entries
   */
  async getQueryHistory(clusterId = null) {
    try {
      let history = [];
      
      // Get history from localStorage
      const historyJson = localStorage.getItem(this.QUERY_HISTORY_KEY);
      history = historyJson ? JSON.parse(historyJson) : [];
      
      // Filter by cluster ID if provided
      if (clusterId) {
        history = history.filter(entry => entry.clusterId === clusterId);
      }
      
      return history;
    } catch (error) {
      console.error('Failed to get query history:', error);
      return [];
    }
  }

  /**
   * Clear query history
   * @param {string} [clusterId] - Optional cluster ID to clear history for
   * @returns {Promise<boolean>} - Success indicator
   */
  async clearQueryHistory(clusterId = null) {
    try {
      // If no cluster ID provided, clear all history
      if (!clusterId) {
        localStorage.removeItem(this.QUERY_HISTORY_KEY);
        return true;
      }
      
      // Otherwise, filter out entries for the specified cluster
      const history = await this.getQueryHistory();
      const filteredHistory = history.filter(entry => entry.clusterId !== clusterId);
      
      // Store updated history in localStorage
      localStorage.setItem(this.QUERY_HISTORY_KEY, JSON.stringify(filteredHistory));
      
      return true;
    } catch (error) {
      console.error('Failed to clear query history:', error);
      return false;
    }
  }
}

// Export a singleton instance
export default new ESConfigManager();