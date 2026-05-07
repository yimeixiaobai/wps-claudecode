// content.js — WPS 365 页面注入：Claude Code 浮动面板（流式 + 剪贴板选区 + 工具步骤可见）
(function () {
  // In sub-frames: only set up selection listeners, no UI / networking
  if (window.top !== window) {
    try {
      document.addEventListener("copy", (e) => {
        const text = (e.clipboardData || window.clipboardData)?.getData("text/plain");
        if (text && text.trim() && window.top) {
          window.top.postMessage({ type: "__CC_SELECTION__", text: text.trim() }, "*");
        }
      }, true);
      document.addEventListener("selectionchange", () => {
        const sel = window.getSelection();
        const text = sel ? sel.toString().trim() : "";
        if (text && window.top) {
          window.top.postMessage({ type: "__CC_SELECTION__", text }, "*");
        }
      });
    } catch (_) {}
    return;
  }

  if (window.__CC_WPS_INJECTED__) return;
  window.__CC_WPS_INJECTED__ = true;

  const LOG = (...args) => console.log("[CC]", ...args);

  // ========== CONSTANTS ==========
  const BRIDGE_BASE = "http://localhost:5174";

  // ========== STATE ==========
  let cachedSelection = "";
  let isStreaming = false;
  let bridgeOnline = false;
  let abortController = null;
  let panelPos = null;

  // ========== SVG ICONS (all inline, with explicit size) ==========
  const ICON = {
    sparkle: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>`,
    send: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M22 2L11 13" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" fill="none" stroke-width="2" stroke-linejoin="round"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
    clear: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    doc: `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" fill="none" stroke-width="1.5"/><polyline points="14 2 14 8 20 8" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>`,
    stop: `<svg viewBox="0 0 24 24" width="12" height="12"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>`,
    // Small inline icon for message labels
    claude: `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" fill="none" stroke-width="2"/></svg>`,
  };

  // ========== DOM: FAB ==========
  const fab = document.createElement("div");
  fab.className = "cc-fab";
  fab.title = "Claude Code (Alt+J)";
  fab.innerHTML = ICON.sparkle + `<span class="cc-status-dot"></span>`;
  document.body.appendChild(fab);
  const statusDot = fab.querySelector(".cc-status-dot");

  // ========== DOM: PANEL ==========
  const panel = document.createElement("div");
  panel.className = "cc-panel";
  panel.innerHTML = `
    <div class="cc-resize-handle"></div>
    <div class="cc-header">
      <span class="cc-title">${ICON.claude} Claude Code</span>
      <div class="cc-header-actions">
        <button class="cc-header-btn cc-clear-btn" title="清空对话">${ICON.clear}</button>
        <button class="cc-header-btn cc-close-btn" title="关闭 (Esc)">${ICON.close}</button>
      </div>
    </div>
    <div class="cc-context">
      <span class="cc-ctx-icon">${ICON.doc}</span>
      <div class="cc-ctx-info">
        <div class="cc-ctx-title">未命名文档</div>
        <div class="cc-ctx-selection"></div>
      </div>
    </div>
    <div class="cc-messages">
      <div class="cc-welcome">
        <div class="cc-welcome-title">Claude Code</div>
        <div class="cc-welcome-hint">
          选中文档文本后按 <kbd>⌘C</kbd> 复制，我会自动捕获。<br/>
          然后告诉我你想做什么。
        </div>
        <div class="cc-welcome-shortcuts">
          <span><kbd>Alt</kbd>+<kbd>J</kbd> 打开</span>
          <span><kbd>⌘</kbd>+<kbd>↵</kbd> 发送</span>
        </div>
      </div>
    </div>
    <button class="cc-stop-btn">${ICON.stop} 停止生成</button>
    <div class="cc-input-area">
      <div class="cc-input-wrapper">
        <textarea class="cc-input" rows="1"
          placeholder="输入你的请求… 例：总结这篇文档 / 把第二段改写得更正式"></textarea>
        <button class="cc-send-btn" title="发送 (⌘/Ctrl+Enter)">${ICON.send}</button>
      </div>
      <div class="cc-input-footer">
        <label class="cc-checkbox">
          <input type="checkbox" class="cc-include-selection" checked />
          包含选中文本
        </label>
        <span class="cc-input-hint"><kbd>⌘</kbd>+<kbd>↵</kbd> 发送</span>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // ========== ELEMENT REFS ==========
  const inputEl = panel.querySelector(".cc-input");
  const sendBtn = panel.querySelector(".cc-send-btn");
  const stopBtn = panel.querySelector(".cc-stop-btn");
  const messagesEl = panel.querySelector(".cc-messages");
  const ctxTitleEl = panel.querySelector(".cc-ctx-title");
  const ctxSelectionEl = panel.querySelector(".cc-ctx-selection");
  const resizeHandle = panel.querySelector(".cc-resize-handle");

  // ========== PANEL TOGGLE ==========
  function showPanel() {
    panel.classList.add("cc-visible");
    refreshContext();
    inputEl.focus();
    checkHealth();
  }
  function hidePanel() { panel.classList.remove("cc-visible"); }
  function togglePanel() {
    panel.classList.contains("cc-visible") ? hidePanel() : showPanel();
  }

  fab.addEventListener("click", togglePanel);
  panel.querySelector(".cc-close-btn").addEventListener("click", hidePanel);

  // ========== KEYBOARD ==========
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "j" || e.key === "J")) { e.preventDefault(); togglePanel(); }
    if (e.key === "Escape" && panel.classList.contains("cc-visible")) hidePanel();
  });
  inputEl.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); send(); }
  });
  sendBtn.addEventListener("click", send);
  stopBtn.addEventListener("click", () => { if (abortController) { abortController.abort(); abortController = null; } });
  panel.querySelector(".cc-clear-btn").addEventListener("click", () => { messagesEl.innerHTML = getWelcomeHTML(); });

  // Auto-resize textarea
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
  });

  // ========== SELECTION CAPTURE (via page-bridge.js in MAIN world) ==========
  // page-bridge.js runs in the page's main world, reads APP.core.editor selection,
  // and sends it here via postMessage.

  window.addEventListener("message", (e) => {
    if (e.data?.type === "__CC_WPS_SELECTION__") {
      cachedSelection = (e.data.text || "").trim();
      if (panel.classList.contains("cc-visible")) refreshContext();
    }
  });

  function getEffectiveSelection() {
    // Request fresh selection from page-bridge
    window.postMessage({ type: "__CC_REQUEST_SELECTION__" }, "*");
    return cachedSelection;
  }

  // ========== CONTEXT DISPLAY ==========
  function refreshContext() {
    const title = (document.title || "").replace(/\s*[-|_]\s*WPS.*$/i, "").trim() || "未命名文档";
    ctxTitleEl.textContent = title;

    const sel = getEffectiveSelection();
    if (sel) {
      const preview = sel.length > 80 ? sel.slice(0, 80) + "…" : sel;
      ctxSelectionEl.textContent = `✂️ 选中: "${preview}"`;
      ctxSelectionEl.style.display = "block";
    } else {
      ctxSelectionEl.textContent = "";
      ctxSelectionEl.style.display = "none";
    }
  }

  // ========== HEALTH CHECK ==========
  async function checkHealth() {
    try {
      const res = await fetch(BRIDGE_BASE + "/health", { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      bridgeOnline = !!data.ok;
    } catch (_) { bridgeOnline = false; }
    statusDot.className = "cc-status-dot " + (bridgeOnline ? "cc-online" : "cc-offline");
  }
  checkHealth();
  setInterval(checkHealth, 30000);

  // ========== MESSAGES ==========
  function getWelcomeHTML() {
    return `<div class="cc-welcome">
      <div class="cc-welcome-title">Claude Code</div>
      <div class="cc-welcome-hint">
        选中文档中的文字，然后告诉我你想做什么。<br/>我可以帮你编辑、总结、翻译、调研并写入文档。
      </div>
      <div class="cc-welcome-shortcuts">
        <span><kbd>Alt</kbd>+<kbd>J</kbd> 打开</span>
        <span><kbd>⌘</kbd>+<kbd>↵</kbd> 发送</span>
      </div>
    </div>`;
  }

  function clearWelcome() {
    const w = messagesEl.querySelector(".cc-welcome");
    if (w) w.remove();
  }

  function addUserMessage(text) {
    clearWelcome();
    const msg = document.createElement("div");
    msg.className = "cc-msg cc-msg-user";
    msg.innerHTML = `<div class="cc-msg-label">你</div><div class="cc-msg-body">${esc(text)}</div>`;
    messagesEl.appendChild(msg);
    scrollToBottom();
  }

  function addAssistantMessage() {
    clearWelcome();
    const msg = document.createElement("div");
    msg.className = "cc-msg cc-msg-assistant";
    msg.innerHTML = `
      <div class="cc-msg-label">${ICON.claude} Claude</div>
      <div class="cc-msg-body">
        <div class="cc-activity"></div>
        <div class="cc-reply"></div>
      </div>`;
    messagesEl.appendChild(msg);
    scrollToBottom();
    return {
      bodyEl: msg.querySelector(".cc-msg-body"),
      activityEl: msg.querySelector(".cc-activity"),
      replyEl: msg.querySelector(".cc-reply"),
    };
  }

  function addStep(activityEl, type, text, icon) {
    const step = document.createElement("div");
    step.className = "cc-step";
    const spinning = (type === "status" || type === "thinking" || type === "tool_start") ? " cc-spinning" : "";
    const defaultIcons = { status: "⚙", thinking: "💭", tool_start: "🔧", tool_done: "✅", tool_error: "❌" };
    step.innerHTML = `<span class="cc-step-icon${spinning}">${icon || defaultIcons[type] || "•"}</span><span class="cc-step-text">${text}</span>`;
    step.dataset.type = type;
    activityEl.appendChild(step);
    scrollToBottom();
    return step;
  }

  function updateOrAddStatus(activityEl, message) {
    // Reuse the last status step if it exists, otherwise add new
    const last = activityEl.querySelector('.cc-step[data-type="status"]:last-of-type');
    if (last) {
      last.querySelector(".cc-step-text").textContent = message;
    } else {
      addStep(activityEl, "status", message);
    }
    scrollToBottom();
  }

  function removeStepsByType(activityEl, type) {
    activityEl.querySelectorAll(`.cc-step[data-type="${type}"]`).forEach(el => el.remove());
  }

  function scrollToBottom() {
    const near = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;
    if (near || messagesEl.scrollTop === 0) {
      requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
    }
  }

  // ========== MARKDOWN RENDERER ==========
  function renderMarkdown(text) {
    if (!text) return "";
    const codeBlocks = [];
    let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre><code class="lang-${esc(lang)}">${esc(code.replace(/\n$/, ""))}</code></pre>`);
      return `%%CB${idx}%%`;
    });
    const inlineCodes = [];
    processed = processed.replace(/`([^`\n]+)`/g, (_, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(`<code>${esc(code)}</code>`);
      return `%%IC${idx}%%`;
    });
    processed = esc(processed);
    processed = processed.replace(/%%CB(\d+)%%/g, (_, i) => codeBlocks[i]);
    processed = processed.replace(/%%IC(\d+)%%/g, (_, i) => inlineCodes[i]);

    processed = processed.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
    processed = processed.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
    processed = processed.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
    processed = processed.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
    processed = processed.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
    processed = processed.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
    processed = processed.replace(/^---+$/gm, "<hr/>");
    processed = processed.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    processed = processed.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    processed = processed.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`);
    processed = processed.replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>");

    // Tables
    processed = processed.replace(
      /^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/gm,
      (_, header, _sep, bodyStr) => {
        const hs = header.split("|").filter(Boolean).map((c) => c.trim());
        const rows = bodyStr.trim().split("\n").map((r) => r.split("|").filter(Boolean).map((c) => c.trim()));
        let h = "<table><thead><tr>" + hs.map((c) => `<th>${c}</th>`).join("") + "</tr></thead><tbody>";
        rows.forEach((r) => { h += "<tr>" + r.map((c) => `<td>${c}</td>`).join("") + "</tr>"; });
        return h + "</tbody></table>";
      }
    );

    processed = processed.replace(/^[\s]*[-*]\s+(.+)$/gm, "<li>$1</li>");
    processed = processed.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
    processed = processed.replace(/^[\s]*\d+\.\s+(.+)$/gm, "<oli>$1</oli>");
    processed = processed.replace(/((?:<oli>.*<\/oli>\n?)+)/g, (m) =>
      "<ol>" + m.replace(/<\/?oli>/g, (t) => t.replace("oli", "li")) + "</ol>"
    );

    const blocks = processed.split(/\n{2,}/);
    processed = blocks.map((b) => {
      b = b.trim();
      if (!b) return "";
      if (/^<(h[1-6]|pre|ul|ol|table|blockquote|hr)/.test(b)) return b;
      return `<p>${b.replace(/\n/g, "<br/>")}</p>`;
    }).join("\n");

    return `<div class="cc-md">${processed}</div>`;
  }

  // ========== SEND (polling mode — avoids long-lived connection issues) ==========
  async function send() {
    if (isStreaming) return;
    const text = inputEl.value.trim();
    if (!text) return;

    const includeSel = panel.querySelector(".cc-include-selection").checked;
    const selection = includeSel ? getEffectiveSelection() : "";

    isStreaming = true;
    sendBtn.disabled = true;
    stopBtn.classList.add("cc-active");

    addUserMessage(text);
    const { activityEl, replyEl } = addAssistantMessage();

    inputEl.value = "";
    inputEl.style.height = "auto";

    let accumulated = "";
    let gotContent = false;
    let renderFrame = null;
    let currentToolStep = null;
    let sessionId = null;
    let stopped = false;

    function scheduleRender() {
      if (renderFrame) return;
      renderFrame = requestAnimationFrame(() => {
        renderFrame = null;
        replyEl.innerHTML = renderMarkdown(accumulated) + `<span class="cc-cursor"></span>`;
        scrollToBottom();
      });
    }

    function handleEvent(data) {
      switch (data.type) {
        case "status":
          updateOrAddStatus(activityEl, data.message);
          break;

        case "thinking_start":
          removeStepsByType(activityEl, "status");
          addStep(activityEl, "thinking", "深度思考中…", "💭");
          break;

        case "thinking":
          // thinking content streaming — show brief preview
          break;

        case "thinking_done": {
          const el = activityEl.querySelector('.cc-step[data-type="thinking"]');
          if (el) {
            el.querySelector(".cc-step-icon").className = "cc-step-icon";
            el.querySelector(".cc-step-icon").textContent = "✅";
            el.querySelector(".cc-step-text").textContent = "思考完成";
            el.dataset.type = "thinking_done";
          }
          break;
        }

        case "delta":
          if (!gotContent) {
            gotContent = true;
            removeStepsByType(activityEl, "status");
            removeStepsByType(activityEl, "thinking");
          }
          accumulated += data.text;
          scheduleRender();
          break;

        case "tool_start":
          removeStepsByType(activityEl, "status");
          removeStepsByType(activityEl, "thinking");
          if (currentToolStep) {
            currentToolStep.querySelector(".cc-step-icon").className = "cc-step-icon";
            currentToolStep.querySelector(".cc-step-icon").textContent = "✅";
            currentToolStep.dataset.type = "tool_done";
          }
          currentToolStep = addStep(activityEl, "tool_start", `<span class="cc-step-name">${esc(data.name)}</span>`);
          break;

        case "tool_input":
          if (currentToolStep && data.input) {
            const detail = summarizeInput(data.input);
            if (detail) {
              const el = document.createElement("div");
              el.className = "cc-step-detail";
              el.textContent = detail;
              currentToolStep.querySelector(".cc-step-text").appendChild(el);
              scrollToBottom();
            }
          }
          break;

        case "tool_result":
          if (currentToolStep) {
            const icon = currentToolStep.querySelector(".cc-step-icon");
            icon.className = "cc-step-icon";
            icon.textContent = data.is_error ? "❌" : "✅";
            currentToolStep.classList.add(data.is_error ? "cc-step-error" : "cc-step-done");
            currentToolStep.dataset.type = data.is_error ? "tool_error" : "tool_done";
            // Show brief result content
            if (data.content) {
              const preview = data.content.length > 100 ? data.content.slice(0, 100) + "…" : data.content;
              const el = document.createElement("div");
              el.className = "cc-step-detail";
              el.textContent = preview;
              currentToolStep.querySelector(".cc-step-text").appendChild(el);
            }
            currentToolStep = null;
            scrollToBottom();
          }
          break;

        case "done":
          removeStepsByType(activityEl, "status");
          removeStepsByType(activityEl, "thinking");
          if (currentToolStep) {
            currentToolStep.querySelector(".cc-step-icon").className = "cc-step-icon";
            currentToolStep.querySelector(".cc-step-icon").textContent = "✅";
          }
          replyEl.innerHTML = renderMarkdown(data.result || accumulated);
          scrollToBottom();
          break;

        case "error":
          removeStepsByType(activityEl, "status");
          removeStepsByType(activityEl, "thinking");
          replyEl.innerHTML = `<div class="cc-error">${esc(data.error)}</div>`;
          scrollToBottom();
          break;
      }
    }

    // Stop handler
    abortController = {
      abort: async () => {
        stopped = true;
        if (sessionId) {
          try { await fetch(BRIDGE_BASE + "/stop/" + sessionId, { method: "POST" }); } catch (_) {}
        }
      }
    };

    try {
      // Step 1: start the session
      const startRes = await fetch(BRIDGE_BASE + "/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text, url: location.href, title: document.title, selection }),
      });
      const startData = await startRes.json();
      if (!startData.ok) throw new Error(startData.error || "启动失败");
      sessionId = startData.sessionId;
      LOG("session started:", sessionId);

      // Step 2: poll for events
      let cursor = 0;
      while (!stopped) {
        await sleep(300);
        if (stopped) break;

        try {
          const pollRes = await fetch(BRIDGE_BASE + "/poll/" + sessionId + "?cursor=" + cursor);
          const pollData = await pollRes.json();
          if (!pollData.ok) break;

          for (const event of pollData.events) {
            handleEvent(event);
            if (event.type === "close") { stopped = true; break; }
          }
          cursor = pollData.cursor;
          if (pollData.done && pollData.events.length === 0) break;
        } catch (e) {
          LOG("poll error:", e.message);
          // Network hiccup — retry
        }
      }

      // Finalize
      if (accumulated && !replyEl.querySelector(".cc-md") && !replyEl.querySelector(".cc-error")) {
        replyEl.innerHTML = renderMarkdown(accumulated);
      }
    } catch (err) {
      replyEl.innerHTML = `<div class="cc-error">
        无法连接 Bridge（端口 5174）<br/>
        请确认 <code>node server.js</code> 已运行<br/>${esc(err.message)}
      </div>`;
    } finally {
      if (renderFrame) cancelAnimationFrame(renderFrame);
      isStreaming = false;
      sendBtn.disabled = false;
      stopBtn.classList.remove("cc-active");
      abortController = null;
    }
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function summarizeInput(input) {
    const parts = [];
    for (const [k, v] of Object.entries(input)) {
      const val = typeof v === "string" ? (v.length > 60 ? v.slice(0, 60) + "…" : v) : JSON.stringify(v);
      parts.push(`${k}: ${val}`);
    }
    return parts.join(" | ").slice(0, 120);
  }

  // ========== PANEL DRAG ==========
  (function () {
    const header = panel.querySelector(".cc-header");
    let dragging = false, startX, startY, startLeft, startTop;
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest(".cc-header-btn")) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startLeft = rect.left; startTop = rect.top;
      panel.style.right = "auto"; panel.style.bottom = "auto";
      panel.style.left = rect.left + "px"; panel.style.top = rect.top + "px";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      panel.style.left = Math.max(0, Math.min(window.innerWidth - 100, startLeft + e.clientX - startX)) + "px";
      panel.style.top = Math.max(0, Math.min(window.innerHeight - 100, startTop + e.clientY - startY)) + "px";
    });
    window.addEventListener("mouseup", () => { if (dragging) { dragging = false; document.body.style.userSelect = ""; } });
  })();

  // ========== PANEL RESIZE ==========
  (function () {
    let resizing = false, startX, startY, startW, startH, startLeft, startTop;
    resizeHandle.addEventListener("mousedown", (e) => {
      resizing = true;
      const rect = panel.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startW = rect.width; startH = rect.height;
      startLeft = rect.left; startTop = rect.top;
      panel.style.right = "auto"; panel.style.bottom = "auto";
      panel.style.left = rect.left + "px"; panel.style.top = rect.top + "px";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      const newW = Math.max(340, Math.min(680, startW - (e.clientX - startX)));
      const newH = Math.max(360, Math.min(window.innerHeight * 0.85, startH - (e.clientY - startY)));
      panel.style.width = newW + "px"; panel.style.height = newH + "px";
      panel.style.left = (startLeft + startW - newW) + "px";
      panel.style.top = (startTop + startH - newH) + "px";
    });
    window.addEventListener("mouseup", () => { if (resizing) { resizing = false; document.body.style.userSelect = ""; } });
  })();

  // ========== UTILITIES ==========
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }
})();
