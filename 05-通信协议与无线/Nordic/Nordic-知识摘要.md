---
tags: []
created: 2026-10-29
updated: 2026-10-29
---

# Nordic

> 本笔记由 XMind 导图自动转换，图片已提取至 `99-附件/Nordic/`。
> 原导图见 `xmind导图/Nordic/Nordic.xmind`。

## CMakeLists.txt中加
set(BOARD_FLASH_RUNNER uf2)
(专用于XIAO的板子，因为它没有探针)
## 烧录命令
west flash -d build --runner uf2
## 编译命令
west build -d build
## # 1. 复制到 SDK 之外
cp -r c:/ncs/v3.4.1/zephyr/samples/hello_world  C:/Users/cz/myapps/hello_world
# 2. 构建（west 需在 workspace 内运行）
cd c:/ncs/v3.4.1
west build -b xiao_ble/nrf52840/sense C:/Users/cz/myapps/hello_world -d C:/Users/cz/myapps/hello_world/build
# 3. 烧录（先双击 RESET）
west flash -d C:/Users/cz/myapps/hello_world/build --runner uf2
