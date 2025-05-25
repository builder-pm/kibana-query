// src/services/QueryLibraryManager.js
/**
 * QueryLibraryManager - Manages reference and example queries for improving Elasticsearch query generation
 */
class QueryLibraryManager {
  constructor() {
    this.referenceQueries = [];
    this.loadMockQueries();
  }

  /**
   * Get reference queries for a specific cluster
   * @param {string} clusterId - Cluster ID
   * @returns {Promise<Array>} - Array of reference queries
   */
  async getQueriesForCluster(clusterId) {
    try {
      // In a real implementation, this would fetch from storage
      // For demo purposes, we're using mock data
      
      // Filter by cluster ID if it's not null
      if (clusterId) {
        return this.referenceQueries.filter(q => !q.clusterId || q.clusterId === clusterId);
      }
      
      return this.referenceQueries;
    } catch (error) {
      console.error('Failed to get reference queries:', error);
      return [];
    }
  }

  /**
   * Add a reference query to the library
   * @param {Object} query - Query object with natural language and DSL
   * @returns {Promise<boolean>} - Success indicator
   */
  async addReferenceQuery(query) {
    try {
      // Validate query
      if (!query.naturalLanguage || !query.dsl) {
        throw new Error('Query must have naturalLanguage and dsl properties');
      }
      
      // Add ID and timestamp if not present
      const enhancedQuery = {
        id: query.id || `query-${Date.now()}`,
        timestamp: query.timestamp || new Date().toISOString(),
        ...query
      };
      
      // In a real implementation, this would store to Chrome storage
      // For demo purposes, we're just adding to memory
      this.referenceQueries.push(enhancedQuery);
      
      return true;
    } catch (error) {
      console.error('Failed to add reference query:', error);
      return false;
    }
  }

  /**
   * Remove a reference query from the library
   * @param {string} queryId - ID of the query to remove
   * @returns {Promise<boolean>} - Success indicator
   */
  async removeReferenceQuery(queryId) {
    try {
      const initialLength = this.referenceQueries.length;
      this.referenceQueries = this.referenceQueries.filter(q => q.id !== queryId);
      
      return this.referenceQueries.length < initialLength;
    } catch (error) {
      console.error('Failed to remove reference query:', error);
      return false;
    }
  }

  /**
   * Load mock queries for demo purposes
   */
  loadMockQueries() {
    this.referenceQueries = [
      {
        id: 'ref-1',
        clusterId: null, // Applicable to all clusters
        timestamp: '2023-06-15T10:30:00Z',
        naturalLanguage: 'Find all documents with elasticsearch in the title from the last 7 days',
        dsl: {
          query: {
            bool: {
              must: [
                { match: { title: 'elasticsearch' } }
              ],
              filter: [
                { range: { timestamp: { gte: 'now-7d/d' } } }
              ]
            }
          }
        },
        tags: ['search', 'basic', 'time-range']
      },
      {
        id: 'ref-2',
        clusterId: null, // Applicable to all clusters
        timestamp: '2023-06-16T14:20:00Z',
        naturalLanguage: 'Show average price by category for products with stock count > 0',
        dsl: {
          size: 0,
          query: {
            range: { inventory: { gt: 0 } }
          },
          aggs: {
            by_category: {
              terms: { field: 'category' },
              aggs: {
                avg_price: { avg: { field: 'price' } }
              }
            }
          }
        },
        tags: ['aggregation', 'statistics', 'categorization']
      },
      {
        id: 'ref-3',
        clusterId: null, // Applicable to all clusters
        timestamp: '2023-06-18T09:15:00Z',
        naturalLanguage: 'Find error logs containing "connection timeout" with surrounding context',
        dsl: {
          query: {
            bool: {
              must: [
                { match: { level: 'ERROR' } },
                { match_phrase: { message: 'connection timeout' } }
              ]
            }
          },
          highlight: {
            fields: {
              message: {
                type: 'unified',
                fragment_size: 150,
                number_of_fragments: 3,
                pre_tags: ['<em>'],
                post_tags: ['</em>']
              }
            }
          }
        },
        tags: ['search', 'logs', 'highlight']
      },
      {
        id: 'ref-4',
        clusterId: null, // Applicable to all clusters
        timestamp: '2023-06-20T16:45:00Z',
        naturalLanguage: 'Find jobs in Seattle or Portland for software engineers with elasticsearch skills',
        dsl: {
          query: {
            bool: {
              must: [
                { match: { requirements: 'elasticsearch' } },
                { match: { title: 'software engineer' } }
              ],
              should: [
                { match: { 'location.city': 'Seattle' } },
                { match: { 'location.city': 'Portland' } }
              ],
              minimum_should_match: 1
            }
          },
          sort: [
            { date_posted: { order: 'desc' } }
          ]
        },
        tags: ['search', 'job', 'location']
      },
      {
        id: 'ref-5',
        clusterId: null, // Applicable to all clusters
        timestamp: '2023-06-22T11:30:00Z',
        naturalLanguage: 'Get daily count of error logs by service for the past week',
        dsl: {
          size: 0,
          query: {
            bool: {
              must: [
                { match: { level: 'ERROR' } }
              ],
              filter: [
                { range: { timestamp: { gte: 'now-7d/d' } } }
              ]
            }
          },
          aggs: {
            daily: {
              date_histogram: {
                field: 'timestamp',
                calendar_interval: 'day'
              },
              aggs: {
                by_service: {
                  terms: {
                    field: 'service',
                    size: 10
                  }
                }
              }
            }
          }
        },
        tags: ['aggregation', 'time-series', 'logs']
      }
    ];
  }
}

// Export a singleton instance
export default new QueryLibraryManager();
