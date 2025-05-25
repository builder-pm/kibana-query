// src/agent/tools/elasticsearch/PerspectiveGenerationTool.js
class PerspectiveGenerationTool {
  constructor(llmProvider) {
    this.name = 'generatePerspectives';
    this.description = 'Generate multiple analytical approaches for the query';
    this.llmProvider = llmProvider;
  }

  async execute(params) {
    const { intent, context } = params;

    // Build context-aware prompt
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(intent, context);
    
    try {
      // Call LLM provider
      const response = await this.llmProvider.generateCompletion(userPrompt, systemPrompt);
      
      // Parse and validate response
      return this.parsePerspectives(response, intent);
    } catch (error) {
      console.error("Perspective generation failed:", error);
      throw new Error(`Failed to generate perspectives: ${error.message}`);
    }
  }

  buildSystemPrompt() {
    return `You are an expert Elasticsearch query architect.
    
Your task is to generate multiple valid approaches to structure an Elasticsearch query based on user intent.
Each approach should use different query structures, clauses, or aggregations to address the same underlying need.

TASK: Generate 1-3 distinct query perspectives with reasoning.
OUTPUT FORMAT: JSON array of perspective objects.`;
  }

  buildUserPrompt(intent, context) {
    return `Generate different perspectives for constructing an Elasticsearch query with the following intent:

INTENT:
${JSON.stringify(intent, null, 2)}

SCHEMA:
${JSON.stringify(context.schema?.mappings || {}, null, 2)}

Generate 1-3 different perspectives for implementing this query. Each perspective should:
1. Have a unique name
2. Include a description of the approach
3. Specify which Elasticsearch features to use (e.g., match, term, range, aggregations)
4. Explain the reasoning behind this approach
5. Include a confidence score (0-1)

Output JSON format:
[
  {
    "name": "Perspective name",
    "description": "Description of approach",
    "features": ["feature1", "feature2"],
    "reasoning": "Why this approach is suitable",
    "confidence": 0.xx
  },
  ...
]

Generate multiple perspectives only if they provide meaningfully different approaches.`;
  }

  parsePerspectives(response, intent) {
    try {
      // Extract JSON from the response
      const jsonMatch = response.text.match(/```json\n([\s\S]*?)\n```/) || 
                       response.text.match(/```([\s\S]*?)```/) ||
                       [null, response.text];
      
      const jsonString = jsonMatch[1].trim();
      const perspectives = JSON.parse(jsonString);
      
      // Validate the perspectives
      if (!Array.isArray(perspectives)) {
        throw new Error("Perspectives must be an array");
      }
      
      // Enforce at least one perspective
      if (perspectives.length === 0) {
        return [{
          name: "Default Approach",
          description: "Standard query approach based on user intent",
          features: ["match", "term"],
          reasoning: "Direct implementation of user intent",
          confidence: 0.7
        }];
      }
      
      // Limit to maximum 3 perspectives
      return perspectives.slice(0, 3).map(p => {
        // Ensure each perspective has required fields
        return {
          name: p.name || "Unnamed Perspective",
          description: p.description || "No description provided",
          features: p.features || [],
          reasoning: p.reasoning || "No reasoning provided",
          confidence: p.confidence || 0.5
        };
      });
    } catch (error) {
      console.error("Failed to parse perspectives:", error);
      throw new Error("Invalid perspectives format returned from LLM");
    }
  }
}

// Export the class
export default PerspectiveGenerationTool;
