// Quản lý badge hiển thị số lượng tài khoản khớp với tab hiện tại

async function updateBadgeForTab(tabId, url) {
  if (!url || !url.startsWith('http')) {
    chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }

  try {
    const hostname = new URL(url).hostname;
    const { accounts = [] } = await chrome.storage.local.get('accounts');
    const count = accounts.filter(acc => acc.domain === hostname).length;

    if (count > 0) {
      chrome.action.setBadgeText({ tabId, text: String(count) });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' });
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch (e) {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateBadgeForTab(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      updateBadgeForTab(tab.id, tab.url);
    }
  } catch (e) {
    // Ignore error if tab is closed
  }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local' && changes.accounts) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url) {
      updateBadgeForTab(tabs[0].id, tabs[0].url);
    }
  }
});
