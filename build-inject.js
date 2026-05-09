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

// 3. Replace chrome.storage.local.set
js = js.replace(
  /chrome\.storage\.local\.set\(\{ \[STORAGE_KEY\]: ([\s\S]*?)\}\);/,
  (_, inner) => `localStorage.setItem(STORAGE_KEY, JSON.stringify(${inner.trim()}));`
);

// 4. Replace chrome.storage.local.get
js = js.replace(
  /const data = await chrome\.storage\.local\.get\(STORAGE_KEY\);\s*const saved = data\[STORAGE_KEY\] \|\| \[\];/,
  `let saved = []; try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(_) {}`
);

// 5. Remove __CC_WPS_INJECTED__ guard (our wrapper handles it)
js = js.replace(/if \(window\.__CC_WPS_INJECTED__\) return;\s*window\.__CC_WPS_INJECTED__ = true;/, "");

// Build final script
const output = `// Claude Code for WPS — 控制台一键注入版
// 在 WPS协作 的 DevTools Console 中粘贴运行

// CSS
(function(){var s=document.createElement("style");s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();

// ProseMirror bridge (selection reading + cursor + direct doc write)
${bridgeJs}

// Main
${js}
console.log("[CC] ✅ Claude Code 已注入！");
`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/inject-console.js", output, "utf-8");
const sizeKB = (Buffer.byteLength(output) / 1024).toFixed(1);
console.log(`✅ dist/inject-console.js (${sizeKB} KB)`);
