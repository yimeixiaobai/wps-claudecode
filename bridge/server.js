// server.js — 本地 HTTP 服务，把浏览器扩展的请求转发给 Claude Code
// 使用 polling 模式（兼容 WPS 页面的网络环境）
import express from "express";
import { spawn } from "child_process";
import { randomUUID } from "crypto";

const PORT = process.env.PORT || 5174;
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const TIMEOUT_MS = Number(process.env.CC_TIMEOUT_MS || 10 * 60 * 1000);
const SESSION_TTL = 10 * 60 * 1000;
const MAX_TOOL_INPUT_LOG_CHARS = 4_000;

const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m",
  magenta: "\x1b[35m", red: "\x1b[31m", blue: "\x1b[34m",
};

const app = express();

const ALLOWED_ORIGINS = (process.env.CC_ALLOWED_ORIGINS || "https://365.kdocs.cn,https://www.kdocs.cn").split(",").map(s => s.trim());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Bridge is localhost-only (127.0.0.1), CORS is defense-in-depth
  if (ALLOWED_ORIGINS.includes("*") || !origin || origin === "null") {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "2mb" }));

// ========== Request logger ==========
const QUIET_PATHS = new Set(["/health"]);
app.use((req, res, next) => {
  const quiet = QUIET_PATHS.has(req.path) || req.path.startsWith("/poll/");
  const t0 = Date.now();
  const ts = new Date(t0).toLocaleTimeString("zh-CN", { hour12: false });
  if (!quiet) console.log(`${C.dim}${ts}${C.reset} ${C.cyan}→${C.reset} ${req.method} ${req.originalUrl}`);
  const origEnd = res.end;
  res.end = function (...args) {
    const ms = Date.now() - t0;
    if (!quiet) console.log(`${C.dim}${ts}${C.reset} ${C.green}←${C.reset} ${req.method} ${req.originalUrl} ${C.dim}[${res.statusCode}] ${ms}ms${C.reset}`);
    origEnd.apply(res, args);
  };
  next();
});

// ========== Session store ==========
const sessions = new Map();

function createSession() {
  const id = randomUUID().slice(0, 8);
  const session = {
    id, events: [], baseCursor: 0, done: false, proc: null, timeoutId: null,
    createdAt: Date.now(),
  };
  sessions.set(id, session);
  return session;
}

function pushEvent(session, event) {
  event.ts = Date.now() - session.createdAt;
  session.events.push(event);
}

function markDone(session) {
  session.done = true;
  if (session.timeoutId) {
    clearTimeout(session.timeoutId);
    session.timeoutId = null;
  }
}

function cleanupSession(id) {
  const session = sessions.get(id);
  if (!session) return;
  if (session.timeoutId) clearTimeout(session.timeoutId);
  session.events = [];
  session.proc = null;
  sessions.delete(id);
}

function compactEvents(events) {
  const compacted = [];
  for (const event of events) {
    const last = compacted[compacted.length - 1];
    if (event.type === "delta" && last?.type === "delta") {
      last.text += event.text || "";
      last.ts = event.ts;
    } else {
      compacted.push({ ...event });
    }
  }
  return compacted;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL) {
      if (s.proc && !s.done) s.proc.kill("SIGTERM");
      cleanupSession(id);
    }
  }
}, 60_000);

// ========== Prompt builder ==========
function buildPrompt({ request, url, title, selection, linkedDocs, cursorPos }) {
  const ctxLines = [];
  if (title) ctxLines.push(`- 当前文档（主文档）：${title}`);
  if (url) ctxLines.push(`  链接：${url}`);
  if (selection) {
    ctxLines.push(`- 用户选中的文本：\n  """\n  ${selection.replace(/\n/g, "\n  ")}\n  """`);
  }
  if (cursorPos && cursorPos.from !== undefined) {
    const posInfo = cursorPos.from === cursorPos.to
      ? `位置 ${cursorPos.from}（光标）`
      : `位置 ${cursorPos.from}–${cursorPos.to}（选区）`;
    const ctxText = cursorPos.context?.parentText ? `，所在段落：「${cursorPos.context.parentText.slice(0, 80)}」` : "";
    ctxLines.push(`- 用户光标：${posInfo}${ctxText}`);
  }
  if (Array.isArray(linkedDocs) && linkedDocs.length > 0) {
    ctxLines.push(`- 关联文档（可读取引用）：`);
    linkedDocs.forEach((doc, i) => {
      ctxLines.push(`  ${i + 1}. ${doc.title || "文档"} — ${doc.url}`);
    });
  }
  return [
    "我正在 WPS 365 智能文档（AirPage / kdocs）中工作，请使用 WPS-AirPage-Skill 完成下面的请求。",
    "", "上下文：", ctxLines.join("\n") || "（无上下文）", "",
    `用户请求：${request}`, "",
    "执行要求：",
    "1. 先从文档链接解析 file_id（短链由 CLI 自动解析）。",
    "2. 如果是写操作，默认写入当前主文档；如需操作关联文档请先确认。",
    "3. 可以从关联文档中 query 读取内容，作为参考素材写入主文档。",
    "4. 如果用户请求里有'调研''查一下''搜索'等意图，先用 WebSearch 工具收集信息，再写入文档。",
    "5. 简洁地总结你做了什么、写到了哪里。",
    "6. 所有思考过程和最终回复必须使用中文。",
  ].join("\n");
}

// ========== Standalone Panel Page (bypasses CSP) ==========
app.get("/panel", async (req, res) => {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const jsPath = path.join(import.meta.dirname || ".", "..", "dist", "inject-console.js");
    const js = await fs.promises.readFile(jsPath, "utf-8");
    const mode = req.query.mode || "float";
    const docUrl = req.query.docUrl || "";
    const docTitle = req.query.docTitle || "";
    const extraCSS = mode === "sidebar"
      ? `html,body{margin:0;height:100%;overflow:hidden;background:var(--cc-surface-1,#fff);}
         .cc-fab{display:none!important;}
         .cc-panel{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;border-radius:0!important;border:none!important;box-shadow:none!important;display:flex!important;contain:unset!important;}
         .cc-close-btn{display:none!important;}`
      : `html,body{margin:0;height:100%;background:transparent!important;}
         .cc-panel.cc-visible{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;border-radius:12px!important;box-shadow:0 8px 32px rgba(0,0,0,0.15)!important;}
         .cc-fab{position:fixed;right:16px;bottom:16px;}`;
    const autoOpen = mode === "sidebar" ? `document.querySelector('.cc-fab')?.click();` : "";
    const globals = `window.__CC_DOC_URL__=${JSON.stringify(docUrl)};window.__CC_DOC_TITLE__=${JSON.stringify(docTitle)};`;
    // Use string concat, not template literal, to avoid ${}  in js breaking interpolation
    res.type("html").send(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Claude Code</title>' +
      '<style>*{box-sizing:border-box;}' + extraCSS + '</style></head>' +
      '<body><script>' + globals + js + autoOpen + '</script></body></html>'
    );
  } catch (err) {
    res.type("html").send(`<h3>请先构建注入脚本</h3><pre>cd /path/to/wps-cc && node build-inject.js</pre><p>${err.message}</p>`);
  }
});

// ========== WPS Doc Search ==========
async function getWpsCookie() {
  const os = await import("os");
  const fs = await import("fs");
  const path = await import("path");
  const secretPath = path.join(os.homedir(), ".claude", "secrets", "wps365.json");
  const data = JSON.parse(await fs.promises.readFile(secretPath, "utf-8"));
  return data.cookie || "";
}

// ========== Routes ==========
app.get("/health", (_, res) => res.json({ ok: true }));

// Resolve short link → numeric file ID (cached per short code)
const shortLinkCache = new Map();
async function resolveShortLink(shortCode, cookie) {
  if (shortLinkCache.has(shortCode)) return shortLinkCache.get(shortCode);
  try {
    // Follow redirects, check final URL for numeric file ID
    const r = await fetch(`https://365.kdocs.cn/l/${shortCode}`, {
      headers: { Cookie: cookie }, redirect: "follow",
    });
    const finalUrl = r.url || "";
    const body = await r.text();
    // Try final URL first
    let m = finalUrl.match(/\/(\d{6,})/);
    // Fallback: look for file ID in response body (e.g. window.__FILE_ID__ or "file_id":12345)
    if (!m) m = body.match(/["']?file_?id["']?\s*[:=]\s*["']?(\d{6,})/i);
    if (!m) m = body.match(/\/p\/(\d{6,})/);
    const fileId = m ? m[1] : null;
    shortLinkCache.set(shortCode, fileId);
    return fileId;
  } catch (e) {
    return null;
  }
}

// Search WPS docs by keyword, or list recent docs (no keyword)
app.get("/search-docs", async (req, res) => {
  try {
    const keyword = req.query.q || "";
    const curUrl = req.query.curUrl || "";
    const cookie = await getWpsCookie();
    if (!cookie) return res.json({ ok: false, error: "WPS cookie 未配置" });

    // Resolve current doc's numeric ID from short link
    let excludeId = null;
    const shortMatch = curUrl.match(/\/l\/([A-Za-z0-9_-]+)/);
    if (shortMatch) {
      excludeId = await resolveShortLink(shortMatch[1], cookie);
    }

    const params = new URLSearchParams({ offset: "0", count: "10", sort_by: "modify_time", order: "desc" });
    if (keyword) params.set("searchname", keyword);

    const r = await fetch(`https://365.kdocs.cn/3rd/drive/api/v6/search/files?${params}`, {
      headers: { Cookie: cookie },
    });
    const data = await r.json();

    if (!data.files) return res.json({ ok: false, error: data.result || data.msg || "搜索失败" });

    const docs = (data.files || []).map(f => ({
      id: String(f.id),
      name: (f.fname || "未命名").replace(/\.\w+$/, ""),
      type: f.ftype || "unknown",
      url: `https://365.kdocs.cn/l/${f.id}`,
      updatedAt: (f.mtime || f.modify_time || 0) * 1000,
    })).filter(d => d.id !== excludeId);
    res.json({ ok: true, docs });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// List local Claude Code sessions with titles (scans ~/.claude/projects)
app.get("/local-sessions", async (req, res) => {
  try {
    const os = await import("os");
    const fs = await import("fs");
    const path = await import("path");
    const { readdir, readFile, stat } = fs.promises;

    const excludeSet = new Set((req.query.exclude || "").split(",").filter(Boolean));
    const projectsDir = path.join(os.homedir(), ".claude", "projects");
    const results = [];

    const projects = await readdir(projectsDir).catch(() => []);
    for (const proj of projects) {
      const projPath = path.join(projectsDir, proj);
      const files = await readdir(projPath).catch(() => []);
      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        const sessionId = file.replace(".jsonl", "");
        if (excludeSet.has(sessionId)) continue;
        const filePath = path.join(projPath, file);
        const fileStat = await stat(filePath).catch(() => null);
        if (!fileStat) continue;

        let firstUserMsg = "", lastUserMsg = "", turns = 0, lastAssistantText = "", sessionCwd = "", hasWpsMsg = false;
        try {
          const content = await readFile(filePath, "utf-8");
          const lines = content.split("\n").filter(Boolean);
          for (const line of lines) {
            const d = JSON.parse(line);
            if (d.type === "user") {
              turns++;
              if (d.cwd && !sessionCwd) sessionCwd = d.cwd;
              const msg = d.message;
              let text = "";
              if (typeof msg === "object" && msg.content) {
                if (Array.isArray(msg.content)) {
                  for (const block of msg.content) {
                    if (block.type === "text" && block.text) { text = block.text; break; }
                    if (typeof block === "string") { text = block; break; }
                  }
                } else if (typeof msg.content === "string") { text = msg.content; }
              } else if (typeof msg === "string") { text = msg; }
              text = text.replace(/\n/g, " ").trim();
              if (text && !firstUserMsg) firstUserMsg = text;
              if (text) lastUserMsg = text;
              if (text.startsWith("我正在 WPS 365")) hasWpsMsg = true;
            }
            if (d.type === "assistant" && d.message?.content) {
              for (const b of d.message.content) {
                if (b.type === "text" && b.text) lastAssistantText = b.text;
              }
            }
          }
        } catch (_) { continue; }

        if (!firstUserMsg || turns === 0) continue;
        if (hasWpsMsg) continue;

        // Title: last user message (represents current state)
        let title = lastUserMsg.slice(0, 60);

        // Summary: last assistant reply, first two sentences
        let summary = lastAssistantText.replace(/\n/g, " ").trim();
        const secondSentence = summary.search(/[。？！?.!]/);
        if (secondSentence > 0) {
          const afterFirst = summary.slice(secondSentence + 1).search(/[。？！?.!]/);
          if (afterFirst > 0) summary = summary.slice(0, secondSentence + 1 + afterFirst + 1);
          else summary = summary.slice(0, secondSentence + 1);
        }
        summary = summary.slice(0, 150);
        const cwdPath = sessionCwd || process.cwd();
        const project = cwdPath.replace(/^\/Users\/\w+\//, "~/");

        results.push({
          sessionId,
          title,
          summary,
          turns,
          project,
          cwd: cwdPath,
          updatedAt: fileStat.mtimeMs,
        });
      }
    }

    results.sort((a, b) => b.updatedAt - a.updatedAt);
    res.json({ ok: true, sessions: results.slice(0, 10) });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post("/start", (req, res) => {
  const { request, claudeSessionId, claudeCwd, forkSession } = req.body || {};
  if (!request) return res.status(400).json({ ok: false, error: "缺少 request 字段" });

  const session = createSession();
  const isResume = !!claudeSessionId;

  // Always include WPS document context — even for resumed sessions,
  // since the original session may not know about this document.
  const prompt = buildPrompt(req.body);

  const modeLabel = isResume ? (forkSession ? "Fork" : "Continue") : "New";
  console.log(`\n${C.cyan}${C.bold}━━━ [${session.id}] ${modeLabel} Request ━━━${C.reset}`);
  if (isResume) console.log(`${C.dim}   ${forkSession ? "forking" : "resuming"} claude session: ${claudeSessionId}${C.reset}`);
  console.log(`${C.dim}${prompt}${C.reset}\n`);

  pushEvent(session, { type: "status", message: "正在启动…" });

  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--dangerously-skip-permissions"];
  if (isResume) {
    args.push("--resume", claudeSessionId);
    if (forkSession) args.push("--fork-session");
  }
  // Use the session's original cwd so --resume can find it
  const spawnCwd = (isResume && claudeCwd) ? claudeCwd : process.cwd();
  const proc = spawn(CLAUDE_BIN, args, { env: process.env, shell: false, stdio: ["ignore", "pipe", "pipe"], cwd: spawnCwd });
  session.proc = proc;

  console.log(`${C.dim}[${session.id}] pid=${proc.pid}${C.reset}`);
  pushEvent(session, { type: "status", message: "等待响应…" });

  let buffer = "";
  const toolInputBuffers = {};
  let currentToolIndex = null;
  let thinkingStarted = false;

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        handleObj(obj);
      } catch (_) {}
    }
  });

  proc.stderr.on("data", (d) => {
    const text = d.toString().trim();
    if (text) console.error(`${C.red}[${session.id} stderr] ${text}${C.reset}`);
  });

  proc.on("close", (code) => {
    if (session.done) return;
    if (buffer.trim()) {
      try { handleObj(JSON.parse(buffer)); } catch (_) {}
    }
    markDone(session);
    if (code !== 0 && !session.events.some(e => e.type === "done")) {
      pushEvent(session, { type: "error", error: `claude 退出码 ${code}` });
    }
    pushEvent(session, { type: "close" });
    console.log(`${C.green}[${session.id}] exited (code=${code})${C.reset}\n`);
  });

  proc.on("error", (err) => {
    markDone(session);
    pushEvent(session, { type: "error", error: `无法启动 claude：${err.message}` });
    pushEvent(session, { type: "close" });
  });

  session.timeoutId = setTimeout(() => {
    if (!session.done) {
      markDone(session);
      proc.kill("SIGTERM");
      pushEvent(session, { type: "error", error: `超时（${TIMEOUT_MS / 1000}s）` });
      pushEvent(session, { type: "close" });
    }
  }, TIMEOUT_MS);

  res.json({ ok: true, sessionId: session.id });

  // ---- inner handler with closure over session state ----
  function handleObj(obj) {
    // system init — capture Claude's session_id for conversation continuity
    if (obj.type === "system" && obj.subtype === "init") {
      const model = obj.model || "unknown";
      const clSessionId = obj.session_id || "";
      console.log(`${C.blue}⚙ model=${model}  claude_session=${clSessionId}${C.reset}`);
      pushEvent(session, { type: "status", message: `模型: ${model}` });
      if (clSessionId) {
        pushEvent(session, { type: "claude_session", claudeSessionId: clSessionId });
      }
    }

    // stream events
    if (obj.type === "stream_event") {
      const evt = obj.event;
      if (!evt) return;

      // thinking
      if (evt.type === "content_block_start" && evt.content_block?.type === "thinking") {
        if (!thinkingStarted) {
          thinkingStarted = true;
          pushEvent(session, { type: "thinking_start" });
        }
      }
      if (evt.type === "content_block_delta" && evt.delta?.type === "thinking_delta") {
        // Don't store thinking deltas — too many events, frontend doesn't display them
      }
      if (evt.type === "content_block_stop" && thinkingStarted && currentToolIndex === null) {
        // thinking block ended (only if no tool is active)
        if (evt.index !== undefined && toolInputBuffers[evt.index] === undefined) {
          thinkingStarted = false;
          pushEvent(session, { type: "thinking_done" });
        }
      }

      // text content
      if (evt.type === "content_block_start" && evt.content_block?.type === "text") {
        pushEvent(session, { type: "status", message: "正在回复…" });
      }
      if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) {
        process.stdout.write(evt.delta.text);
        pushEvent(session, { type: "delta", text: evt.delta.text });
      }

      // tool use
      if (evt.type === "content_block_start" && evt.content_block?.type === "tool_use") {
        const tool = evt.content_block;
        currentToolIndex = evt.index;
        toolInputBuffers[evt.index] = { text: "", truncated: false };
        console.log(`\n${C.magenta}🔧 ${tool.name}${C.reset}`);
        pushEvent(session, { type: "tool_start", name: tool.name, id: tool.id });
      }
      if (evt.type === "content_block_delta" && evt.delta?.type === "input_json_delta") {
        const idx = evt.index;
        const bufferInfo = toolInputBuffers[idx];
        if (bufferInfo) {
          const partial = evt.delta.partial_json || "";
          const remaining = MAX_TOOL_INPUT_LOG_CHARS - bufferInfo.text.length;
          if (remaining > 0) bufferInfo.text += partial.slice(0, remaining);
          if (partial.length > remaining) bufferInfo.truncated = true;
        }
      }
      if (evt.type === "content_block_stop" && toolInputBuffers[evt.index] !== undefined) {
        const idx = evt.index;
        const bufferInfo = toolInputBuffers[idx];
        try {
          if (!bufferInfo.truncated) {
            const input = JSON.parse(bufferInfo.text);
            const summary = Object.entries(input).map(([k, v]) => {
              const val = typeof v === "string" ? (v.length > 80 ? v.slice(0, 80) + "…" : v) : JSON.stringify(v);
              return `${k}: ${val}`;
            }).join(" | ");
            console.log(`${C.dim}   ${summary}${C.reset}`);
            // Send description to frontend if available
            const desc = input.description || input.file_path || input.skill || input.query || input.command;
            if (desc) {
              const short = typeof desc === "string" ? (desc.length > 100 ? desc.slice(0, 100) + "…" : desc) : "";
              if (short) pushEvent(session, { type: "tool_detail", text: short });
            }
          }
        } catch (_) {}
        delete toolInputBuffers[idx];
        if (currentToolIndex === idx) currentToolIndex = null;
      }
    }

    // tool results (from claude's turn-level messages)
    if (obj.type === "tool_result" || (obj.type === "system" && obj.subtype === "tool_result")) {
      const name = obj.tool_name || obj.name || "?";
      const isError = obj.is_error || false;
      const content = typeof obj.content === "string" ? obj.content : JSON.stringify(obj.content || "");
      const short = content.length > 500 ? content.slice(0, 500) + "…" : content;
      const icon = isError ? "✗" : "✓";
      console.log(`${isError ? C.red : C.green}   ${icon} ${name}${C.reset}`);
      pushEvent(session, { type: "tool_result", name, is_error: isError, content: short });
    }

    // final result
    if (obj.type === "result") {
      if (obj.subtype === "success") {
        console.log(`\n${C.green}${C.bold}━━━ Done ━━━${C.reset}`);
        // Only include result text if it's reasonably sized; deltas already delivered the content
        const result = obj.result || "";
        pushEvent(session, { type: "done", result: result.length > 10000 ? "" : result });
        markDone(session);
      } else if (obj.subtype === "error" || obj.is_error) {
        console.log(`${C.red}✗ ${obj.error}${C.reset}`);
        pushEvent(session, { type: "error", error: obj.error || "未知错误" });
        markDone(session);
      }
    }
  }
});

app.get("/poll/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ ok: false, error: "session not found" });
  const cursor = Math.max(0, parseInt(req.query.cursor, 10) || 0);

  if (cursor > session.baseCursor) {
    const dropCount = Math.min(cursor - session.baseCursor, session.events.length);
    if (dropCount > 0) {
      session.events.splice(0, dropCount);
      session.baseCursor += dropCount;
    }
  }

  const startIndex = Math.max(0, cursor - session.baseCursor);
  const events = session.events.slice(startIndex);
  const newCursor = session.baseCursor + session.events.length;
  res.json({ ok: true, events: compactEvents(events), cursor: newCursor, done: session.done });

  if (session.done) cleanupSession(req.params.id);
});

app.post("/stop/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ ok: false });
  if (session.proc && !session.done) {
    markDone(session);
    session.proc.kill("SIGTERM");
    pushEvent(session, { type: "close" });
    console.log(`${C.yellow}[${session.id}] stopped by user${C.reset}`);
  }
  res.json({ ok: true });
});

// ========== Version & Update Check ==========
const GITHUB_REPO = "yimeixiaobai/wps-claudecode";

async function getLocalVersion() {
  const fs = await import("fs");
  const path = await import("path");
  const pkgPath = path.join(import.meta.dirname || ".", "package.json");
  const pkg = JSON.parse(await fs.promises.readFile(pkgPath, "utf-8"));
  return pkg.version;
}

function semverCompare(a, b) {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

app.get("/version", async (req, res) => {
  try {
    const version = await getLocalVersion();
    res.json({ ok: true, version });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.get("/check-update", async (req, res) => {
  try {
    const localVersion = await getLocalVersion();
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "wps-claude-bridge" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      return res.json({ ok: true, hasUpdate: false, localVersion, error: `GitHub API ${r.status}` });
    }
    const release = await r.json();
    const latestVersion = (release.tag_name || "").replace(/^v/, "");
    const hasUpdate = semverCompare(localVersion, latestVersion) < 0;
    res.json({
      ok: true,
      hasUpdate,
      localVersion,
      latestVersion,
      releaseUrl: release.html_url || "",
      changelog: (release.body || "").slice(0, 500),
      publishedAt: release.published_at || "",
    });
  } catch (err) {
    res.json({ ok: true, hasUpdate: false, localVersion: await getLocalVersion().catch(() => "?"), error: err.message });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`${C.green}${C.bold}✅ Bridge listening on http://localhost:${PORT}${C.reset}`);
  console.log(`   CLAUDE_BIN=${CLAUDE_BIN}`);
  console.log(`   Mode: polling (POST /start → GET /poll/:id)`);
});
