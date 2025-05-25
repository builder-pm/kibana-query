import { ESConfigManager } from './ESConfigManager';
import { ESClusterConfig, ESAuthDetails, ClusterHealth } from './types';

export class ESConnectionManager {
  private readonly STORAGE_KEY_CLUSTERS = 'esClusters';
  private readonly STORAGE_KEY_ACTIVE_CLUSTER_ID = 'esActiveClusterId';

  constructor(private esConfigManager: ESConfigManager) {
    if (!esConfigManager) {
        throw new Error("ESConfigManager is required for ESConnectionManager.");
    }
    console.log("ESConnectionManager initialized.");
  }

  // ---- Cluster CRUD Methods ----
  async getClusters(): Promise<ESClusterConfig[]> {
    const clusters = await this.esConfigManager.loadData(this.STORAGE_KEY_CLUSTERS);
    return (clusters || []) as ESClusterConfig[];
  }

  async saveClusters(clusters: ESClusterConfig[]): Promise<void> {
    await this.esConfigManager.saveData(this.STORAGE_KEY_CLUSTERS, clusters);
  }

  async addCluster(config: Omit<ESClusterConfig, 'id' | 'createdAt'>): Promise<ESClusterConfig> {
    const newCluster: ESClusterConfig = {
      ...config,
      // Generate a more robust unique ID
      id: `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`, 
      createdAt: new Date().toISOString(),
    };
    const clusters = await this.getClusters();
    clusters.push(newCluster);
    await this.saveClusters(clusters);
    console.log(`Cluster added: ${newCluster.name} (ID: ${newCluster.id})`);
    return newCluster;
  }

  async removeCluster(clusterId: string): Promise<void> {
    let clusters = await this.getClusters();
    const initialLength = clusters.length;
    clusters = clusters.filter(c => c.id !== clusterId);
    if (clusters.length < initialLength) {
        await this.saveClusters(clusters);
        console.log(`Cluster removed: ID ${clusterId}`);
        const activeId = await this.getActiveClusterId();
        if (activeId === clusterId) {
            await this.setActiveClusterId(null); // Clears the active ID if it was the one removed
            console.log(`Active cluster (ID: ${clusterId}) was removed, active cluster set to null.`);
        }
    } else {
        console.warn(`Cluster with ID ${clusterId} not found for removal.`);
    }
  }

  async updateCluster(clusterId: string, updatedConfigPartial: Partial<Omit<ESClusterConfig, 'id' | 'createdAt'>>): Promise<ESClusterConfig | null> {
    const clusters = await this.getClusters();
    const clusterIndex = clusters.findIndex(c => c.id === clusterId);
    
    if (clusterIndex === -1) {
      console.warn(`Cluster with ID ${clusterId} not found for update.`);
      return null;
    }
    
    // Preserve 'id' and 'createdAt' from the original object
    const originalCluster = clusters[clusterIndex];
    const updatedCluster: ESClusterConfig = {
      ...originalCluster, // Start with original values
      ...updatedConfigPartial, // Override with partial updates
      id: originalCluster.id, // Explicitly keep original id
      createdAt: originalCluster.createdAt, // Explicitly keep original createdAt
    };

    clusters[clusterIndex] = updatedCluster;
    await this.saveClusters(clusters);
    console.log(`Cluster updated: ${updatedCluster.name} (ID: ${updatedCluster.id})`);
    return updatedCluster;
  }

  async getCluster(clusterId: string): Promise<ESClusterConfig | undefined> {
    const clusters = await this.getClusters();
    return clusters.find(c => c.id === clusterId);
  }

  // ---- Active Cluster Management ----
  async setActiveClusterId(clusterId: string | null): Promise<void> {
    await this.esConfigManager.saveData(this.STORAGE_KEY_ACTIVE_CLUSTER_ID, clusterId);
    console.log(`Active cluster ID set to: ${clusterId}`);
  }

  async getActiveClusterId(): Promise<string | null> {
    const activeId = await this.esConfigManager.loadData(this.STORAGE_KEY_ACTIVE_CLUSTER_ID);
    return activeId as string | null; // Assuming loadData returns the value or null
  }

  async getActiveCluster(): Promise<ESClusterConfig | undefined> {
    const activeId = await this.getActiveClusterId();
    if (!activeId) {
      return undefined;
    }
    return this.getCluster(activeId);
  }

  // ---- Test Connection Method ----
  async testConnection(config: ESClusterConfig): Promise<ClusterHealth> {
    const baseUrl = `${config.protocol}://${config.host}:${config.port}/`;
    const requestOptions: RequestInit = {
      method: 'GET',
      headers: new Headers({ // Using Headers class for better type safety and methods
        'Content-Type': 'application/json',
        'kbn-xsrf': 'true', // Common header for ES/Kibana, helps with some setups
      }),
      mode: 'cors', 
    };

    if (config.auth) {
      if (config.auth.type === 'basic' && config.auth.username && config.auth.password) {
        (requestOptions.headers as Headers).set('Authorization', 'Basic ' + btoa(`${config.auth.username}:${config.auth.password}`));
      } else if (config.auth.type === 'apiKey' && config.auth.apiKey) {
        if (config.auth.apiKeyId) { // Elasticsearch "API Key" format
          (requestOptions.headers as Headers).set('Authorization', 'ApiKey ' + btoa(`${config.auth.apiKeyId}:${config.auth.apiKey}`));
        } else { // Bearer token or other simple API key format
          (requestOptions.headers as Headers).set('Authorization', `Bearer ${config.auth.apiKey}`);
        }
      }
    }
    
    console.log(`Testing connection to ${baseUrl} with auth type: ${config.auth?.type || 'none'}`);

    try {
      if (typeof fetch === 'undefined') {
        console.error("Fetch API is not available. Cannot test connection.");
        return { status: 'error', message: 'Fetch API not available in this environment.' };
      }

      const response = await fetch(baseUrl, requestOptions);
      
      if (response.ok) { // status in the range 200-299
        const data = await response.json();
        const esVersion = data?.version?.number;
        console.log("Connection test successful. ES Version:", esVersion, "Full response:", data);
        return { status: 'connected', esVersion: esVersion, message: `Successfully connected. Elasticsearch version: ${esVersion || 'N/A'}` };
      } else {
        let errorBodyText = "Could not retrieve error body.";
        try {
            errorBodyText = await response.text();
        } catch(parseError) {
            console.warn("Could not parse error body as text:", parseError);
        }
        console.warn(`Connection test failed: ${response.status} ${response.statusText}. Body: ${errorBodyText}`);
        return { status: 'error', message: `Connection failed: ${response.status} ${response.statusText}. Details: ${errorBodyText}` };
      }
    } catch (e: any) {
      console.error("Connection test network error:", e);
      return { status: 'error', message: `Network error: ${e.message || 'Unknown fetch error'}` };
    }
  }
}
