import { useState } from 'react';
import ElasticsearchSidePanel from './components/ElasticsearchSidePanel';

function App() {
  const [activeCluster, setActiveCluster] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Handle connection to Elasticsearch cluster
  const handleClusterConnect = (clusterId) => {
    setActiveCluster(clusterId);
    setIsConnected(true);
    setShowSettings(false);
  };

  // Show settings modal when no active cluster or when settings button is clicked
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Elasticsearch Query Helper</h1>
          <button 
            onClick={toggleSettings}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-800 rounded-md text-sm"
          >
            Settings
          </button>
        </div>
        {activeCluster && (
          <div className="text-sm mt-1 flex items-center">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
            <span>{isConnected ? 'Connected to: ' : 'Disconnected: '}{activeCluster}</span>
          </div>
        )}
      </header>

      <main className="flex-grow overflow-hidden">
        <ElasticsearchSidePanel 
          activeCluster={activeCluster}
          isConnected={isConnected}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          onClusterConnect={handleClusterConnect}
        />
      </main>

      <footer className="bg-gray-100 border-t text-center p-2 text-xs text-gray-500">
        Powered by BrowserBee's Multi-Agent Architecture
      </footer>
    </div>
  );
}

export default App;