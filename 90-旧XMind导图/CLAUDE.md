# CLAUDE.md — 旧 XMind 区域

本目录统一存放历史 XMind 导图与迁移工具。改动本目录前请阅读本约定。

## 断图问题的结论

- 已扫描全部 30 份 `.xmind`：图片均以 `xap:attachments/` 或 `xap:resources/` **内嵌在文件内部，没有任何外部路径引用**。
- 因此 `.xmind` 文件本身是自包含的：**只复制 `.xmind` 即可，不会断图**。
- 导图旁的 `pic/` 文件夹只是冗余备份，可保留，但不参与迁移，不要依赖它。

## 防止再断图的规则

1. 在 XMind 中插入图片时，使用「插入图片」让 XMind 把图片复制进文件，**不要用“链接到文件”**。
2. 新增或编辑导图后，确认正文中不出现 `file:///`、`../`、`C:\`、`/Users/` 等外部路径。
3. 迁移时只复制 `.xmind` 单文件到本目录，不要依赖同级 `pic/`。
4. 需要复核时运行：
   ```bash
   node "90-旧XMind导图/tools/scan_refs.mjs" "C:/Users/cz/Desktop/xmind/mindmap"
   ```
   输出应为 `external image refs: 0`。
5. 若发现外部引用，说明图片未内嵌：在 XMind 中重新插入图片并保存，再用工具复核。

## 目录约定

- `90-旧XMind导图/<主题>/<原文件名>.xmind`：原导图。
- `90-旧XMind导图/tools/`：迁移与检查脚本（仅用 Node 内置模块，无外部依赖）。
- 转换后的 Markdown 摘要放在对应知识目录，图片导出到 `99-附件/<主题>/`。

## 转换流程

1. 用 xmind 技能的 `read` 动作把 `.xmind` 读成 JSON：
   ```bash
   echo '{"action":"read","path":"<xmind路径>"}' | node <skill>/scripts/read_xmind.mjs > /tmp/x.json
   ```
2. 运行转换器：
   ```bash
   node "90-旧XMind导图/tools/migrate_xmind.mjs" \
     <上一步的JSON> <xmind路径> <md输出> <图片目录绝对路径> <图片目录库内路径> <标题> <原导图库内路径>
   ```
3. 检查输出中的 `missing` 应为空，图片数量与导图一致。
