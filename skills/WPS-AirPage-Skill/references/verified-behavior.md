# 已验证行为与坑点

这份记录优先级高于旧的逆向笔记。若 `api-reference.md` 与这里冲突，以这里为准。

## 已验证命令覆盖

| 操作 | 命令 | 状态 |
|------|------|------|
| 搜索文档 | `search` | ✅ |
| 查询块 | `query` / `batch-query` | ✅ |
| 插入块 | `insert` | ✅ |
| 更新内容 | `update --body '[{...}]'` | ✅ |
| 更新属性 | `update --body '[{...}]'` | ✅ |
| 插入表格行 | `update` | ✅ |
| 插入表格列 | `update` | ✅ |
| 删除表格行 | `update` | ✅ |
| 删除表格列 | `update` | ✅ |
| 合并单元格 | `update` | ✅ |
| 拆分单元格 | `update` | ✅ |
| 替换锚点 | `update` | ✅ |
| 替换特性 | `update` | ✅ |
| 删除块 | `delete` | ✅ |
| Markdown 转换 | `convert` | ✅ |
| 创建文档 | `new-doc` | ✅ |
| 上传图片 | `upload-image` | ✅ |
| 查询评论 | `comments` | ✅ |
| 创建评论 | `comment-add` | ✅ |
| 回复评论 | `comment-add --reply-id` | ✅ |
| 更新评论 | `comment-update` | ✅ |
| 插入 Markdown | `insert-markdown` | ✅（内部走 convert + block.insert） |
| 目录结构 | `outline` | ✅ |
| 读取文档 | `read-doc` | ✅ |
| 解析文档 ID | `resolve` | ✅（短链 + 关键词） |

## 鉴权检测坑点

- `/latest` 首页登录后，`window.__userId` 和 `window.__WPSENV__` 可能为 null/undefined，但 `document.cookie` 里已有 `uid=<数字>`。
- 正确的登录检测需三路兜底：`window.__userId || window.__WPSENV__?.uid || /uid=\d+/.test(document.cookie)`。
- `window.__WPSENV__.csrf_token` 只在 AirPage **编辑页**（URL 格式 `/office/o/{fileid}`）加载后才出现；首页、分享页、预览页均为 null。

## outline API 坑点

- `queryContentByStyle`（`outline` 命令）对**新建文档**可能立即返回空列表，即使内容已成功插入。
- 原因：服务端索引有一定延迟（通常几秒到几十秒）。
- 验证文档内容应使用 `query <file_id> doc`，可立即看到块数据；`outline` 仅用于目录导航。
- 如需确认 heading 已写入：从 `query` 结果中过滤 `type === "heading"` 的块即可。

## new-doc 响应与 URL 坑点

- `new-doc` 成功时服务端只返回 `{"fileid": "<id>"}`,不含 `result:"ok"`，CLI 已兼容处理。
- 文档 URL 格式为 `https://365.kdocs.cn/office/o/{fileid}`，无需 `groupid`。
- `fname` 仅设置文件名（搜索可见），文档内部标题块（index 0，`type: "title"`）默认为空。
- CLI 当前会在 `newDoc()` 内尝试自动写入 title 块；失败不影响创建结果。只有用户明确要求核对标题、或创建后标题仍为空时，才需要手动 `query <file_id>` 找 title 块并 `update`。

## 关键坑点

1. `block.query` **必须**使用 `blockIds: ["id"]` 数组形式；传 `blockId`（字符串）会返回错误 1001 "blockId is required"。CLI 已默认使用数组形式。
2. `block.update` 的底层 API `params` 必须是数组；CLI 会自动将单对象包装成数组。
3. `block.delete` 的 `params` **不支持**数组形式；数组会返回 "Invalid parameter"。只能用单对象形式，一次删除一个范围。
4. `convert` 的参数名是 `format`，不是 `from`。
5. inline 文本节点字段是 `content`，不是 `text`。
6. `delete_table_rows` / `delete_table_columns` 使用 `start` + `count`。
7. `replace_anchor` 的 `content` 需要 `{"type": "...", "attrs": {...}}` 结构。
8. 附件上传端点必须加 `Origin: https://365.kdocs.cn`，否则可能返回 `SessionDeleted`。
9. 更新评论时必须传 `selection_id`，否则会报 `selection id invalid`。
10. 凭据 stale 不等于失效；CLI 会先继续请求，遇到认证类错误再自动刷新并重试一次。

## 有序列表显示

- AirPage 有序列表的底层数据中 `listAttrs.type === 2` 表示有序列表，渲染器会自动递增编号（1、2、3…）。
- CLI `read-doc` 文本输出已自动递增编号显示。审查文档内容时不要将有序列表编号报告为错误。

## insertContent subtype 不可用

- `subType: 'insertContent'` 对所有参数组合均返回 "Apply step failed"（500410002），无论大小写（`subType`/`subtype`）。
- `insert-markdown` CLI 已改为内部走 `convert` + `block.insert` 两步实现。

## 响应格式坑点

所有 `core/execute` 端点的成功响应格式是 `{detail: {...}, result: "ok"}`，而不是 `{code: 0, msg: "", data: {...}}`：
- 写操作（`http.otl.exec`）：`detail` 包含 `subType` 和 `result`
- 读操作（`http.otl.query`）：`detail` 包含 `name`、`params` 和 `result`
- 文件搜索 API 使用 `{status: 0, files: [...], total: N}`，不是 `{result: "ok", ...}`

## 查询结果兼容说明

- CLI 查询输出会尝试自动解码 `detail.result`。
- 如果服务端返回的是 base64 字符串，CLI 会解码为 JSON。
- 如果服务端已经直接返回 JSON 对象，CLI 会原样保留。
- 因此文档编写时应以“CLI 输出最终可直接消费”为准，而不是假设服务端只有一种编码形式。

## 带评论块的更新

查询结果里可能出现：

```json
{ "type": "rangeMarkBegin", "id": "abc", "data": [{ "type": "comment", "ids": ["..."] }] }
{ "type": "rangeMarkEnd", "id": "abc" }
```

- 做 `insert` / `delete` 时，计算 index 要忽略这些标记。
- 做 `update_content` 时，如果想保留评论锚点，需要把这些标记一并带回去。
