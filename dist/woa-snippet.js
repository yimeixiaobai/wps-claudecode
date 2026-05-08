// ═══════════════════════════════════════════════════════════════
// Claude Code for WPS协作 (WOA)
//
// 安装方法:
//   1. 在 WOA 中按 F12 打开 DevTools
//   2. 切到 Sources（源代码）→ Snippets（代码段）
//   3. 点 + New snippet，命名为 "Claude Code"
//   4. 粘贴此文件全部内容，Ctrl+S 保存
//   5. 右键 snippet → Run（或 Ctrl+Enter）即可启动
//
// 使用：运行后右下角出现橘色按钮，点击打开面板。
//       再次运行 snippet 可关闭。
//       需要先启动 Bridge（双击 bridge/start-bridge.command）
// ═══════════════════════════════════════════════════════════════

(function () {
  var fabId = "cc-woa-fab", frameId = "cc-float-frame", styleId = "cc-woa-style";

  // Toggle: 已注入则关闭
  if (document.getElementById(fabId)) {
    document.getElementById(fabId)?.remove();
    document.getElementById(frameId)?.remove();
    document.getElementById(styleId)?.remove();
    console.log("[CC] 已关闭");
    return;
  }

  // ── 提取当前文档信息 ──
  var docUrl = "", docTitle = "";

  // 标题：从当前激活的 tab 提取
  var activeSpan = document.querySelector("[class*=active] span");
  if (activeSpan) docTitle = activeSpan.textContent.trim();

  // URL：从 webview 标签提取（WOA 用 webview 加载文档）
  var wvs = [...document.querySelectorAll("webview")];
  for (var i = wvs.length - 1; i >= 0; i--) {
    var src = wvs[i].src || "";
    if (src.match(/365\.kdocs\.cn\/l\/[A-Za-z0-9]+/)) {
      docUrl = src.split("?")[0];
      break;
    }
  }
  // Fallback：从 HTML 中正则匹配
  if (!docUrl) {
    var links = document.body.innerHTML.match(/https:\/\/365\.kdocs\.cn\/l\/[A-Za-z0-9]+/g);
    if (links) docUrl = links[links.length - 1];
  }

  // ── 注入样式 ──
  var style = document.createElement("style");
  style.id = styleId;
  style.textContent = [
    "#" + fabId + "{position:fixed;right:24px;bottom:24px;width:46px;height:46px;border-radius:50%;background:#D97757;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 3px 14px rgba(217,119,87,0.35);z-index:99999;border:none;outline:none;transition:box-shadow 0.2s,transform 0.15s;overflow:visible}",
    "#" + fabId + ":hover{box-shadow:0 5px 22px rgba(217,119,87,0.45);transform:translateY(-1px)}",
    "#" + fabId + ":active{transform:scale(0.94)}",
    "#" + fabId + " svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8}",
    "#" + fabId + "::after{content:'';position:absolute;inset:-5px;border-radius:50%;border:1.5px solid #D97757;opacity:0;pointer-events:none;transition:opacity 0.3s,transform 0.4s cubic-bezier(0.34,1.56,0.64,1);transform:scale(0.9)}",
    "#" + fabId + ":hover::after{opacity:0.4;transform:scale(1.15)}",
    "#" + frameId + "{position:fixed;right:16px;bottom:80px;width:420px;height:560px;border:none;z-index:99998;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.12);display:none}",
    "#" + frameId + ".cc-show{display:block}",
  ].join("\n");
  document.head.appendChild(style);

  // ── FAB 按钮（原生 DOM，不受 CSP 限制）──
  var fab = document.createElement("div");
  fab.id = fabId;
  fab.title = "Claude Code";
  fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>';
  document.body.appendChild(fab);

  // ── 面板 iframe ──
  var frame = document.createElement("iframe");
  frame.id = frameId;
  frame.src = "http://localhost:5174/panel?mode=sidebar" +
    "&docUrl=" + encodeURIComponent(docUrl) +
    "&docTitle=" + encodeURIComponent(docTitle);
  frame.allow = "clipboard-write";
  document.body.appendChild(frame);

  // ── 点击切换 ──
  fab.addEventListener("click", function () {
    frame.classList.toggle("cc-show");
  });

  console.log("[CC] ✅ Claude Code 已注入！" + (docUrl ? " 文档: " + docUrl : " (未检测到文档)"));
})();
