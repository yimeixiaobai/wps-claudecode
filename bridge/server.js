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

app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "2mb" }));

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
function buildPrompt({ request, url, title, selection }) {
  const ctxLines = [];
  if (title) ctxLines.push(`- 当前文档标题：${title}`);
  if (url) ctxLines.push(`- 文档链接（含 file_id）：${url}`);
  if (selection) {
    ctxLines.push(`- 用户在文档中选中的文本：\n  """\n  ${selection.replace(/\n/g, "\n  ")}\n  """`);
  }
  return [
    "我正在 WPS 365 智能文档（AirPage / kdocs）中工作，请使用 WPS-AirPage-Skill 完成下面的请求。",
    "", "上下文：", ctxLines.join("\n") || "（无上下文）", "",
    `用户请求：${request}`, "",
    "执行要求：",
    "1. 先从文档链接解析 file_id（短链由 CLI 自动解析）。",
    "2. 如果是写操作，使用 insert-markdown / update / insert / delete 等命令；写完后用 query 回读验证。",
    "3. 如果用户请求里有'调研''查一下''搜索'等意图，先用 WebSearch 工具收集信息，再写入文档。",
    "4. 简洁地总结你做了什么、写到了哪里。",
    "5. 所有思考过程和最终回复必须使用中文。",
  ].join("\n");
}

// ========== Routes ==========
app.get("/health", (_, res) => res.json({ ok: true }));

// List local Claude Code sessions with titles (scans ~/.claude/projects)
app.get("/local-sessions", async (req, res) => {
  try {
    const os = await import("os");
    const fs = await import("fs");
    const path = await import("path");
    const { readdir, readFile, stat } = fs.promises;

    const projectsDir = path.join(os.homedir(), ".claude", "projects");
    const results = [];

    const projects = await readdir(projectsDir).catch(() => []);
    for (const proj of projects) {
      const projPath = path.join(projectsDir, proj);
      const files = await readdir(projPath).catch(() => []);
      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        const sessionId = file.replace(".jsonl", "");
        const filePath = path.join(projPath, file);
        const fileStat = await stat(filePath).catch(() => null);
        if (!fileStat) continue;

        // Extract: first user msg as title, last user msg + last assistant text as summary
        let firstUserMsg = "", lastUserMsg = "", turns = 0, lastAssistantText = "";
        try {
          const content = await readFile(filePath, "utf-8");
          const lines = content.split("\n").filter(Boolean);
          for (const line of lines) {
            const d = JSON.parse(line);
            if (d.type === "user") {
              turns++;
              const msg = d.message;
              let text = "";
              if (typeof msg === "object" && msg.content) {
                if (Array.isArray(msg.content)) {
                  // Find first text block (skip images etc.)
                  for (const block of msg.content) {
                    if (block.type === "text" && block.text) { text = block.text; break; }
                    if (typeof block === "string") { text = block; break; }
                  }
                } else if (typeof msg.content === "string") { text = msg.content; }
              } else if (typeof msg === "string") { text = msg; }
              text = text.replace(/\n/g, " ").trim();
              if (text && !firstUserMsg) firstUserMsg = text;
              if (text) lastUserMsg = text;
            }
            if (d.type === "assistant" && d.message?.content) {
              for (const b of d.message.content) {
                if (b.type === "text" && b.text) lastAssistantText = b.text;
              }
            }
          }
        } catch (_) { continue; }

        if (!firstUserMsg || turns === 0) continue;
        if (firstUserMsg.startsWith("我正在 WPS 365")) continue;

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
        // Decode project dir back to real path for cwd
        const cwdPath = "/" + proj.replace(/-/g, "/").replace(/^\//, "");
        const project = proj.replace(/-/g, "/").replace(/^\/Users\/\w+\//, "~/");

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
  const { request, claudeSessionId, claudeCwd } = req.body || {};
  if (!request) return res.status(400).json({ ok: false, error: "缺少 request 字段" });

  const session = createSession();
  const isResume = !!claudeSessionId;

  // First message: full prompt with context. Follow-up: just the user request (Claude already has context)
  let prompt;
  if (isResume) {
    const parts = [];
    if (req.body.selection) parts.push(`[用户选中的文本: "${req.body.selection}"]`);
    parts.push(request);
    prompt = parts.join("\n\n");
  } else {
    prompt = buildPrompt(req.body);
  }

  console.log(`\n${C.cyan}${C.bold}━━━ [${session.id}] ${isResume ? "Continue" : "New"} Request ━━━${C.reset}`);
  if (isResume) console.log(`${C.dim}   resuming claude session: ${claudeSessionId}${C.reset}`);
  console.log(`${C.dim}${prompt}${C.reset}\n`);

  pushEvent(session, { type: "status", message: "正在启动…" });

  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--dangerously-skip-permissions"];
  if (isResume) {
    args.push("--resume", claudeSessionId);
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

app.listen(PORT, () => {
  console.log(`${C.green}${C.bold}✅ Bridge listening on http://localhost:${PORT}${C.reset}`);
  console.log(`   CLAUDE_BIN=${CLAUDE_BIN}`);
  console.log(`   Mode: polling (POST /start → GET /poll/:id)`);
});
