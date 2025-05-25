// background.js - Chrome Extension Background Script

// Handle side panel action
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Elasticsearch Query Helper extension installed');
});

// Handle messages from content scripts and side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  switch (request.action) {
    case 'openSidePanel':
      // Open side panel
      chrome.sidePanel.open({ tabId: sender.tab.id });
      break;
    
    case 'testElasticsearchConnection':
      // Handle Elasticsearch connection testing
      handleElasticsearchConnection(request.config)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep the message channel open for async response
    
    default:
      console.log('Unknown action:', request.action);
  }
});

/**
 * Test Elasticsearch connection
 * @param {Object} config - Elasticsearch cluster configuration
 */
async function handleElasticsearchConnection(config) {
  try {
    // Test connection by making a simple health check
    const response = await fetch(`${config.host}/_cluster/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `ApiKey ${config.apiKey}` }),
        ...(config.username && config.password && {
          'Authorization': `Basic ${btoa(`${config.username}:${config.password}`)}`
        })
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const healthData = await response.json();
    return {
      status: 'connected',
      cluster_name: healthData.cluster_name,
      status: healthData.status,
      number_of_nodes: healthData.number_of_nodes
    };
  } catch (error) {
    console.error('Connection test failed:', error);
    throw error;
  }
}
