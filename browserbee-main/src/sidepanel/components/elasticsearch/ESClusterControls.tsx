import React, { ChangeEvent } from 'react';
import { ESClusterConfig } from '../../../services/elasticsearch/types'; // Assuming types are here

interface ESClusterControlsProps {
  activeCluster: ESClusterConfig | null;
  availableClusters: ESClusterConfig[];
  onSetClusterActive: (clusterId: string) => void;
  onOpenSettings: () => void;
  isLoading?: boolean; // Optional: To show a loading state
}

export const ESClusterControls: React.FC<ESClusterControlsProps> = ({
  activeCluster,
  availableClusters,
  onSetClusterActive,
  onOpenSettings,
  isLoading = false
}) => {
  const handleClusterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newActiveClusterId = event.target.value;
    if (newActiveClusterId) {
      onSetClusterActive(newActiveClusterId);
    }
  };

  return (
    <div className="p-3 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {isLoading ? (
            <span className="text-gray-500">Loading clusters...</span>
          ) : activeCluster ? (
            <>
              <span className="font-medium text-gray-700">Active Cluster:</span>
              <span className="ml-1 px-2 py-0.5 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                {activeCluster.name}
              </span>
              <span className="text-xs text-gray-500 ml-1">({activeCluster.host})</span>
            </>
          ) : (
            <span className="text-gray-500">No active cluster selected.</span>
          )}
        </div>
        <button
            onClick={onOpenSettings}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
        >
            Manage Clusters
        </button>
      </div>

      {availableClusters && availableClusters.length > 0 && (
        <div className="mt-2">
          <label htmlFor="clusterSelector" className="sr-only">Select active cluster</label>
          <select
            id="clusterSelector"
            value={activeCluster?.id || ''}
            onChange={handleClusterChange}
            disabled={isLoading || availableClusters.length === 0}
            className="block w-full pl-3 pr-10 py-1.5 text-xs border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md disabled:bg-gray-100"
          >
            <option value="" disabled={!!activeCluster}>
              {activeCluster ? 'Change active cluster...' : 'Select a cluster...'}
            </option>
            {availableClusters.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>
                {cluster.name} ({cluster.host})
              </option>
            ))}
          </select>
        </div>
      )}
       {availableClusters && availableClusters.length === 0 && !isLoading && (
         <p className="text-xs text-gray-500 mt-1">
            No clusters configured. Click "Manage Clusters" to add one.
        </p>
       )}
    </div>
  );
};
