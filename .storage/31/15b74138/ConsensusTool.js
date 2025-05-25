// src/agent/tools/elasticsearch/ConsensusTool.js
class ConsensusTool {
  constructor(llmProvider) {
    this.name = 'consensus';
    this.description = 'Ranks query options and provides recommendations';
    this.llmProvider = llmProvider;
  }

  async execute(params) {
    const { queries, context } = params;

    // Build context-aware prompt
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(queries, context);
    
    try {
      // Call LLM provider
      const response = await this.llmProvider.generateCompletion(userPrompt, systemPrompt);
      
      // Parse and validate response
      const rankedResults = this.parseConsensusResponse(response, queries);
      return this.formatFinalResults(rankedResults, queries);
    } catch (error) {
      console.error("Consensus generation failed:", error);
      throw new Error(`Failed to generate consensus: ${error.message}`);
    }
  }

  buildSystemPrompt() {
    return `You are an expert Elasticsearch query evaluator.
    
Your task is to analyze multiple query options and rank them based on their suitability for the user's intent.

TASK: Rank different query implementations and provide reasoning.
OUTPUT FORMAT: Return JSON with rankings and explanations.

RULES:
- Evaluate each query for correctness, completeness, and efficiency
- Consider both the query structure and the validation results
- Rank queries from best to worst
- Provide specific reasoning for each ranking
- Consider the user's original intent`;
  }

  buildUserPrompt(queries, context) {
    return `Evaluate and rank the following Elasticsearch query options:

USER QUERY: ${context.userInput}

${queries.map((q, i) => `
QUERY OPTION ${i+1}:
${JSON.stringify(q.query, null, 2)}

VALIDATION RESULTS:
${JSON.stringify(q.validation, null, 2)}
`).join('\n')}

Rank these query options from best to worst based on:
1. Correctness (matches user intent)
2. Completeness (includes all necessary clauses)
3. Efficiency (performs well)
4. Readability (easy to understand and maintain)

Output JSON format:
{
  "rankings": [
    {
      "queryIndex": 0,
      "score": 0.xx,
      "reasoning": "Explanation for this ranking"
    },
    ...
  ],
  "explanation": "Overall explanation of rankings"
}`;
  }

  parseConsensusResponse(response, queries) {
    try {
      // Extract JSON from the response
      const jsonMatch = response.text.match(/```json\n([\s\S]*?)\n```/) || 
                       response.text.match(/```([\s\S]*?)```/) ||
                       [null, response.text];
      
      const jsonString = jsonMatch[1].trim();
      const consensus = JSON.parse(jsonString);
      
      // Ensure the rankings has required fields
      if (!consensus.rankings || !Array.isArray(consensus.rankings)) {
        throw new Error("Missing or invalid rankings array");
      }
      
      return {
        rankings: consensus.rankings.map(r => ({
          queryIndex: r.queryIndex,
          score: r.score || 0.5,
          reasoning: r.reasoning || "No reasoning provided"
        })),
        explanation: consensus.explanation || "No explanation provided"
      };
    } catch (error) {
      console.error("Failed to parse consensus response:", error);
      
      // Create default rankings based on validation scores if parsing fails
      return {
        rankings: queries.map((q, i) => ({
          queryIndex: i,
          score: q.overallScore || 0.5,
          reasoning: `Default ranking based on validation score: ${q.overallScore || 0.5}`
        })).sort((a, b) => b.score - a.score),
        explanation: "Default rankings based on validation scores due to parsing error"
      };
    }
  }

  formatFinalResults(rankedResults, queries) {
    // Sort queries by ranking score
    const sortedRankings = [...rankedResults.rankings].sort((a, b) => b.score - a.score);
    
    // Format the final results
    return sortedRankings.map(ranking => {
      const query = queries[ranking.queryIndex];
      return {
        query: query.query,
        perspective: query.perspective || { name: `Option ${ranking.queryIndex + 1}` },
        score: ranking.score,
        reasoning: ranking.reasoning,
        validation: {
          errors: query.validation.errors,
          warnings: query.validation.warnings,
          improvements: query.validation.improvements
        }
      };
    });
  }
}

// Export the class
export default ConsensusTool;
