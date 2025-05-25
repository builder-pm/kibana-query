// src/storage/ESConfigManager.js

/**
 * ESConfigManager
 * 
 * Manages Elasticsearch cluster configurations by storing and retrieving them
 * from localStorage for demo purposes. In a production extension, this would
 * use Chrome Storage or similar persistent storage mechanism.
 */
class ESConfigManager {
  constructor() {
    this.storagePrefix = 'es_query_helper_';
    this.clusterKey = `${this.storagePrefix}clusters`;
    this.activeClusterKey = `${this.storagePrefix}active_cluster`;
  }

  /**
   * Save a cluster configuration
   * 
   * @param {Object} cluster - The cluster configuration to save
   * @returns {Promise<boolean>} - Success status
   */
  async saveCluster(cluster) {
    if (!cluster || !cluster.id) {
      throw new Error('Invalid cluster configuration');
    }
    
    try {
      // Get existing clusters
      const clusters = await this.getAllClusters();
      
      // Update or add the cluster
      const existingIndex = clusters.findIndex(c => c.id === cluster.id);
      if (existingIndex >= 0) {
        clusters[existingIndex] = cluster;
      } else {
        clusters.push(cluster);
      }
      
      // Save to localStorage
      localStorage.setItem(this.clusterKey, JSON.stringify(clusters));
      return true;
    } catch (error) {
      console.error('Error saving cluster:', error);
      throw error;
    }
  }

  /**
   * Get a single cluster by ID
   * 
   * @param {string} clusterId - The ID of the cluster to retrieve
   * @returns {Promise<Object|null>} - The cluster configuration or null if not found
   */
  async getCluster(clusterId) {
    try {
      const clusters = await this.getAllClusters();
      return clusters.find(cluster => cluster.id === clusterId) || null;
    } catch (error) {
      console.error('Error getting cluster:', error);
      throw error;
    }
  }

  /**
   * Get all stored cluster configurations
   * 
   * @returns {Promise<Array>} - Array of cluster configurations
   */
  async getAllClusters() {
    try {
      const clustersJson = localStorage.getItem(this.clusterKey);
      return clustersJson ? JSON.parse(clustersJson) : [];
    } catch (error) {
      console.error('Error getting all clusters:', error);
      return [];
    }
  }

  /**
   * Remove a cluster configuration
   * 
   * @param {string} clusterId - The ID of the cluster to remove
   * @returns {Promise<boolean>} - Success status
   */
  async removeCluster(clusterId) {
    try {
      const clusters = await this.getAllClusters();
      const updatedClusters = clusters.filter(cluster => cluster.id !== clusterId);
      
      localStorage.setItem(this.clusterKey, JSON.stringify(updatedClusters));
      
      // If this was the active cluster, clear it
      const activeCluster = await this.getActiveCluster();
      if (activeCluster && activeCluster === clusterId) {
        await this.setActiveCluster(null);
      }
      
      return true;
    } catch (error) {
      console.error('Error removing cluster:', error);
      throw error;
    }
  }

  /**
   * Set the active cluster
   * 
   * @param {string|null} clusterId - The ID of the cluster to set as active, or null to clear
   * @returns {Promise<boolean>} - Success status
   */
  async setActiveCluster(clusterId) {
    try {
      if (clusterId) {
        // Verify cluster exists before setting as active
        const exists = await this.getCluster(clusterId);
        if (!exists) {
          throw new Error(`Cluster ${clusterId} not found`);
        }
      }
      
      localStorage.setItem(this.activeClusterKey, clusterId || '');
      return true;
    } catch (error) {
      console.error('Error setting active cluster:', error);
      throw error;
    }
  }

  /**
   * Get the active cluster ID
   * 
   * @returns {Promise<string|null>} - Active cluster ID or null if none set
   */
  async getActiveCluster() {
    try {
      const clusterId = localStorage.getItem(this.activeClusterKey);
      
      if (!clusterId) {
        return null;
      }
      
      // Verify the cluster still exists
      const cluster = await this.getCluster(clusterId);
      return cluster ? clusterId : null;
    } catch (error) {
      console.error('Error getting active cluster:', error);
      return null;
    }
  }

  /**
   * Clear all stored cluster configurations
   * 
   * @returns {Promise<boolean>} - Success status
   */
  async clearAllClusters() {
    try {
      localStorage.removeItem(this.clusterKey);
      localStorage.removeItem(this.activeClusterKey);
      return true;
    } catch (error) {
      console.error('Error clearing all clusters:', error);
      throw error;
    }
  }
  
  /**
   * Import cluster configurations from JSON
   * 
   * @param {string} json - JSON string containing cluster configurations
   * @returns {Promise<boolean>} - Success status
   */
  async importFromJson(json) {
    try {
      const data = JSON.parse(json);
      
      if (!data || !Array.isArray(data.clusters)) {
        throw new Error('Invalid import format');
      }
      
      // Save all clusters
      for (const cluster of data.clusters) {
        if (cluster && cluster.id) {
          await this.saveCluster(cluster);
        }
      }
      
      // Set active cluster if specified
      if (data.activeCluster) {
        await this.setActiveCluster(data.activeCluster);
      }
      
      return true;
    } catch (error) {
      console.error('Error importing clusters:', error);
      throw error;
    }
  }
  
  /**
   * Export cluster configurations to JSON
   * 
   * @returns {Promise<string>} - JSON string containing cluster configurations
   */
  async exportToJson() {
    try {
      const clusters = await this.getAllClusters();
      const activeCluster = await this.getActiveCluster();
      
      const data = {
        clusters,
        activeCluster
      };
      
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Error exporting clusters:', error);
      throw error;
    }
  }
}

export { ESConfigManager };
