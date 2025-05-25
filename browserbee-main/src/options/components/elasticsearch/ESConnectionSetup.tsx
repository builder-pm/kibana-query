import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { ESClusterConfig, ESAuthDetails, ClusterHealth } from '../../../services/elasticsearch/types';

// Define a type for form values, excluding id and createdAt for new clusters
type ClusterFormValues = Omit<ESClusterConfig, 'id' | 'createdAt'>;

const initialFormValues: ClusterFormValues = {
  name: '',
  host: '',
  port: 9200,
  protocol: 'http',
  auth: { type: 'none', username: '', password: '', apiKey: '', apiKeyId: '' }, // Ensure all auth fields are initialized
};

export const ESConnectionSetup: React.FC = () => {
  const [clusters, setClusters] = useState<ESClusterConfig[]>([]);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<ClusterFormValues>(initialFormValues);
  const [editingClusterId, setEditingClusterId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [testStatus, setTestStatus] = useState<Record<string, { status: 'testing' | 'success' | 'error'; message?: string }>>({});
  const [uiState, setUiState] = useState<'list' | 'addForm' | 'editForm'>('list');
  const [generalFeedback, setGeneralFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const clearGeneralFeedback = () => setTimeout(() => setGeneralFeedback(null), 5000);

  const loadInitialData = () => {
    chrome.runtime.sendMessage({ type: 'GET_ES_CLUSTERS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching clusters:', chrome.runtime.lastError.message);
        setGeneralFeedback({type: 'error', message: `Error fetching clusters: ${chrome.runtime.lastError.message}`});
        clearGeneralFeedback();
        return;
      }
      if (response && response.success && Array.isArray(response.data)) {
        setClusters(response.data);
      } else {
        console.error('Failed to fetch clusters or invalid response:', response?.message);
        setGeneralFeedback({type: 'error', message: `Failed to fetch clusters: ${response?.message || 'Invalid response'}`});
        clearGeneralFeedback();
      }
    });
    chrome.runtime.sendMessage({ type: 'GET_ACTIVE_ES_CLUSTER_ID' }, (response) => {
       if (chrome.runtime.lastError) {
        console.error('Error fetching active cluster ID:', chrome.runtime.lastError.message);
        // This error is less critical for initial display, might not show general feedback
        return;
      }
      if (response && response.success) {
        setActiveClusterId(response.data);
      }
    });
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formValues.name.trim()) errors.name = 'Name is required.';
    if (!formValues.host.trim()) errors.host = 'Host is required.';
    if (formValues.port <= 0 || formValues.port > 65535) errors.port = 'Port must be between 1 and 65535.';
    if (formValues.auth.type === 'basic') {
      if (!formValues.auth.username?.trim()) errors.username = 'Username is required for Basic auth.';
      if (!formValues.auth.password?.trim()) errors.password = 'Password is required for Basic auth.';
    } else if (formValues.auth.type === 'apiKey') {
      if (!formValues.auth.apiKey?.trim()) errors.apiKey = 'API Key/Token is required.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: name === 'port' ? parseInt(value, 10) || 0 : value }));
  };

  const handleAuthTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as ESAuthDetails['type'];
    // Reset specific auth fields when type changes to avoid carrying over old values
    setFormValues(prev => ({ ...prev, auth: { type, username: '', password: '', apiKey: '', apiKeyId: '' } }));
  };

  const handleAuthDetailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target; 
    setFormValues(prev => ({ ...prev, auth: { ...prev.auth, [name]: value } }));
  };
  
  const resetFormAndUi = () => {
    setFormValues(initialFormValues);
    setFormErrors({});
    setEditingClusterId(null);
    setTestStatus({}); 
    setUiState('list');
    // generalFeedback is usually set by actions, not cleared here unless specifically needed
  };

  const handleSaveCluster = (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setGeneralFeedback(null);
    const messageType = editingClusterId ? 'UPDATE_ES_CLUSTER' : 'ADD_ES_CLUSTER';
    const payload = editingClusterId ? { clusterId: editingClusterId, updatedConfigPartial: formValues } : { clusterConfig: formValues };
    
    chrome.runtime.sendMessage({ type: messageType, payload }, (response) => {
      if (chrome.runtime.lastError) {
        setGeneralFeedback({type: 'error', message: `Error saving cluster: ${chrome.runtime.lastError.message}`});
      } else if (response && response.success) {
        setGeneralFeedback({type: 'success', message: `Cluster ${editingClusterId ? 'updated' : 'added'} successfully!`});
        resetFormAndUi();
        loadInitialData(); 
      } else {
        setGeneralFeedback({type: 'error', message: `Failed to save cluster: ${response?.message || 'Unknown error'}`});
      }
      clearGeneralFeedback();
    });
  };
  
  const handleEditCluster = (cluster: ESClusterConfig) => {
    setUiState('editForm');
    setEditingClusterId(cluster.id);
    const authDetails: ESAuthDetails = {
        type: cluster.auth.type,
        username: cluster.auth.username || '',
        password: cluster.auth.password || '',
        apiKey: cluster.auth.apiKey || '',
        apiKeyId: cluster.auth.apiKeyId || ''
    };
    setFormValues({ 
        name: cluster.name, 
        host: cluster.host, 
        port: cluster.port, 
        protocol: cluster.protocol, 
        auth: authDetails 
    });
    setFormErrors({});
    setTestStatus({});
    setGeneralFeedback(null);
  };

  const handleRemoveCluster = (clusterId: string) => {
    if (!confirm('Are you sure you want to remove this cluster?')) return;
    setGeneralFeedback(null);
    chrome.runtime.sendMessage({ type: 'REMOVE_ES_CLUSTER', payload: { clusterId } }, (response) => {
      if (chrome.runtime.lastError) {
        setGeneralFeedback({type: 'error', message: `Error removing cluster: ${chrome.runtime.lastError.message}`});
      } else if (response && response.success) {
        setGeneralFeedback({type: 'success', message: 'Cluster removed successfully!'});
        loadInitialData(); 
        if (activeClusterId === clusterId) setActiveClusterId(null); // Update local active ID state
      } else {
        setGeneralFeedback({type: 'error', message: `Failed to remove cluster: ${response?.message || 'Unknown error'}`});
      }
      clearGeneralFeedback();
    });
  };
  
  const handleSetActiveCluster = (clusterId: string) => {
    setGeneralFeedback(null);
    chrome.runtime.sendMessage({ type: 'SET_ACTIVE_ES_CLUSTER_ID', payload: { clusterId } }, (response) => {
      if (chrome.runtime.lastError) {
        setGeneralFeedback({type: 'error', message: `Error setting active cluster: ${chrome.runtime.lastError.message}`});
      } else if (response && response.success) {
        setActiveClusterId(clusterId); 
        setGeneralFeedback({type: 'success', message: 'Active cluster set successfully!'});
      } else {
        setGeneralFeedback({type: 'error', message: `Failed to set active cluster: ${response?.message || 'Unknown error'}`});
      }
      clearGeneralFeedback();
    });
  };

  const handleTestConnection = (clusterConfig: ESClusterConfig | ClusterFormValues, id: string = 'form') => {
    setTestStatus(prev => ({ ...prev, [id]: { status: 'testing', message: 'Testing...' } }));
    setGeneralFeedback(null);

    const configToTest: ESClusterConfig = (clusterConfig as ESClusterConfig).id 
        ? (clusterConfig as ESClusterConfig) 
        : { ... (clusterConfig as ClusterFormValues), id: '_test_config_', createdAt: new Date().toISOString() };

    chrome.runtime.sendMessage({ type: 'TEST_ES_CONNECTION', payload: { clusterConfig: configToTest } }, (response: {success: boolean, data?: ClusterHealth, message?: string}) => {
      if (chrome.runtime.lastError) {
        setTestStatus(prev => ({ ...prev, [id]: { status: 'error', message: `Error: ${chrome.runtime.lastError.message}` } }));
      } else if (response && response.success && response.data) {
        setTestStatus(prev => ({ ...prev, [id]: { status: response.data.status === 'connected' ? 'success' : 'error', message: response.data.message || (response.data.status === 'connected' ? 'Connection successful!' : 'Connection failed.') } }));
      } else {
        setTestStatus(prev => ({ ...prev, [id]: { status: 'error', message: `Failed to test connection: ${response?.message || 'Unknown error'}` } }));
      }
    });
  };

  const renderAuthFields = () => { /* Same as previous implementation */ 
    switch (formValues.auth.type) {
      case 'basic':
        return (
          <>
            <div className="mb-3">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
              <input type="text" name="username" id="username" value={formValues.auth.username || ''} onChange={handleAuthDetailChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              {formErrors.username && <p className="text-xs text-red-500 mt-1">{formErrors.username}</p>}
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <input type="password" name="password" id="password" value={formValues.auth.password || ''} onChange={handleAuthDetailChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              {formErrors.password && <p className="text-xs text-red-500 mt-1">{formErrors.password}</p>}
            </div>
          </>
        );
      case 'apiKey':
        return (
          <>
            <div className="mb-3">
              <label htmlFor="apiKeyId" className="block text-sm font-medium text-gray-700">API Key ID (Optional)</label>
              <input type="text" name="apiKeyId" id="apiKeyId" value={formValues.auth.apiKeyId || ''} onChange={handleAuthDetailChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="For Base64 encoded id:api_key" />
            </div>
            <div className="mb-3">
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">API Key / Bearer Token</label>
              <input type="password" name="apiKey" id="apiKey" value={formValues.auth.apiKey || ''} onChange={handleAuthDetailChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              {formErrors.apiKey && <p className="text-xs text-red-500 mt-1">{formErrors.apiKey}</p>}
            </div>
          </>
        );
      default: // 'none'
        return null;
    }
  };
  
  const renderForm = () => (  /* Same as previous implementation, with minor key for test status */
    <form onSubmit={handleSaveCluster} className="p-4 bg-white shadow rounded-lg space-y-4">
      <h3 className="text-xl font-semibold text-gray-800">{editingClusterId ? 'Edit' : 'Add New'} Cluster</h3>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Cluster Name</label>
        <input type="text" name="name" id="name" value={formValues.name} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="protocol" className="block text-sm font-medium text-gray-700">Protocol</label>
          <select name="protocol" id="protocol" value={formValues.protocol} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option value="http">http</option>
            <option value="https">https</option>
          </select>
        </div>
        <div className="col-span-2">
          <label htmlFor="host" className="block text-sm font-medium text-gray-700">Host</label>
          <input type="text" name="host" id="host" value={formValues.host} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          {formErrors.host && <p className="text-xs text-red-500 mt-1">{formErrors.host}</p>}
        </div>
      </div>
      <div>
        <label htmlFor="port" className="block text-sm font-medium text-gray-700">Port</label>
        <input type="number" name="port" id="port" value={formValues.port} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        {formErrors.port && <p className="text-xs text-red-500 mt-1">{formErrors.port}</p>}
      </div>
      <div>
        <label htmlFor="authType" className="block text-sm font-medium text-gray-700">Authentication Type</label>
        <select name="authType" id="authType" value={formValues.auth.type} onChange={handleAuthTypeChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
          <option value="none">None</option>
          <option value="basic">Basic Auth</option>
          <option value="apiKey">API Key / Bearer Token</option>
        </select>
      </div>
      {renderAuthFields()}

      <div className="flex items-center justify-between mt-6">
        <div className="flex space-x-2">
           <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
            {editingClusterId ? 'Update' : 'Save'} Cluster
          </button>
          <button type="button" onClick={() => handleTestConnection(formValues, editingClusterId || 'form')} className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50">
            Test Connection
          </button>
        </div>
        <button type="button" onClick={() => { setUiState('list'); resetFormAndUi(); }} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500">
          Cancel
        </button>
      </div>
       {testStatus[editingClusterId || 'form'] && (
        <div className={`mt-3 p-2 rounded-md text-sm ${testStatus[editingClusterId || 'form'].status === 'success' ? 'bg-green-100 text-green-700' : testStatus[editingClusterId || 'form'].status === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {testStatus[editingClusterId || 'form'].message}
        </div>
      )}
    </form>
  );

  const renderClusterList = () => ( /* Same as previous implementation */
    <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Managed Clusters</h3>
            <button onClick={() => { setUiState('addForm'); resetFormAndUi(); setGeneralFeedback(null); }} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                Add New Cluster
            </button>
        </div>
         {generalFeedback && (
            <div className={`p-3 rounded-md text-sm mb-4 ${generalFeedback.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {generalFeedback.message}
            </div>
        )}
        {clusters.length === 0 ? (
            <p className="text-gray-500">No clusters configured yet. Click "Add New Cluster" to get started.</p>
        ) : (
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Connection</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clusters.map((cluster) => (
                <tr key={cluster.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{cluster.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{`${cluster.protocol}://${cluster.host}:${cluster.port}`}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {activeClusterId === cluster.id 
                        ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                        : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Inactive</span>
                    }
                    {testStatus[cluster.id] && (
                      <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${testStatus[cluster.id].status === 'success' ? 'bg-green-100 text-green-800' : testStatus[cluster.id].status === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {testStatus[cluster.id].status === 'testing' ? 'Testing...' : testStatus[cluster.id].status === 'success' ? 'OK' : 'Failed'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
                    {activeClusterId !== cluster.id && (
                      <button onClick={() => handleSetActiveCluster(cluster.id)} className="text-indigo-600 hover:text-indigo-900">Set Active</button>
                    )}
                    <button onClick={() => handleTestConnection(cluster, cluster.id)} className="text-green-600 hover:text-green-900">Test</button>
                    <button onClick={() => handleEditCluster(cluster)} className="text-yellow-600 hover:text-yellow-900">Edit</button>
                    <button onClick={() => handleRemoveCluster(cluster.id)} className="text-red-600 hover:text-red-900">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
    </div>
  );

  return (
    <div className="mt-6">
      {uiState === 'list' && renderClusterList()}
      {(uiState === 'addForm' || uiState === 'editForm') && renderForm()}
    </div>
  );
};
