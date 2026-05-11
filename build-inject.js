#!/usr/bin/env node
// build-inject.js — 构建控制台注入版
// 用法：node build-inject.js → 输出 dist/inject-console.js

import { readFileSync, writeFileSync, mkdirSync } from "fs";

const css = readFileSync("extension/content.css", "utf-8");
const bridgeJs = readFileSync("extension/inject-bridge.js", "utf-8");
let js = readFileSync("extension/content.js", "utf-8");

// 1. Remove sub-frame guard (lines 2-11 approximately)
js = js.replace(/\s*if \(window\.top !== window\) \{[\s\S]*?return;\s*\}/, "");

// 2. Remove chrome extension bridge injection block and replace requestSelection
js = js.replace(
  /\/\/ =+ PROSEMIRROR BRIDGE[\s\S]*?const BRIDGE_SCRIPT_URL[^;]+;\s*\(function \(\) \{[^}]*document\.documentElement\.appendChild\(s\);\s*\}\)\(\);/,
  ""
);

// requestSelection now uses postMessage which works in MAIN world with the bridge listener
// No replacement needed — the function already calls window.postMessage({ type: "__CC_READ_SEL__" })

// 3. Replace chrome.storage.local.set for STORAGE_KEY (conversation persistence)
js = js.replace(
  /chrome\.storage\.local\.set\(\{ \[STORAGE_KEY\]: ([\s\S]*?)\}\);/,
  (_, inner) => `localStorage.setItem(STORAGE_KEY, JSON.stringify(${inner.trim()}));`
);

// 4. Replace chrome.storage.local.get for STORAGE_KEY
js = js.replace(
  /const data = await chrome\.storage\.local\.get\(STORAGE_KEY\);\s*const saved = data\[STORAGE_KEY\] \|\| \[\];/,
  `let saved = []; try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(_) {}`
);

// 5. Remove __CC_WPS_INJECTED__ guard (our wrapper handles it)
js = js.replace(/if \(window\.__CC_WPS_INJECTED__\) return;\s*window\.__CC_WPS_INJECTED__ = true;/, "");

// 6. Replace ALL remaining chrome.storage.local with __csLocal shim
//    (covers version check, update dismiss, self-update pending, etc.)
js = js.replace(/chrome\.storage\.local/g, '__csLocal');

// 7. After health check, notify parent frame (for WOA FAB status dot)
js = js.replace(
  'statusDot.className = "cc-status-dot " + (bridgeOnline ? "cc-online" : "cc-offline");',
  'statusDot.className = "cc-status-dot " + (bridgeOnline ? "cc-online" : "cc-offline"); try { if (window.parent !== window) window.parent.postMessage({ type: "__CC_HEALTH__", online: bridgeOnline }, "*"); } catch(_) {}'
);

// 8. After update check, notify parent frame (for WOA FAB update dot)
js = js.replace(
  'function showUpdateBanner(info) {',
  'function showUpdateBanner(info) { try { if (window.parent !== window) window.parent.postMessage({ type: "__CC_UPDATE__", hasUpdate: true }, "*"); } catch(_) {}'
);
js = js.replace(
  'function hideUpdateBanner() {',
  'function hideUpdateBanner() { try { if (window.parent !== window) window.parent.postMessage({ type: "__CC_UPDATE__", hasUpdate: false }, "*"); } catch(_) {}'
);

// 9. Accept dynamic docUrl/docTitle from WOA relay via __CC_SEL__ messages
js = js.replace(
  'if (panel.classList.contains("cc-visible")) updateSelectionBar();',
  'if (e.data.docUrl) { window.__CC_DOC_URL__ = e.data.docUrl; window.__CC_DOC_TITLE__ = e.data.docTitle || ""; }\n      if (panel.classList.contains("cc-visible")) updateSelectionBar();'
);

// 10. Make requestSelection also notify parent frame (for WOA relay mode)
js = js.replace(
  'function requestSelection() { window.postMessage({ type: "__CC_READ_SEL__" }, "*"); }',
  'function requestSelection() { window.postMessage({ type: "__CC_READ_SEL__" }, "*"); try { if (window.parent !== window) window.parent.postMessage({ type: "__CC_READ_SEL__" }, "*"); } catch(_) {} }'
);

// 11. Replace browser-extension-only self-update with iframe-friendly version
js = js.replace(
  '__csLocal.set({ cc_self_update_pending: true });',
  '/* cc_self_update_pending: skipped in non-extension context */'
);
js = js.replace('更新完成，扩展即将自动重载…', '更新完成！即将刷新…');
js = js.replace('更新完成！请刷新页面以加载新版扩展。', '更新完成！请手动刷新面板。');
js = js.replace(
  'refreshBtn.textContent = "刷新页面";',
  'refreshBtn.textContent = "刷新面板";'
);
js = js.replace(
  /LOG\("\[update\] bridge restarted.*?"\);/,
  'LOG("[update] bridge restarted");'
);
js = js.replace(
  /textEl\.innerHTML = "更新完成！即将刷新…";\s*\/\/ 兜底/,
  'textEl.innerHTML = "更新完成！即将刷新…"; setTimeout(() => location.reload(), 2000); //'
);

// __csLocal shim definition
const storageShim = `
var __csLocal = {
  get: function(key, cb) {
    var r = {}; try { r[key] = JSON.parse(localStorage.getItem('_cs_' + key)); } catch(_) {}
    if (typeof cb === 'function') { cb(r); return; }
    return Promise.resolve(r);
  },
  set: function(obj, cb) {
    Object.keys(obj).forEach(function(k) { localStorage.setItem('_cs_' + k, JSON.stringify(obj[k])); });
    if (typeof cb === 'function') cb();
  },
  remove: function(key, cb) {
    if (Array.isArray(key)) key.forEach(function(k) { localStorage.removeItem('_cs_' + k); });
    else localStorage.removeItem('_cs_' + key);
    if (typeof cb === 'function') cb();
  }
};
`;

// Build final script
const output = `// Claude Code for WPS — 控制台注入版
// 在 WPS协作 的 DevTools Console 中粘贴运行

// localStorage shim for chrome.storage.local (all references rewritten to __csLocal)
${storageShim}

// CSS
(function(){var s=document.createElement("style");s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();

// ProseMirror bridge — only in top frame (in iframe/WOA, the relay handles selection)
if (window.top === window) {
${bridgeJs}
}

// Main
${js}
console.log("[CC] ✅ Claude Code 已注入！");
`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/inject-console.js", output, "utf-8");
const sizeKB = (Buffer.byteLength(output) / 1024).toFixed(1);
console.log(`✅ dist/inject-console.js (${sizeKB} KB)`);
