// src/services/elasticsearch/ESConfigManager.ts
export class ESConfigManager {
  async loadData(storageKey: string): Promise<any | null> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        console.warn('chrome.storage.local is not available. Returning null.');
        resolve(null);
        return;
      }
      chrome.storage.local.get([storageKey], (result) => {
        if (chrome.runtime.lastError) {
          console.error(
            `Error loading data for key "${storageKey}":`,
            chrome.runtime.lastError.message
          );
          resolve(null);
        } else {
          resolve(result[storageKey] || null);
        }
      });
    });
  }

  async saveData(storageKey: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        console.warn('chrome.storage.local is not available. Data not saved.');
        // In a real scenario, you might want to reject or handle this more gracefully
        // depending on whether saving is critical. For this example, we'll resolve
        // but log a warning, implying data might not be persisted.
        resolve(); 
        return;
      }
      chrome.storage.local.set({ [storageKey]: data }, () => {
        if (chrome.runtime.lastError) {
          console.error(
            `Error saving data for key "${storageKey}":`,
            chrome.runtime.lastError.message
          );
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}
