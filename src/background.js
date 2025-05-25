// Background script for Elasticsearch Query Helper Extension
// Handles sidepanel behavior and message routing

chrome.runtime.onInstalled.addListener(() => {
  console.log('Elasticsearch Query Helper Extension installed');
});

// Handle action icon clicks - open sidepanel
chrome.action.onClicked.addListener((tab) => {
  // Open the side panel for the current tab
  chrome.sidePanel.open({ tabId: tab.id });
});

// Message handler for communication between sidepanel and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.type) {
    case 'OPEN_SIDE_PANEL':
      chrome.sidePanel.open({ tabId: message.tabId });
      sendResponse({ success: true });
      break;
      
    case 'CLOSE_SIDE_PANEL':
      chrome.sidePanel.close({ tabId: message.tabId });
      sendResponse({ success: true });
      break;
      
    case 'GET_ACTIVE_TAB':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        sendResponse({ tab: tabs[0] });
      });
      return true; // Indicates we will send a response asynchronously
      
    case 'ELASTICSEARCH_QUERY':
      // Handle Elasticsearch queries (can be extended later)
      handleElasticsearchQuery(message.payload)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'QUERY_FEEDBACK':
      // Handle query feedback storage
      handleQueryFeedback(message.payload)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Handle tab updates to maintain sidepanel state
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // You can add logic here to update sidepanel when tab changes
    console.log('Tab updated:', tab.url);
  }
});

// Handle Elasticsearch query execution
async function handleElasticsearchQuery(payload) {
  try {
    const { query, clusterConfig, options } = payload;
    
    // This is a placeholder for actual Elasticsearch query execution
    // In a real implementation, you would:
    // 1. Validate the cluster configuration
    // 2. Execute the query against the Elasticsearch cluster
    // 3. Return the results
    
    console.log('Executing Elasticsearch query:', query);
    console.log('Cluster config:', clusterConfig);
    console.log('Options:', options);
    
    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      query: query,
      results: {
        hits: {
          total: { value: 42 },
          hits: [
            { _id: '1', _source: { title: 'Sample document 1' } },
            { _id: '2', _source: { title: 'Sample document 2' } }
          ]
        }
      },
      executionTime: '125ms'
    };
  } catch (error) {
    console.error('Error executing Elasticsearch query:', error);
    throw error;
  }
}

// Handle query feedback storage
async function handleQueryFeedback(payload) {
  try {
    const { queryId, feedback, comment } = payload;
    
    // Store feedback in chrome.storage
    const feedbackData = {
      queryId,
      feedback,
      comment,
      timestamp: Date.now()
    };
    
    // Get existing feedback
    const result = await chrome.storage.local.get(['queryFeedback']);
    const existingFeedback = result.queryFeedback || [];
    
    // Add new feedback
    existingFeedback.push(feedbackData);
    
    // Store updated feedback
    await chrome.storage.local.set({ queryFeedback: existingFeedback });
    
    console.log('Query feedback stored:', feedbackData);
  } catch (error) {
    console.error('Error storing query feedback:', error);
    throw error;
  }
}

// Initialize sidepanel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(error => console.error('Error setting panel behavior:', error));
