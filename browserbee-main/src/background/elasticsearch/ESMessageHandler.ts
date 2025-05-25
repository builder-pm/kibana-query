import { ElasticsearchAgentCore } from '../../agent/elasticsearch/ElasticsearchAgentCore';

// Define a more specific type for messages for better type safety.
interface ESMessage {
  type: string;
  payload?: any;
  target?: string; // For routing messages if needed
}

export class ESMessageHandler {
  private agentCore: ElasticsearchAgentCore;

  constructor() {
    // ElasticsearchAgentCore's constructor initializes its own dependencies,
    // including ESConfigManager and QueryLibraryManager.
    // QueryLibraryManager's async loadAndInitializeLibrary is called within ElasticsearchAgentCore's constructor.
    this.agentCore = new ElasticsearchAgentCore();
    console.log('ESMessageHandler initialized with ElasticsearchAgentCore.');
  }

  public async handleMessage(
    message: ESMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<boolean | undefined> { // Return true if sendResponse is asynchronous
    console.log('ESMessageHandler received message:', { message, sender: sender?.tab?.url || sender?.id });

    // Basic routing: Ensure the message is intended for this handler.
    // This is a conceptual check; actual routing might be handled by the main message listener.
    if (message.target !== 'elasticsearch' && message.type && !message.type.startsWith('ES_')) {
        // console.log('Message not targeted for ESMessageHandler, ignoring.');
        // return false; // Indicate that this handler will not respond
    }


    switch (message.type) {
      case 'GENERATE_ES_QUERY': // Matches type from subtask description
      // case 'ES_GENERATE_QUERY': // Alternative naming convention
        try {
          if (!message.payload) {
            throw new Error('Payload is missing for GENERATE_ES_QUERY');
          }
          const { userInput, clusterId, indexPattern } = message.payload;
          if (typeof userInput !== 'string' || typeof clusterId !== 'string') {
            throw new Error('Invalid payload: userInput and clusterId must be strings.');
          }

          console.log(`Handling GENERATE_ES_QUERY for cluster: ${clusterId}, input: "${userInput}", index: "${indexPattern || 'any'}"`);
          // The generateQuery method in agentCore now returns a more complex object.
          // The UI/caller side will need to be aware of this new structure.
          this.agentCore.generateQuery(userInput, clusterId, indexPattern)
            .then(result => sendResponse({ status: 'success', data: result })) // result is now GenerateQueryResult
            .catch(e => {
                console.error('Error in agentCore.generateQuery:', e);
                sendResponse({ status: 'error', message: e.message || 'Unknown error occurred during query generation' });
            });
          return true; 
        } catch (e: any) {
          console.error('Error handling GENERATE_ES_QUERY before calling agentCore:', e);
          sendResponse({ status: 'error', message: e.message || 'Unknown error occurred' });
          return false; 
        }

      case 'VALIDATE_ES_QUERY':
        try {
            if (!message.payload) {
                throw new Error('Payload is missing for VALIDATE_ES_QUERY');
            }
            // Renamed query to queryToValidate for clarity in the payload from UI
            const { queryToValidate, clusterId, indexPattern } = message.payload; 
            if (typeof queryToValidate !== 'object' || typeof clusterId !== 'string') {
                throw new Error('Invalid payload: queryToValidate must be an object and clusterId a string.');
            }
            console.log(`Handling VALIDATE_ES_QUERY for cluster: ${clusterId}, index: "${indexPattern || 'any'}"`);
            this.agentCore.validateESQuery(queryToValidate, clusterId, indexPattern) // Call updated method
                .then(result => sendResponse({ status: 'success', data: result })) // result is ValidationToolOutput
                .catch(e => {
                    console.error('Error in agentCore.validateESQuery:', e);
                    sendResponse({ status: 'error', message: e.message || 'Unknown error occurred during query validation' });
                });
            return true; 
        } catch (e: any) {
            console.error('Error handling VALIDATE_ES_QUERY before calling agentCore:', e);
            sendResponse({ status: 'error', message: e.message || 'Unknown error occurred' });
            return false;
        }

      case 'EXPLAIN_ES_QUERY':
        try {
            if (!message.payload) {
                throw new Error('Payload is missing for EXPLAIN_ES_QUERY');
            }
            // Renamed query to queryToExplain for clarity
            const { queryToExplain, clusterId, indexPattern } = message.payload; 
            // documentId is not used by the new explainESQuery method, so it's removed from destructuring here.
            // If it were still needed, it would be passed along.
            if (typeof queryToExplain !== 'object') { // clusterId and indexPattern are optional for explainESQuery
                throw new Error('Invalid payload: queryToExplain must be an object.');
            }
            console.log(`Handling EXPLAIN_ES_QUERY for cluster: "${clusterId || 'N/A'}", index: "${indexPattern || 'N/A'}"`);
            this.agentCore.explainESQuery(queryToExplain, clusterId, indexPattern) // Call updated method
                .then(result => sendResponse({ status: 'success', data: result })) // result is ExplanationToolOutput
                .catch(e => {
                    console.error('Error in agentCore.explainESQuery:', e);
                    sendResponse({ status: 'error', message: e.message || 'Unknown error occurred during query explanation' });
                });
            return true;
        } catch (e: any) {
            console.error('Error handling EXPLAIN_ES_QUERY before calling agentCore:', e);
            sendResponse({ status: 'error', message: e.message || 'Unknown error occurred' });
            return false;
        }

      case 'IMPORT_ES_QUERY_LIBRARY':
        try {
          if (!message.payload || typeof message.payload.jsonData !== 'string') {
            throw new Error('Payload with jsonData string is missing for IMPORT_ES_QUERY_LIBRARY');
          }
          const { jsonData } = message.payload;
          console.log(`Handling IMPORT_ES_QUERY_LIBRARY`);
          this.agentCore.importQueryLibraryFromJson(jsonData)
            .then(result => sendResponse(result)) // result should be { success: boolean, message?: string }
            .catch(e => {
              console.error('Error in agentCore.importQueryLibraryFromJson:', e);
              sendResponse({ success: false, message: e.message || 'Unknown error occurred during library import' });
            });
          return true; // Async response
        } catch (e: any) {
          console.error('Error handling IMPORT_ES_QUERY_LIBRARY before calling agentCore:', e);
          sendResponse({ success: false, message: e.message || 'Unknown error occurred' });
          return false;
        }

      // ---- ESConnectionManager related messages ----
      case 'GET_ES_CLUSTERS':
        this.agentCore.esConnectionManager.getClusters()
          .then(clusters => sendResponse({ success: true, data: clusters }))
          .catch(e => sendResponse({ success: false, message: e.message || 'Failed to get clusters' }));
        return true;

      case 'GET_ACTIVE_ES_CLUSTER_ID':
        this.agentCore.esConnectionManager.getActiveClusterId()
          .then(activeId => sendResponse({ success: true, data: activeId }))
          .catch(e => sendResponse({ success: false, message: e.message || 'Failed to get active cluster ID' }));
        return true;
      
      case 'ADD_ES_CLUSTER':
        try {
          if (!message.payload || !message.payload.clusterConfig) {
            throw new Error('Payload with clusterConfig is missing for ADD_ES_CLUSTER');
          }
          this.agentCore.esConnectionManager.addCluster(message.payload.clusterConfig)
            .then(newCluster => sendResponse({ success: true, data: newCluster }))
            .catch(e => sendResponse({ success: false, message: e.message || 'Failed to add cluster' }));
          return true;
        } catch (e: any) {
          sendResponse({ success: false, message: e.message });
          return false;
        }

      case 'UPDATE_ES_CLUSTER':
        try {
          if (!message.payload || !message.payload.clusterId || !message.payload.updatedConfigPartial) {
            throw new Error('Payload with clusterId and updatedConfigPartial is missing for UPDATE_ES_CLUSTER');
          }
          const { clusterId, updatedConfigPartial } = message.payload;
          this.agentCore.esConnectionManager.updateCluster(clusterId, updatedConfigPartial)
            .then(updatedCluster => sendResponse({ success: true, data: updatedCluster }))
            .catch(e => sendResponse({ success: false, message: e.message || 'Failed to update cluster' }));
          return true;
        } catch (e: any) {
          sendResponse({ success: false, message: e.message });
          return false;
        }

      case 'REMOVE_ES_CLUSTER':
        try {
          if (!message.payload || !message.payload.clusterId) {
            throw new Error('Payload with clusterId is missing for REMOVE_ES_CLUSTER');
          }
          this.agentCore.esConnectionManager.removeCluster(message.payload.clusterId)
            .then(() => sendResponse({ success: true }))
            .catch(e => sendResponse({ success: false, message: e.message || 'Failed to remove cluster' }));
          return true;
        } catch (e: any) {
          sendResponse({ success: false, message: e.message });
          return false;
        }
        
      case 'SET_ACTIVE_ES_CLUSTER_ID':
        try {
          if (!message.payload || message.payload.clusterId === undefined) { // Allow null clusterId
            throw new Error('Payload with clusterId is missing for SET_ACTIVE_ES_CLUSTER_ID');
          }
          this.agentCore.esConnectionManager.setActiveClusterId(message.payload.clusterId)
            .then(() => sendResponse({ success: true }))
            .catch(e => sendResponse({ success: false, message: e.message || 'Failed to set active cluster' }));
          return true;
        } catch (e: any) {
          sendResponse({ success: false, message: e.message });
          return false;
        }

      case 'TEST_ES_CONNECTION':
        try {
          if (!message.payload || !message.payload.clusterConfig) {
            throw new Error('Payload with clusterConfig is missing for TEST_ES_CONNECTION');
          }
          this.agentCore.esConnectionManager.testConnection(message.payload.clusterConfig)
            .then(health => sendResponse({ success: true, data: health }))
            .catch(e => sendResponse({ success: false, message: e.message || 'Failed to test connection' }));
          return true;
        } catch (e: any) {
          sendResponse({ success: false, message: e.message });
          return false;
        }
        
      default:
        // Only respond if message seems targeted for ES, otherwise ignore.
        if (message.target === 'elasticsearch' || (message.type && message.type.startsWith('ES_'))) {
            console.log('ESMessageHandler received unhandled message type:', message.type);
            sendResponse({ status: 'info', message: `Unhandled Elasticsearch message type: ${message.type}` });
        } else {
            // console.log('ESMessageHandler ignored message of type:', message.type);
        }
        return false; // No async response from this handler for this message type
    }
  }
}

// Conceptual usage in a background script (e.g., src/background/index.ts or a dedicated message router)
//
// import { ESMessageHandler } from './elasticsearch/ESMessageHandler';
//
// const esMessageHandler = new ESMessageHandler(); // Instantiate the handler
//
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   // Example: Check if the message is intended for ESMessageHandler
//   // This could be based on a property like `message.target === 'elasticsearch'`
//   // or by checking message.type prefixes like 'ES_'.
//   if (message.target === 'elasticsearch' || (message.type && message.type.startsWith('ES_'))) {
//     // Pass to the ESMessageHandler and return true to indicate async response.
//     return esMessageHandler.handleMessage(message, sender, sendResponse);
//   }
//   // If not for ESMessageHandler, potentially pass to other handlers or return false/undefined.
//   // console.log("Message not for ESMessageHandler:", message.type);
//   return false; 
// });
// console.log('Elasticsearch message handling logic set up in background.');
//
// // Ensure ESConfigManager and QueryLibraryManager are available and initialized
// // as they are dependencies for ElasticsearchAgentCore.
// // ESConfigManager is assumed to work with chrome.storage.local.
// // QueryLibraryManager uses ESConfigManager for persistence.
// // The instantiation of ElasticsearchAgentCore (and thus its dependencies) happens
// // within the ESMessageHandler constructor.
//
// // Note: The subtask assumes ESConnectionManager.ts and ESSchemaManager.ts exist.
// // If these files are missing or empty, ElasticsearchAgentCore instantiation might log errors
// // (e.g., if their constructors are not defined or if they throw errors).
// // For this subtask, we are proceeding with the assumption they are importable.
