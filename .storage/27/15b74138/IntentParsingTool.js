// src/agent/tools/elasticsearch/IntentParsingTool.js
class IntentParsingTool {
  constructor(llmProvider) {
    this.name = 'parseIntent';
    this.description = 'Parse natural language input to extract Elasticsearch query intent';
    this.llmProvider = llmProvider;
  }

  async execute(params) {
    const { userInput, context } = params;

    // Build context-aware prompt
    const systemPrompt = this.buildSystemPrompt(context.schema);
    const userPrompt = this.buildUserPrompt(userInput, context.referenceQueries);
    
    try {
      // Call LLM provider
      const response = await this.llmProvider.generateCompletion(userPrompt, systemPrompt);
      
      // Parse and validate response
      const intent = this.parseIntentResponse(response);
      return this.validateIntent(intent, context.schema);
    } catch (error) {
      console.error("Intent parsing failed:", error);
      throw new Error(`Failed to parse intent: ${error.message}`);
    }
  }

  buildSystemPrompt(schema) {
    return `You are an expert Elasticsearch intent parser.

ELASTICSEARCH SCHEMA:
${JSON.stringify(schema?.mappings || {}, null, 2)}

TASK: Extract structured intent from natural language queries.
OUTPUT FORMAT: Return JSON with entities, queryType, complexity, confidence.

FIELD TYPES:
${this.generateFieldTypeGuide(schema)}

RULES:
- Use exact field names from schema
- Classify query type: search, aggregation, analytics
- Extract entities: companies, locations, skills, dates, ranges
- Set complexity: simple (1-2 criteria), medium (3-4), complex (5+)
- Provide confidence score (0-1)`;
  }

  buildUserPrompt(userInput, referenceQueries) {
    let prompt = `Parse the following natural language query into a structured intent for Elasticsearch:
    
QUERY: ${userInput}

`;

    // Add reference queries if available
    if (referenceQueries && referenceQueries.length > 0) {
      prompt += `
REFERENCE QUERIES:
${this.formatReferenceQueries(referenceQueries)}
`;
    }
    
    prompt += `
Extract the main entities, query type, and complexity.
Output JSON format:
{
  "entities": { "field1": "value1", ... },
  "queryType": "<search|aggregation|analytics>",
  "complexity": "<simple|medium|complex>",
  "confidence": 0.xx
}`;

    return prompt;
  }

  parseIntentResponse(response) {
    try {
      // Extract JSON from the response
      const jsonMatch = response.text.match(/```json\n([\s\S]*?)\n```/) || 
                       response.text.match(/```([\s\S]*?)```/) ||
                       [null, response.text];
      
      const jsonString = jsonMatch[1].trim();
      const intent = JSON.parse(jsonString);
      
      // Validate required fields
      if (!intent.entities || !intent.queryType || !intent.complexity) {
        throw new Error("Missing required fields in intent");
      }
      
      return intent;
    } catch (error) {
      console.error("Failed to parse intent response:", error);
      throw new Error("Invalid intent format returned from LLM");
    }
  }

  validateIntent(intent, schema) {
    // Validate entity field names against schema
    if (schema && schema.mappings) {
      for (const field in intent.entities) {
        if (!this.fieldExistsInSchema(field, schema.mappings)) {
          console.warn(`Field '${field}' not found in schema`);
          // We don't throw here, just warn since LLM might infer fields
        }
      }
    }
    
    return intent;
  }

  generateFieldTypeGuide(schema) {
    if (!schema || !schema.mappings) {
      return "Schema not available";
    }
    
    // Generate a guide for common field types
    const fields = this.extractFieldsFromSchema(schema.mappings);
    
    let guide = "";
    const fieldsByType = {};
    
    fields.forEach(field => {
      const type = field.type || 'unknown';
      if (!fieldsByType[type]) {
        fieldsByType[type] = [];
      }
      fieldsByType[type].push(field.name);
    });
    
    for (const type in fieldsByType) {
      guide += `${type}: ${fieldsByType[type].join(', ')}\n`;
    }
    
    return guide;
  }

  extractFieldsFromSchema(mappings) {
    // Recursive function to extract fields from nested mappings
    const fields = [];
    
    // Placeholder for schema field extraction logic
    // In a real implementation, this would traverse the schema recursively
    
    return fields;
  }

  fieldExistsInSchema(fieldPath, mappings) {
    // Placeholder for field existence check
    // This would check if a field exists in the schema, handling nested fields
    return true;
  }

  formatReferenceQueries(referenceQueries) {
    // Format up to 3 reference queries for context
    return referenceQueries
      .slice(0, 3)
      .map((q, i) => `QUERY ${i+1}: ${q.naturalLanguage}\nDSL: ${JSON.stringify(q.dsl, null, 2)}`)
      .join('\n\n');
  }
}

// Export the class
export default IntentParsingTool;
