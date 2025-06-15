
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refresh-btn');
  const dataContainer = document.getElementById('data-container');
  const statusDot = document.getElementById('status-dot');
  const metaInfo = document.getElementById('meta-info');

  loadData();
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;

    updateStatus('fetching', 'Fetching...');

    try {
      await chrome.runtime.sendMessage({
        action: 'manualFetch',
        source: 'extensionStats'
      });

      await loadData();
    } catch (error) {
      console.error('Error refreshing data:', error);
      updateStatus('error', 'Error');
      showError(`Failed to refresh data: ${error.message}`);
    } finally {
      refreshBtn.disabled = false;
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'dataUpdated') {
      console.log('Popup received data update:', message);
      loadData();
    }
  });
});

function updateStatus(status, text) {
  const statusDot = document.getElementById('status-dot');

  statusDot.classList.remove('status-idle', 'status-fetching', 'status-success', 'status-error');
  statusDot.classList.add(`status-${status}`);
  statusDot.title = text;
}

async function loadData() {
  const dataContainer = document.getElementById('data-container');
  const metaInfo = document.getElementById('meta-info');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAllData' });

    if (!response.success) {
      throw new Error(response.error || 'Failed to load data');
    }

    const allData = response.data;
    console.log('All data loaded:', allData);

    if (!allData.dataSources || allData.dataSources.length === 0) {
      dataContainer.innerHTML = '<div class="no-data">No data sources configured</div>';
      return;
    }

    const source = allData.dataSources.find(s => s.name === 'extensionStats');
    if (!source) {
      dataContainer.innerHTML = '<div class="no-data">Extension stats source not found</div>';
      return;
    }

    updateStatus(source.status, source.status === 'success' ? 'OK' : source.status.charAt(0).toUpperCase() + source.status.slice(1));

    const extensionData = allData.extensionStats;

    dataContainer.innerHTML = '';

    if (source.status === 'error' && source.error) {
      showError(source.error);
      return;
    }

    if (extensionData && Array.isArray(extensionData) && extensionData.length > 0) {

      const groupedByStore = {};

      for (const item of extensionData) {
        const store = item.store || 'Unknown';
        if (!groupedByStore[store]) {
          groupedByStore[store] = [];
        }
        groupedByStore[store].push(item);
      }

      for (const [storeName, storeItems] of Object.entries(groupedByStore)) {
        const storeHeader = document.createElement('div');
        storeHeader.className = 'store-header';
        storeHeader.textContent = storeName;
        dataContainer.appendChild(storeHeader);

        const displayItems = storeItems.slice(0, 5);
        for (const item of displayItems) {
          const extensionItem = document.createElement('div');
          extensionItem.className = 'extension-item';

          const extensionHeader = document.createElement('div');
          extensionHeader.className = 'extension-header';

          const extensionName = document.createElement('a');
          extensionName.className = 'extension-name';
          extensionName.textContent = item.extension;
          extensionName.title = 'Open in new tab';
          if (item.url) {
            extensionName.href = '#';
            extensionName.addEventListener('click', (e) => {
              e.preventDefault();
              chrome.tabs.create({ url: item.url });
            });
          }
          extensionHeader.appendChild(extensionName);

          const extensionVersion = document.createElement('div');
          extensionVersion.className = 'extension-version';
          extensionVersion.textContent = item.version;
          extensionHeader.appendChild(extensionVersion);

          extensionItem.appendChild(extensionHeader);

          const extensionDetails = document.createElement('div');
          extensionDetails.className = 'extension-details';

          if (item.users) {
            const userCount = document.createElement('div');
            userCount.className = 'detail-item';

            const userLabel = document.createElement('span');
            userLabel.className = 'detail-label';
            userLabel.textContent = 'Users:';
            userCount.appendChild(userLabel);

            const userValue = document.createElement('span');
            userValue.className = 'detail-value';
            userValue.textContent = formatNumber(item.users);
            userCount.appendChild(userValue);

            extensionDetails.appendChild(userCount);
          }

          if (item.lastUpdated) {
            const lastUpdated = document.createElement('div');
            lastUpdated.className = 'detail-item';

            const updatedLabel = document.createElement('span');
            updatedLabel.className = 'detail-label';
            updatedLabel.textContent = 'Updated:';
            lastUpdated.appendChild(updatedLabel);

            const updatedValue = document.createElement('span');
            updatedValue.className = 'detail-value';
            updatedValue.textContent = item.lastUpdated;
            lastUpdated.appendChild(updatedValue);

            extensionDetails.appendChild(lastUpdated);
          }

          if (item.size) {
            const sizeInfo = document.createElement('div');
            sizeInfo.className = 'detail-item';

            const sizeLabel = document.createElement('span');
            sizeLabel.className = 'detail-label';
            sizeLabel.textContent = 'Size:';
            sizeInfo.appendChild(sizeLabel);

            const sizeValue = document.createElement('span');
            sizeValue.className = 'detail-value';
            sizeValue.textContent = item.size;
            sizeInfo.appendChild(sizeValue);

            extensionDetails.appendChild(sizeInfo);
          }

          if (item.lastChecked) {
            const lastChecked = document.createElement('div');
            lastChecked.className = 'detail-item';

            const checkedLabel = document.createElement('span');
            checkedLabel.className = 'detail-label';
            checkedLabel.textContent = 'Checked:';
            lastChecked.appendChild(checkedLabel);

            const checkedValue = document.createElement('span');
            checkedValue.className = 'detail-value';
            checkedValue.textContent = formatRelativeTime(new Date(item.lastChecked));
            lastChecked.appendChild(checkedValue);

            extensionDetails.appendChild(lastChecked);
          }

          extensionItem.appendChild(extensionDetails);
          dataContainer.appendChild(extensionItem);
        }

        if (storeItems.length > 5) {
          const moreText = document.createElement('div');
          moreText.className = 'more-text';
          moreText.textContent = `+ ${storeItems.length - 5} more extensions in ${storeName}`;
          dataContainer.appendChild(moreText);
        }
      }
    } else {
      dataContainer.innerHTML = '<div class="no-data">No extension data available</div>';
    }

    metaInfo.innerHTML = '';

    if (source.lastFetched) {
      const lastFetchedElement = document.createElement('div');
      lastFetchedElement.textContent = `Last updated: ${formatRelativeTime(new Date(source.lastFetched))}`;
      metaInfo.appendChild(lastFetchedElement);
    }

    const intervalElement = document.createElement('div');
    intervalElement.textContent = `Updates every ${source.intervalMinutes} min`;
    metaInfo.appendChild(intervalElement);

  } catch (error) {
    console.error('Error loading data:', error);
    showError(`Failed to load data: ${error.message}`);
  }
}

function showError(message) {
  const dataContainer = document.getElementById('data-container');
  dataContainer.innerHTML = `<div class="error-message">${message}</div>`;
}

function formatNumber(num) {
  if (!num) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ago`;
  }

  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }

  if (diffMin > 0) {
    return `${diffMin}m ago`;
  }

  return 'just now';
}
