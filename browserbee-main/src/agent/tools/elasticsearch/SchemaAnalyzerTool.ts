import { SchemaAnalyzerInput, AnalyzedField, SchemaAnalysisOutput } from './types';

export class SchemaAnalyzerTool {
  constructor() {
    console.log("SchemaAnalyzerTool initialized.");
  }

  private _traverseProperties(
    properties: Record<string, any>,
    currentPath: string = '',
    analyzedFieldsList: AnalyzedField[], // For flat list
    fieldIndex: Record<string, AnalyzedField>
  ): AnalyzedField[] { // Returns properties for current level, used for nesting
    const currentLevelProperties: AnalyzedField[] = [];

    for (const key in properties) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        const mapping = properties[key];
        const fieldName = currentPath ? `${currentPath}.${key}` : key;

        const field: AnalyzedField = {
          fieldName: fieldName,
          type: mapping.type || 'object', // Default to 'object' if type is not specified (common for root or object fields)
        };

        // Extract analyzers if present
        const analyzers: string[] = [];
        if (mapping.analyzer) analyzers.push(mapping.analyzer);
        if (mapping.search_analyzer) analyzers.push(mapping.search_analyzer);
        if (analyzers.length > 0) {
          field.analyzers = analyzers;
        }

        // Recursively process nested properties
        if (mapping.properties) {
          field.properties = this._traverseProperties(
            mapping.properties,
            fieldName,
            analyzedFieldsList,
            fieldIndex
          );
        } else if (mapping.type === 'nested' && mapping.properties) { 
          // Explicitly handle 'nested' type if it also has 'properties'
           field.properties = this._traverseProperties(
            mapping.properties,
            fieldName,
            analyzedFieldsList,
            fieldIndex
          );
        }
        
        // Basic isArray inference: Elasticsearch mappings don't explicitly define arrays for simple types.
        // A field can contain single or multiple values.
        // For object/nested types, if it's treated as an array of objects, this is usually
        // implicit or indicated by how data is indexed. For now, we'll leave isArray as undefined
        // unless we have a more specific heuristic (e.g., naming conventions like 'tagsList').
        // field.isArray = ...; 

        currentLevelProperties.push(field);
        analyzedFieldsList.push(field); // Add to the flat list
        fieldIndex[fieldName] = field;
      }
    }
    return currentLevelProperties;
  }

  private _generateSchemaSummary(analyzedFields: AnalyzedField[], maxSummaryFields: number = 15): string {
    if (!analyzedFields || analyzedFields.length === 0) {
      return "Schema is empty or could not be analyzed.";
    }
    
    let summary = "Key fields in schema:\n";
    // Prioritize fields that are not part of a deeper nested structure for the top-level summary
    const topLevelOrImportantFields = analyzedFields.filter(f => !f.fieldName.includes('.', f.fieldName.indexOf('.') +1 )); // simple check for less nested fields

    const fieldsToSummarize = topLevelOrImportantFields.length > 0 ? topLevelOrImportantFields : analyzedFields;

    fieldsToSummarize.slice(0, maxSummaryFields).forEach(field => {
      summary += `- ${field.fieldName} (${field.type})`;
      if (field.properties && field.properties.length > 0) {
        summary += ` (object with ${field.properties.length} sub-fields)`;
      }
      if (field.analyzers && field.analyzers.length > 0) {
        summary += ` (analyzers: ${field.analyzers.join(', ')})`;
      }
      summary += "\n";
    });

    if (fieldsToSummarize.length > maxSummaryFields) {
      summary += `... and ${fieldsToSummarize.length - maxSummaryFields} more fields.`;
    }
    return summary.trim();
  }

  public async execute(input: SchemaAnalyzerInput): Promise<SchemaAnalysisOutput> {
    const analyzedFieldsList: AnalyzedField[] = []; // Flat list of all fields
    const fieldIndex: Record<string, AnalyzedField> = {};
    const errors: string[] = [];

    try {
      if (!input.rawMappings || typeof input.rawMappings !== 'object') {
        throw new Error("rawMappings must be a valid object.");
      }
      
      // Mappings typically have an outermost key which is the index name,
      // then 'mappings', then 'properties'. Or sometimes directly 'properties'.
      // We need to find the actual 'properties' object.
      let propertiesToAnalyze: Record<string, any> | undefined;

      if (input.rawMappings.properties && typeof input.rawMappings.properties === 'object') {
        propertiesToAnalyze = input.rawMappings.properties;
      } else if (input.rawMappings.mappings && input.rawMappings.mappings.properties && typeof input.rawMappings.mappings.properties === 'object') {
        // Common structure: { "index_name": { "mappings": { "properties": { ... } } } }
        // Or: { "mappings": { "properties": { ... } } } when index name is already handled
        propertiesToAnalyze = input.rawMappings.mappings.properties;
      } else {
        // Check if rawMappings itself is the properties object (e.g. if pre-processed)
        // This is a heuristic: check if some keys look like field definitions (have a 'type' or 'properties')
        const topLevelKeys = Object.keys(input.rawMappings);
        const looksLikeProperties = topLevelKeys.some(key => {
            const value = input.rawMappings[key];
            return typeof value === 'object' && (value.hasOwnProperty('type') || value.hasOwnProperty('properties'));
        });
        if (looksLikeProperties) {
            propertiesToAnalyze = input.rawMappings;
        } else {
            // Try to find the properties object within the first top-level key if it matches common patterns
            // e.g. { "my_index_name": { "mappings": { "properties": { ... } } } }
            const firstKey = topLevelKeys[0];
            if (firstKey && input.rawMappings[firstKey]?.mappings?.properties) {
                propertiesToAnalyze = input.rawMappings[firstKey].mappings.properties;
            } else if (firstKey && input.rawMappings[firstKey]?.properties) { // For cases like { "my_index_name": { "properties": { ... } } }
                 propertiesToAnalyze = input.rawMappings[firstKey].properties;
            }
        }
      }

      if (!propertiesToAnalyze) {
        // Try to find 'properties' at any depth for robustness, max depth 2-3
        let found = false;
        const findProps = (obj: Record<string, any>, depth: number): Record<string, any> | undefined => {
            if (depth > 3) return undefined;
            if (obj.properties && typeof obj.properties === 'object') {
                found = true;
                return obj.properties;
            }
            for (const key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    const props = findProps(obj[key], depth + 1);
                    if (props) return props;
                }
            }
            return undefined;
        };
        if (!found) propertiesToAnalyze = findProps(input.rawMappings, 0);
      }


      if (!propertiesToAnalyze || typeof propertiesToAnalyze !== 'object' || Object.keys(propertiesToAnalyze).length === 0) {
        errors.push(
          "Could not find 'properties' object in rawMappings or it is empty. " +
          "Expected structure like { 'properties': { ... } } or { 'index_name': { 'mappings': { 'properties': { ... } } } }."
        );
      } else {
        // The initial call to _traverseProperties will return the top-level fields' properties.
        // The analyzedFieldsList and fieldIndex are passed by reference and populated directly.
        this._traverseProperties(propertiesToAnalyze, '', analyzedFieldsList, fieldIndex);
      }

    } catch (e: any) {
      console.error("Error during schema analysis:", e);
      errors.push(e.message || "An unknown error occurred during schema traversal.");
    }

    const schemaSummary = this._generateSchemaSummary(analyzedFieldsList);

    return {
      analyzedFields: analyzedFieldsList, // This will be a flat list of all fields
      fieldIndex: fieldIndex,
      schemaSummary: schemaSummary,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
