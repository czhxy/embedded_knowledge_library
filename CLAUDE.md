# CLAUDE.md — 嵌入式知识库项目约定

本文件供 Claude Code 与协作者阅读，记录本知识库的结构约定与操作注意事项。修改内容时请遵守。

## 项目定位

- 个人嵌入式软件学习与面试知识库，**纯 Markdown + Obsidian**。
- 目标：全量收录、分类清晰、图片自包含、碎片可定期汇总。
- 面向 Windows，未来会整体迁移到 macOS。

## 目录约定

| 目录 | 用途 |
|---|---|
| `00-Inbox/` | 碎片收件箱，学习时随手记，**不纠结分类** |
| `01-编程基础/` | C语言、数据结构与算法 |
| `02-体系结构与数字电路/` | ARM架构、电源与电路 |
| `03-单片机与MCU/` | STM32外设、启动/Bootloader、中断与时钟、内存与堆栈 |
| `04-RTOS/` | FreeRTOS、Zephyr |
| `05-通信协议与无线/` | 有线协议、USB、EtherCAT、BLE、Nordic、物联网通信 |
| `06-操作系统与驱动/` | Linux 驱动 |
| `07-工具链与开发环境/` | Git、开源嵌入式开发环境 |
| `08-电机控制与算法/` | FOC |
| `09-面试与项目/` | 面经、面试项目、实习总结 |
| `xmind导图/` | XMind 源文件 + 转换工具 + 迁移记录（不含大体积参考资料） |
| `99-附件/` | **全局图片附件**（Obsidian 自动归集） |
| `99-归档/` | 处理完的 Inbox 按月归档 |
| `模板/` | Obsidian 笔记模板 |

- 顶层目录使用两位数字前缀排序，新增领域按顺序编号（如 `10-xxx/`）。
- 每个领域/子分类目录内有一份同名 `.md` 索引（MOC），用于说明收录范围并回链上层。
- 新增一级领域时，需同步更新 `README.md` 的目录树和本文件的表格。

## 笔记规范

- 正式笔记使用 `模板/知识笔记模板.md`：

```yaml
---
tags: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

- 元信息保持**精简**：只要求 `tags` + 日期，不引入掌握度/复习状态等重元数据。
- 文件名、目录名使用中文，保持可读性；避免重名（Obsidian 的 wiki 链接按文件名解析）。
- 内部链接优先使用 `[[文件名|显示名]]`；跨目录时用相对库根的路径，避免歧义。

## 图片与附件（重要）

- **所有图片必须存入 `99-附件/`**，由 Obsidian 自动处理（`.obsidian/app.json` 已设置 `attachmentFolderPath`）。
- **按主题再分一层**：如 `99-附件/无线BLE/`、`99-附件/FreeRTOS/`。手动粘贴的图默认在根部，可移入对应主题文件夹。
- **禁止引用库外绝对路径**（如 `C:\...\pic\xxx.png`），否则迁移到 Mac 会断图。
- 在 Obsidian 内重命名/移动图片会自动更新引用；不要在文件管理器里直接改名。
- 旧 XMind 的图片已内嵌在 `.xmind` 内，见下方迁移策略。

## Inbox 碎片工作流

- 记录格式：在 `00-Inbox/Inbox.md` 当天日期下追加
  ```md
  - [ ] #主题标签 一句话知识点
      - 可选展开：代码 / 图示 / 链接
  ```
- 汇总节奏：每周或碎片积累够了做一次。
- 汇总步骤：
  1. 逐条处理未勾选项，把内容加工进对应领域的正式笔记；
  2. 勾选为 `- [x]`；
  3. 把已处理段落移到 `99-归档/Inbox归档/YYYY-MM.md`；
  4. 提交一次 Git。
- Inbox 不应长期堆积；它只是暂存区，不是正式知识。

## XMind 导图与自动转换（重要）

- **源文件统一放在 `xmind导图/`**，保留原有子目录结构（如 `BLE/BLE.xmind`）。新增/修改导图直接放这里。
- 已核查全部导图：图片以 `xap:attachments/` 或 `xap:resources/` 内嵌在 `.xmind` 内，无外部路径引用，单文件即可移植。
- **转换流程**（用户只在 XMind 里维护脑图，Markdown 由助手生成）：
  1. 在 `xmind导图/tools/mapping.json` 增加一条映射（`source` / `md` / `imgDir` / `title`）；
  2. 运行 `node "xmind导图/tools/batch_migrate.mjs"`，自动只转换新增或内容变化的导图；
  3. 图片导出到 `99-附件/<主题>/`，笔记写入对应知识目录；
  4. 在对应索引笔记的 `## 笔记` 下补链接。
- 需要全部重建时运行 `node "xmind导图/tools/batch_migrate.mjs" --force`。
- 转换记录（源文件 sha1 清单）在 `xmind导图/tools/.migrated.json`，用作增量判断。
- 大体积参考资料（PDF/ZIP/DOC）不纳入库，已在 `.gitignore` 排除；`xmind导图/` 内只保留 `.xmind`、图片、`.md`。
- 详见 `xmind导图/迁移记录.md` 与 `xmind导图/CLAUDE.md`。

## Git 与同步

- 使用 Git 管理，远程仓库：`git@github.com:czhxy/embedded_knowledge_library.git`
- `.gitignore` 已忽略 `.obsidian/workspace*.json`、`.trash/` 及系统文件。
- 提交时机：完成一次 Inbox 汇总、批量新增/调整结构后。
- 提交信息用中文，简述本次变更意图，例如：`新增 BLE GATT 笔记`、`Inbox 周汇总归档`。
- `.gitattributes` 已设 `* text=auto`，保证 Windows/macOS 换行一致。

## 迁移到 macOS

- 直接 `git clone` 或复制整个文件夹即可，图片随库携带。
- 迁移后无需改动图片引用；Obsidian 打开库后确认附件目录仍为 `99-附件`。
