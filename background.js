import DataManager from './dataManager.js';

const dataManager = new DataManager();

dataManager.init().then(() => {
  console.log('DataManager initialized');
});

const CHECK_INTERVAL_MINUTES = 5;
const ALARM_NAME = 'checkDataSources';

chrome.alarms.create(ALARM_NAME, {
  periodInMinutes: CHECK_INTERVAL_MINUTES
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('Alarm triggered to check data sources');
    dataManager.checkAndFetchAll();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);

  if (message.action === 'manualFetch') {
    dataManager.manualFetch(message.source)
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  if (message.action === 'getData') {
    dataManager.getData(message.source)
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.action === 'getAllData') {
    dataManager.getAllData()
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed or updated:', details.reason);
  if (details.reason === 'install' || details.reason === 'update') {
    dataManager.checkAndFetchAll();
  }
});
