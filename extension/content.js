// content.js — WPS 365 Claude Code 浮动面板（含会话管理）
(function () {
  if (window.top !== window) {
    try {
      document.addEventListener("copy", (e) => {
        const text = (e.clipboardData || window.clipboardData)?.getData("text/plain");
        if (text && text.trim() && window.top) window.top.postMessage({ type: "__CC_SELECTION__", text: text.trim() }, "*");
      }, true);
    } catch (_) {}
    return;
  }
  if (window.__CC_WPS_INJECTED__) return;
  window.__CC_WPS_INJECTED__ = true;

  const LOG = (...args) => console.log("[CC]", ...args);
  const BRIDGE = "http://localhost:5174";
  const MAX_SESSIONS = 20;

  let cachedSelection = "";
  let isStreaming = false;
  let bridgeOnline = false;
  let abortController = null;
  let claudeSessionId = null;
  let currentConvId = null; // local conversation ID
  let conversations = []; // { id, claudeSessionId, title, html, createdAt }

  const ICON = {
    sparkle: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>`,
    send: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M22 2L11 13" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" fill="none" stroke-width="2" stroke-linejoin="round"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
    clear: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    stop: `<svg viewBox="0 0 24 24" width="12" height="12"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>`,
    claude: `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" fill="none" stroke-width="2"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 5v14M5 12h14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
    list: `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
  };

  // ========== FAB ==========
  const fab = document.createElement("div");
  fab.className = "cc-fab";
  fab.title = "Claude Code (Alt+J)";
  fab.innerHTML = ICON.sparkle + `<span class="cc-status-dot"></span>`;
  document.body.appendChild(fab);
  const statusDot = fab.querySelector(".cc-status-dot");

  // ========== PANEL ==========
  const panel = document.createElement("div");
  panel.className = "cc-panel";
  panel.innerHTML = `
    <div class="cc-header">
      <span class="cc-title">${ICON.claude} Claude Code</span>
      <div class="cc-header-actions">
        <button class="cc-header-btn cc-sessions-btn" title="会话列表">${ICON.list}</button>
        <button class="cc-header-btn cc-new-btn" title="新建会话">${ICON.plus}</button>
        <button class="cc-header-btn cc-close-btn" title="关闭 (Esc)">${ICON.close}</button>
      </div>
    </div>
    <div class="cc-session-list"></div>
    <div class="cc-messages">
      <div class="cc-welcome">
        <div class="cc-welcome-title">Claude Code</div>
        <div class="cc-welcome-hint">选中文档中的文字，然后告诉我你想做什么。</div>
        <div class="cc-welcome-shortcuts"><span><kbd>Alt</kbd>+<kbd>J</kbd> 打开</span><span><kbd>⌘</kbd>+<kbd>↵</kbd> 发送</span></div>
      </div>
    </div>
    <button class="cc-stop-btn">${ICON.stop} 停止生成</button>
    <div class="cc-input-area">
      <div class="cc-selection-bar"></div>
      <div class="cc-input-wrapper">
        <textarea class="cc-input" rows="1" placeholder="输入你的请求…"></textarea>
        <button class="cc-send-btn" title="发送 (⌘/Ctrl+Enter)">${ICON.send}</button>
      </div>
      <div class="cc-input-footer">
        <span class="cc-input-hint"><kbd>⌘</kbd>+<kbd>↵</kbd> 发送</span>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const inputEl = panel.querySelector(".cc-input");
  const sendBtn = panel.querySelector(".cc-send-btn");
  const stopBtn = panel.querySelector(".cc-stop-btn");
  const messagesEl = panel.querySelector(".cc-messages");
  const selectionBar = panel.querySelector(".cc-selection-bar");
  const sessionListEl = panel.querySelector(".cc-session-list");

  // ========== STORAGE ==========
  function saveConversations() {
    try {
      chrome.storage.local.set({ cc_conversations: conversations.map(c => ({
        id: c.id, claudeSessionId: c.claudeSessionId, title: c.title, html: c.html, createdAt: c.createdAt,
      }))});
    } catch (_) {}
  }

  async function loadConversations() {
    try {
      const data = await chrome.storage.local.get("cc_conversations");
      conversations = data.cc_conversations || [];
    } catch (_) { conversations = []; }
  }

  function saveCurrentConv() {
    if (!currentConvId) return;
    const conv = conversations.find(c => c.id === currentConvId);
    if (conv) {
      conv.claudeSessionId = claudeSessionId;
      conv.html = messagesEl.innerHTML;
      saveConversations();
    }
  }

  function newConversation() {
    saveCurrentConv();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const conv = { id, claudeSessionId: null, title: "新会话", html: "", createdAt: Date.now() };
    conversations.unshift(conv);
    if (conversations.length > MAX_SESSIONS) conversations.pop();
    currentConvId = id;
    claudeSessionId = null;
    messagesEl.innerHTML = getWelcomeHTML();
    saveConversations();
    hideSessionList();
  }

  function switchToConv(id) {
    if (isStreaming) return;
    saveCurrentConv();
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    currentConvId = conv.id;
    claudeSessionId = conv.claudeSessionId;
    messagesEl.innerHTML = conv.html || getWelcomeHTML();
    hideSessionList();
  }

  function deleteConv(id) {
    conversations = conversations.filter(c => c.id !== id);
    if (currentConvId === id) {
      if (conversations.length > 0) {
        switchToConv(conversations[0].id);
      } else {
        newConversation();
      }
    }
    saveConversations();
    renderSessionList();
  }

  // ========== SESSION LIST UI ==========
  function renderSessionList() {
    sessionListEl.innerHTML = "";
    if (conversations.length === 0) {
      sessionListEl.innerHTML = `<div class="cc-sl-empty">暂无会话记录</div>`;
      return;
    }
    conversations.forEach(c => {
      const item = document.createElement("div");
      item.className = "cc-sl-item" + (c.id === currentConvId ? " cc-sl-active" : "");
      const time = new Date(c.createdAt);
      const timeStr = `${time.getMonth()+1}/${time.getDate()} ${time.getHours()}:${String(time.getMinutes()).padStart(2,"0")}`;
      item.innerHTML = `
        <div class="cc-sl-info">
          <div class="cc-sl-title">${esc(c.title)}</div>
          <div class="cc-sl-time">${timeStr}</div>
        </div>
        <button class="cc-sl-del" title="删除">×</button>
      `;
      item.querySelector(".cc-sl-info").addEventListener("click", () => switchToConv(c.id));
      item.querySelector(".cc-sl-del").addEventListener("click", (e) => { e.stopPropagation(); deleteConv(c.id); });
      sessionListEl.appendChild(item);
    });
  }

  function toggleSessionList() {
    const visible = sessionListEl.classList.contains("cc-sl-visible");
    if (visible) hideSessionList();
    else { renderSessionList(); sessionListEl.classList.add("cc-sl-visible"); }
  }

  function hideSessionList() { sessionListEl.classList.remove("cc-sl-visible"); }

  // ========== PANEL TOGGLE ==========
  function showPanel() {
    panel.classList.add("cc-visible");
    requestSelection();
    inputEl.focus();
    checkHealth();
  }
  function hidePanel() { panel.classList.remove("cc-visible"); hideSessionList(); }
  fab.addEventListener("click", () => panel.classList.contains("cc-visible") ? hidePanel() : showPanel());
  panel.querySelector(".cc-close-btn").addEventListener("click", hidePanel);
  panel.querySelector(".cc-sessions-btn").addEventListener("click", toggleSessionList);
  panel.querySelector(".cc-new-btn").addEventListener("click", newConversation);

  // ========== KEYBOARD ==========
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "j" || e.key === "J")) { e.preventDefault(); panel.classList.contains("cc-visible") ? hidePanel() : showPanel(); }
    if (e.key === "Escape" && panel.classList.contains("cc-visible")) hidePanel();
  });
  inputEl.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); send(); }
  });
  sendBtn.addEventListener("click", send);
  stopBtn.addEventListener("click", () => { if (abortController) { abortController.abort(); abortController = null; } });

  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
  });

  // ========== SELECTION ==========
  const SEL_URL = chrome.runtime.getURL("inject-sel.js");
  function requestSelection() {
    const s = document.createElement("script");
    s.src = SEL_URL + "?t=" + Date.now();
    s.onload = () => s.remove(); s.onerror = () => s.remove();
    document.documentElement.appendChild(s);
  }
  function waitForSelection() {
    return new Promise((resolve) => {
      requestSelection();
      const t = setTimeout(() => resolve(cachedSelection), 200);
      function onMsg(e) {
        if (e.data?.type === "__CC_SEL__") { clearTimeout(t); window.removeEventListener("message", onMsg); cachedSelection = (e.data.text || "").trim(); resolve(cachedSelection); }
      }
      window.addEventListener("message", onMsg);
    });
  }
  window.addEventListener("message", (e) => {
    if (e.data?.type === "__CC_SEL__") { cachedSelection = (e.data.text || "").trim(); if (panel.classList.contains("cc-visible")) updateSelectionBar(); }
  });
  document.addEventListener("mouseup", () => { if (panel.classList.contains("cc-visible")) setTimeout(requestSelection, 50); }, true);
  document.addEventListener("keyup", (e) => { if (panel.classList.contains("cc-visible") && (e.shiftKey || e.key === "Shift")) requestSelection(); }, true);

  function updateSelectionBar() {
    if (cachedSelection) {
      const preview = cachedSelection.length > 60 ? cachedSelection.slice(0, 60) + "…" : cachedSelection;
      selectionBar.innerHTML = `<span class="cc-sel-quote">↵</span><span class="cc-sel-text">${esc(preview)}</span><button class="cc-sel-clear">×</button>`;
      selectionBar.style.display = "flex";
      selectionBar.querySelector(".cc-sel-clear").addEventListener("click", () => { cachedSelection = ""; updateSelectionBar(); });
    } else { selectionBar.innerHTML = ""; selectionBar.style.display = "none"; }
  }

  // ========== HEALTH ==========
  async function checkHealth() {
    try { const r = await fetch(BRIDGE + "/health", { signal: AbortSignal.timeout(3000) }); bridgeOnline = !!(await r.json()).ok; } catch (_) { bridgeOnline = false; }
    statusDot.className = "cc-status-dot " + (bridgeOnline ? "cc-online" : "cc-offline");
  }

  // ========== MESSAGES ==========
  function getWelcomeHTML() {
    return `<div class="cc-welcome"><div class="cc-welcome-title">Claude Code</div><div class="cc-welcome-hint">选中文档中的文字，然后告诉我你想做什么。</div><div class="cc-welcome-shortcuts"><span><kbd>Alt</kbd>+<kbd>J</kbd> 打开</span><span><kbd>⌘</kbd>+<kbd>↵</kbd> 发送</span></div></div>`;
  }
  function addUserMessage(text) {
    const w = messagesEl.querySelector(".cc-welcome"); if (w) w.remove();
    const msg = document.createElement("div"); msg.className = "cc-msg cc-msg-user";
    msg.innerHTML = `<div class="cc-msg-body">${esc(text)}</div>`;
    messagesEl.appendChild(msg); scrollToBottom();
  }
  function addAssistantMessage() {
    const w = messagesEl.querySelector(".cc-welcome"); if (w) w.remove();
    const msg = document.createElement("div"); msg.className = "cc-msg cc-msg-assistant";
    msg.innerHTML = `<div class="cc-msg-body"><div class="cc-activity"></div><div class="cc-reply"></div></div>`;
    messagesEl.appendChild(msg); scrollToBottom();
    return { activityEl: msg.querySelector(".cc-activity"), replyEl: msg.querySelector(".cc-reply") };
  }
  function addStep(el, type, text, icon) {
    const step = document.createElement("div"); step.className = "cc-step";
    const spinning = (type === "status" || type === "thinking" || type === "tool_start") ? " cc-spinning" : "";
    const icons = { status: "⚙", thinking: "💭", tool_start: "🔧" };
    step.innerHTML = `<span class="cc-step-icon${spinning}">${icon || icons[type] || "•"}</span><span class="cc-step-text">${text}</span>`;
    step.dataset.type = type; el.appendChild(step); scrollToBottom(); return step;
  }
  function updateStatus(el, msg) { const l = el.querySelector('.cc-step[data-type="status"]'); if (l) l.querySelector(".cc-step-text").textContent = msg; else addStep(el, "status", msg); }
  function clearSteps(el, type) { el.querySelectorAll(`.cc-step[data-type="${type}"]`).forEach(n => n.remove()); }
  function scrollToBottom() { requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }); }

  // ========== MARKDOWN ==========
  function renderMarkdown(text) {
    if (!text) return "";
    const cb = []; let p = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, l, c) => { cb.push(`<pre><code class="lang-${esc(l)}">${esc(c.replace(/\n$/, ""))}</code></pre>`); return `%%CB${cb.length-1}%%`; });
    const ic = []; p = p.replace(/`([^`\n]+)`/g, (_, c) => { ic.push(`<code>${esc(c)}</code>`); return `%%IC${ic.length-1}%%`; });
    p = esc(p); p = p.replace(/%%CB(\d+)%%/g, (_, i) => cb[i]); p = p.replace(/%%IC(\d+)%%/g, (_, i) => ic[i]);
    p = p.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>").replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>").replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
    p = p.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>").replace(/^##\s+(.+)$/gm, "<h2>$1</h2>").replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
    p = p.replace(/^---+$/gm, "<hr/>").replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    p = p.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`);
    p = p.replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>");
    p = p.replace(/^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/gm, (_, h, _s, b) => {
      const hs = h.split("|").filter(Boolean).map(c => c.trim()); const rs = b.trim().split("\n").map(r => r.split("|").filter(Boolean).map(c => c.trim()));
      let t = "<table><thead><tr>" + hs.map(c => `<th>${c}</th>`).join("") + "</tr></thead><tbody>"; rs.forEach(r => { t += "<tr>" + r.map(c => `<td>${c}</td>`).join("") + "</tr>"; }); return t + "</tbody></table>";
    });
    p = p.replace(/^[\s]*[-*]\s+(.+)$/gm, "<li>$1</li>").replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
    p = p.replace(/^[\s]*\d+\.\s+(.+)$/gm, "<oli>$1</oli>").replace(/((?:<oli>.*<\/oli>\n?)+)/g, m => "<ol>" + m.replace(/<\/?oli>/g, t => t.replace("oli", "li")) + "</ol>");
    const blocks = p.split(/\n{2,}/); p = blocks.map(b => { b = b.trim(); if (!b) return ""; if (/^<(h[1-6]|pre|ul|ol|table|blockquote|hr)/.test(b)) return b; return `<p>${b.replace(/\n/g, "<br/>")}</p>`; }).join("\n");
    return `<div class="cc-md">${p}</div>`;
  }

  // ========== SEND ==========
  async function send() {
    if (isStreaming) return;
    const text = inputEl.value.trim(); if (!text) return;
    const selection = await waitForSelection();

    // Ensure we have a conversation
    if (!currentConvId) newConversation();

    // Update conversation title from first message
    const conv = conversations.find(c => c.id === currentConvId);
    if (conv && conv.title === "新会话") {
      conv.title = text.length > 30 ? text.slice(0, 30) + "…" : text;
      saveConversations();
    }

    isStreaming = true; sendBtn.disabled = true; stopBtn.classList.add("cc-active");
    addUserMessage(text);
    const { activityEl, replyEl } = addAssistantMessage();
    inputEl.value = ""; inputEl.style.height = "auto";

    let accumulated = "", gotContent = false, currentToolStep = null, sessionId = null, stopped = false, renderFrame = null;
    const lastUserText = text; let stepCount = 0, startTime = Date.now();

    const LABELS = { "Bash": "执行命令", "Read": "读取文件", "Write": "写入文件", "Edit": "编辑文件", "Skill": "调用技能", "WebSearch": "搜索网络", "WebFetch": "获取网页" };
    function label(n) { return LABELS[n] || (/bash/i.test(n) ? "执行命令" : /read/i.test(n) ? "读取文件" : /search/i.test(n) ? "搜索网络" : /skill/i.test(n) ? "调用技能" : n); }
    function scheduleRender() { if (renderFrame) return; renderFrame = requestAnimationFrame(() => { renderFrame = null; replyEl.innerHTML = renderMarkdown(accumulated) + `<span class="cc-cursor"></span>`; scrollToBottom(); }); }

    function flushTextToStep() {
      if (!accumulated.trim()) return;
      const el = document.createElement("div"); el.className = "cc-thought";
      el.textContent = accumulated.trim().length > 120 ? accumulated.trim().slice(0, 120) + "…" : accumulated.trim();
      activityEl.appendChild(el); accumulated = "";
      if (renderFrame) { cancelAnimationFrame(renderFrame); renderFrame = null; } replyEl.innerHTML = ""; scrollToBottom();
    }
    function collapseActivity() {
      if (activityEl.children.length === 0) return;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const timeStr = elapsed >= 60 ? `${Math.floor(elapsed/60)}分${elapsed%60}秒` : `${elapsed}秒`;
      const details = activityEl.innerHTML; activityEl.innerHTML = "";
      const summary = document.createElement("div"); summary.className = "cc-activity-summary";
      summary.innerHTML = `<span class="cc-summary-toggle">▶</span> 已完成 · ${stepCount}步 · ${timeStr}`;
      const wrap = document.createElement("div"); wrap.className = "cc-activity-details"; wrap.innerHTML = details; wrap.style.display = "none";
      summary.addEventListener("click", () => { const o = wrap.style.display !== "none"; wrap.style.display = o ? "none" : "block"; summary.querySelector(".cc-summary-toggle").textContent = o ? "▶" : "▼"; });
      activityEl.appendChild(summary); activityEl.appendChild(wrap);
    }

    function handleEvent(ev) {
      switch (ev.type) {
        case "claude_session": claudeSessionId = ev.claudeSessionId; LOG("claude session:", claudeSessionId); break;
        case "status": updateStatus(activityEl, ev.message); break;
        case "thinking_start": clearSteps(activityEl, "status"); if (!activityEl.querySelector('.cc-step[data-type="thinking"]')) addStep(activityEl, "thinking", "思考中…"); break;
        case "thinking": break;
        case "thinking_done": { const s = activityEl.querySelector('.cc-step[data-type="thinking"]'); if (s) s.remove(); break; }
        case "delta":
          if (!gotContent) { gotContent = true; clearSteps(activityEl, "status"); clearSteps(activityEl, "thinking"); }
          accumulated += ev.text; scheduleRender(); break;
        case "tool_start":
          stepCount++; clearSteps(activityEl, "status"); clearSteps(activityEl, "thinking");
          if (accumulated.trim()) flushTextToStep();
          if (currentToolStep) { currentToolStep.querySelector(".cc-step-icon").className = "cc-step-icon"; currentToolStep.querySelector(".cc-step-icon").textContent = "✅"; }
          currentToolStep = addStep(activityEl, "tool_start", label(ev.name)); break;
        case "tool_detail":
          if (currentToolStep && ev.text) {
            let d = currentToolStep.querySelector(".cc-step-detail");
            if (!d) { d = document.createElement("div"); d.className = "cc-step-detail"; currentToolStep.appendChild(d); }
            let t = ev.text; if (t.includes("/")) t = t.replace(/\/[\w./-]+\/([\w.-]+)/g, "…/$1");
            d.textContent = t.length > 80 ? t.slice(0, 80) + "…" : t; scrollToBottom();
          } break;
        case "tool_input": break;
        case "tool_result":
          if (currentToolStep) { const ic = currentToolStep.querySelector(".cc-step-icon"); ic.className = "cc-step-icon"; ic.textContent = ev.is_error ? "❌" : "✅"; currentToolStep = null; } break;
        case "done":
          clearSteps(activityEl, "status"); clearSteps(activityEl, "thinking");
          if (currentToolStep) { currentToolStep.querySelector(".cc-step-icon").className = "cc-step-icon"; currentToolStep.querySelector(".cc-step-icon").textContent = "✅"; }
          if (renderFrame) { cancelAnimationFrame(renderFrame); renderFrame = null; }
          collapseActivity(); replyEl.innerHTML = renderMarkdown(ev.result || accumulated); scrollToBottom();
          saveCurrentConv(); break;
        case "error": {
          clearSteps(activityEl, "status"); clearSteps(activityEl, "thinking");
          if (activityEl.children.length > 0) collapseActivity();
          const isTimeout = (ev.error || "").includes("超时");
          replyEl.innerHTML = `<div class="cc-error">${esc(ev.error)}</div>`;
          if (isTimeout) { const btn = document.createElement("button"); btn.className = "cc-retry-btn"; btn.textContent = "重试"; btn.addEventListener("click", () => { messagesEl.removeChild(messagesEl.lastElementChild); messagesEl.removeChild(messagesEl.lastElementChild); inputEl.value = lastUserText; send(); }); replyEl.querySelector(".cc-error").appendChild(document.createElement("br")); replyEl.querySelector(".cc-error").appendChild(btn); }
          scrollToBottom(); saveCurrentConv(); break;
        }
      }
    }

    abortController = { abort: async () => { stopped = true; if (sessionId) { try { await fetch(BRIDGE + "/stop/" + sessionId, { method: "POST" }); } catch (_) {} } } };

    try {
      const startRes = await fetch(BRIDGE + "/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text, url: location.href, title: document.title, selection, claudeSessionId }),
      });
      const d = await startRes.json(); if (!d.ok) throw new Error(d.error || "启动失败");
      sessionId = d.sessionId; LOG("session:", sessionId);

      let cursor = 0, polls = 0;
      while (!stopped) {
        await sleep(200); if (stopped) break;
        try {
          const r = await fetch(BRIDGE + "/poll/" + sessionId + "?cursor=" + cursor);
          const p = await r.json(); if (!p.ok) break; polls++;
          for (const ev of p.events) {
            if (ev.type === "close" || ev.type === "done" || ev.type === "error") stopped = true;
            try { handleEvent(ev); } catch (e) { LOG("event error:", e); }
            if (stopped) break;
          }
          cursor = p.cursor; if (p.done || stopped) break;
        } catch (e) { LOG("poll error:", e.message); }
      }
      LOG("stopped after", polls, "polls");
      if (accumulated && !replyEl.querySelector(".cc-md") && !replyEl.querySelector(".cc-error")) replyEl.innerHTML = renderMarkdown(accumulated);
    } catch (err) {
      replyEl.innerHTML = `<div class="cc-error">无法连接 Bridge<br/>${esc(err.message)}</div>`;
    } finally {
      if (renderFrame) cancelAnimationFrame(renderFrame);
      isStreaming = false; sendBtn.disabled = false; stopBtn.classList.remove("cc-active"); abortController = null;
      saveCurrentConv();
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ========== DRAG ==========
  (function () {
    const hdr = panel.querySelector(".cc-header"); let d = false, sx, sy, sl, st;
    hdr.addEventListener("mousedown", (e) => { if (e.target.closest(".cc-header-btn")) return; d = true; const r = panel.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top; panel.style.right = "auto"; panel.style.bottom = "auto"; panel.style.left = r.left + "px"; panel.style.top = r.top + "px"; document.body.style.userSelect = "none"; e.preventDefault(); });
    window.addEventListener("mousemove", (e) => { if (!d) return; panel.style.left = Math.max(0, Math.min(innerWidth - 100, sl + e.clientX - sx)) + "px"; panel.style.top = Math.max(0, Math.min(innerHeight - 100, st + e.clientY - sy)) + "px"; });
    window.addEventListener("mouseup", () => { if (d) { d = false; document.body.style.userSelect = ""; } });
  })();

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // ========== INIT ==========
  loadConversations().then(() => {
    if (conversations.length > 0) {
      switchToConv(conversations[0].id);
    } else {
      newConversation();
    }
  });
})();
