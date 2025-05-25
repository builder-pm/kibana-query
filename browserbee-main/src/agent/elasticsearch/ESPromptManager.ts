// src/agent/elasticsearch/ESPromptManager.ts

/**
 * ESPromptManager
 * 
 * Manages specialized prompts for Elasticsearch query generation.
 * Creates context-aware prompts that help the LLM generate accurate ES queries.
 */
export class ESPromptManager {
  private basePrompt: string;
  private queryExamples: Map<string, string> = new Map();

  constructor() {
    this.basePrompt = this.createBasePrompt();
    this.initializeQueryExamples();
    console.log('ESPromptManager initialized');
  }

  /**
   * Create a query generation prompt from user input and context
   */
  async createQueryGenerationPrompt(userInput: string, context?: any): Promise<string> {
    const schemaInfo = context?.schema || '';
    const queryExamples = this.getRelevantExamples(userInput);
    
    return `${this.basePrompt}

## Current Context:
${schemaInfo ? `**Index Schema:**
${JSON.stringify(schemaInfo, null, 2)}` : ''}

**User Request:** ${userInput}

## Relevant Query Examples:
${queryExamples}

## Instructions:
1. Analyze the user's request carefully
2. Consider the available fields and their types from the schema
3. Generate an appropriate Elasticsearch query
4. Provide a clear explanation of what the query does
5. Format your response as:

**Explanation:**
[Your explanation here]

**Query:**
\`\`\`json
{
  "query": {
    // Your Elasticsearch query here
  }
}
\`\`\`

Generate the query now:`;
  }

  /**
   * Create base prompt for Elasticsearch query generation
   */
  private createBasePrompt(): string {
    return `You are an expert Elasticsearch query generator. Your task is to convert natural language requests into valid Elasticsearch Query DSL.

## Key Guidelines:
- Always generate valid Elasticsearch Query DSL syntax
- Use appropriate query types (match, term, range, bool, etc.)
- Consider field types when building queries (text vs keyword vs date vs numeric)
- Use aggregations when grouping or statistical analysis is requested
- Include appropriate filters for time ranges, field values, etc.
- Default to using 'match' for text search and 'term' for exact matches
- Use 'bool' queries to combine multiple conditions
- For date ranges, use 'range' query with 'gte', 'lte', 'gt', 'lt'
- For numeric ranges, use 'range' query appropriately
- Include 'size' parameter to limit results when appropriate
- Use 'sort' for ordering results

## Common Query Patterns:
1. **Text Search**: Use 'match' or 'multi_match'
2. **Exact Match**: Use 'term' or 'terms'
3. **Range Queries**: Use 'range' with appropriate operators
4. **Boolean Logic**: Use 'bool' with 'must', 'should', 'must_not', 'filter'
5. **Aggregations**: Use 'aggs' for grouping, counting, statistics
6. **Time-based**: Use 'range' on timestamp fields

## Response Format:
Always provide both an explanation and the JSON query.`;
  }

  /**
   * Initialize common query examples
   */
  private initializeQueryExamples(): void {
    this.queryExamples.set('text_search', `
**Text Search Example:**
\`\`\`json
{
  "query": {
    "match": {
      "message": "error"
    }
  }
}
\`\`\``);

    this.queryExamples.set('range_query', `
**Range Query Example:**
\`\`\`json
{
  "query": {
    "range": {
      "@timestamp": {
        "gte": "now-1h",
        "lte": "now"
      }
    }
  }
}
\`\`\``);

    this.queryExamples.set('boolean_query', `
**Boolean Query Example:**
\`\`\`json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "error" } }
      ],
      "filter": [
        { "range": { "@timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
\`\`\``);

    this.queryExamples.set('aggregation', `
**Aggregation Example:**
\`\`\`json
{
  "size": 0,
  "aggs": {
    "status_codes": {
      "terms": {
        "field": "status_code",
        "size": 10
      }
    }
  }
}
\`\`\``);

    this.queryExamples.set('complex_query', `
**Complex Query Example:**
\`\`\`json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "message": "error" } }
      ],
      "filter": [
        { "term": { "level": "error" } },
        { "range": { "@timestamp": { "gte": "now-24h" } } }
      ]
    }
  },
  "sort": [
    { "@timestamp": { "order": "desc" } }
  ],
  "size": 100
}
\`\`\``);
  }

  /**
   * Get relevant query examples based on user input
   */
  private getRelevantExamples(userInput: string): string {
    const lowercaseInput = userInput.toLowerCase();
    const relevantExamples: string[] = [];

    // Determine which examples are most relevant
    if (lowercaseInput.includes('search') || lowercaseInput.includes('find') || lowercaseInput.includes('match')) {
      relevantExamples.push(this.queryExamples.get('text_search') || '');
    }

    if (lowercaseInput.includes('time') || lowercaseInput.includes('date') || lowercaseInput.includes('hour') || lowercaseInput.includes('day')) {
      relevantExamples.push(this.queryExamples.get('range_query') || '');
    }

    if (lowercaseInput.includes('and') || lowercaseInput.includes('or') || lowercaseInput.includes('but') || lowercaseInput.includes('not')) {
      relevantExamples.push(this.queryExamples.get('boolean_query') || '');
    }

    if (lowercaseInput.includes('count') || lowercaseInput.includes('group') || lowercaseInput.includes('aggregate') || lowercaseInput.includes('sum')) {
      relevantExamples.push(this.queryExamples.get('aggregation') || '');
    }

    // If no specific patterns found, include a complex example
    if (relevantExamples.length === 0) {
      relevantExamples.push(this.queryExamples.get('complex_query') || '');
    }

    return relevantExamples.join('\n');
  }

  /**
   * Create a prompt for query validation
   */
  createValidationPrompt(query: string): string {
    return `Please validate the following Elasticsearch query and identify any issues:

\`\`\`json
${query}
\`\`\`

Check for:
1. Valid JSON syntax
2. Correct Elasticsearch Query DSL structure
3. Proper field names and types
4. Logical consistency
5. Performance considerations

Provide feedback in this format:
**Valid:** Yes/No
**Issues:** [List any issues found]
**Suggestions:** [Recommendations for improvement]`;
  }

  /**
   * Create a prompt for query optimization
   */
  createOptimizationPrompt(query: string, context?: any): string {
    return `Please analyze and optimize the following Elasticsearch query:

\`\`\`json
${query}
\`\`\`

${context?.schema ? `**Schema Context:**
${JSON.stringify(context.schema, null, 2)}` : ''}

Provide optimization suggestions for:
1. Performance improvements
2. More efficient query structure
3. Better use of filters vs queries
4. Index optimization opportunities

Format your response as:
**Current Analysis:** [Analysis of current query]
**Optimized Query:** [Your optimized version]
**Improvements:** [List of improvements made]`;
  }
}