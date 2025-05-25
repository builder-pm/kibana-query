import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { ESClusterConfig, ESSchema } from '../../../services/elasticsearch/types'; 
// For RenderField, we'll use the SchemaField from ESSchemaManager's types, 
// as ESSchema.analysis contains fields of this type.
import { SchemaField as ESSchemaManagerSchemaField } from '../../../services/elasticsearch/types';

interface RenderFieldProps {
  field: ESSchemaManagerSchemaField; 
  nestingLevel: number;
}

const RenderField: React.FC<RenderFieldProps> = ({ field, nestingLevel }) => {
  const [isExpanded, setIsExpanded] = useState(nestingLevel < 1); // Auto-expand only the very top level

  const displayName = field.name.includes('.') ? field.name.substring(field.name.lastIndexOf('.') + 1) : field.name;
  const displayType = field.type;
  const subProperties = field.properties;

  return (
    <div style={{ marginLeft: `${nestingLevel * 20}px` }} className="my-1 py-1 px-2 border-l-2 border-gray-200 hover:bg-gray-100 rounded-r-md">
      <div className="flex items-center">
        {subProperties && subProperties.length > 0 && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="mr-2 text-blue-600 hover:text-blue-800 text-xs focus:outline-none transform transition-transform duration-150"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            ▶
          </button>
        )}
        <span className={`font-medium text-sm ${subProperties && subProperties.length > 0 ? 'cursor-pointer' : ''}`} onClick={() => subProperties && subProperties.length > 0 && setIsExpanded(!isExpanded)}>
            {displayName}
        </span>
        <span className="ml-2 text-xs py-0.5 px-1.5 bg-sky-100 text-sky-700 rounded-full font-mono">{displayType}</span>
      </div>
      {(field.searchable || field.aggregatable) && (
         <div className="ml-5 mt-0.5 text-xs text-gray-500">
            {field.searchable && <span className="mr-2 py-0.5 px-1 bg-green-100 text-green-700 rounded-sm">Searchable</span>}
            {field.aggregatable && <span className="py-0.5 px-1 bg-yellow-100 text-yellow-700 rounded-sm">Aggregatable</span>}
        </div>
      )}

      {isExpanded && subProperties && subProperties.length > 0 && (
        <div className="mt-1">
          {subProperties.map((prop) => ( // Using prop.name for key assuming names are unique within their level
            <RenderField key={prop.name} field={prop} nestingLevel={nestingLevel + 1} />
          ))}
        </div>
      )}
    </div>
  );
};


export const ESSchemaViewer: React.FC = () => {
  const [indexPattern, setIndexPattern] = useState<string>('');
  const [schema, setSchema] = useState<ESSchema | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [clusters, setClusters] = useState<ESClusterConfig[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Not setting isLoading for this initial fetch to avoid UI flicker before user interaction
      try {
        const clustersResponse = await chrome.runtime.sendMessage({ type: 'GET_ES_CLUSTERS' });
        if (clustersResponse?.success && Array.isArray(clustersResponse.data)) {
          setClusters(clustersResponse.data);
          if (clustersResponse.data.length > 0) {
            const activeIdResponse = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_ES_CLUSTER_ID' });
            const currentActiveId = (activeIdResponse?.success && activeIdResponse.data) ? activeIdResponse.data : clustersResponse.data[0].id;
            setSelectedClusterId(currentActiveId); 
          }
        } else {
          setError(`Failed to fetch clusters: ${clustersResponse?.message || 'Unknown error'}`);
        }
      } catch (e: any) {
        setError(`Error fetching initial cluster data: ${e.message}`);
      }
    };
    fetchData();
  }, []);
  
  const handleViewSchema = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedClusterId) {
      setError('Please select a cluster.');
      return;
    }
    if (!indexPattern.trim()) {
      setError('Please enter an index pattern.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSchema(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ES_SCHEMA',
        payload: { clusterId: selectedClusterId, indexPattern },
      });

      if (response?.status === 'success' && response.data) {
        setSchema(response.data);
        if (response.data.source === 'mock' && response.data.indexName.includes('mock-default')) {
             setError("Displayed schema is a generic mock. Could not fetch live schema; verify connection, index pattern, and permissions.");
        } else if (response.data.source === 'mock') {
             setError(`Displayed schema for '${response.data.indexName}' is a mock. Live discovery might have failed or is pending.`);
        }
      } else {
        setError(response?.message || 'Failed to fetch schema.');
        setSchema(null); 
      }
    } catch (e: any) {
      setError(`Error fetching schema: ${e.message}`);
      setSchema(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper to reconstruct the field tree from SchemaAnalysis for RenderField
  // This is needed because ESSchema.analysis contains flat lists, but RenderField expects hierarchical structure.
  // We will use the raw mappings for the tree structure directly.
  const getDisplayableFields = (rawMappings: Record<string, any>): ESSchemaManagerSchemaField[] => {
    if (!rawMappings || !rawMappings.properties) return [];
    
    // Function to map raw properties to SchemaField structure, including searchable/aggregatable flags from analysis
    // This is a simplified version; a full version would need to cross-reference with schema.analysis lists.
    // For now, RenderField will primarily show name/type/properties from raw mappings.
    // The SchemaField from ESSchemaManager already has 'searchable' and 'aggregatable'.
    // If ESSchema.analysis.searchableFields etc. were hierarchical, that would be ideal.
    // Since they are flat, we build the hierarchy from mappings and RenderField can use the flags from the *flat* lists if needed.
    // For this iteration, RenderField uses flags if present on the field object it receives.
    // The ESSchema.analysis fields *are* already structured with nested properties by the SchemaManager.
    // So, we can use schema.analysis.searchableFields (or a combined list) if we want to show *only* those.
    // But to show the *full* tree like a mapping, schema.mappings.properties is better.
    // Let's use schema.mappings.properties and let RenderField show what it can.
    // The `analyzeSchema` method in `ESSchemaManager` should populate `properties` recursively.
    // The `SchemaField` type in `services/elasticsearch/types.ts` has `properties?: SchemaField[]`.
    // So, if `schema.analysis.allFields` (a hypothetical combined & structured list) was available, that would be best.
    // Lacking that, we will use the raw mappings and RenderField will show structure but might miss searchable/aggregatable flags
    // if those flags are only on the flat lists in `schema.analysis`.
    // The current RenderField is adapted to work with ESSchemaManagerSchemaField type which includes these flags.
    // The solution is to ensure _analyzeFieldsRecursive in ESSchemaManager populates these flags on the nested properties too.
    // Assuming ESSchemaManager._analyzeFieldsRecursive populates properties for schema.analysis.searchableFields etc.
    
    // A simple approach: iterate raw mapping properties and let RenderField handle nesting.
    // The `SchemaField` type used by `RenderField` needs to be compatible with what `schema.mappings.properties` provides.
    const mapRawPropsToSchemaFields = (props: Record<string, any>): ESSchemaManagerSchemaField[] => {
        return Object.entries(props).map(([key, valueObj]) => {
            const esType = (valueObj as any).type || 'object';
            // Try to find this field in the analyzed flat lists to get its searchable/aggregatable status
            // This is inefficient. Ideally, analysis in ESSchemaManager provides a single hierarchical tree.
            // For now, we'll just pass the basic structure. RenderField is adapted.
            const field: ESSchemaManagerSchemaField = {
                name: key,
                type: esType,
                searchable: schema?.analysis?.searchableFields.some(f => f.name === key && f.type === esType), // Basic check for top-level
                aggregatable: schema?.analysis?.aggregatableFields.some(f => f.name === key && f.type === esType), // Basic check for top-level
                properties: (valueObj as any).properties ? mapRawPropsToSchemaFields((valueObj as any).properties) : undefined
            };
            return field;
        });
    };
    return mapRawPropsToSchemaFields(rawMappings.properties);
  };


  return (
    <div className="p-4 border border-gray-300 rounded-lg shadow-sm mt-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-700">Index Schema Viewer</h3>
      <form onSubmit={handleViewSchema} className="space-y-3 mb-4">
        <div>
          <label htmlFor="clusterSelectSchema" className="block text-sm font-medium text-gray-700">
            Target Cluster
          </label>
          <select
            id="clusterSelectSchema"
            value={selectedClusterId || ''}
            onChange={(e) => setSelectedClusterId(e.target.value)}
            disabled={clusters.length === 0 || isLoading}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:bg-gray-100"
          >
            <option value="" disabled>
              {clusters.length === 0 ? 'No clusters configured' : 'Select a cluster'}
            </option>
            {clusters.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>
                {cluster.name} ({cluster.host})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="indexPatternSchema" className="block text-sm font-medium text-gray-700">
            Index Pattern (e.g., my-index-*, logs-prod)
          </label>
          <input
            type="text"
            id="indexPatternSchema"
            value={indexPattern}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setIndexPattern(e.target.value)}
            placeholder="your-index-name or pattern"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !selectedClusterId || !indexPattern.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 disabled:opacity-50"
        >
          {isLoading ? 'Loading Schema...' : 'View Schema'}
        </button>
      </form>

      {error && <div className="my-3 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}

      {schema && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-md font-semibold text-gray-800">
              Schema for: <span className="font-normal text-indigo-600">{schema.indexName}</span>
            </h4>
            <span className="text-xs py-1 px-2 bg-gray-200 text-gray-700 rounded-full capitalize">{schema.source} source</span>
          </div>
          
          {schema.analysis?.suggestions && schema.analysis.suggestions.length > 0 && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <h5 className="text-sm font-semibold text-blue-700 mb-1">Analysis Suggestions:</h5>
              <ul className="list-disc list-inside text-xs text-blue-600 space-y-0.5">
                {schema.analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          <div className="max-h-[600px] overflow-y-auto bg-gray-50 p-3 rounded-md border">
            {schema.mappings?.properties && Object.keys(schema.mappings.properties).length > 0 ? (
                getDisplayableFields(schema.mappings).map((field) => (
                    <RenderField key={field.name} field={field} nestingLevel={0} />
                ))
            ) : (
              <p className="text-sm text-gray-500">No fields found in schema properties, or schema structure not recognized for detailed display. Raw mappings might be empty or missing 'properties'.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
