// server.js — 本地 HTTP 服务，把浏览器扩展的请求转发给 Claude Code
// 使用 polling 模式（兼容 WPS 页面的网络环境）
import express from "express";
import { spawn } from "child_process";
import { randomUUID } from "crypto";

const PORT = process.env.PORT || 5174;
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const TIMEOUT_MS = Number(process.env.CC_TIMEOUT_MS || 5 * 60 * 1000);
const SESSION_TTL = 10 * 60 * 1000;

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
    id, events: [], done: false, proc: null,
    createdAt: Date.now(),
  };
  sessions.set(id, session);
  return session;
}

function pushEvent(session, event) {
  event.ts = Date.now() - session.createdAt;
  session.events.push(event);
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL) {
      if (s.proc && !s.done) s.proc.kill("SIGTERM");
      sessions.delete(id);
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
  ].join("\n");
}

// ========== Routes ==========
app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/start", (req, res) => {
  const { request } = req.body || {};
  if (!request) return res.status(400).json({ ok: false, error: "缺少 request 字段" });

  const session = createSession();
  const prompt = buildPrompt(req.body);

  console.log(`\n${C.cyan}${C.bold}━━━ [${session.id}] New Request ━━━${C.reset}`);
  console.log(`${C.dim}${prompt}${C.reset}\n`);

  pushEvent(session, { type: "status", message: "正在启动 Claude Code…" });

  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--dangerously-skip-permissions"];
  const proc = spawn(CLAUDE_BIN, args, { env: process.env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
  session.proc = proc;

  console.log(`${C.dim}[${session.id}] pid=${proc.pid}${C.reset}`);
  pushEvent(session, { type: "status", message: "Claude Code 已启动，等待响应…" });

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
    session.done = true;
    if (code !== 0 && !session.events.some(e => e.type === "done")) {
      pushEvent(session, { type: "error", error: `claude 退出码 ${code}` });
    }
    pushEvent(session, { type: "close" });
    console.log(`${C.green}[${session.id}] exited (code=${code})${C.reset}\n`);
  });

  proc.on("error", (err) => {
    session.done = true;
    pushEvent(session, { type: "error", error: `无法启动 claude：${err.message}` });
    pushEvent(session, { type: "close" });
  });

  setTimeout(() => {
    if (!session.done) {
      session.done = true;
      proc.kill("SIGTERM");
      pushEvent(session, { type: "error", error: `超时（${TIMEOUT_MS / 1000}s）` });
      pushEvent(session, { type: "close" });
    }
  }, TIMEOUT_MS);

  res.json({ ok: true, sessionId: session.id });

  // ---- inner handler with closure over session state ----
  function handleObj(obj) {
    // system init
    if (obj.type === "system" && obj.subtype === "init") {
      const model = obj.model || "unknown";
      console.log(`${C.blue}⚙ model=${model}${C.reset}`);
      pushEvent(session, { type: "status", message: `模型: ${model}` });
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
        pushEvent(session, { type: "thinking", text: evt.delta.thinking });
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
        pushEvent(session, { type: "status", message: "正在生成回复…" });
      }
      if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) {
        process.stdout.write(evt.delta.text);
        pushEvent(session, { type: "delta", text: evt.delta.text });
      }

      // tool use
      if (evt.type === "content_block_start" && evt.content_block?.type === "tool_use") {
        const tool = evt.content_block;
        currentToolIndex = evt.index;
        toolInputBuffers[evt.index] = "";
        console.log(`\n${C.magenta}🔧 ${tool.name}${C.reset}`);
        pushEvent(session, { type: "tool_start", name: tool.name, id: tool.id });
      }
      if (evt.type === "content_block_delta" && evt.delta?.type === "input_json_delta") {
        const idx = evt.index;
        if (toolInputBuffers[idx] !== undefined) {
          toolInputBuffers[idx] += evt.delta.partial_json;
        }
      }
      if (evt.type === "content_block_stop" && toolInputBuffers[evt.index] !== undefined) {
        const idx = evt.index;
        try {
          const input = JSON.parse(toolInputBuffers[idx]);
          const summary = Object.entries(input).map(([k, v]) => {
            const val = typeof v === "string" ? (v.length > 80 ? v.slice(0, 80) + "…" : v) : JSON.stringify(v);
            return `${k}: ${val}`;
          }).join(" | ");
          console.log(`${C.dim}   ${summary}${C.reset}`);
          pushEvent(session, { type: "tool_input", input });
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
        pushEvent(session, { type: "done", result: obj.result || "" });
        session.done = true;
      } else if (obj.subtype === "error" || obj.is_error) {
        console.log(`${C.red}✗ ${obj.error}${C.reset}`);
        pushEvent(session, { type: "error", error: obj.error || "未知错误" });
        session.done = true;
      }
    }
  }
});

app.get("/poll/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ ok: false, error: "session not found" });
  const cursor = parseInt(req.query.cursor) || 0;
  res.json({ ok: true, events: session.events.slice(cursor), cursor: session.events.length, done: session.done });
});

app.post("/stop/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ ok: false });
  if (session.proc && !session.done) {
    session.done = true;
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
