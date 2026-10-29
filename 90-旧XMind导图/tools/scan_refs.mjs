// 扫描所有 .xmind，统计图片来源：内嵌(xap:) / 外部(file:, 绝对路径, ../, http)
import fs from 'fs';
import path from 'path';
import { inflateRawSync } from 'zlib';

function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd === -1) return null;
  const entries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  let pos = cdOffset;
  for (let i = 0; i < entries; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
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
      const e = files.get(name); if (!e) return null;
      const n = buf.readUInt16LE(e.lhOffset + 26), x = buf.readUInt16LE(e.lhOffset + 28);
      const off = e.lhOffset + 30 + n + x;
      const raw = buf.subarray(off, off + e.compressedSize);
      if (e.compression === 0) return raw;
      if (e.compression === 8) return inflateRawSync(raw);
      return null;
    },
  };
}

const root = process.argv[2] || 'C:/Users/cz/Desktop/xmind/mindmap';
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.xmind$/i.test(e.name)) files.push(p);
  }
})(root);

let totalExt = 0;
for (const f of files) {
  let buf;
  try { buf = fs.readFileSync(f); } catch { continue; }
  const zip = readZip(buf); if (!zip) { console.log('BAD', f); continue; }
  let content = zip.extract('content.xml') || zip.extract('content.json');
  if (!content) { console.log('NO CONTENT', f); continue; }
  const text = content.toString('utf8');
  const refs = new Set();
  for (const m of text.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) refs.add(m[1]);
  for (const m of text.matchAll(/"src"\s*:\s*"([^"]+)"/g)) refs.add(m[1]);
  const ext = [];
  for (const r of refs) {
    if (!/\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(r) && !/^(xap:|file:|https?:|\.\.?\/)/.test(r)) continue;
    if (/^xap:/.test(r)) continue; // 内嵌资源（attachments/ 或 resources/）
    ext.push(r);
  }
  if (ext.length) { totalExt += ext.length; console.log('EXTERNAL', path.relative(root, f), '->', ext.join(' | ')); }
}
console.log('SCANNED', files.length, 'files; external image refs:', totalExt);
