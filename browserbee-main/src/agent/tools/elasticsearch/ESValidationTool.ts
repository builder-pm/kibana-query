import { 
    ValidationToolInput, 
    ValidationResultItem, 
    ValidationToolOutput,
    AnalyzedField,
    SchemaAnalysisOutput // Already imported via ValidationToolInput but good for clarity
} from './types';

export class ESValidationTool {
  private results: ValidationResultItem[];
  private schemaFields: Record<string, AnalyzedField>; // From SchemaAnalysisOutput.fieldIndex
  private isValid: boolean;

  constructor() {
    // Initialize in execute method to ensure fresh state per call
    this.results = [];
    this.schemaFields = {};
    this.isValid = true;
    console.log("ESValidationTool initialized. State will be reset per execution.");
  }

  private _addResult(type: 'error' | 'warning' | 'suggestion', message: string, fieldPath?: string): void {
    this.results.push({ type, message, fieldPath });
    if (type === 'error') {
      this.isValid = false;
    }
  }

  private _validateFieldExistence(fieldName: string, path: string): AnalyzedField | null {
    const fieldInfo = this.schemaFields[fieldName];
    if (!fieldInfo) {
      // Handle cases like _score, _doc which are valid but not in schemaFields
      if (fieldName === '_score' || fieldName === '_doc') {
        return { fieldName, type: fieldName } as AnalyzedField; // Treat as special valid field
      }
      // If it's a field within a known object/nested structure, it might not be in fieldIndex if fieldIndex is flat.
      // This check needs to be robust. For now, assume fieldIndex contains all relevant queryable paths.
      this._addResult('error', `Field '${fieldName}' not found in schema. Path: ${path}`, path);
      return null;
    }
    return fieldInfo;
  }

  private _validateNode(node: any, path: string): void {
    if (node === null || typeof node !== 'object') {
      return; // Leaf node or primitive
    }

    for (const key in node) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const value = node[key];
        const currentPath = path ? `${path}.${key}` : key;

        // Clause-specific validation
        if (key === 'term' || key === 'terms') this._validateTermQuery(value, currentPath);
        else if (key === 'match' || key === 'multi_match' || key === 'match_phrase' || key === 'query_string' || key === 'simple_query_string') this._validateMatchQuery(value, currentPath);
        else if (key === 'range') this._validateRangeQuery(value, currentPath);
        else if (key === 'exists' && value && typeof value.field === 'string') this._validateFieldExistence(value.field, `${currentPath}.field`);
        else if (key === 'aggs' || key === 'aggregations') this._validateAggregations(value, currentPath);
        else if (key === 'sort') this._validateSort(value, currentPath);
        
        // Field name check in common structures where 'field' property appears
        // This is a common pattern, e.g. in some aggregations, script_fields, etc.
        // This check is broad; specific handlers for aggs, sort, etc. are preferred for context.
        // else if (key === 'field' && typeof value === 'string') {
        //    // This could be too generic. For instance, a "field" inside "script" is not an ES field.
        //    // Consider context: if parent key is 'terms', 'avg', etc. then 'field' is an ES field.
        //    // The specific validators (_validateAggregations, _validateSort) should handle this better.
        // }


        // Recursively validate nested objects and arrays
        if (typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach((item, index) => this._validateNode(item, `${currentPath}[${index}]`));
          } else {
            this._validateNode(value, currentPath);
          }
        }
      }
    }
  }

  private _validateTermQuery(queryNode: any, path: string): void {
    for (const fieldName in queryNode) {
      if (Object.prototype.hasOwnProperty.call(queryNode, fieldName)) {
        // Field existence check
        const fieldInfo = this._validateFieldExistence(fieldName, `${path}.${fieldName}`);
        if (!fieldInfo) continue;

        // Type compatibility check
        if (fieldInfo.type === 'text' && !fieldName.endsWith('.keyword')) {
          const keywordSubfield = `${fieldName}.keyword`;
          if (this.schemaFields[keywordSubfield] && this.schemaFields[keywordSubfield].type === 'keyword') {
            this._addResult('warning', `Using 'term' on a 'text' field ('${fieldName}'). Consider using '${keywordSubfield}' for exact non-analyzed matches. Path: ${path}`, `${path}.${fieldName}`);
          } else {
            this._addResult('warning', `Using 'term' on a 'text' field ('${fieldName}'). This matches analyzed tokens. For exact value, ensure a keyword subfield is mapped and used. Path: ${path}`, `${path}.${fieldName}`);
          }
        } else if (fieldInfo.type === 'object' || fieldInfo.type === 'nested') {
             this._addResult('error', `Using 'term' on an '${fieldInfo.type}' field ('${fieldName}'). 'term' queries are for scalar fields. Path: ${path}`, `${path}.${fieldName}`);
        }
        // Value type check (conceptual)
        // const termValue = queryNode[fieldName];
        // if (fieldInfo.type === 'long' && typeof termValue !== 'number') { /* add error */ }
      }
    }
  }
  
  private _validateMatchQuery(queryNode: any, path: string): void {
     for (const fieldName in queryNode) {
        if (Object.prototype.hasOwnProperty.call(queryNode, fieldName)) {
            if (fieldName === 'fields' && Array.isArray(queryNode[fieldName])) { // For multi_match
                queryNode[fieldName].forEach((f: string, idx: number) => {
                    const actualFieldName = f.includes('^') ? f.split('^')[0] : f; // Handle field boosting syntax "my_field^3"
                    this._validateFieldExistence(actualFieldName, `${path}.${fieldName}[${idx}]`);
                });
            } else if (fieldName === 'analyzer' || fieldName === 'operator' || fieldName === 'query' || fieldName === 'fuzziness' || fieldName === 'prefix_length' || fieldName === 'max_expansions' || fieldName === 'minimum_should_match' || fieldName === 'fuzzy_rewrite' || fieldName === 'lenient' || fieldName === 'zero_terms_query' || fieldName === 'auto_generate_synonyms_phrase_query' || fieldName === 'fuzzy_transpositions' || fieldName === 'slop' || fieldName === 'type' ) {
                // These are valid parameters for match queries, not field names to validate against schema here.
                continue;
            }
            else {
                this._validateFieldExistence(fieldName, `${path}.${fieldName}`);
                // `match` queries are generally fine on `text` fields.
            }
        }
    }
  }

  private _validateRangeQuery(queryNode: any, path: string): void {
    for (const fieldName in queryNode) {
      if (Object.prototype.hasOwnProperty.call(queryNode, fieldName)) {
        const fieldInfo = this._validateFieldExistence(fieldName, `${path}.${fieldName}`);
        if (!fieldInfo) continue;

        const supportedTypes = ['date', 'long', 'integer', 'double', 'float', 'ip', 'date_nanos', 'short', 'byte', 'unsigned_long'];
        if (!supportedTypes.includes(fieldInfo.type)) {
          this._addResult('error', `Field '${fieldName}' of type '${fieldInfo.type}' does not support range queries. Path: ${path}`, `${path}.${fieldName}`);
        }
        
        const rangeOperators = queryNode[fieldName];
        if (typeof rangeOperators === 'object' && rangeOperators !== null) {
            for(const op in rangeOperators) {
                if (Object.prototype.hasOwnProperty.call(rangeOperators, op)) {
                    const opValue = rangeOperators[op];
                    if (op === 'format' && fieldInfo.type !== 'date' && fieldInfo.type !== 'date_nanos') {
                         this._addResult('warning', `'format' option is typically used with date types. Field '${fieldName}' is '${fieldInfo.type}'. Path: ${path}`, `${path}.${fieldName}.format`);
                    }
                    // Type check for values
                    if (fieldInfo.type === 'date' || fieldInfo.type === 'date_nanos') {
                        if (typeof opValue === 'number' && (op === 'gte' || op === 'lte' || op === 'gt' || op === 'lt')) {
                             this._addResult('suggestion', `Numeric value used for date field '${fieldName}' in range. Ensure it's epoch milliseconds if intended. Path: ${path}`, `${path}.${fieldName}.${op}`);
                        }
                    } else if (supportedTypes.includes(fieldInfo.type) && fieldInfo.type !== 'ip') { // Numeric types other than IP
                        if (typeof opValue !== 'number' && (op === 'gte' || op === 'lte' || op === 'gt' || op === 'lt')) {
                             this._addResult('error', `Range value for numeric field '${fieldName}' should be a number. Found: ${opValue}. Path: ${path}`, `${path}.${fieldName}.${op}`);
                        }
                    }
                }
            }
        }
      }
    }
  }

  private _validateAggregations(aggsNode: any, path: string): void {
    for (const aggName in aggsNode) {
      if (Object.prototype.hasOwnProperty.call(aggsNode, aggName)) {
        const aggDefinition = aggsNode[aggName];
        const currentAggPath = `${path}.${aggName}`;
        
        for (const aggType in aggDefinition) { // e.g. "terms", "stats"
          if (Object.prototype.hasOwnProperty.call(aggDefinition, aggType)) {
            if (aggType === 'aggs' || aggType === 'aggregations') { // Nested aggregations
              this._validateAggregations(aggDefinition[aggType], currentAggPath);
              continue;
            }

            const aggParams = aggDefinition[aggType];
            if (!aggParams || typeof aggParams !== 'object') continue;

            if (typeof aggParams.field === 'string') {
              const fieldName = aggParams.field;
              const fieldInfo = this._validateFieldExistence(fieldName, `${currentAggPath}.${aggType}.field`);
              if (fieldInfo) {
                if (aggType === 'terms' && fieldInfo.type === 'text' && !fieldName.endsWith('.keyword')) {
                  this._addResult('warning', `Terms aggregation on a 'text' field ('${fieldName}') without '.keyword' suffix. This aggregates on analyzed tokens. Use '${fieldName}.keyword' for distinct terms. Path: ${currentAggPath}`, `${currentAggPath}.${aggType}.field`);
                }
                if (aggType === 'date_histogram' && fieldInfo.type !== 'date' && fieldInfo.type !== 'date_nanos') {
                  this._addResult('error', `Date histogram on field '${fieldName}' requires 'date' or 'date_nanos' type, but found '${fieldInfo.type}'. Path: ${currentAggPath}`, `${currentAggPath}.${aggType}.field`);
                }
                const numericAggTypes = ['avg', 'sum', 'stats', 'extended_stats', 'percentiles', 'median_absolute_deviation', 'histogram', 'percentile_ranks', 'weighted_avg'];
                if (numericAggTypes.includes(aggType) && !['long', 'integer', 'short', 'byte', 'double', 'float', 'half_float', 'scaled_float', 'unsigned_long', 'date', 'date_nanos'].includes(fieldInfo.type)) {
                     // Date fields are often used in numeric aggs (e.g. avg of timestamp differences if scripted, or avg value of a date field itself)
                     this._addResult('error', `Aggregation '${aggType}' on field '${fieldName}' typically requires a numeric or date type, but found '${fieldInfo.type}'. Path: ${currentAggPath}`, `${currentAggPath}.${aggType}.field`);
                }
                if (aggType === 'cardinality' && fieldInfo.type === 'text' && !fieldName.endsWith('.keyword')) {
                     this._addResult('warning', `Cardinality aggregation on 'text' field ('${fieldName}') without '.keyword'. This may yield inaccurate counts due to analysis. Path: ${currentAggPath}`, `${currentAggPath}.${aggType}.field`);
                }
                if (aggType === 'significant_text' && fieldInfo.type !== 'text') {
                     this._addResult('error', `Significant Text aggregation requires a 'text' field. Field '${fieldName}' is '${fieldInfo.type}'. Path: ${currentAggPath}`, `${currentAggPath}.${aggType}.field`);
                }
              }
            }
          }
        }
      }
    }
  }
  
  private _validateSort(sortNode: any, path: string): void {
    const sortCriteria = Array.isArray(sortNode) ? sortNode : [sortNode];

    sortCriteria.forEach((criterion, index) => {
        const criterionPath = `${path}[${index}]`;
        if (typeof criterion === 'string') {
            if (criterion !== '_score' && criterion !== '_doc') { // _score and _doc are valid special sort fields
                this._validateFieldExistence(criterion, criterionPath);
            }
        } else if (typeof criterion === 'object' && criterion !== null) {
            for (const fieldName in criterion) {
                if (Object.prototype.hasOwnProperty.call(criterion, fieldName)) {
                    const fieldInfo = this._validateFieldExistence(fieldName, `${criterionPath}.${fieldName}`);
                    if (fieldInfo) {
                        if (fieldInfo.type === 'text' && !fieldName.endsWith('.keyword')) {
                            // Check if a .keyword subfield exists for this text field that could be used
                            const keywordVariant = `${fieldName}.keyword`;
                            if (!this.schemaFields[keywordVariant]) {
                                this._addResult('error', `Sorting on 'text' field ('${fieldName}') without a '.keyword' subfield is usually not allowed or very inefficient due to analysis. Path: ${criterionPath}`, `${criterionPath}.${fieldName}`);
                            } else {
                                this._addResult('suggestion', `Sorting on 'text' field ('${fieldName}'). Consider using '${keywordVariant}' for more efficient and predictable sorting. Path: ${criterionPath}`, `${criterionPath}.${fieldName}`);
                            }
                        }
                        // Further checks on sort options (mode, numeric_type, missing) can be added here
                        const sortOptions = criterion[fieldName];
                        if (typeof sortOptions === 'object' && sortOptions !== null && sortOptions.mode) {
                            if (!['min', 'max', 'sum', 'avg', 'median'].includes(sortOptions.mode)) {
                                this._addResult('warning', `Invalid sort mode '${sortOptions.mode}' for field '${fieldName}'. Path: ${criterionPath}`, `${criterionPath}.${fieldName}.mode`);
                            }
                        }
                    }
                }
            }
        }
    });
  }


  public async execute(input: ValidationToolInput): Promise<ValidationToolOutput> {
    // Reset state for this execution
    this.results = [];
    this.isValid = true;
    this.schemaFields = input.schemaAnalysis.fieldIndex || {};

    if (!input.query || typeof input.query !== 'object' || Object.keys(input.query).length === 0) {
      this._addResult('error', 'Query object is empty or invalid.');
    } else {
        this._validateNode(input.query, 'query');
    }
    
    // (Future Enhancement) LLM-based critique placeholder
    // if (this.isValid) { 
    //   // const llmCritiquePrompt = `Critique this Elasticsearch query: ${JSON.stringify(input.query)}. Schema summary: ${input.schemaAnalysis.schemaSummary}`;
    //   // const critiqueResponse = await this.executionEngine.generateText("System: You are an ES expert.", llmCritiquePrompt);
    //   // Parse critiqueResponse and add to this.results as 'suggestion' or 'warning'
    // }

    return {
      isValid: this.isValid,
      results: this.results,
      // validatedQuery: input.query // No auto-corrections in this version
    };
  }
}
