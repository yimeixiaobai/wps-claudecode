# WPS AirPage CLI Skill

Use the local CLI (`node scripts/cli.js`) to operate WPS 365 AirPage / 智能文档 / kdocs documents.

**Use this skill when** the user wants to create, read, modify, search, or delete content inside a WPS 365 AirPage document. Triggers on requests mentioning: kdocs, AirPage, 智能文档, 365.kdocs.cn.

**Do NOT use for:** local `.docx`/`.xlsx` files, WPS desktop app, Notion, Google Docs, or generic browser automation.

---

## Task Flow

Execute in order. **Credential checks, auth-error retry, and verification are built into commands — no separate calls needed.**

**Step 1 — Resolve `file_id`**

- User provided numeric ID, short link (`365.kdocs.cn/l/xxx`), or doc URL (`/office/o/xxx`) → pass directly to CLI, it resolves automatically.
- User provided name/keyword → `node scripts/cli.js resolve <keyword>` for the first matching `file_id`; use `search <keyword>` when you need a candidate list.
- No target specified → ask: search existing doc or create new one.

**Step 2 — Execute operation**

- Reading: use `read-doc` (outputs readable text). For long docs, prefer `read-doc --sections --output /tmp/doc.md`.
- Writing: use write commands with `--verify` flag. Bare `--verify` is compact; use `--verify target` for known block IDs and `--verify full` only when the whole document must be inspected.
- Stale credentials are used optimistically; if credentials still error after the built-in retry, refresh:
  ```bash
  node scripts/cli.js auth --browser
  ```

**Step 3 — Report** file name, `file_id`, what changed, and verification result.

---

## Commands

```bash
node scripts/cli.js                                          # interactive wizard
node scripts/cli.js auth                                     # check credential status
node scripts/cli.js auth --browser                          # refresh (silent or headed)
node scripts/cli.js search <keyword> [--json] [--first] [--id-only]  # find docs
node scripts/cli.js resolve <target> [--json]                # ID/link/shortlink/keyword → file_id
node scripts/cli.js new-doc --name <name>                   # create doc → file_id + doc_url
node scripts/cli.js read-doc [file_id] [--format text|annotated|json] [--type <block_type>] [--sections] [--max-chars N] [--output <path>]
node scripts/cli.js query [file_id] [block_id]              # query blocks (default: root)
node scripts/cli.js batch-query [file_id] <id1> <id2> ...   # query multiple blocks
node scripts/cli.js insert-markdown [file_id] \
  --content <"text" | @file.md> [--pos begin|end] [--verify]  # insert Markdown (preferred)
node scripts/cli.js outline [file_id] [--format json]       # document heading outline
node scripts/cli.js update [file_id] --body <json-array> [--verify]   # update block(s)
node scripts/cli.js insert [file_id] \
  --block-id <id> --index <n> --content <json> [--verify]   # insert block at position
node scripts/cli.js delete [file_id] --body <json> [--verify]  # delete block(s)
node scripts/cli.js convert [file_id] \
  --from markdown --content <text>                           # convert Markdown → blocks
node scripts/cli.js upload-image <file_id> <path> \
  [--index <n>] [--width <w>] [--height <h>]               # upload & insert image
node scripts/cli.js comments [file_id]                       # list comments
node scripts/cli.js comment-add [file_id] \
  --sid <selection_id> --text <text> [--reply-id <id>]      # add / reply comment
node scripts/cli.js comment-update [file_id] \
  --id <comment_id> --sid <selection_id> --text <text>      # update comment
```

**Key options:**
- `read-doc`: includes credential check. `--format text` (default) = readable text; `annotated` = text with block IDs; `json` = raw query result. `--type heading` filters by block type (json format auto-batch-queries for full block content).
- `read-doc --sections`: split by headings for long-doc summaries/research; `--output /tmp/doc.md` avoids flooding the terminal.
- `--verify`: auto-queries after write. Bare `--verify` = compact for most commands, but **`update` defaults to target** (verifies the updated blocks). `--verify target` = target block(s); `--verify full` = complete annotated view. No separate `query` call.
- `--content @filepath`: read content from file. **Multi-line content must use this** — never inline `\n` in `--content`.
- Many commands can omit `file_id` when `WPS_FILE_ID` is set.

---

## Common Patterns

### Read / research a doc (read-only)

```bash
node scripts/cli.js read-doc <file_id>           # readable text, includes auth check
# Long docs:
node scripts/cli.js read-doc <file_id> --sections --output /tmp/airpage-doc.md
```

### Summarize and write back (read → process → write)

```bash
node scripts/cli.js read-doc <file_id>                                              # 1 call
# Write generated content to temp file (Write tool, not Bash)
node scripts/cli.js insert-markdown <file_id> --content @/tmp/summary.md --pos end --verify  # 1 call
```

### Insert Markdown into existing doc

```bash
# Single line — inline OK
node scripts/cli.js insert-markdown <file_id> --content "One line text" --pos end --verify
# Multi-line — MUST use @file
node scripts/cli.js insert-markdown <file_id> --content @/tmp/content.md --pos end --verify
```

### Create new doc and write content

```bash
node scripts/cli.js new-doc --name "My Document"
node scripts/cli.js insert-markdown <file_id> --content @content.md --verify
```

### Modify a single block

```bash
node scripts/cli.js read-doc <file_id> --format annotated    # get block IDs
node scripts/cli.js query <file_id> <block_id>               # get full block content for payload
node scripts/cli.js update <file_id> --body '[{
  "operation": "update_content",
  "blockId": "<id>",
  "content": [{"type": "text", "content": "new text"}]
}]' --verify target
```

### Modify multiple blocks of the same type (e.g. add emoji to all headings)

```bash
# 1. Get all heading blocks with full content in one call
node scripts/cli.js read-doc <file_id> --type heading --format json
# 2. Build update payload from the returned block data, write to temp file (Write tool)
# 3. Batch update in one call
node scripts/cli.js update <file_id> --body @/tmp/update.json --verify target
```

### Add a comment

```bash
node scripts/cli.js comments <file_id>
node scripts/cli.js comment-add <file_id> --sid <sid> --text "Comment text"
```

---

## Critical Gotchas

1. **Multi-line content must use temp file** — write to a temp file first, then use `--content @/tmp/file.md`. Never inline `\n` in `--content` — bash escaping will break markdown parsing. Single-line content can use `--content "text"` directly.
2. **Write operations must use `--verify`** — all write commands (`insert-markdown`, `insert`, `update`, `delete`) support `--verify` for auto-verification. Bare `--verify` is compact; use `--verify target` for known block IDs; use `--verify full` only when needed. Do not make separate `query` calls to verify.
3. **`update --body` must be a JSON array** — even for one operation. Single object returns error -152.
4. **`outline` has indexing delay on new docs** — always use `--verify` (which uses `query` internally), never `outline`, for verification.
5. **Inline text field is `content`, not `text`** — `{"content": [...]}`, not `{"text": "..."}`.
6. **`rangeMarkBegin`/`rangeMarkEnd` are not real blocks** — skip them when calculating `--index`; preserve them in `update_content` to keep comment anchors.
7. **`file_id` accepts three forms** — numeric ID, short link (`365.kdocs.cn/l/xxx`), or doc URL (`/office/o/xxx`). CLI resolves all three automatically.
8. **`insert --index` must be ≥ 1** — the title block is always at index 0.
9. **Document URL format**: `https://365.kdocs.cn/office/o/{fileid}` (no groupid needed).

---

## Authentication Details

Credentials stored at `~/.claude/secrets/wps365.json` (mode `0600`).

`auth --browser` flow:
1. Tries headless Playwright with saved profile (`~/.claude/secrets/wps-airpage-profile/`)
2. If session is active → silently extracts cookie + CSRF, no UI shown
3. If session expired → opens headed browser window, user logs in once, profile saved for next time

Chrome DevTools MCP (zero-click, any platform that supports MCP):
```bash
node scripts/cli.js auth --install-mcp           # install for all platforms
node scripts/cli.js auth --install-mcp cursor    # Cursor only
node scripts/cli.js auth --install-mcp codex     # Codex CLI only
node scripts/cli.js auth --install-mcp gemini    # Gemini CLI only
```

Manual fallback:
```bash
node scripts/cli.js auth --set-cookie "<cookie>" --set-csrf "<token>"
```

---

## Key Constraints

- CLI `file_id` arguments accept numeric IDs, doc URLs, short links, or `WPS_FILE_ID`; the underlying API uses numeric IDs.
- `update --body`: JSON array always
- `insert --index`: ≥ 1
- `insert-markdown --pos`: `begin` or `end` only
- `comment-update`: requires both `--id` (comment_id) and `--sid` (selection_id)
- Image upload `--index 0`: uploads only, does not insert block
