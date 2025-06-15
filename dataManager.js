class DataManager {
  constructor() {
    this.sources = [
      {
        name: 'extensionStats',
        url: 'https://pub-079f1d96c32c4039998e87fd3c5b549d.r2.dev/extension-latest.json',
        intervalMinutes: 30,
        lastFetched: null,
        status: 'idle'
      }
    ];
  }
  async init() {
    await this.loadConfig();
    this.checkAndFetchAll();
  }
  async loadConfig() {
    try {
      const { dataSources } = await chrome.storage.local.get('dataSources');

      if (dataSources) {
        for (const source of this.sources) {
          const savedSource = dataSources.find(s => s.name === source.name);
          if (savedSource) {
            source.lastFetched = savedSource.lastFetched;
            source.status = savedSource.status;
            source.error = savedSource.error;
          }
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }
  async saveConfig() {
    await chrome.storage.local.set({ dataSources: this.sources });
  }

  async checkAndFetchAll() {
    for (const source of this.sources) {
      const needsUpdate = !source.lastFetched ||
        (Date.now() - new Date(source.lastFetched).getTime() > source.intervalMinutes * 60 * 1000);

      if (needsUpdate) {
        await this.fetchData(source.name);
      }
    }
  }
  async fetchData(sourceName) {
    const source = this.sources.find(s => s.name === sourceName);
    if (!source) return null; try {
      source.status = 'fetching';
      await this.saveConfig(); const response = await fetch(source.url);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const rawData = await response.json();

      const processedData = rawData;

      console.log('DEBUG INFO - Processed Data:', {
        processedDataType: typeof processedData,
        isArray: Array.isArray(processedData),
        topLevelKeys: typeof processedData === 'object' && !Array.isArray(processedData) ?
          Object.keys(processedData) : [],
        sampleStore: typeof processedData === 'object' && !Array.isArray(processedData) ?
          Object.keys(processedData)[0] : null
      });

      await chrome.storage.local.set({ [sourceName]: processedData });
      source.lastFetched = new Date().toISOString();
      source.status = 'success';
      source.error = undefined;
      await this.saveConfig();

      chrome.runtime.sendMessage({
        action: 'dataUpdated',
        source: sourceName,
        status: 'success'
      });

      return processedData;
    } catch (error) {
      source.status = 'error';
      source.error = error.message;
      await this.saveConfig();

      chrome.runtime.sendMessage({
        action: 'dataUpdated',
        source: sourceName,
        status: 'error',
        error: error.message
      }); return null;
    }
  }

  async getAllData() {
    return await chrome.storage.local.get(null);
  }
}

export default DataManager;
