// content.js — WPS 365 Claude Code 浮动面板（会话管理 + 流式）
(function () {
  if (window.top !== window) {
    try { document.addEventListener("copy", (e) => { const t = (e.clipboardData || window.clipboardData)?.getData("text/plain"); if (t && t.trim() && window.top) window.top.postMessage({ type: "__CC_SELECTION__", text: t.trim() }, "*"); }, true); } catch (_) {}
    return;
  }
  if (window.__CC_WPS_INJECTED__) return;
  window.__CC_WPS_INJECTED__ = true;

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const MOD_KEY = isMac ? "⌥" : "Alt";
  const LOG = (...args) => console.log("[CC]", ...args);
  const BRIDGE = "http://localhost:5174";


  function getDocUrl() { return window.__CC_DOC_URL__ || location.href; }
  function getDocTitle() { return window.__CC_DOC_TITLE__ || document.title; }
  const MAX_SESSIONS = 20;

  let cachedSelection = "";
  let isStreaming = false;
  let bridgeOnline = false;
  let abortController = null;

  // ========== DOCUMENT ID (for per-document conversation isolation) ==========
  const docId = (() => {
    const url = window.__CC_DOC_URL__ || location.href;
    const m = url.match(/\/l\/([A-Za-z0-9]+)/);
    if (m) return m[1];
    const m2 = url.match(/\/(\d+)\//);
    if (m2) return m2[1];
    return url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
  })();
  const STORAGE_KEY = "cc_convs_" + docId;
  LOG("doc isolation key:", docId);

  // ========== CONVERSATION STATE ==========
  // Each conversation: { id, claudeSessionId, title, container (DOM element), createdAt }
  let convs = [];
  let activeConvId = null;

  function getConv(id) { return convs.find(c => c.id === id); }
  function activeConv() { return getConv(activeConvId); }

  // ========== ICONS ==========
  const ICON = {
    sparkle: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>`,
    send: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M22 2L11 13" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" fill="none" stroke-width="2" stroke-linejoin="round"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
    clear: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    stop: `<svg viewBox="0 0 24 24" width="12" height="12"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>`,
    claude: `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" fill="none" stroke-width="2"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 5v14M5 12h14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
    list: `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
    link: `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" fill="none" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" fill="none" stroke-width="2"/></svg>`,
    docWrite: `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" fill="none" stroke-width="2"/><path d="M12 18v-6M9 15l3 3 3-3" stroke="currentColor" fill="none" stroke-width="2"/></svg>`,
  };

  // ========== FAB ==========
  const fab = document.createElement("div");
  fab.className = "cc-fab";
  fab.title = `Claude Code (${MOD_KEY}+J)`;
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
    <div class="cc-messages-wrap"></div>
    <button class="cc-stop-btn">${ICON.stop} 停止生成</button>
    <div class="cc-input-area">
      <div class="cc-quick-actions">
        <button class="cc-quick-btn" data-prompt="总结整篇文档要点">总结全文</button>
        <button class="cc-quick-btn" data-prompt="对这篇文档提出改进建议">提改进建议</button>
        <button class="cc-quick-btn" data-prompt="基于上文继续续写一段">续写</button>
      </div>
      <div class="cc-linked-docs"></div>
      <div class="cc-selection-bar"></div>
      <div class="cc-input-wrapper">
        <textarea class="cc-input" rows="1" placeholder="输入你的请求…"></textarea>
        <button class="cc-send-btn" title="发送 (Enter)">${ICON.send}</button>
      </div>
      <div class="cc-input-footer">
        <span class="cc-input-hint"><kbd>↵</kbd> 发送 · <kbd>Shift</kbd>+<kbd>↵</kbd> 换行</span>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const inputEl = panel.querySelector(".cc-input");
  const sendBtn = panel.querySelector(".cc-send-btn");
  const stopBtn = panel.querySelector(".cc-stop-btn");
  const msgsWrap = panel.querySelector(".cc-messages-wrap");
  const selectionBar = panel.querySelector(".cc-selection-bar");
  const linkedDocsEl = panel.querySelector(".cc-linked-docs");
  let linkedDocs = []; // [{ url, title }]
  const sessionListEl = panel.querySelector(".cc-session-list");

  // ========== CONVERSATION MANAGEMENT (DOM-based, no innerHTML swap) ==========
  function createConvContainer() {
    const el = document.createElement("div");
    el.className = "cc-messages";
    el.innerHTML = getWelcomeHTML();
    return el;
  }

  function makeConv(title) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const container = createConvContainer();
    return { id, claudeSessionId: null, claudeCwd: null, title: title || "新会话", container, createdAt: Date.now() };
  }

  function showConv(id) {
    // Hide all, show target
    convs.forEach(c => { c.container.style.display = "none"; });
    const conv = getConv(id);
    if (!conv) return;
    if (!conv.container.parentElement) msgsWrap.appendChild(conv.container);
    conv.container.style.display = "flex";
    activeConvId = id;
    hideSessionList();
  }

  function newConversation() {
    const conv = makeConv();
    convs.unshift(conv);
    if (convs.length > MAX_SESSIONS) {
      const old = convs.pop();
      old.container.remove();
    }
    msgsWrap.appendChild(conv.container);
    showConv(conv.id);
    persistIndex();
    return conv;
  }

  function switchToConv(id) {
    if (id === activeConvId) { hideSessionList(); return; }
    showConv(id);
    persistIndex();
  }

  function deleteConv(id) {
    const conv = getConv(id);
    if (conv) conv.container.remove();
    convs = convs.filter(c => c.id !== id);
    if (activeConvId === id) {
      if (convs.length > 0) showConv(convs[0].id);
      else newConversation();
    }
    persistIndex();
    renderSessionList();
  }

  // ========== PERSISTENCE (index only — DOM containers are ephemeral) ==========
  function persistIndex() {
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: convs.map(c => ({
        id: c.id, claudeSessionId: c.claudeSessionId, claudeCwd: c.claudeCwd, title: c.title, createdAt: c.createdAt,
        html: c.container.innerHTML,
      }))});
    } catch (_) {}
  }

  function rebindContainerEvents(container) {
    container.querySelectorAll(".cc-activity-summary").forEach(summary => {
      const wrap = summary.nextElementSibling;
      if (!wrap || !wrap.classList.contains("cc-activity-details")) return;
      summary.addEventListener("click", () => {
        const open = wrap.style.display !== "none";
        wrap.style.display = open ? "none" : "block";
        summary.querySelector(".cc-summary-toggle").textContent = open ? "▶" : "▼";
      });
    });
    container.querySelectorAll(".cc-msg-assistant").forEach(msg => {
      const replyEl = msg.querySelector(".cc-reply");
      const actionsEl = msg.querySelector(".cc-msg-actions");
      if (replyEl && actionsEl && actionsEl.querySelector(".cc-copy-btn")) {
        addMsgActions(actionsEl, replyEl);
      }
    });
  }

  async function restoreIndex() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const saved = data[STORAGE_KEY] || [];
      saved.forEach(s => {
        const container = createConvContainer();
        if (s.html) container.innerHTML = s.html;
        rebindContainerEvents(container);
        container.style.display = "none";
        msgsWrap.appendChild(container);
        convs.push({ id: s.id, claudeSessionId: s.claudeSessionId, claudeCwd: s.claudeCwd || null, title: s.title, container, createdAt: s.createdAt });
      });
    } catch (_) {}
    if (convs.length > 0) showConv(convs[0].id);
    else newConversation();
  }

  // ========== SESSION LIST UI ==========
  let showingImport = false;

  function renderSessionList() {
    sessionListEl.innerHTML = "";

    // Tab bar: 插件会话 / 导入本地
    const tabs = document.createElement("div");
    tabs.className = "cc-sl-tabs";
    tabs.innerHTML = `<span class="cc-sl-tab ${showingImport ? "" : "cc-sl-tab-active"}" data-tab="local">插件会话</span><span class="cc-sl-tab ${showingImport ? "cc-sl-tab-active" : ""}" data-tab="import">导入本地 Claude</span>`;
    tabs.querySelector('[data-tab="local"]').addEventListener("click", () => { showingImport = false; renderSessionList(); });
    tabs.querySelector('[data-tab="import"]').addEventListener("click", () => { showingImport = true; renderSessionList(); loadLocalSessions(); });
    sessionListEl.appendChild(tabs);

    const listWrap = document.createElement("div");
    listWrap.className = "cc-sl-list-wrap";
    sessionListEl.appendChild(listWrap);

    if (showingImport) {
      listWrap.innerHTML = `<div class="cc-sl-empty">加载中…</div>`;
      return;
    }

    // Plugin conversations
    if (convs.length === 0) { listWrap.innerHTML = `<div class="cc-sl-empty">暂无会话</div>`; return; }
    convs.forEach(c => {
      const item = document.createElement("div");
      item.className = "cc-sl-item" + (c.id === activeConvId ? " cc-sl-active" : "");
      const t = new Date(c.createdAt);
      item.innerHTML = `<div class="cc-sl-info"><div class="cc-sl-title">${esc(c.title)}</div><div class="cc-sl-time">${t.getMonth()+1}/${t.getDate()} ${t.getHours()}:${String(t.getMinutes()).padStart(2,"0")}</div></div><button class="cc-sl-del" title="删除">×</button>`;
      item.querySelector(".cc-sl-info").addEventListener("click", () => switchToConv(c.id));
      item.querySelector(".cc-sl-del").addEventListener("click", (e) => { e.stopPropagation(); deleteConv(c.id); });
      listWrap.appendChild(item);
    });
  }

  async function loadLocalSessions() {
    const listWrap = sessionListEl.querySelector(".cc-sl-list-wrap");
    if (!listWrap) return;
    try {
      const r = await fetch(BRIDGE + "/local-sessions");
      const d = await r.json();
      if (!d.ok || !d.sessions?.length) { listWrap.innerHTML = `<div class="cc-sl-empty">未找到本地 Claude 会话</div>`; return; }
      listWrap.innerHTML = "";
      d.sessions.forEach(s => {
        const item = document.createElement("div");
        item.className = "cc-sl-item cc-sl-import";
        const t = new Date(s.updatedAt);
        item.innerHTML = `
          <div class="cc-sl-info">
            <div class="cc-sl-title">${esc(s.title)}</div>
            <div class="cc-sl-meta">${s.turns}轮 · ${esc(s.project)}</div>
            ${s.summary ? `<div class="cc-sl-summary">${esc(s.summary)}</div>` : ""}
          </div>
          <button class="cc-sl-import-btn">导入</button>
        `;
        item.querySelector(".cc-sl-import-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          importLocalSession(s);
        });
        listWrap.appendChild(item);
      });
    } catch (err) {
      listWrap.innerHTML = `<div class="cc-sl-empty">无法连接 Bridge</div>`;
    }
  }

  function importLocalSession(s) {
    // Create a new conversation linked to the local Claude session
    const conv = makeConv(s.title);
    conv.claudeSessionId = s.sessionId;
    conv.claudeCwd = s.cwd || null;
    convs.unshift(conv);
    if (convs.length > MAX_SESSIONS) { const old = convs.pop(); old.container.remove(); }
    msgsWrap.appendChild(conv.container);

    // Show a welcome-like message indicating this is imported
    const w = conv.container.querySelector(".cc-welcome");
    if (w) w.remove();
    const notice = document.createElement("div");
    notice.className = "cc-import-notice";
    notice.innerHTML = `<strong>已导入本地会话</strong><br/>${esc(s.title)}<br/><span class="cc-text-muted">${s.turns}轮对话 · ${esc(s.project)}</span>`;
    conv.container.appendChild(notice);

    showConv(conv.id);
    persistIndex();
    showingImport = false;
    LOG("imported local session:", s.sessionId);
  }

  function toggleSessionList() { const v = sessionListEl.classList.contains("cc-sl-visible"); if (v) hideSessionList(); else { showingImport = false; renderSessionList(); sessionListEl.classList.add("cc-sl-visible"); } }
  function hideSessionList() { sessionListEl.classList.remove("cc-sl-visible"); }

  // ========== PANEL ==========
  function showPanel() { panel.classList.add("cc-visible"); requestSelection(); inputEl.focus(); checkHealth(); try { window.parent.postMessage({type:"__CC_PANEL__",open:true}, "*"); } catch(_) {} }
  function hidePanel() { panel.classList.remove("cc-visible"); hideSessionList(); try { window.parent.postMessage({type:"__CC_PANEL__",open:false}, "*"); } catch(_) {} }
  fab.addEventListener("click", () => panel.classList.contains("cc-visible") ? hidePanel() : showPanel());
  panel.querySelector(".cc-close-btn").addEventListener("click", hidePanel);
  panel.querySelector(".cc-sessions-btn").addEventListener("click", toggleSessionList);
  panel.querySelector(".cc-new-btn").addEventListener("click", () => newConversation());

  // ========== KEYBOARD ==========
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "j" || e.key === "J")) { e.preventDefault(); panel.classList.contains("cc-visible") ? hidePanel() : showPanel(); }
    if (e.key === "Escape" && panel.classList.contains("cc-visible")) hidePanel();
  });
  let inputHistory = [];
  let historyIdx = -1;

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); send(); return; }
    // ↑ key recall last input (only when input is empty or at start)
    if (e.key === "ArrowUp" && inputEl.selectionStart === 0 && inputHistory.length > 0) {
      e.preventDefault();
      historyIdx = Math.min(historyIdx + 1, inputHistory.length - 1);
      inputEl.value = inputHistory[historyIdx];
      inputEl.style.height = "auto"; inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
    }
    if (e.key === "ArrowDown" && historyIdx >= 0) {
      historyIdx--;
      inputEl.value = historyIdx >= 0 ? inputHistory[historyIdx] : "";
      inputEl.style.height = "auto"; inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
    }
  });
  sendBtn.addEventListener("click", send);
  stopBtn.addEventListener("click", () => { if (abortController) { abortController.abort(); abortController = null; } });
  inputEl.addEventListener("input", () => { inputEl.style.height = "auto"; inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px"; });

  // Quick action buttons
  panel.querySelectorAll(".cc-quick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const prompt = btn.dataset.prompt;
      if (prompt && !isStreaming) { inputEl.value = prompt; send(); }
    });
  });

  // ========== SELECTION ==========
  const SEL_URL = chrome.runtime.getURL("inject-sel.js");
  function requestSelection() { const s = document.createElement("script"); s.src = SEL_URL + "?t=" + Date.now(); s.onload = () => s.remove(); s.onerror = () => s.remove(); document.documentElement.appendChild(s); }
  function waitForSelection() {
    return new Promise(resolve => {
      requestSelection();
      const t = setTimeout(() => resolve(cachedSelection), 200);
      function onMsg(e) { if (e.data?.type === "__CC_SEL__") { clearTimeout(t); window.removeEventListener("message", onMsg); cachedSelection = (e.data.text || "").trim(); resolve(cachedSelection); } }
      window.addEventListener("message", onMsg);
    });
  }
  window.addEventListener("message", (e) => { if (e.data?.type === "__CC_SEL__") { cachedSelection = (e.data.text || "").trim(); if (panel.classList.contains("cc-visible")) updateSelectionBar(); } });
  document.addEventListener("mouseup", () => { if (panel.classList.contains("cc-visible")) setTimeout(requestSelection, 50); }, true);
  document.addEventListener("keyup", (e) => { if (panel.classList.contains("cc-visible") && (e.shiftKey || e.key === "Shift")) requestSelection(); }, true);

  function updateSelectionBar() {
    if (cachedSelection) {
      const p = cachedSelection.length > 60 ? cachedSelection.slice(0, 60) + "…" : cachedSelection;
      selectionBar.innerHTML = `<span class="cc-sel-quote">↵</span><span class="cc-sel-text">${esc(p)}</span><button class="cc-sel-clear">×</button>`;
      selectionBar.style.display = "flex";
      selectionBar.querySelector(".cc-sel-clear").addEventListener("click", () => { cachedSelection = ""; updateSelectionBar(); });
    } else { selectionBar.innerHTML = ""; selectionBar.style.display = "none"; }
  }

  // ========== LINKED DOCS (with search) ==========
  let linkSearchTimer = null;

  function renderLinkedDocs() {
    linkedDocsEl.innerHTML = "";
    // Existing linked docs
    if (linkedDocs.length > 0) {
      const header = document.createElement("div");
      header.className = "cc-link-header";
      header.innerHTML = `<span>${ICON.link} 关联文档 (${linkedDocs.length})</span>`;
      linkedDocsEl.appendChild(header);
      linkedDocs.forEach((doc, i) => {
        const item = document.createElement("div");
        item.className = "cc-link-item";
        item.innerHTML = `<span class="cc-link-title">${esc(doc.title || doc.url)}</span><button class="cc-link-rm">×</button>`;
        item.querySelector(".cc-link-rm").addEventListener("click", () => { linkedDocs.splice(i, 1); renderLinkedDocs(); });
        linkedDocsEl.appendChild(item);
      });
    }
    // Search input
    const searchWrap = document.createElement("div");
    searchWrap.className = "cc-link-search-wrap";
    searchWrap.innerHTML = `<input class="cc-link-search" placeholder="搜索文档名称关联…" /><div class="cc-link-results"></div>`;
    linkedDocsEl.appendChild(searchWrap);

    const searchInput = searchWrap.querySelector(".cc-link-search");
    const resultsEl = searchWrap.querySelector(".cc-link-results");

    // Load recent docs on focus
    searchInput.addEventListener("focus", () => { if (!searchInput.value.trim()) searchDocs("", resultsEl); });
    searchInput.addEventListener("input", () => {
      clearTimeout(linkSearchTimer);
      linkSearchTimer = setTimeout(() => searchDocs(searchInput.value.trim(), resultsEl), 300);
    });
  }

  async function searchDocs(q, resultsEl) {
    resultsEl.innerHTML = `<div class="cc-link-loading">搜索中…</div>`;
    try {
      const r = await fetch(BRIDGE + "/search-docs?q=" + encodeURIComponent(q) + "&curUrl=" + encodeURIComponent(getDocUrl()));
      const d = await r.json();
      if (!d.ok || !d.docs?.length) { resultsEl.innerHTML = `<div class="cc-link-loading">${q ? "未找到" : "暂无最近文档"}</div>`; return; }
      resultsEl.innerHTML = "";
      d.docs.forEach(doc => {
        if (linkedDocs.some(ld => ld.url === doc.url)) return;
        const item = document.createElement("div");
        item.className = "cc-link-result";
        const t = doc.updatedAt ? new Date(doc.updatedAt) : null;
        const timeStr = t ? `${t.getMonth()+1}/${t.getDate()}` : "";
        item.innerHTML = `<span class="cc-link-result-name">${esc(doc.name)}</span><span class="cc-link-result-meta">${esc(doc.type)} ${timeStr}</span>`;
        item.addEventListener("click", () => {
          linkedDocs.push({ url: doc.url, title: doc.name });
          renderLinkedDocs();
        });
        resultsEl.appendChild(item);
      });
    } catch (e) {
      resultsEl.innerHTML = `<div class="cc-link-loading">连接失败</div>`;
    }
  }

  renderLinkedDocs();

  // ========== HEALTH ==========
  async function checkHealth() { try { const r = await fetch(BRIDGE + "/health", { signal: AbortSignal.timeout(3000) }); bridgeOnline = !!(await r.json()).ok; } catch (_) { bridgeOnline = false; } statusDot.className = "cc-status-dot " + (bridgeOnline ? "cc-online" : "cc-offline"); }

  // ========== HELPERS ==========
  function getWelcomeHTML() { return `<div class="cc-welcome"><div class="cc-welcome-title">Claude Code</div><div class="cc-welcome-hint">选中文档中的文字，然后告诉我你想做什么。</div><div class="cc-welcome-shortcuts"><span><kbd>${MOD_KEY}</kbd>+<kbd>J</kbd> 打开</span><span><kbd>↵</kbd> 发送</span></div></div>`; }

  function addUserMsg(container, text) {
    const w = container.querySelector(".cc-welcome"); if (w) w.remove();
    const m = document.createElement("div"); m.className = "cc-msg cc-msg-user";
    m.innerHTML = `<div class="cc-msg-body">${esc(text)}</div>`;
    container.appendChild(m);
  }

  function addAssistantMsg(container) {
    const w = container.querySelector(".cc-welcome"); if (w) w.remove();
    const m = document.createElement("div"); m.className = "cc-msg cc-msg-assistant";
    m.innerHTML = `<div class="cc-msg-body"><div class="cc-activity"></div><div class="cc-reply"></div></div><div class="cc-msg-actions"></div>`;
    container.appendChild(m);
    return { activityEl: m.querySelector(".cc-activity"), replyEl: m.querySelector(".cc-reply"), actionsEl: m.querySelector(".cc-msg-actions") };
  }

  function addMsgActions(actionsEl, replyEl) {
    actionsEl.innerHTML = `<button class="cc-action-btn cc-copy-btn" title="复制">${ICON.copy} 复制</button><button class="cc-action-btn cc-write-btn" title="写入文档">${ICON.docWrite} 写入文档</button>`;
    actionsEl.querySelector(".cc-copy-btn").addEventListener("click", () => {
      const text = replyEl.innerText || replyEl.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = actionsEl.querySelector(".cc-copy-btn");
        btn.textContent = "✓ 已复制"; setTimeout(() => { btn.innerHTML = `${ICON.copy} 复制`; }, 1500);
      });
    });
    actionsEl.querySelector(".cc-write-btn").addEventListener("click", () => {
      const text = replyEl.innerText || replyEl.textContent;
      inputEl.value = `将以下内容追加写入当前文档末尾：\n\n${text.slice(0, 2000)}`;
      inputEl.style.height = "auto"; inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
      inputEl.focus();
    });
  }

  function addStep(el, type, text, icon) {
    const s = document.createElement("div"); s.className = "cc-step";
    const spin = (type === "status" || type === "thinking" || type === "tool_start") ? " cc-spinning" : "";
    const icons = { status: "⚙", thinking: "💭", tool_start: "🔧" };
    s.innerHTML = `<span class="cc-step-icon${spin}">${icon || icons[type] || "•"}</span><span class="cc-step-text">${text}</span>`;
    s.dataset.type = type; el.appendChild(s); return s;
  }
  function updateStatus(el, msg) { const l = el.querySelector('.cc-step[data-type="status"]'); if (l) l.querySelector(".cc-step-text").textContent = msg; else addStep(el, "status", msg); }
  function clearSteps(el, type) { el.querySelectorAll(`.cc-step[data-type="${type}"]`).forEach(n => n.remove()); }
  function scrollContainer(container) { requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; }); }

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
    p = p.replace(/^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/gm, (_, h, _s, b) => { const hs = h.split("|").filter(Boolean).map(c => c.trim()); const rs = b.trim().split("\n").map(r => r.split("|").filter(Boolean).map(c => c.trim())); let t = "<table><thead><tr>" + hs.map(c => `<th>${c}</th>`).join("") + "</tr></thead><tbody>"; rs.forEach(r => { t += "<tr>" + r.map(c => `<td>${c}</td>`).join("") + "</tr>"; }); return t + "</tbody></table>"; });
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

    // Ensure conversation exists
    if (!activeConvId || !activeConv()) newConversation();
    const conv = activeConv();
    if (conv.title === "新会话") { conv.title = text.length > 30 ? text.slice(0, 30) + "…" : text; }

    const targetConvId = conv.id;
    const container = conv.container;
    const targetClaudeSession = conv.claudeSessionId;
    const targetCwd = conv.claudeCwd;

    inputHistory.unshift(text); if (inputHistory.length > 20) inputHistory.pop(); historyIdx = -1;

    isStreaming = true; sendBtn.disabled = true; stopBtn.classList.add("cc-active");
    addUserMsg(container, text);
    const { activityEl, replyEl, actionsEl } = addAssistantMsg(container);
    inputEl.value = ""; inputEl.style.height = "auto";
    scrollContainer(container);

    let accumulated = "", gotContent = false, currentToolStep = null, sessionId = null, stopped = false, renderFrame = null;
    let stepCount = 0, startTime = Date.now();

    const LABELS = { "Bash": "执行命令", "Read": "读取文件", "Write": "写入文件", "Edit": "编辑文件", "Skill": "调用技能", "WebSearch": "搜索网络", "WebFetch": "获取网页" };
    function label(n) { return LABELS[n] || (/bash/i.test(n) ? "执行命令" : /read/i.test(n) ? "读取文件" : /search/i.test(n) ? "搜索网络" : /skill/i.test(n) ? "调用技能" : n); }
    function scroll() { scrollContainer(container); }

    function scheduleRender() { if (renderFrame) return; renderFrame = requestAnimationFrame(() => { renderFrame = null; replyEl.innerHTML = renderMarkdown(accumulated) + `<span class="cc-cursor"></span>`; scroll(); }); }

    function flushTextToStep() {
      if (!accumulated.trim()) return;
      const el = document.createElement("div"); el.className = "cc-thought";
      el.textContent = accumulated.trim().length > 120 ? accumulated.trim().slice(0, 120) + "…" : accumulated.trim();
      activityEl.appendChild(el); accumulated = "";
      if (renderFrame) { cancelAnimationFrame(renderFrame); renderFrame = null; } replyEl.innerHTML = ""; scroll();
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
        case "claude_session": { const c = getConv(targetConvId); if (c) c.claudeSessionId = ev.claudeSessionId; if (targetConvId === activeConvId) ; LOG("claude session:", ev.claudeSessionId); break; }
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
            d.textContent = t.length > 80 ? t.slice(0, 80) + "…" : t;
          } break;
        case "tool_input": break;
        case "tool_result":
          if (currentToolStep) { const ic = currentToolStep.querySelector(".cc-step-icon"); ic.className = "cc-step-icon"; ic.textContent = ev.is_error ? "❌" : "✅"; currentToolStep = null; } break;
        case "done":
          clearSteps(activityEl, "status"); clearSteps(activityEl, "thinking");
          if (currentToolStep) { currentToolStep.querySelector(".cc-step-icon").className = "cc-step-icon"; currentToolStep.querySelector(".cc-step-icon").textContent = "✅"; }
          if (renderFrame) { cancelAnimationFrame(renderFrame); renderFrame = null; }
          collapseActivity(); replyEl.innerHTML = renderMarkdown(ev.result || accumulated);
          addMsgActions(actionsEl, replyEl); scroll(); persistIndex(); break;
        case "error": {
          clearSteps(activityEl, "status"); clearSteps(activityEl, "thinking");
          if (activityEl.children.length > 0) collapseActivity();
          const isTimeout = (ev.error || "").includes("超时");
          replyEl.innerHTML = `<div class="cc-error">${esc(ev.error)}</div>`;
          if (isTimeout) { const btn = document.createElement("button"); btn.className = "cc-retry-btn"; btn.textContent = "重试"; btn.addEventListener("click", () => { container.removeChild(container.lastElementChild); container.removeChild(container.lastElementChild); inputEl.value = text; send(); }); replyEl.querySelector(".cc-error").appendChild(document.createElement("br")); replyEl.querySelector(".cc-error").appendChild(btn); }
          scroll(); persistIndex(); break;
        }
      }
    }

    abortController = { abort: async () => { stopped = true; if (sessionId) { try { await fetch(BRIDGE + "/stop/" + sessionId, { method: "POST" }); } catch (_) {} } } };

    try {
      const startRes = await fetch(BRIDGE + "/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text, url: getDocUrl(), title: getDocTitle(), selection, linkedDocs, claudeSessionId: targetClaudeSession, claudeCwd: targetCwd }),
      });
      const d = await startRes.json(); if (!d.ok) throw new Error(d.error || "启动失败");
      sessionId = d.sessionId; LOG("session:", sessionId);

      let cursor = 0, polls = 0, consecutiveErrors = 0;
      while (!stopped) {
        await sleep(200); if (stopped) break;
        try {
          const r = await fetch(BRIDGE + "/poll/" + sessionId + "?cursor=" + cursor);
          const p = await r.json(); if (!p.ok) break;
          polls++; consecutiveErrors = 0;

          for (const ev of p.events) {
            if (ev.type === "close" || ev.type === "done" || ev.type === "error") stopped = true;
            try { handleEvent(ev); } catch (e) { LOG("event error:", e); }
            if (stopped) break;
          }
          cursor = p.cursor; if (p.done || stopped) break;
        } catch (e) {
          consecutiveErrors++;
          LOG("poll error:", e.message, `(${consecutiveErrors}/5)`);
          if (consecutiveErrors >= 5) {
            // Bridge is down — show reconnect error
            clearSteps(activityEl, "status"); clearSteps(activityEl, "thinking");
            replyEl.innerHTML = `<div class="cc-error">Bridge 连接中断，请检查 bridge 是否在运行</div>`;
            const retryBtn = document.createElement("button");
            retryBtn.className = "cc-retry-btn"; retryBtn.textContent = "重试";
            retryBtn.addEventListener("click", () => {
              container.removeChild(container.lastElementChild);
              container.removeChild(container.lastElementChild);
              inputEl.value = text; send();
            });
            replyEl.querySelector(".cc-error").appendChild(document.createElement("br"));
            replyEl.querySelector(".cc-error").appendChild(retryBtn);
            stopped = true; scroll(); break;
          }
          await sleep(1000); // back off before retry
        }
      }
      LOG("stopped after", polls, "polls");
      if (accumulated && !replyEl.querySelector(".cc-md") && !replyEl.querySelector(".cc-error")) replyEl.innerHTML = renderMarkdown(accumulated);
    } catch (err) {
      replyEl.innerHTML = `<div class="cc-error">无法连接 Bridge，请确认已运行 <code>cd bridge && npm start</code></div>`;
    } finally {
      if (renderFrame) cancelAnimationFrame(renderFrame);
      isStreaming = false; sendBtn.disabled = false; stopBtn.classList.remove("cc-active"); abortController = null;
      persistIndex();
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
  restoreIndex();
})();
