import React, { useState, useEffect } from 'react';

/**
 * ESSettingsModal component
 *
 * Modal dialog for configuring, adding, selecting, and removing Elasticsearch clusters.
 * Provides forms for entering connection details and displays the list of configured clusters.
 */
const ESSettingsModal = ({ 
  onClose,
  clusters = [],
  activeCluster = null,
  onClusterAdd,
  onClusterSelect,
  onClusterRemove
}) => {
  // State for new cluster form
  const [formValues, setFormValues] = useState({
    name: '',
    host: 'localhost',
    port: 9200,
    protocol: 'http',
    auth: {
      type: 'none',
      username: '',
      password: '',
      apiKey: ''
    }
  });
  
  // State for form validation
  const [formErrors, setFormErrors] = useState({});
  
  // Track current tab (Configure/Manage)
  const [activeTab, setActiveTab] = useState('configure');
  
  // Selected cluster for management
  const [selectedCluster, setSelectedCluster] = useState(null);
  
  // Test connection status
  const [testStatus, setTestStatus] = useState(null);
  
  // Effect for setting selected cluster when active cluster changes
  useEffect(() => {
    if (activeCluster) {
      const cluster = clusters.find(c => c.id === activeCluster);
      setSelectedCluster(cluster?.id || null);
    }
  }, [activeCluster, clusters]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      // Handle nested properties (like auth.type)
      const [parent, child] = name.split('.');
      setFormValues(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormValues(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error for this field if any
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  const validateForm = () => {
    const errors = {};
    
    if (!formValues.name.trim()) {
      errors.name = 'Cluster name is required';
    }
    
    if (!formValues.host.trim()) {
      errors.host = 'Host is required';
    }
    
    if (!formValues.port) {
      errors.port = 'Port is required';
    } else if (isNaN(formValues.port) || formValues.port <= 0) {
      errors.port = 'Port must be a positive number';
    }
    
    // Validate auth fields if auth type is not 'none'
    if (formValues.auth.type === 'basic') {
      if (!formValues.auth.username.trim()) {
        errors['auth.username'] = 'Username is required';
      }
      if (!formValues.auth.password.trim()) {
        errors['auth.password'] = 'Password is required';
      }
    } else if (formValues.auth.type === 'apiKey') {
      if (!formValues.auth.apiKey.trim()) {
        errors['auth.apiKey'] = 'API Key is required';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleAddCluster = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Convert port to number
    const clusterConfig = {
      ...formValues,
      port: Number(formValues.port)
    };
    
    // Call parent handler
    onClusterAdd(clusterConfig);
    
    // Reset form
    setFormValues({
      name: '',
      host: 'localhost',
      port: 9200,
      protocol: 'http',
      auth: {
        type: 'none',
        username: '',
        password: '',
        apiKey: ''
      }
    });
    
    // Switch to manage tab
    setActiveTab('manage');
  };
  
  const handleTestConnection = () => {
    if (!validateForm()) {
      return;
    }
    
    setTestStatus('testing');
    
    // In a real implementation, this would call a service to test the connection
    // For demo purposes, simulate a successful connection after delay
    setTimeout(() => {
      setTestStatus('success');
      
      // Reset after 3 seconds
      setTimeout(() => {
        setTestStatus(null);
      }, 3000);
    }, 1000);
  };
  
  const renderConfigureTab = () => {
    return (
      <form onSubmit={handleAddCluster} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Cluster Name
          </label>
          <input
            type="text"
            name="name"
            value={formValues.name}
            onChange={handleInputChange}
            className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              formErrors.name ? 'border-red-500' : ''
            }`}
            placeholder="My Elasticsearch Cluster"
          />
          {formErrors.name && (
            <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Protocol
            </label>
            <select
              name="protocol"
              value={formValues.protocol}
              onChange={handleInputChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Host
            </label>
            <input
              type="text"
              name="host"
              value={formValues.host}
              onChange={handleInputChange}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                formErrors.host ? 'border-red-500' : ''
              }`}
              placeholder="localhost"
            />
            {formErrors.host && (
              <p className="mt-1 text-sm text-red-600">{formErrors.host}</p>
            )}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Port
          </label>
          <input
            type="number"
            name="port"
            value={formValues.port}
            onChange={handleInputChange}
            className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              formErrors.port ? 'border-red-500' : ''
            }`}
            placeholder="9200"
          />
          {formErrors.port && (
            <p className="mt-1 text-sm text-red-600">{formErrors.port}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Authentication
          </label>
          <select
            name="auth.type"
            value={formValues.auth.type}
            onChange={handleInputChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="none">No Authentication</option>
            <option value="basic">Basic Authentication</option>
            <option value="apiKey">API Key</option>
          </select>
        </div>
        
        {formValues.auth.type === 'basic' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                name="auth.username"
                value={formValues.auth.username}
                onChange={handleInputChange}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  formErrors['auth.username'] ? 'border-red-500' : ''
                }`}
              />
              {formErrors['auth.username'] && (
                <p className="mt-1 text-sm text-red-600">{formErrors['auth.username']}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                name="auth.password"
                value={formValues.auth.password}
                onChange={handleInputChange}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  formErrors['auth.password'] ? 'border-red-500' : ''
                }`}
              />
              {formErrors['auth.password'] && (
                <p className="mt-1 text-sm text-red-600">{formErrors['auth.password']}</p>
              )}
            </div>
          </div>
        )}
        
        {formValues.auth.type === 'apiKey' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API Key
            </label>
            <input
              type="password"
              name="auth.apiKey"
              value={formValues.auth.apiKey}
              onChange={handleInputChange}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                formErrors['auth.apiKey'] ? 'border-red-500' : ''
              }`}
            />
            {formErrors['auth.apiKey'] && (
              <p className="mt-1 text-sm text-red-600">{formErrors['auth.apiKey']}</p>
            )}
          </div>
        )}
        
        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
          >
            {testStatus === 'testing' ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Testing...
              </>
            ) : testStatus === 'success' ? (
              <>
                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Connection Successful
              </>
            ) : (
              'Test Connection'
            )}
          </button>
          
          <div>
            <button
              type="button"
              onClick={onClose}
              className="mr-2 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Add Cluster
            </button>
          </div>
        </div>
      </form>
    );
  };
  
  const renderManageTab = () => {
    if (clusters.length === 0) {
      return (
        <div className="py-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No clusters configured yet. Switch to the Configure tab to add a cluster.
          </p>
          <button
            onClick={() => setActiveTab('configure')}
            className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Add New Cluster
          </button>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-md">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                  Cluster Name
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                  Connection
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                  Status
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {clusters.map(cluster => (
                <tr 
                  key={cluster.id}
                  className={`${cluster.id === activeCluster ? 'bg-blue-50 dark:bg-blue-900' : ''}`}
                >
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-200">
                    {cluster.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {cluster.protocol}://{cluster.host}:{cluster.port}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    {cluster.id === activeCluster ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm-1.5-6L17 9.5 15.5 8l-5 5-2-2L7 12.5l3.5 3.5z" clipRule="evenodd" />
                        </svg>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-4 pl-3 pr-4 text-sm text-right space-x-1">
                    {cluster.id !== activeCluster && (
                      <button
                        onClick={() => onClusterSelect(cluster.id)}
                        className="inline-flex items-center text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Select
                      </button>
                    )}
                    <button
                      onClick={() => onClusterRemove(cluster.id)}
                      className="inline-flex items-center text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <button
            onClick={() => setActiveTab('configure')}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add New Cluster
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Done
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        {/* Modal container */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Modal header */}
          <div className="bg-gray-50 dark:bg-gray-750 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                Elasticsearch Settings
              </h3>
              <button 
                onClick={onClose}
                className="bg-white dark:bg-gray-700 rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex mt-3 border-b border-gray-200 dark:border-gray-700">
              <button
                className={`py-2 px-4 text-sm font-medium border-b-2 ${
                  activeTab === 'configure'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                } focus:outline-none`}
                onClick={() => setActiveTab('configure')}
              >
                Configure
              </button>
              <button
                className={`py-2 px-4 text-sm font-medium border-b-2 ${
                  activeTab === 'manage'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                } focus:outline-none`}
                onClick={() => setActiveTab('manage')}
              >
                Manage Clusters
              </button>
            </div>
          </div>
          
          {/* Modal content */}
          <div className="px-4 py-5">
            {activeTab === 'configure' ? renderConfigureTab() : renderManageTab()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ESSettingsModal;
