const fs = require('fs');
const path = require('path');

/**
 * 解析 JSON 输入：支持内联 JSON 字符串或 @filepath
 */
function parseJsonInput(input) {
  if (!input) return null;
  if (input.startsWith('@')) {
    const filePath = path.resolve(input.slice(1));
    const cwd = process.cwd();
    const tmpDir = require('os').tmpdir();
    const isInCwd = filePath.startsWith(cwd + path.sep) || filePath === cwd;
    const isInTmp = filePath.startsWith(tmpDir + path.sep) || filePath.startsWith('/tmp/') || filePath.startsWith('/private/tmp/');
    if (!isInCwd && !isInTmp) {
      throw new Error(`安全限制: @filepath 只能读取工作目录或临时目录下的文件，拒绝访问 ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return JSON.parse(input);
}

/**
 * base64 解码 AirPage 查询响应中的 data.result
 */
function decodeResult(result) {
  try {
    return JSON.parse(Buffer.from(result, 'base64').toString('utf-8'));
  } catch {
    return result;
  }
}

/**
 * 格式化输出：自动解码 data.result 中的 base64
 */
function formatResponse(data) {
  if (data && data.detail && typeof data.detail.result === 'string') {
    try {
      const decoded = decodeResult(data.detail.result);
      return { ...data, detail: { ...data.detail, result: decoded } };
    } catch {
      // 不是 base64，原样返回
    }
  }
  return data;
}

// --- Block text extraction ---

const CONTAINER_TYPES = new Set(['column', 'columnItem', 'lockBlock', 'highLightBlock', 'pictureColumn']);
const BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'title', 'blockQuote', 'codeBlock',
  'table', 'tableRow', 'tableCell', 'hr', 'picture', 'video', 'audio', 'videoLink',
  'highLightBlock', 'lockBlock', 'column', 'columnItem', 'pictureColumn',
  'map', 'countdown', 'thirdResource', 'dbsheet', 'spreadsheet',
]);

function extractInlineText(nodes) {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map(n => {
      if (n.type === 'rangeMarkBegin' || n.type === 'rangeMarkEnd') return '';
      if (n.type === 'text') return n.content || '';
      if (n.type === 'emoji') return n.attrs?.emoji || '';
      if (n.type === 'br') return '\n';
      if (n.type === 'WPSUser') return `@${n.attrs?.name || ''}`;
      if (n.type === 'linkView') return n.attrs?.title || n.attrs?.url || '';
      if (n.type === 'latex') return n.attrs?.latexStr || '[公式]';
      if (n.type === 'WPSDocument') return n.attrs?.wpsDocumentName || '[文档]';
      return '';
    })
    .join('');
}

function formatTableBlock(block, annotate) {
  const suffix = annotate ? ` [block:${block.id}]` : '';
  const rows = (block.content || []).filter(b => b.type === 'tableRow');
  if (!rows.length) return `[空表格]${suffix}`;
  const lines = [];
  rows.forEach((row, ri) => {
    const cells = (row.content || []).filter(c => c.type === 'tableCell');
    const cellTexts = cells.map(cell =>
      (cell.content || []).map(b => extractInlineText(b.content)).filter(Boolean).join(' ') || ''
    );
    lines.push(`| ${cellTexts.join(' | ')} |`);
    if (ri === 0) lines.push(`| ${cellTexts.map(() => '---').join(' | ')} |`);
  });
  return lines.join('\n') + suffix;
}

function blockToLine(block, annotate, ordinal) {
  if (!block || block.type === 'rangeMarkBegin' || block.type === 'rangeMarkEnd') return null;
  const suffix = annotate ? ` [block:${block.id}]` : '';
  const children = block.content || [];

  if (CONTAINER_TYPES.has(block.type)) {
    const isBlocks = children.length > 0 && BLOCK_TYPES.has(children[0].type);
    if (isBlocks) {
      const lines = mapBlocksWithOrdinals(children, annotate);
      if (block.type === 'highLightBlock') return lines.map(l => `> ${l}`).join('\n') + suffix;
      return lines.join('\n\n') + suffix;
    }
    const text = extractInlineText(children);
    if (block.type === 'highLightBlock') return `> ${text}${suffix}`;
    return text ? `${text}${suffix}` : null;
  }

  if (block.type === 'table') return formatTableBlock(block, annotate);

  const text = extractInlineText(children);
  switch (block.type) {
    case 'title': return `# ${text}${suffix}`;
    case 'heading': return `${'#'.repeat(Math.min((block.attrs?.level || 1) + 1, 6))} ${text}${suffix}`;
    case 'paragraph': {
      const la = block.attrs?.listAttrs;
      if (la) {
        const indent = '  '.repeat(la.level || 0);
        const marker = la.type === 2 ? `${ordinal || 1}.` : la.type === 3 ? '- [ ]' : '-';
        return `${indent}${marker} ${text}${suffix}`;
      }
      return `${text}${suffix}`;
    }
    case 'blockQuote': return `> ${text}${suffix}`;
    case 'codeBlock': return `\`\`\`\n${text}\n\`\`\`${suffix}`;
    case 'hr': return `---${suffix}`;
    case 'picture': return `[图片]${suffix}`;
    case 'video': case 'videoLink': return `[视频]${suffix}`;
    case 'audio': return `[音频]${suffix}`;
    default: return text ? `${text}${suffix}` : `[${block.type}]${suffix}`;
  }
}

function mapBlocksWithOrdinals(blocks, annotate) {
  const counters = {};
  return (blocks || []).map(b => {
    const la = b?.attrs?.listAttrs;
    if (la && la.type === 2) {
      const level = la.level || 0;
      counters[level] = (counters[level] || 0) + 1;
      for (const k of Object.keys(counters)) {
        if (Number(k) > level) delete counters[k];
      }
      return blockToLine(b, annotate, counters[level]);
    }
    for (const k of Object.keys(counters)) delete counters[k];
    return blockToLine(b, annotate);
  }).filter(Boolean);
}

function rootChildren(queryResult) {
  const blocks = queryResult?.detail?.result?.blocks;
  if (!blocks || !blocks.length) return [];
  return blocks[0].content || [];
}

function blocksListToReadable(blocks, format = 'annotated') {
  const annotate = format === 'annotated';
  return mapBlocksWithOrdinals(blocks, annotate).join('\n\n');
}

function blocksToReadable(queryResult, format) {
  const children = rootChildren(queryResult);
  if (!children.length) return '（文档为空）';
  return blocksListToReadable(children, format);
}

function blocksToSections(queryResult, format = 'annotated') {
  const annotate = format === 'annotated';
  const children = rootChildren(queryResult);
  if (!children.length) return '（文档为空）';

  const sections = [];
  let current = null;
  const counters = {};
  for (const block of children) {
    const la = block?.attrs?.listAttrs;
    let ordinal;
    if (la && la.type === 2) {
      const level = la.level || 0;
      counters[level] = (counters[level] || 0) + 1;
      for (const k of Object.keys(counters)) {
        if (Number(k) > level) delete counters[k];
      }
      ordinal = counters[level];
    } else {
      for (const k of Object.keys(counters)) delete counters[k];
    }
    const line = blockToLine(block, annotate, ordinal);
    if (!line) continue;
    const startsSection = block.type === 'title' || block.type === 'heading';
    if (startsSection || !current) {
      if (current) sections.push(current);
      current = { blockId: block.id, lines: [] };
    }
    current.lines.push(line);
  }
  if (current) sections.push(current);

  return sections.map((section, i) => {
    const suffix = section.blockId ? ` [block:${section.blockId}]` : '';
    return `--- Section ${i + 1}${suffix} ---\n${section.lines.join('\n\n')}`;
  }).join('\n\n');
}

module.exports = {
  parseJsonInput,
  decodeResult,
  formatResponse,
  blocksToReadable,
  blocksToSections,
  blocksListToReadable,
  blockToLine,
  rootChildren,
};
