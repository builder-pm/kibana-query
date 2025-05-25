import React, { useState } from 'react';

const ESSettingsModal = ({ onClose, onConnect, activeCluster }) => {
  const [step, setStep] = useState('connection');
  const [connectionType, setConnectionType] = useState('direct');
  const [clusterName, setClusterName] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('9200');
  const [protocol, setProtocol] = useState('http');
  const [authMethod, setAuthMethod] = useState('none');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [indexPatterns, setIndexPatterns] = useState('');
  const [testStatus, setTestStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTestConnection = async () => {
    setIsLoading(true);
    setTestStatus(null);
    
    try {
      // In a real implementation, this would call the ESClusterManager to test the connection
      // For demo purposes, we'll simulate a delay and success
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock success
      setTestStatus({ success: true, message: "Connection successful! Elasticsearch v7.10.0" });
      setStep('schema');
    } catch (err) {
      setTestStatus({ success: false, message: err.message || "Failed to connect to Elasticsearch" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveConnection = () => {
    // Generate cluster ID - in a real implementation, this would be more robust
    const clusterId = `${clusterName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    
    // Create cluster config
    const clusterConfig = {
      id: clusterId,
      name: clusterName,
      host,
      port,
      protocol,
      auth: {
        type: authMethod,
        username: authMethod === 'basic' ? username : undefined,
        password: authMethod === 'basic' ? password : undefined,
        apiKey: authMethod === 'apiKey' ? apiKey : undefined
      },
      indexPatterns: indexPatterns.split(',').map(p => p.trim()).filter(Boolean)
    };
    
    // Call connect handler
    onConnect(clusterId);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4">
          <h2 className="text-lg font-semibold">
            {step === 'connection' ? 'Connect to Elasticsearch Cluster' : 'Configure Index Schema'}
          </h2>
        </div>
        
        {/* Body */}
        <div className="p-6">
          {step === 'connection' && (
            <div className="space-y-4">
              {/* Connection Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Connection Type</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="connectionType"
                      value="direct"
                      checked={connectionType === 'direct'}
                      onChange={() => setConnectionType('direct')}
                      className="mr-2"
                    />
                    <span>Direct Connection</span>
                  </label>
                  <label className="flex items-center opacity-50 cursor-not-allowed">
                    <input
                      type="radio"
                      name="connectionType"
                      value="cloud"
                      disabled
                      className="mr-2"
                    />
                    <span>Elastic Cloud (Coming Soon)</span>
                  </label>
                </div>
              </div>
              
              {/* Cluster Name */}
              <div>
                <label htmlFor="clusterName" className="block text-sm font-medium text-gray-700 mb-1">
                  Cluster Name
                </label>
                <input
                  type="text"
                  id="clusterName"
                  value={clusterName}
                  onChange={(e) => setClusterName(e.target.value)}
                  placeholder="My Elasticsearch Cluster"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              
              {/* Connection Details Group */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-3">
                  <label htmlFor="protocol" className="block text-sm font-medium text-gray-700 mb-1">
                    Protocol
                  </label>
                  <select
                    id="protocol"
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
                </div>
                <div className="col-span-6">
                  <label htmlFor="host" className="block text-sm font-medium text-gray-700 mb-1">
                    Host
                  </label>
                  <input
                    type="text"
                    id="host"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="localhost"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="col-span-3">
                  <label htmlFor="port" className="block text-sm font-medium text-gray-700 mb-1">
                    Port
                  </label>
                  <input
                    type="text"
                    id="port"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="9200"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              {/* Authentication */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Authentication</label>
                <select
                  value={authMethod}
                  onChange={(e) => setAuthMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
                >
                  <option value="none">No Authentication</option>
                  <option value="basic">Basic Auth</option>
                  <option value="apiKey">API Key</option>
                </select>
                
                {authMethod === 'basic' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                )}
                
                {authMethod === 'apiKey' && (
                  <div>
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      id="apiKey"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                )}
              </div>
              
              {/* Test Status */}
              {testStatus && (
                <div className={`p-3 rounded ${testStatus.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {testStatus.message}
                </div>
              )}
            </div>
          )}
          
          {step === 'schema' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="indexPatterns" className="block text-sm font-medium text-gray-700 mb-1">
                  Index Patterns (comma separated)
                </label>
                <input
                  type="text"
                  id="indexPatterns"
                  value={indexPatterns}
                  onChange={(e) => setIndexPatterns(e.target.value)}
                  placeholder="my-index-*,another-index"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to discover all indices. Using specific patterns improves performance.
                </p>
              </div>
              
              <div className="bg-yellow-50 p-3 rounded text-sm">
                <p className="font-medium text-yellow-700">Schema Discovery</p>
                <p className="text-yellow-600 mt-1">
                  The extension will automatically discover the schema when you connect. 
                  You can later upload reference queries to improve results.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-between">
          {step === 'connection' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleTestConnection}
                disabled={isLoading || !clusterName || !host || !port}
                className={`px-4 py-2 text-sm text-white rounded ${
                  isLoading || !clusterName || !host || !port
                    ? 'bg-blue-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isLoading ? 'Testing...' : 'Test & Continue'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('connection')}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                Back
              </button>
              <button
                onClick={handleSaveConnection}
                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
              >
                Save & Connect
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ESSettingsModal;
