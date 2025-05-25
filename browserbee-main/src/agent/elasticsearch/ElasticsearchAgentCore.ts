// src/agent/elasticsearch/ElasticsearchAgentCore.ts

import { BrowserAgent } from '../AgentCore';
import { Page } from 'playwright-crx';
import { ProviderConfig } from '../../background/configManager';
import { LLMProvider } from '../../models/providers/types';
import { ESToolManager } from './ESToolManager';
import { ESPromptManager } from './ESPromptManager';

/**
 * ElasticsearchAgentCore extends BrowserAgent to provide Elasticsearch-specific functionality
 * 
 * This agent core integrates with BrowserBee's architecture while adding specialized
 * tools and capabilities for Elasticsearch query generation and management.
 */
export class ElasticsearchAgentCore extends BrowserAgent {
  private esToolManager: ESToolManager;
  private esPromptManager: ESPromptManager;
  private activeCluster: string | null = null;
  private queryHistory: Array<{
    id: string;
    query: object;
    timestamp: Date;
    success: boolean;
    results?: any;
    error?: string;
  }> = [];

  constructor(page: Page, config: ProviderConfig, provider?: LLMProvider) {
    super(page, config, provider);
    
    // Initialize Elasticsearch-specific managers
    this.esToolManager = new ESToolManager();
    this.esPromptManager = new ESPromptManager();
    
    console.log('ElasticsearchAgentCore initialized');
  }

  /**
   * Set the active Elasticsearch cluster for this agent
   */
  async setActiveCluster(clusterId: string): Promise<void> {
    this.activeCluster = clusterId;
    await this.esToolManager.setActiveCluster(clusterId);
    console.log(`Active cluster set to: ${clusterId}`);
  }

  /**
   * Generate Elasticsearch query from natural language input
   */
  async generateQuery(input: string, context?: any): Promise<any> {
    if (!this.activeCluster) {
      throw new Error('No active Elasticsearch cluster set');
    }

    try {
      // Use the ES prompt manager to create specialized prompts
      const prompt = await this.esPromptManager.createQueryGenerationPrompt(input, context);
      
      // Execute using the parent agent's execution engine
      const result = await this.execute(prompt);
      
      // Parse and validate the result
      const parsedQuery = await this.esToolManager.parseAndValidateQuery(result);
      
      // Add to query history
      this.addToQueryHistory(parsedQuery, true);
      
      return parsedQuery;
    } catch (error) {
      console.error('Error generating query:', error);
      this.addToQueryHistory(null, false, error.message);
      throw error;
    }
  }

  /**
   * Execute an Elasticsearch query against the active cluster
   */
  async executeQuery(query: object): Promise<any> {
    if (!this.activeCluster) {
      throw new Error('No active Elasticsearch cluster set');
    }

    try {
      const result = await this.esToolManager.executeQuery(query);
      this.addToQueryHistory(query, true, result);
      return result;
    } catch (error) {
      console.error('Error executing query:', error);
      this.addToQueryHistory(query, false, error.message);
      throw error;
    }
  }

  /**
   * Get query history
   */
  getQueryHistory(): Array<any> {
    return [...this.queryHistory];
  }

  /**
   * Clear query history
   */
  clearQueryHistory(): void {
    this.queryHistory = [];
  }

  /**
   * Get schema information for the active cluster
   */
  async getSchemaInfo(indexPattern?: string): Promise<any> {
    if (!this.activeCluster) {
      throw new Error('No active Elasticsearch cluster set');
    }

    return await this.esToolManager.getSchemaInfo(indexPattern);
  }

  /**
   * Validate an Elasticsearch query
   */
  async validateQuery(query: object): Promise<{ valid: boolean; errors?: string[] }> {
    return await this.esToolManager.validateQuery(query);
  }

  /**
   * Add entry to query history
   */
  private addToQueryHistory(query: object | null, success: boolean, resultOrError?: any): void {
    this.queryHistory.push({
      id: `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query: query || {},
      timestamp: new Date(),
      success,
      ...(success ? { results: resultOrError } : { error: resultOrError })
    });

    // Keep only last 100 queries
    if (this.queryHistory.length > 100) {
      this.queryHistory = this.queryHistory.slice(-100);
    }
  }
}