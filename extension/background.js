// background.js — Service Worker：监听自动更新完成后重载扩展
const BRIDGE = "http://localhost:5174";
const CHECK_INTERVAL = 10 * 1000;
const UPDATE_FLAG_KEY = "cc_self_update_pending";

let knownVersion = chrome.runtime.getManifest().version;

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[UPDATE_FLAG_KEY]?.newValue) {
    pollForReload();
  }
});

async function pollForReload() {
  const data = await chrome.storage.local.get(UPDATE_FLAG_KEY);
  if (!data[UPDATE_FLAG_KEY]) return;

  let retries = 0;
  const timer = setInterval(async () => {
    retries++;
    try {
      const r = await fetch(BRIDGE + "/version", { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      if (d.ok && d.version && d.version !== knownVersion) {
        clearInterval(timer);
        await chrome.storage.local.remove(UPDATE_FLAG_KEY);
        chrome.runtime.reload();
      }
    } catch (_) {}
    if (retries > 30) {
      clearInterval(timer);
      await chrome.storage.local.remove(UPDATE_FLAG_KEY);
    }
  }, CHECK_INTERVAL);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(UPDATE_FLAG_KEY);
});
