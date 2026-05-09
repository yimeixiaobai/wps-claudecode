---
name: wps-airpage
version: "1.4.0"
platform: claude-code
platforms:
  - claude-code   # full support incl. MCP auto-auth
  - cursor        # CLI + --browser auth
  - codex         # CLI + --browser auth (see AGENTS.md)
  - gemini        # CLI + --browser auth (copy AGENTS.md → GEMINI.md)
requires:
  - chrome-devtools-mcp  # optional, enables fully-automated auth (claude-code only)
language: zh-CN
description: >
  Use for any operation on a WPS 365 / AirPage / 智能文档 / kdocs online document:
  creating new documents, reading or searching block structure, inserting or editing
  paragraphs and headings, operating tables (merge cells, insert rows), uploading
  images into a doc, adding or querying comments, or converting Markdown/HTML into
  blocks. Triggers on natural Chinese requests mentioning kdocs, AirPage, 智能文档,
  or 365.kdocs.cn — e.g. "帮我在那个 kdocs 文档里加一段", "查一下文档的块结构",
  "创建一个新的 AirPage 文档", "把这段 markdown 插进去", "合并表格单元格",
  "往文档里加评论". Do NOT use for local .docx/.xlsx files, WPS desktop app
  issues, Notion, Google Docs, or generic browser/script automation.
---

# WPS AirPage CLI Skill

Use the local CLI to operate WPS 365 AirPage documents. Prefer the CLI over hand-written HTTP requests. Only read raw API references when the CLI cannot express the requested operation.

## When to Use

**Use this skill when:**
- User wants to modify, inspect, search, or create a WPS 365 AirPage / 智能文档 / kdocs document.
- User mentions adding a paragraph, changing a heading, adding comments, uploading an image, querying block structure, finding a block ID, converting Markdown/HTML, or editing a table inside AirPage.
- User asks to automate a WPS smart doc and the target is clearly AirPage rather than a local Office file.

**Do NOT use for:** local `.docx` / `.xlsx`, WPS desktop troubleshooting, Notion/Google Docs, or generic browser automation unrelated to AirPage.

## Task Flow

收到 AirPage 请求时，按此顺序执行。**凭据检查和认证失败重试已内嵌到命令中，无需单独调用。**

1. **确认 `file_id`**
   - 用户给了数字 ID、短链（`365.kdocs.cn/l/xxx`）或文档链接（`/office/o/xxx`）→ 直接传给 CLI，自动解析。
   - 给了文档名/关键词 → `resolve <keyword>` 直接拿 `file_id`；需要候选列表时用 `search <keyword>`。
   - 没有明确目标 → 主动询问：搜索已有文档 或 新建文档。
   - 搜索/新建**一律用 CLI 完成**，不得要求用户在浏览器手动操作。

2. **执行操作** → 按场景选择最优路径（见下方 Common Task Patterns）。
   - 读取文档：`read-doc`；长文档/调研优先 `--sections` 或 `--output /tmp/doc.md`。
   - 写入操作：所有写命令加 `--verify` 自动验证；默认 compact 轻量验证，需完整回读时用 `--verify full`。
   - 凭据过期提示不等于失败；命令会先继续使用，遇到认证错误会自动刷新并重试一次。仍失败时再运行 `auth --browser`。

3. **回报用户**：说明文档名、`file_id`、变更内容、验证结果；失败时说明卡在哪一步。

## Core Commands

```bash
node scripts/cli.js                          # 交互式向导（推荐用户直接使用）
node scripts/cli.js auth                     # 检查凭据状态
node scripts/cli.js auth --browser           # 全自动刷新凭据（Playwright）
node scripts/cli.js search <keyword> [--json] [--first] [--id-only]  # 搜索文档
node scripts/cli.js resolve <target> [--json]  # 数字 ID/链接/短链/关键词 → file_id
node scripts/cli.js new-doc --name <名称>   # 新建文档，返回 file_id + doc_url
node scripts/cli.js read-doc [file_id] [--format text|annotated|json] [--type <块类型>] [--sections] [--max-chars N] [--output <path>]
node scripts/cli.js query [file_id] [block_id]   # 查询块（默认查根节点）
node scripts/cli.js insert-markdown [file_id] --content <text|@file> [--pos begin|end] [--verify]
node scripts/cli.js outline [file_id] [--format markdown|json]   # 目录结构
node scripts/cli.js batch-query [file_id] <id1> <id2> ...  # 批量查询多个块
node scripts/cli.js convert [file_id] --from markdown|html --content <text|@file>  # Markdown/HTML 转块 JSON
node scripts/cli.js update [file_id] --body <json> [--verify]
node scripts/cli.js insert [file_id] --block-id <id> --index <n> --content <json> [--verify]
node scripts/cli.js delete [file_id] --body <json> [--verify]
node scripts/cli.js upload-image <file_id> <path> [--index <n>] [--width <n>] [--height <n>]
node scripts/cli.js comments [file_id]
node scripts/cli.js comment-add [file_id] --sid <id> --text <text>
node scripts/cli.js comment-update [file_id] --id <comment_id> --sid <selection_id> --text <text>
node scripts/cli.js decode <base64_string>              # 解码 base64 查询结果
```

**关键选项说明：**
- `read-doc`：内含凭据检查，无需先调 `auth`。`--format text`（默认）输出可读文本；`annotated` 附带 block ID（用于后续修改）；`json` 等价于 `query`。`--type heading` 可按块类型过滤（json 格式时自动 batch-query 拿到完整块内容）。
- `read-doc --sections`：按标题拆分，适合全局总结、调研、优化文档；`--output /tmp/doc.md` 可避免长文档刷屏。
- `--verify`：写命令执行成功后自动回读验证。裸 `--verify` = compact（但 **`update` 默认走 target**，直接验证被更新的块）；`--verify target` 只回读目标块；`--verify full` 输出完整 annotated 文档。
- `--content @filepath`：从文件读取内容。**多行内容必须用此方式**，不要在 `--content` 中内联 `\n`。
- 多个命令都可省略 `file_id` 并读取环境变量 `WPS_FILE_ID`。

完整命令参数见 `references/block-ops.md`。

## Common Task Patterns

### 总结 / 调研文档（只读）

```bash
node scripts/cli.js read-doc <file_id>
# 长文档优先：
node scripts/cli.js read-doc <file_id> --sections --output /tmp/airpage-doc.md
```

### 总结并写回文档（读 → 处理 → 写）

```bash
# 1. 读取文档（1 次 Bash）— 需要 block ID 时直接用 annotated 格式，不要读两遍
node scripts/cli.js read-doc <file_id> --format annotated --output /tmp/airpage-doc.md
# 2. 生成内容，用 Bash heredoc 写入临时文件（1 次 Bash）
# 3. 写入并轻量验证（1 次 Bash）
node scripts/cli.js insert-markdown <file_id> --content @/tmp/summary.md --pos end --verify
```

### 插入 Markdown 内容（首选方式）

```bash
# 单行内容可直接内联
node scripts/cli.js insert-markdown <file_id> --content "一行文本" --pos end --verify
# 多行内容必须用 @file
node scripts/cli.js insert-markdown <file_id> --content @/tmp/content.md --pos end --verify
```

> 精细控制插入位置时才改用 `convert` + `insert`。

### 新建文档并写入内容

```bash
node scripts/cli.js new-doc --name "文档名"
# 输出包含 file_id 和 doc_url（格式：https://365.kdocs.cn/office/o/{fileid}）
node scripts/cli.js insert-markdown <file_id> --content @content.md --verify
```

### 修改单个块

```bash
# 1. 读取文档（带 block ID，用于定位目标块）
node scripts/cli.js read-doc <file_id> --format annotated
# 2. 如需完整块内容（构造 update_content payload），查询目标块
node scripts/cli.js query <file_id> <block_id>
# 3. 更新
node scripts/cli.js update <file_id> --body '[{...}]' --verify target
```

### 批量修改同类型块（如给所有标题加 emoji）

```bash
# 1. 按类型过滤读取，json 格式自动 batch-query 拿到完整块内容（1 次调用）
node scripts/cli.js read-doc <file_id> --type heading --format json
# 2. 根据返回的完整块数据构造 update payload，用 Bash heredoc 写入临时文件（1 次 Bash）
# 3. 批量更新（1 次调用）
node scripts/cli.js update <file_id> --body @/tmp/update.json --verify target
```

### 替换 / 重写章节内容

已有块数量相同时，用 `update_content` 逐块替换（不要 delete + insert）：

```bash
# 1. 读取文档带 block ID（1 次 Bash）
node scripts/cli.js read-doc <file_id> --format annotated
# 2. 根据目标块构造 update payload，用 Bash heredoc 写入临时文件（1 次 Bash）
#    每个块一个 {"operation":"update_content","blockId":"...","content":[...]}
# 3. 批量更新（1 次 Bash）
node scripts/cli.js update <file_id> --body @/tmp/update.json --verify target
```

块数量变化时才用 delete + insert；delete 不支持数组，见 Critical Gotchas。

### 插入图表（架构图 / 流程图 / 时序图等）

用户要求添加图表时，**优先用 SVG 自行生成**，避免打断用户要求提供图片文件。

**适合 SVG 生成的场景：** 架构图、流程图、时序图、状态机图、思维导图、组织结构图、关系图、简单示意图。

**不适合 SVG 的场景：** 照片、截图、复杂插画、含大量位图元素的设计稿 → 询问用户图片路径。

```bash
# 1. 生成 SVG 文件（用 Bash heredoc 写入，注意中文字体用 sans-serif）
cat <<'EOF' > /tmp/diagram.svg
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">
  <style>text { font-family: sans-serif; font-size: 14px; }</style>
  <!-- 图表内容 -->
</svg>
EOF
# 2. 上传并插入到文档（--index 指定位置，>= 1）
node scripts/cli.js upload-image <file_id> /tmp/diagram.svg --index <n> --width 800 --height 400
```

SVG 生成要点：
- 用 `sans-serif` 字体确保中文正常显示
- 宽度建议 600-900px，适配文档排版
- 方框用 `<rect rx="8">`（圆角），箭头用 `<marker>` + `<line>`/`<path>`
- 配色保持简洁专业，避免过多颜色

### 评论操作

```bash
node scripts/cli.js comments <file_id>
node scripts/cli.js comment-add <file_id> --sid <sid> --text "评论内容"
```

### 查看文档目录

```bash
node scripts/cli.js outline <file_id>              # markdown 格式，含 tileId
node scripts/cli.js outline <file_id> --format json  # 带 level/attrs 结构
```

### 快速定位文档

```bash
node scripts/cli.js resolve "关键词"      # 直接输出第一条匹配的 file_id
node scripts/cli.js search "关键词" --json # 需要候选列表时用 JSON 输出
```

## Critical Gotchas（无需读 reference，直接记住）

这些是 Claude 最容易默认踩错的行为，优先级高于直觉：

1. **多行内容必须用临时文件**：先用 Bash `cat <<'EOF' > /tmp/content.md` 写入临时文件，再用 `--content @/tmp/content.md`。**不要用 Write tool 写 `/tmp` 文件**（会触发 "File has not been read yet" 错误）。绝不要在 `--content` 参数中内联 `\n` 换行——bash 转义会导致 markdown 解析失败。单行内容可直接用 `--content "文本"`。
   - **URL 参数必须加引号**：含 `?` 或 `&` 的 URL（如 `365.kdocs.cn/l/xxx?from=koa`）在 zsh 中不加引号会报 `no matches found`。一律用双引号包裹。
2. **写操作必须加 `--verify`**：所有写命令（`insert-markdown`、`insert`、`update`、`delete`）加 `--verify` 自动验证，不要单独调 `query` 验证。默认 compact；修改已知块时优先 `--verify target`；必要时才 `--verify full`。
3. **`outline` 对新建文档有索引延迟**：`outline` 可能返回空，即使内容已写入。验证写入结果一律用 `--verify`（内部使用 `query`），不用 `outline`。
4. **`update --body` 底层 API 要求数组**：CLI 会自动把单对象包装成数组，所以 `'{...}'` 和 `'[{...}]'` 都可用。但手写 payload 直接调 API 时必须用数组。
5. **`delete --body` 不支持数组，也没有 `operation` 字段**：格式是 `{"blockId":"doc","startIndex":N,"endIndex":M}`。不要用 `[{"operation":"delete",...}]`——那是 update 的格式。需要删多段时分多次调用。优先考虑用 `update_content` 替换内容而不是删除。
6. **inline 文本字段是 `content` 不是 `text`**：`{ "content": [...] }`，写成 `{ "text": "..." }` 会静默失败。
7. **`rangeMarkBegin` / `rangeMarkEnd` 不是真实块**：计算 insert `--index` 时必须跳过这些标记；`update_content` 时如果想保留评论锚点，需要把这些标记一并带回去。

> 完整坑点列表见 `references/verified-behavior.md`。

## Key Constraints

- `file_id` 接受三种形式：数字 ID、短链（`365.kdocs.cn/l/xxx`）、文档链接（`365.kdocs.cn/office/o/xxx`），CLI 自动解析。
- `insert --index` 必须 `>= 1`（title 固定在 index 0）。
- `comment-update` 必须同时传 `comment_id` + `selection_id`。
- `insert-markdown --pos` 只支持 `begin` / `end`。
- 文档 URL 格式：`https://365.kdocs.cn/office/o/{fileid}`（`new-doc` 会自动返回）。

## Security

- 凭据存储于 `~/.claude/secrets/wps365.json`（权限 0600），包含 `cookie` + `csrf`。
- `wps_sid` 是 HttpOnly cookie，只能从网络请求头读取，不得依赖 `document.cookie`。
- CSRF token 只在 AirPage 编辑页（非分享/预览页）的 `window.__WPSENV__.csrf_token` 中可用。
- MCP 鉴权通过拦截浏览器网络请求提取，凭据不会离开本地。
- 凭据超过 8 小时自动提示刷新，避免长期暴露陈旧 session。

## Progressive Disclosure

按需读取，不要预加载所有 reference：

| 场景 | 读取 |
|------|------|
| 凭据刷新失败、MCP 步骤、鉴权错误 | `references/auth.md` |
| 搜索文档、理解 file_id | `references/file-search.md` |
| 构造 insert/update/delete/表格 payload | `references/block-ops.md` |
| 块类型、inline 结构、字段约束 | `references/data-structure.md` |
| 错误码 | `references/error-codes.md` |
| 实测坑点、兼容写法、已验证覆盖范围 | `references/verified-behavior.md` |
| CLI 无法覆盖时（低频） | `references/api-reference.md` |
| 现成块 JSON 示例 | `assets/` |

> 如果 `api-reference.md` 与 `verified-behavior.md` 冲突，以 `verified-behavior.md` 为准。
