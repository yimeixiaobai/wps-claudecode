// ═══════════════════════════════════════════════════════════
// Claude Code for WPS — 控制台一键注入版
// 使用方法：在 WPS协作 的 DevTools Console 中粘贴运行此代码
// ═══════════════════════════════════════════════════════════
(function() {
  if (window.__CC_WPS_INJECTED__) { console.log("[CC] 已注入，无需重复执行"); return; }
  window.__CC_WPS_INJECTED__ = true;

  // ========== 注入 CSS ==========
  const style = document.createElement("style");
  style.textContent = `INJECT_CSS_PLACEHOLDER`;
  document.head.appendChild(style);

  // ========== 注入选区脚本（替代 inject-sel.js） ==========
  window.__CC_READ_SELECTION__ = function() {
    try {
      var e = window.APP && APP.core && APP.core.editor;
      if (!e) return "";
      var s = e.selection;
      if (!s || s.from === s.to) return "";
      return (e.state && e.state.doc && e.state.doc.textBetween(s.from, s.to, "\\n")) || "";
    } catch(_) { return ""; }
  };

  // ========== 注入主逻辑（替代 content.js，去除 chrome.* API 依赖） ==========
  INJECT_JS_PLACEHOLDER

  console.log("[CC] ✅ Claude Code 面板已注入！点击右下角橘色按钮或按 Alt+J 打开。");
})();
