import { ESConfigManager } from './ESConfigManager';

// Define interfaces for query structure
export interface ExampleQuery {
  id: string; // Renamed from 'name' for clarity, maps to 'id' in JSON
  description: string;
  naturalLanguageQuery: string; // Maps to 'userIntent' in JSON
  query: object; // This is the Elasticsearch query object
  tags?: string[];
  complexity?: string;
  successRate?: number;
}

export type ExampleQueryCategory = string;

// Default sample queries, loaded from sample-queries.json structure
const defaultExampleQueriesData: { sampleQueries: ExampleQuery[] } = {
  sampleQueries: [
    {
      id: 'basic_source_search',
      description: 'Find jobs from specific job board with recent crawl date',
      naturalLanguageQuery: 'source-based filtering with time constraint',
      query: {
        query: {
          bool: {
            must: [
              { 'match': { 'source_name.keyword': 'Indeed_US' } },
              { 'term': { 'is_deleted.keyword': '0' } },
            ],
            filter: [
              { 'range': { 'crawled_date': { 'gte': 'now-7d/d', 'lte': 'now' } } },
            ],
          },
        },
        size: 50,
      },
      tags: ['source_filter', 'date_range', 'basic_search'],
      complexity: 'simple',
      successRate: 95,
    },
    {
      id: 'geo_proximity_search',
      description: 'Find jobs within 50km of Frankfurt',
      naturalLanguageQuery: 'location-based proximity search',
      query: {
        query: {
          bool: {
            must: [
              { 'term': { 'is_deleted.keyword': '0' } },
              { 'term': { 'is_duplicate': false } },
            ],
            filter: [
              {
                geo_distance: {
                  distance: '50km',
                  standardized_geo_point: {
                    lat: 50.1109,
                    lon: 8.6821,
                  },
                },
              },
              { 'range': { 'crawled_date': { 'gte': 'now-30d/d' } } },
            ],
          },
        },
      },
      tags: ['geo_search', 'location', 'proximity'],
      complexity: 'medium',
      successRate: 88,
    },
    {
      id: 'skills_match_search',
      description: 'Find software engineering jobs requiring Python and machine learning',
      naturalLanguageQuery: 'skills and title matching',
      query: {
        query: {
          bool: {
            must: [
              { 'match': { 'job_title': 'software engineer' } },
              { 'match': { 'job_description': 'Python' } },
              { 'match': { 'job_description': 'machine learning' } },
              { 'term': { 'is_deleted.keyword': '0' } },
            ],
            filter: [
              { 'range': { 'crawled_date': { 'gte': 'now-14d/d' } } },
            ],
          },
        },
      },
      tags: ['skills', 'job_title', 'technology'],
      complexity: 'medium',
      successRate: 92,
    },
    {
      id: 'company_filter_search',
      description: 'Find all jobs at Google or Microsoft',
      naturalLanguageQuery: 'company-specific job search',
      query: {
        query: {
          bool: {
            must: [
              {
                terms: {
                  'company_name.keyword': ['Google', 'Microsoft', 'Alphabet Inc.'],
                },
              },
              { 'term': { 'is_deleted.keyword': '0' } },
            ],
            filter: [
              { 'range': { 'crawled_date': { 'gte': 'now-30d/d' } } },
            ],
          },
        },
      },
      tags: ['company', 'multiple_values', 'exact_match'],
      complexity: 'simple',
      successRate: 96,
    },
    {
      id: 'salary_range_search',
      description: 'Find jobs with salary information excluding N/A values',
      naturalLanguageQuery: 'salary-based filtering',
      query: {
        query: {
          bool: {
            must: [
              { 'exists': { 'field': 'raw_salary' } },
              { 'term': { 'is_deleted.keyword': '0' } },
            ],
            must_not: [
              { 'match_phrase': { 'raw_salary': 'NA' } },
              { 'match_phrase': { 'raw_salary': '#N/A' } },
            ],
            filter: [
              { 'range': { 'crawled_date': { 'gte': 'now-7d/d' } } },
            ],
          },
        },
      },
      tags: ['salary', 'exists', 'exclusion'],
      complexity: 'medium',
      successRate: 85,
    },
  ],
};

const DEFAULT_CATEGORY: ExampleQueryCategory = "General";

export class QueryLibraryManager {
  public exampleQueries: Record<ExampleQueryCategory, ExampleQuery[]>;
  private storageKey = 'queryLibrary';

  constructor(private esConfigManager: ESConfigManager) {
    this.exampleQueries = { [DEFAULT_CATEGORY]: [] };
    // loadAndInitializeLibrary will be called by an async factory or an init method
  }

  async loadAndInitializeLibrary(): Promise<void> {
    try {
      const loadedLibrary = await this.esConfigManager.loadData(this.storageKey);
      if (loadedLibrary && Object.keys(loadedLibrary).length > 0) {
        this.exampleQueries = loadedLibrary as Record<ExampleQueryCategory, ExampleQuery[]>;
        console.log('Query library loaded from storage.');
      } else {
        console.log('No query library found in storage, initializing with default examples.');
        // Initialize with default examples, structured into categories
        // For now, all sample queries go into a "General" category
        const defaultQueries: ExampleQuery[] = defaultExampleQueriesData.sampleQueries.map(q => ({
          id: q.id,
          description: q.description,
          naturalLanguageQuery: q.userIntent || q.description, // Fallback for userIntent
          query: q.query,
          tags: q.tags,
          complexity: q.complexity,
          successRate: q.successRate,
        }));
        this.exampleQueries = { [DEFAULT_CATEGORY]: defaultQueries };
        await this.esConfigManager.saveData(this.storageKey, this.exampleQueries);
        console.log('Default query library initialized and saved to storage.');
      }
    } catch (error) {
      console.error('Error during query library initialization:', error);
      // Fallback to in-memory defaults if storage operations fail catastrophically
      if (Object.keys(this.exampleQueries).length === 0 || 
          (Object.keys(this.exampleQueries).length === 1 && Object.keys(this.exampleQueries)[0] === DEFAULT_CATEGORY && this.exampleQueries[DEFAULT_CATEGORY].length === 0)) {
        const defaultQueries: ExampleQuery[] = defaultExampleQueriesData.sampleQueries.map(q => ({
            id: q.id,
            description: q.description,
            naturalLanguageQuery: q.userIntent || q.description,
            query: q.query,
            tags: q.tags,
            complexity: q.complexity,
            successRate: q.successRate,
        }));
        this.exampleQueries = { [DEFAULT_CATEGORY]: defaultQueries };
        console.warn('Query library initialized with in-memory defaults due to storage error.');
      }
    }
  }

  async addExample(category: ExampleQueryCategory, query: ExampleQuery): Promise<void> {
    if (!this.exampleQueries[category]) {
      this.exampleQueries[category] = [];
    }
    // Prevent duplicates by ID within the same category
    if (this.exampleQueries[category].some(eq => eq.id === query.id)) {
        console.warn(`Query with ID "${query.id}" already exists in category "${category}". Skipping.`);
        return;
    }
    this.exampleQueries[category].push(query);
    try {
      await this.esConfigManager.saveData(this.storageKey, this.exampleQueries);
      console.log(`Query "${query.id}" added to category "${category}" and library saved.`);
    } catch (error) {
      console.error('Error saving query library after adding example:', error);
      // Optionally, revert the change to keep in-memory state consistent with storage
      this.exampleQueries[category] = this.exampleQueries[category].filter(eq => eq.id !== query.id);
      if (this.exampleQueries[category].length === 0) {
          delete this.exampleQueries[category];
      }
      throw error; // Re-throw to allow caller to handle
    }
  }

  async importExamples(data: Record<ExampleQueryCategory, ExampleQuery[]>): Promise<void> {
    for (const category in data) {
      if (Object.prototype.hasOwnProperty.call(data, category)) {
        if (!this.exampleQueries[category]) {
          this.exampleQueries[category] = [];
        }
        data[category].forEach(newQuery => {
          // Remove existing query with the same ID before adding new one to prevent duplicates
          this.exampleQueries[category] = this.exampleQueries[category].filter(q => q.id !== newQuery.id);
          this.exampleQueries[category].push(newQuery);
        });
      }
    }
    try {
      await this.esConfigManager.saveData(this.storageKey, this.exampleQueries);
      console.log('Query library updated with imported examples and saved.');
    } catch (error) {
      console.error('Error saving query library after importing examples:', error);
      // Reverting import is more complex, could be handled by re-loading from storage or a more sophisticated transaction model
      // For now, we log the error and the in-memory state might be inconsistent with storage until next successful save.
      throw error; // Re-throw to allow caller to handle
    }
  }

  getExamples(category?: ExampleQueryCategory): ExampleQuery[] | Record<ExampleQueryCategory, ExampleQuery[]> {
    if (category) {
      return this.exampleQueries[category] || [];
    }
    return this.exampleQueries;
  }

  getExample(id: string, category?: ExampleQueryCategory): ExampleQuery | undefined {
    if (category) {
        const categoryQueries = this.exampleQueries[category];
        return categoryQueries ? categoryQueries.find(q => q.id === id) : undefined;
    }
    // Search in all categories if no category is specified
    for (const cat in this.exampleQueries) {
        if (Object.prototype.hasOwnProperty.call(this.exampleQueries, cat)) {
            const query = this.exampleQueries[cat].find(q => q.id === id);
            if (query) return query;
        }
    }
    return undefined;
  }

  async removeExample(id: string, category: ExampleQueryCategory): Promise<void> {
    if (this.exampleQueries[category]) {
        const initialLength = this.exampleQueries[category].length;
        this.exampleQueries[category] = this.exampleQueries[category].filter(q => q.id !== id);
        if (this.exampleQueries[category].length === 0) {
            delete this.exampleQueries[category]; // Remove category if it becomes empty
        }
        
        if (this.exampleQueries[category] && this.exampleQueries[category].length !== initialLength || 
            (!this.exampleQueries[category] && initialLength > 0) ) { // Check if a change actually happened
            try {
                await this.esConfigManager.saveData(this.storageKey, this.exampleQueries);
                console.log(`Query "${id}" removed from category "${category}" and library saved.`);
            } catch (error) {
                console.error('Error saving query library after removing example:', error);
                // Revert change (simplified, full revert might need storing original state)
                // This is a basic revert, for complex scenarios, more robust state management is needed.
                // For now, we'll just log and the in-memory state might be ahead of storage.
                throw error;
            }
        } else {
            console.log(`Query "${id}" not found in category "${category}". No changes made.`);
        }
    } else {
        console.log(`Category "${category}" not found. No changes made.`);
    }
  }

  async updateExample(id: string, category: ExampleQueryCategory, updatedQuery: Partial<ExampleQuery>): Promise<void> {
    if (this.exampleQueries[category]) {
        const queryIndex = this.exampleQueries[category].findIndex(q => q.id === id);
        if (queryIndex > -1) {
            this.exampleQueries[category][queryIndex] = { ...this.exampleQueries[category][queryIndex], ...updatedQuery, id: id }; // Ensure ID is not changed
            try {
                await this.esConfigManager.saveData(this.storageKey, this.exampleQueries);
                console.log(`Query "${id}" in category "${category}" updated and library saved.`);
            } catch (error) {
                console.error('Error saving query library after updating example:', error);
                // Revert (simplified)
                // This is a basic revert, for complex scenarios, more robust state management is needed.
                throw error;
            }
        } else {
            console.log(`Query "${id}" not found in category "${category}" for update.`);
        }
    } else {
        console.log(`Category "${category}" not found for updating query.`);
    }
  }
}
