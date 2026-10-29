// 将 XMind 读取得到的 JSON 转为 Obsidian Markdown，并导出内嵌图片。
// 用法: node migrate_xmind.mjs <json> <xmind> <mdOut> <imgDirFs> <imgDirVault> <title> [sourceRel]
import fs from 'fs';
import { inflateRawSync } from 'zlib';
import { basename, join, dirname } from 'path';

const [, , jsonPath, xmindPath, mdOut, imgDirFs, imgDirVault, title, sourceRelArg] = process.argv;
const sourceRel = sourceRelArg || ('90-旧XMind导图/' + title + '/' + basename(xmindPath));

function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('Invalid ZIP');
  const entries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  let pos = cdOffset;
  for (let i = 0; i < entries; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('Bad CD');
    const compression = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const lhOffset = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf-8', pos + 46, pos + 46 + nameLen);
    files.set(name, { compression, compressedSize, lhOffset });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return {
    extract(name) {
      const e = files.get(name);
      if (!e) return null;
      const lhNameLen = buf.readUInt16LE(e.lhOffset + 26);
      const lhExtraLen = buf.readUInt16LE(e.lhOffset + 28);
      const dataOffset = e.lhOffset + 30 + lhNameLen + lhExtraLen;
      const raw = buf.subarray(dataOffset, dataOffset + e.compressedSize);
      if (e.compression === 0) return raw;
      if (e.compression === 8) return inflateRawSync(raw);
      throw new Error('Unsupported compression ' + e.compression);
    },
  };
}

function decode(s) {
  return String(s)
    .replace(/&#13;|&#x0d;/gi, '\n')
    .replace(/&#10;|&#x0a;/gi, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function lines(s) {
  return decode(s).replace(/\r/g, '\n').split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== '');
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const zip = readZip(fs.readFileSync(xmindPath));
fs.mkdirSync(imgDirFs, { recursive: true });
fs.mkdirSync(dirname(mdOut), { recursive: true });

let imgCount = 0, missing = [];
const used = new Set();

function renderImage(img, indent) {
  if (!img || !img.src) return [];
  const src = img.src;
  if (!src.startsWith('xap:')) {
    missing.push(src);
    return [indent + '> [外部图片引用: ' + src + ']'];
  }
  const zipName = src.slice(4);
  const outName = basename(zipName);
  const buf = zip.extract(zipName);
  if (!buf) { missing.push(src); return [indent + '> [图片缺失: ' + src + ']']; }
  fs.writeFileSync(join(imgDirFs, outName), buf);
  imgCount++;
  used.add(outName);
  return [indent + '![[' + imgDirVault + '/' + outName + ']]'];
}

function renderTopic(t, depth, out) {
  const ls = lines(t.title || '');
  const head = ls[0] || '(无标题)';
  const body = ls.slice(1);
  const images = [];
  if (Array.isArray(t.image)) images.push(...t.image);
  else if (t.image) images.push(t.image);

  if (depth === 0) {
    out.push('## ' + head);
    for (const b of body) out.push(b);
    for (const im of images) out.push(...renderImage(im, ''));
  } else {
    const indent = '  '.repeat(depth - 1);
    out.push(indent + '- ' + (head.length <= 30 ? '**' + head + '**' : head));
    const bodyIndent = indent + '  ';
    for (const b of body) out.push(bodyIndent + b);
    for (const im of images) out.push(...renderImage(im, bodyIndent));
  }
  if (t.notes) {
    const indent = depth === 0 ? '' : '  '.repeat(depth) + ' ';
    out.push(indent + '> ' + decode(typeof t.notes === 'string' ? t.notes : JSON.stringify(t.notes)));
  }
  for (const c of (t.children || [])) renderTopic(c, depth + 1, out);
}

const out = [];
out.push('---');
out.push('tags: []');
out.push('created: ' + new Date().toISOString().slice(0, 10));
out.push('updated: ' + new Date().toISOString().slice(0, 10));
out.push('---');
out.push('');
out.push('# ' + title);
out.push('');
out.push('> 本笔记由 XMind 导图自动转换，图片已提取至 `' + imgDirVault + '/`。');
out.push('> 原导图见 `' + sourceRel + '`。');
out.push('');

for (const sheet of data) {
  if (data.length > 1) {
    out.push('# ' + (sheet.title || sheet.sheetTitle || 'Sheet'));
    out.push('');
  }
  if (sheet.rootTopic) renderTopic(sheet.rootTopic, 0, out);
  else for (const c of (sheet.children || [])) renderTopic(c, 0, out);
}

fs.writeFileSync(mdOut, out.join('\n') + '\n', 'utf8');
console.log(JSON.stringify({ mdOut, imgCount, uniqueImages: used.size, missing, lines: out.length }));
