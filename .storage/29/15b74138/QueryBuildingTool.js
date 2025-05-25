// src/agent/tools/elasticsearch/QueryBuildingTool.js
class QueryBuildingTool {
  constructor(llmProvider) {
    this.name = 'buildQuery';
    this.description = 'Construct Elasticsearch DSL from intent and perspective';
    this.llmProvider = llmProvider;
  }

  async execute(params) {
    const { intent, perspective, context } = params;

    // Build context-aware prompt
    const systemPrompt = this.buildSystemPrompt(context.schema);
    const userPrompt = this.buildUserPrompt(intent, perspective, context);
    
    try {
      // Call LLM provider
      const response = await this.llmProvider.generateCompletion(userPrompt, systemPrompt);
      
      // Parse and validate response
      const query = this.parseQueryResponse(response);
      return this.validateQuery(query, context.schema);
    } catch (error) {
      console.error("Query building failed:", error);
      throw new Error(`Failed to build query: ${error.message}`);
    }
  }

  buildSystemPrompt(schema) {
    return `You are an expert Elasticsearch query builder.
    
Your task is to construct a valid Elasticsearch DSL query that matches the provided intent and follows the specified perspective.

ELASTICSEARCH SCHEMA:
${JSON.stringify(schema?.mappings || {}, null, 2)}

TASK: Construct a valid Elasticsearch DSL query.
OUTPUT FORMAT: Return JSON with the complete query.

RULES:
- Use valid Elasticsearch DSL syntax
- Use correct field names from the schema
- Include all entities from the intent
- Follow the perspective's approach
- Ensure proper nesting of query clauses
- Add comments for complex parts`;
  }

  buildUserPrompt(intent, perspective, context) {
    let prompt = `Build an Elasticsearch DSL query with the following intent and perspective:

INTENT:
${JSON.stringify(intent, null, 2)}

PERSPECTIVE:
${JSON.stringify(perspective, null, 2)}

`;

    // Add reference queries if available
    if (context.referenceQueries && context.referenceQueries.length > 0) {
      prompt += `
REFERENCE QUERIES:
${this.formatReferenceQueries(context.referenceQueries)}
`;
    }
    
    prompt += `
SCHEMA:
${JSON.stringify(context.schema?.mappings || {}, null, 2)}

Create a complete and valid Elasticsearch DSL query following the specified perspective.
Output the query as JSON without explanation.`;

    return prompt;
  }

  parseQueryResponse(response) {
    try {
      // Extract JSON from the response
      const jsonMatch = response.text.match(/```json\n([\s\S]*?)\n```/) || 
                       response.text.match(/```([\s\S]*?)```/) ||
                       [null, response.text];
      
      const jsonString = jsonMatch[1].trim();
      const query = JSON.parse(jsonString);
      
      return query;
    } catch (error) {
      console.error("Failed to parse query response:", error);
      throw new Error("Invalid query format returned from LLM");
    }
  }

  validateQuery(query, schema) {
    // Basic validation of query structure
    if (!query) {
      throw new Error("Empty query returned");
    }
    
    // Check if the query has a root element (query, aggs, etc.)
    if (!query.query && !query.aggs && !query.aggregations) {
      throw new Error("Query must include a 'query' or 'aggregations' section");
    }
    
    // More detailed validation would be implemented here
    // This would check field names against schema, validate syntax, etc.
    
    return query;
  }

  formatReferenceQueries(referenceQueries) {
    // Format up to 2 reference queries similar to the perspective
    return referenceQueries
      .slice(0, 2)
      .map((q, i) => `REFERENCE ${i+1}: ${JSON.stringify(q.dsl, null, 2)}`)
      .join('\n\n');
  }
}

// Export the class
export default QueryBuildingTool;
