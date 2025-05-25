// src/services/QueryLibraryManager.js

/**
 * QueryLibraryManager
 * 
 * Service for managing reference and example queries for Elasticsearch.
 * Provides templates and examples to improve query generation.
 */
class QueryLibraryManager {
  constructor() {
    this.categories = [
      'search',
      'aggregation',
      'time_series',
      'geospatial'
    ];

    // Initialize example queries
    this.exampleQueries = {};
    this.initializeExampleQueries();
  }

  /**
   * Initialize example query templates for different categories
   */
  initializeExampleQueries() {
    // Search query examples
    this.exampleQueries.search = [
      {
        name: 'Basic Match Query',
        description: 'Simple search with a match query',
        naturalLanguage: 'Find documents where message contains "error"',
        query: {
          query: {
            match: {
              message: "error"
            }
          }
        }
      },
      {
        name: 'Boolean Query with Multiple Conditions',
        description: 'Combines multiple conditions with boolean logic',
        naturalLanguage: 'Find documents with status "error" and response code greater than 400 but not from the "maintenance" service',
        query: {
          query: {
            bool: {
              must: [
                { match: { status: "error" } }
              ],
              filter: [
                { range: { response_code: { gt: 400 } } }
              ],
              must_not: [
                { match: { service: "maintenance" } }
              ]
            }
          }
        }
      },
      {
        name: 'Multi-field Search with Phrase Matching',
        description: 'Search across multiple fields with phrase matching',
        naturalLanguage: 'Find documents where title or description contains the phrase "system failure"',
        query: {
          query: {
            multi_match: {
              query: "system failure",
              type: "phrase",
              fields: ["title", "description"]
            }
          }
        }
      },
      {
        name: 'Fuzzy Search',
        description: 'Text search with fuzzy matching for typos',
        naturalLanguage: 'Find documents with messages similar to "authentication"',
        query: {
          query: {
            match: {
              message: {
                query: "authentication",
                fuzziness: "AUTO"
              }
            }
          }
        }
      }
    ];

    // Aggregation query examples
    this.exampleQueries.aggregation = [
      {
        name: 'Terms Aggregation',
        description: 'Group documents by field values and count occurrences',
        naturalLanguage: 'Show count of documents grouped by status',
        query: {
          size: 0,
          aggs: {
            status_counts: {
              terms: {
                field: "status.keyword",
                size: 10
              }
            }
          }
        }
      },
      {
        name: 'Stats Aggregation',
        description: 'Calculate statistics on a numeric field',
        naturalLanguage: 'Get statistics for response time across all documents',
        query: {
          size: 0,
          aggs: {
            response_time_stats: {
              stats: {
                field: "response_time"
              }
            }
          }
        }
      },
      {
        name: 'Nested Aggregations',
        description: 'Combine multiple aggregations in a hierarchy',
        naturalLanguage: 'Group by status and then by service, showing average response time for each combination',
        query: {
          size: 0,
          aggs: {
            status_groups: {
              terms: {
                field: "status.keyword",
                size: 10
              },
              aggs: {
                service_groups: {
                  terms: {
                    field: "service.keyword",
                    size: 10
                  },
                  aggs: {
                    avg_response_time: {
                      avg: {
                        field: "response_time"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      {
        name: 'Range Aggregation',
        description: 'Group documents by ranges of values',
        naturalLanguage: 'Show count of documents by response time ranges: 0-100ms, 100-300ms, 300+ms',
        query: {
          size: 0,
          aggs: {
            response_time_ranges: {
              range: {
                field: "response_time",
                ranges: [
                  { to: 100 },
                  { from: 100, to: 300 },
                  { from: 300 }
                ]
              }
            }
          }
        }
      }
    ];

    // Time series query examples
    this.exampleQueries.time_series = [
      {
        name: 'Date Histogram',
        description: 'Group documents by time intervals',
        naturalLanguage: 'Show count of events per day over the last week',
        query: {
          size: 0,
          query: {
            range: {
              "@timestamp": {
                gte: "now-7d/d",
                lt: "now/d"
              }
            }
          },
          aggs: {
            events_over_time: {
              date_histogram: {
                field: "@timestamp",
                calendar_interval: "day",
                min_doc_count: 0
              }
            }
          }
        }
      },
      {
        name: 'Time Series with Metrics',
        description: 'Track metrics over time intervals',
        naturalLanguage: 'Show average response time by hour for the last day',
        query: {
          size: 0,
          query: {
            range: {
              "@timestamp": {
                gte: "now-1d",
                lt: "now"
              }
            }
          },
          aggs: {
            response_time_over_time: {
              date_histogram: {
                field: "@timestamp",
                calendar_interval: "hour",
                min_doc_count: 0
              },
              aggs: {
                avg_response_time: {
                  avg: {
                    field: "response_time"
                  }
                }
              }
            }
          }
        }
      },
      {
        name: 'Time Series Comparison',
        description: 'Compare metrics across different time periods',
        naturalLanguage: 'Compare error counts by hour for today vs yesterday',
        query: {
          size: 0,
          aggs: {
            events_by_hour: {
              date_histogram: {
                field: "@timestamp",
                calendar_interval: "hour",
                min_doc_count: 0
              },
              aggs: {
                today: {
                  filter: {
                    range: {
                      "@timestamp": {
                        gte: "now/d",
                        lt: "now"
                      }
                    }
                  }
                },
                yesterday: {
                  filter: {
                    range: {
                      "@timestamp": {
                        gte: "now-1d/d",
                        lt: "now/d"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      {
        name: 'Moving Average Trend',
        description: 'Calculate moving averages for smoother trend lines',
        naturalLanguage: 'Show 3-hour moving average of CPU usage over the last day',
        query: {
          size: 0,
          query: {
            range: {
              "@timestamp": {
                gte: "now-1d",
                lt: "now"
              }
            }
          },
          aggs: {
            cpu_usage_by_hour: {
              date_histogram: {
                field: "@timestamp",
                calendar_interval: "hour"
              },
              aggs: {
                avg_cpu: {
                  avg: {
                    field: "system.cpu.total.pct"
                  }
                },
                moving_avg: {
                  moving_avg: {
                    buckets_path: "avg_cpu",
                    window: 3
                  }
                }
              }
            }
          }
        }
      }
    ];

    // Geospatial query examples
    this.exampleQueries.geospatial = [
      {
        name: 'Geo Distance Query',
        description: 'Find documents within a certain distance of a point',
        naturalLanguage: 'Find locations within 10km of New York City',
        query: {
          query: {
            geo_distance: {
              distance: "10km",
              location: {
                lat: 40.7128,
                lon: -74.0060
              }
            }
          }
        }
      },
      {
        name: 'Geo Bounding Box Query',
        description: 'Find documents within a geographic box',
        naturalLanguage: 'Find all events within the Los Angeles area (bounding box)',
        query: {
          query: {
            geo_bounding_box: {
              location: {
                top_left: {
                  lat: 34.3373,
                  lon: -118.5170
                },
                bottom_right: {
                  lat: 33.7036,
                  lon: -118.1553
                }
              }
            }
          }
        }
      },
      {
        name: 'Geo Distance Aggregation',
        description: 'Count documents at various distances from a point',
        naturalLanguage: 'Count users in concentric rings around San Francisco',
        query: {
          size: 0,
          aggs: {
            rings_around_sf: {
              geo_distance: {
                field: "location",
                origin: "37.7749, -122.4194",
                ranges: [
                  { to: 5000 },
                  { from: 5000, to: 10000 },
                  { from: 10000, to: 20000 },
                  { from: 20000 }
                ],
                unit: "m"
              }
            }
          }
        }
      },
      {
        name: 'Geo Hash Grid Aggregation',
        description: 'Create a grid of cells over a geographic area for heatmaps',
        naturalLanguage: 'Show a heatmap of events across Seattle',
        query: {
          size: 0,
          aggs: {
            seattle_grid: {
              geohash_grid: {
                field: "location",
                precision: 5
              }
            }
          }
        }
      }
    ];
  }

  /**
   * Get query examples for a specific category
   * 
   * @param {string} category - The category of queries to retrieve (optional)
   * @returns {Promise<Array>} - Array of example queries
   */
  async getQueryExamples(category = null) {
    try {
      if (category && this.categories.includes(category)) {
        return this.exampleQueries[category] || [];
      } else {
        // Return all examples if no category specified
        const allExamples = [];
        for (const cat of this.categories) {
          if (this.exampleQueries[cat]) {
            allExamples.push(...this.exampleQueries[cat]);
          }
        }
        return allExamples;
      }
    } catch (error) {
      console.error('Error getting query examples:', error);
      return [];
    }
  }

  /**
   * Search for example queries that match keywords
   * 
   * @param {string} searchText - Text to search for in example queries
   * @returns {Promise<Array>} - Array of matching example queries
   */
  async searchExamples(searchText) {
    if (!searchText) return [];
    
    searchText = searchText.toLowerCase();
    const results = [];
    
    for (const category of this.categories) {
      const examples = this.exampleQueries[category] || [];
      
      for (const example of examples) {
        // Search in name, description and natural language form
        if (
          example.name.toLowerCase().includes(searchText) ||
          example.description.toLowerCase().includes(searchText) ||
          example.naturalLanguage.toLowerCase().includes(searchText)
        ) {
          results.push(example);
        }
      }
    }
    
    return results;
  }

  /**
   * Add a new example query to the library
   * 
   * @param {string} category - The category for the query
   * @param {Object} example - The example query object
   * @returns {Promise<boolean>} - Success status
   */
  async addExample(category, example) {
    try {
      if (!this.categories.includes(category)) {
        throw new Error(`Invalid category: ${category}`);
      }
      
      if (!example.name || !example.query) {
        throw new Error('Example must have a name and query');
      }

      // Ensure the examples array exists for this category
      if (!this.exampleQueries[category]) {
        this.exampleQueries[category] = [];
      }
      
      // Add the new example
      this.exampleQueries[category].push(example);
      
      // In a real implementation, this would save to storage
      return true;
    } catch (error) {
      console.error('Error adding example query:', error);
      throw error;
    }
  }

  /**
   * Get example templates that are most relevant to specific intent
   * 
   * @param {Object} intent - The parsed intent object
   * @returns {Promise<Array>} - Array of relevant example queries
   */
  async getRelevantExamplesForIntent(intent) {
    const { queryType, filters = [], aggregations = [], entities = [] } = intent;
    const relevantExamples = [];
    
    // Get examples for the specific query type
    const typeExamples = await this.getQueryExamples(queryType);
    if (typeExamples && typeExamples.length > 0) {
      relevantExamples.push(...typeExamples);
    }
    
    // If we have specific needs, look for more targeted examples
    const searchTerms = [];
    
    // Add search terms based on filters
    if (filters.length > 0) {
      filters.forEach(filter => {
        if (filter.operator === 'contains') searchTerms.push('text search');
        if (filter.operator === 'eq') searchTerms.push('exact match');
        if (filter.operator === 'range' || ['gt', 'lt', 'gte', 'lte'].includes(filter.operator)) {
          searchTerms.push('range');
        }
      });
    }
    
    // Add search terms based on aggregations
    if (aggregations.length > 0) {
      aggregations.forEach(agg => {
        searchTerms.push(agg.type);
      });
    }
    
    // Search for additional examples based on these terms
    if (searchTerms.length > 0) {
      for (const term of searchTerms) {
        const additionalExamples = await this.searchExamples(term);
        if (additionalExamples.length > 0) {
          relevantExamples.push(...additionalExamples);
        }
      }
    }
    
    // Remove duplicates (based on name)
    const uniqueExamples = [];
    const addedNames = new Set();
    
    for (const example of relevantExamples) {
      if (!addedNames.has(example.name)) {
        uniqueExamples.push(example);
        addedNames.add(example.name);
      }
    }
    
    // Limit to max 5 examples
    return uniqueExamples.slice(0, 5);
  }
  
  /**
   * Export all examples as JSON
   * 
   * @returns {string} - JSON string with all examples
   */
  exportExamples() {
    return JSON.stringify(this.exampleQueries, null, 2);
  }
  
  /**
   * Import examples from JSON
   * 
   * @param {string} jsonData - JSON string with examples to import
   * @returns {boolean} - Success status
   */
  importExamples(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      // Validate the imported data
      for (const category in data) {
        if (!this.categories.includes(category)) {
          console.warn(`Skipping unknown category: ${category}`);
          continue;
        }
        
        if (!Array.isArray(data[category])) {
          console.warn(`Skipping invalid category data: ${category}`);
          continue;
        }
        
        // Update or add examples
        this.exampleQueries[category] = data[category];
      }
      
      return true;
    } catch (error) {
      console.error('Error importing examples:', error);
      return false;
    }
  }
}

export { QueryLibraryManager };
