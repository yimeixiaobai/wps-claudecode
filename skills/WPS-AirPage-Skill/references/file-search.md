# 文件搜索与定位

优先使用 CLI：

```bash
node scripts/cli.js resolve "关键词"              # 输出第一条匹配的 file_id
node scripts/cli.js resolve "https://365.kdocs.cn/l/xxx"  # 短链/长链转 file_id
node scripts/cli.js search "关键词" --json        # 候选列表，机器可读
node scripts/cli.js search "关键词" --first       # 只看第一条
node scripts/cli.js search "关键词" --id-only     # 只输出第一条 ID
```

设置默认文档后，多数文档命令可以省略 `file_id`：

```bash
export WPS_FILE_ID="123456789"
node scripts/cli.js read-doc --sections
node scripts/cli.js insert-markdown --content @/tmp/content.md --verify
```

以下是底层 API 参考，只有 CLI 不能覆盖时再读。

## 接口

```
GET https://365.kdocs.cn/3rd/drive/api/v6/search/files
```

**认证**: 仅需 `Cookie`，无需 CSRF。

## 参数

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `offset` | int | 分页偏移 | 0 |
| `count` | int | 返回数量 | 10 |
| `sort_by` | string | 排序字段: `create_time` / `modify_time` | `modify_time` |
| `order` | string | 排序方向: `asc` / `desc` | `desc` |
| `searchname` | string | 搜索关键词 | - |

## 示例

```bash
COOKIE=$(cat ~/.claude/secrets/wps365.json | python3 -c "import sys,json; print(json.load(sys.stdin)['cookie'])")

curl -s \
  -H "Cookie: $COOKIE" \
  "https://365.kdocs.cn/3rd/drive/api/v6/search/files?offset=0&count=10&sort_by=modify_time&order=desc&searchname=测试文档" \
  | python3 -m json.tool
```

## 响应结构

```json
{
  "status": 0,
  "total": 883,
  "files": [
    {
      "path": "目录/路径",
      "id": 494357493419,
      "fname": "测试文档.otl",
      "fsize": 1472603,
      "ftype": "sharefile",
      "ctime": 1770791956,
      "mtime": 1778158507,
      "fver": 118,
      "creator": {
        "id": 1728097386,
        "name": "用户名",
        "avatar": ""
      },
      "modifier": {
        "id": 1692380369,
        "name": "用户名",
        "avatar": ""
      }
    }
  ]
}
```

## 展示格式（选择文档时）

```
搜索结果 "测试文档":
1. 测试文档        [ID: 123456789]  修改: 2026-03-11
2. 测试文档v2      [ID: 987654321]  修改: 2026-03-10
3. 测试文档备份    [ID: 111222333]  修改: 2026-03-09

请输入序号选择文档（或直接输入 file_id）:
```

## file_id 获取优先级

```python
# 伪代码
file_id = os.environ.get("WPS_FILE_ID")        # 1. 环境变量
       or args.get("--file-id")                 # 2. 命令行参数
       or search_and_select(keyword)             # 3. 搜索选择
```

**使用环境变量（推荐）**:
```bash
export WPS_FILE_ID="123456789"
# 后续所有操作默认使用此文档
```
