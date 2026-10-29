// 批量把 xmind导图 下的导图转换为 Obsidian 笔记，并导出内嵌图片。
// 用法:
//   node "xmind导图/tools/batch_migrate.mjs"           # 只转换新增/改动过的导图
//   node "xmind导图/tools/batch_migrate.mjs" --force   # 全部重新转换
//
// 映射关系在 mapping.json；转换记录在 .migrated.json（按源文件 sha1 判断是否变化）。
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const vaultRoot = path.resolve(toolsDir, '..', '..');
const readScript = 'C:/Users/cz/.claude/skills/xmind/scripts/read_xmind.mjs';
const converter = path.join(toolsDir, 'migrate_xmind.mjs');
const mappingPath = path.join(toolsDir, 'mapping.json');
const manifestPath = path.join(toolsDir, '.migrated.json');

const force = process.argv.includes('--force');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : {};

const sha1 = (file) =>
  crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');

function runRead(xmind) {
  const input = JSON.stringify({ action: 'read', path: xmind });
  const r = spawnSync(process.execPath, [readScript], {
    input,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error('read_xmind 失败: ' + (r.stderr || r.stdout));
  return r.stdout;
}

let converted = 0, skipped = 0, failed = 0;

for (const item of mapping) {
  const sourceAbs = path.join(vaultRoot, item.source);
  const mdAbs = path.join(vaultRoot, item.md);
  const imgAbs = path.join(vaultRoot, item.imgDir);

  if (!fs.existsSync(sourceAbs)) {
    console.log('MISSING  ' + item.source);
    failed++;
    continue;
  }

  const hash = sha1(sourceAbs);
  const prev = manifest[item.source];
  if (!force && prev && prev.hash === hash && fs.existsSync(mdAbs)) {
    skipped++;
    continue;
  }

  const tmpJson = path.join(os.tmpdir(), 'xmind_' + hash.slice(0, 12) + '.json');
  try {
    fs.writeFileSync(tmpJson, runRead(sourceAbs), 'utf8');
    const r = spawnSync(
      process.execPath,
      [converter, tmpJson, sourceAbs, mdAbs, imgAbs, item.imgDir, item.title, item.source],
      { encoding: 'utf8' }
    );
    if (r.status !== 0) throw new Error(r.stderr || r.stdout);
    const result = JSON.parse(r.stdout.trim().split('\n').pop());
    if (result.imgCount === 0 && fs.existsSync(imgAbs)) {
      try { fs.rmdirSync(imgAbs); } catch { /* 非空则保留 */ }
    }
    manifest[item.source] = {
      hash,
      md: item.md,
      imgDir: item.imgDir,
      images: result.imgCount,
      missing: result.missing,
      at: new Date().toISOString(),
    };
    console.log('OK       ' + item.title + '  images=' + result.imgCount +
      (result.missing.length ? '  missing=' + result.missing.length : ''));
    converted++;
  } catch (e) {
    console.log('FAIL     ' + item.title + '  ' + e.message);
    failed++;
  } finally {
    if (fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`\n转换 ${converted} 份，跳过 ${skipped} 份，失败 ${failed} 份。`);
