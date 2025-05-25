// src/agent/tools/elasticsearch/ValidationTool.js
class ValidationTool {
  constructor(llmProvider) {
    this.name = 'validateQuery';
    this.description = 'Validates Elasticsearch query syntax and semantics';
    this.llmProvider = llmProvider;
  }

  async execute(params) {
    const { query, context } = params;

    // Build context-aware prompt
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(query, context);
    
    try {
      // Call LLM provider
      const response = await this.llmProvider.generateCompletion(userPrompt, systemPrompt);
      
      // Parse and validate response
      const validationResult = this.parseValidationResponse(response);
      return this.enhanceQuery(query, validationResult);
    } catch (error) {
      console.error("Query validation failed:", error);
      throw new Error(`Failed to validate query: ${error.message}`);
    }
  }

  buildSystemPrompt() {
    return `You are an expert Elasticsearch query validator.
    
Your task is to analyze an Elasticsearch DSL query for syntax errors, semantic problems, and performance issues.

TASK: Validate the query and provide feedback.
OUTPUT FORMAT: Return JSON with validation results.

RULES:
- Check for valid Elasticsearch DSL syntax
- Verify correct field usage based on schema
- Identify potential performance issues
- Suggest improvements
- Rate the query for correctness, efficiency, and readability`;
  }

  buildUserPrompt(query, context) {
    return `Validate the following Elasticsearch DSL query:

QUERY:
${JSON.stringify(query, null, 2)}

SCHEMA:
${JSON.stringify(context.schema?.mappings || {}, null, 2)}

Analyze the query for:
1. Syntax errors
2. Field usage issues
3. Performance concerns
4. Structural improvements

Output JSON format:
{
  "valid": true|false,
  "errors": [
    { "type": "syntax|field|performance", "message": "Error description", "path": "query.path" }
  ],
  "warnings": [
    { "type": "syntax|field|performance", "message": "Warning description", "path": "query.path" }
  ],
  "improvements": [
    { "message": "Improvement suggestion", "path": "query.path" }
  ],
  "ratings": {
    "correctness": 0.xx,
    "efficiency": 0.xx,
    "readability": 0.xx
  }
}`;
  }

  parseValidationResponse(response) {
    try {
      // Extract JSON from the response
      const jsonMatch = response.text.match(/```json\n([\s\S]*?)\n```/) || 
                       response.text.match(/```([\s\S]*?)```/) ||
                       [null, response.text];
      
      const jsonString = jsonMatch[1].trim();
      const validation = JSON.parse(jsonString);
      
      // Ensure validation result has required fields
      return {
        valid: validation.valid !== undefined ? validation.valid : true,
        errors: Array.isArray(validation.errors) ? validation.errors : [],
        warnings: Array.isArray(validation.warnings) ? validation.warnings : [],
        improvements: Array.isArray(validation.improvements) ? validation.improvements : [],
        ratings: validation.ratings || {
          correctness: 0.7,
          efficiency: 0.7,
          readability: 0.7
        }
      };
    } catch (error) {
      console.error("Failed to parse validation response:", error);
      return {
        valid: false,
        errors: [{ type: "parsing", message: "Failed to parse validation result", path: "root" }],
        warnings: [],
        improvements: [],
        ratings: { correctness: 0, efficiency: 0, readability: 0 }
      };
    }
  }

  enhanceQuery(query, validationResult) {
    // Combine the query with its validation result
    return {
      query: query,
      validation: validationResult,
      // Compute overall score based on validation ratings
      overallScore: this.computeScore(validationResult)
    };
  }

  computeScore(validation) {
    // Simple weighted average of ratings
    const weights = {
      correctness: 0.5,
      efficiency: 0.3,
      readability: 0.2
    };
    
    // Calculate score, penalize for errors and warnings
    let score = (
      (validation.ratings.correctness * weights.correctness) +
      (validation.ratings.efficiency * weights.efficiency) +
      (validation.ratings.readability * weights.readability)
    );
    
    // Penalize for errors
    score -= validation.errors.length * 0.2;
    
    // Penalize for warnings
    score -= validation.warnings.length * 0.05;
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }
}

// Export the class
export default ValidationTool;
