# CLAUDE.md — xmind导图 区域

本目录统一存放 XMind 源文件与转换工具。**用户日常只在 XMind 里维护脑图，Markdown 笔记由助手转换生成。**

## 断图问题的结论

- 已扫描全部 30 份 `.xmind`：图片均以 `xap:attachments/` 或 `xap:resources/` **内嵌在文件内部，没有任何外部路径引用**。
- 因此 `.xmind` 文件本身是自包含的：**只复制 `.xmind` 即可，不会断图**。
- 导图旁的 `pic/` 文件夹只是冗余备份，已随目录复制，但不参与转换，不要依赖它。

## 防止再断图的规则

1. 在 XMind 中插入图片时，使用「插入图片」让 XMind 把图片复制进文件，**不要用“链接到文件”**。
2. 新增或编辑导图后，确认正文中不出现 `file:///`、`../`、`C:\`、`/Users/` 等外部路径。
3. 需要复核时运行：
   ```bash
   node "xmind导图/tools/scan_refs.mjs" "xmind导图"
   ```
   输出应为 `external image refs: 0`。
4. 若发现外部引用，说明图片未内嵌：在 XMind 中重新插入图片并保存，再用工具复核。

## 目录约定

- `xmind导图/<主题>/<原文件名>.xmind`：源导图，保留用户原有目录结构。
- `xmind导图/tools/`：转换与检查脚本（仅用 Node 内置模块，无外部依赖）。
  - `mapping.json`：源导图 → Markdown 笔记 / 附件目录的映射表。
  - `migrate_xmind.mjs`：单文件转换器。
  - `batch_migrate.mjs`：批量/增量转换入口。
  - `scan_refs.mjs`：外部图片引用检查。
  - `.migrated.json`：转换记录（按源文件 sha1 判断是否需要重转）。
- 转换后的 Markdown 笔记放在对应知识目录，图片导出到 `99-附件/<主题>/`。
- 大体积参考资料（PDF/ZIP/DOC/DOCX）不纳入库，已在 `.gitignore` 排除。

## 日常操作流程（用户新增/修改脑图后）

1. 用户把新增或修改后的 `.xmind` 放到 `xmind导图/` 下（可建主题子目录）。
2. 在 `xmind导图/tools/mapping.json` 增加/更新一条记录：
   ```json
   {
     "source": "xmind导图/<主题>/<文件>.xmind",
     "md": "<知识目录>/<笔记名>.md",
     "imgDir": "99-附件/<主题>",
     "title": "<笔记标题>"
   }
   ```
3. 运行增量转换：
   ```bash
   node "xmind导图/tools/batch_migrate.mjs"
   ```
   - 自动读取 `mapping.json`，只转换**新增或内容变化**（sha1 不同）的导图。
   - 全部重建用 `--force`：`node "xmind导图/tools/batch_migrate.mjs" --force`
4. 检查输出：`images=N`、`missing` 应为空；失败会有 `FAIL` 行。
5. 在对应索引笔记的 `## 笔记` 下补 wikilink；若新增子分类，同步更新上级索引。

## 单文件手动转换（调试用）

1. 用 xmind 技能的 `read` 动作把 `.xmind` 读成 JSON：
   ```bash
   echo '{"action":"read","path":"<xmind路径>"}' | node "C:/Users/cz/.claude/skills/xmind/scripts/read_xmind.mjs" > x.json
   ```
2. 运行转换器：
   ```bash
   node "xmind导图/tools/migrate_xmind.mjs" \
     <上一步的JSON> <xmind路径> <md输出> <图片目录绝对路径> <图片目录库内路径> <标题> <原导图库内路径>
   ```
3. 检查输出中的 `missing` 应为空，图片数量与导图一致。

## 注意事项

- 笔记路径与附件目录在 `mapping.json` 中维护；新增主题时记得同步目录名。
- 生成的笔记会被 `--force` 覆盖，**不要直接编辑生成的 `.md` 正文**；需要补充内容应写在源导图或另建笔记，避免下次转换丢失。
- 附件目录名保持唯一、语义清晰（如 `无线BLE`、`STM32外设`），避免与其他主题混用。
