---
tags: []
created: 2026-10-29
updated: 2026-10-29
---

# Nordic 开发 SOP

> 本笔记由 XMind 导图自动转换，图片已提取至 `99-附件/Nordic开发SOP/`。
> 原导图见 `xmind导图/Nordic/Nordic开发SOP.xmind`。

## 0. 环境前提
- **终端必须加载 nRF Connect 工具链环境**
  > 所有 west 命令必须在已加载工具链环境的终端里执行。推荐用 VS Code 集成终端（nRF Connect 扩展会配好环境），或用 Toolchain Manager 里的 Open Terminal。实测普通 PowerShell / Git Bash 里没有 west，$env:ZEPHYR_BASE 也是空的。
- **自检三条命令**
  > west --version
  > echo $env:ZEPHYR_BASE   （应指向 C:/ncs/v3.4.1/zephyr）
  > ninja --version
- 报错 west: unknown command "build"
  = 环境没加载
  > 遇到这个报错说明终端里没有 west 扩展命令。换 VS Code 集成终端；或 cd 到 C:/ncs/v3.4.1 后用 -s 显式指定源码路径。
## 1. 日常编译 & 烧录
- **首次 / 换 board / 大改配置**
  west build -b xiao_ble/nrf52840 -p always
  > 换 board target 必须加 -p always，否则会撞上旧的 CMake 缓存。
- **日常只改了 main.c**
  west build
  > 增量编译，不用再带 -b，缓存里已经有了。
- **烧录**
  双按 RESET 进 bootloader → west flash
  > 双按 RESET 后会出现 XIAO-SENSE 盘。因为 CMakeLists.txt 里已加 set(BOARD_FLASH_RUNNER uf2)，所以不用再写 --runner uf2。
- **要点**
  - board target 固定 xiao_ble/nrf52840
    （非 Sense 版，别用 /sense）
  - **改 prj.conf / CMakeLists.txt 后**
    CMake 一般会自动重跑 configure
  - **west flash 结尾的 WinError 433**
    是正常的，已烧录成功，忽略即可
- **产物路径（sysbuild 多一层目录）**
  build/<项目名>/zephyr/zephyr.uf2
  > 注意是 build/hello_world/zephyr/，不是 build/zephyr/。手动拖拽烧录用这个 uf2 文件。
- **看串口输出**
  USB CDC ACM，115200
  不需要 USB-TTL 转接板
  > XIAO BLE 上 Zephyr 的 console 默认走 USB CDC ACM，插上 USB 线会出现一个「USB 串行设备 (COMx)」。列出串口：[System.IO.Ports.SerialPort]::GetPortNames()
## 2. 复制工程做二次开发
（蓝牙透传为例）
- **选样例**
  - **peripheral_nus（推荐起步）**
    zephyr/samples/bluetooth/peripheral_nus
    > 只有一个 main.c，只用 printk，不依赖 DK 库和 RTT，移植成本最低。
  - **peripheral_uart（完整双向透传）**
    nrf/samples/bluetooth/peripheral_uart
    > NUS 服务 + 异步 UART 双向透传。功能全，但依赖 dk_buttons_and_leds 和 RTT 日志，需要移植。
- **复制（目标目录别放 C:/ncs 里面）**
  > cd C:/Users/cz/Desktop/Nordic/my_project
  > Copy-Item -Recurse C:/ncs/v3.4.1/zephyr/samples/bluetooth/peripheral_nus ./ble_uart
  > cd ./ble_uart
  >
  > 放在 C:/ncs 外面可以避免污染 SDK 的 git 状态和 west 模块扫描。
- **清理**
  build/  .git/  sample.yaml
  > build 是旧构建缓存；.git 是样例自带的仓库信息；sample.yaml 是给 CI（twister）用的，留着会误导。
- **改工程标识**
  project(NONE) → project(ble_uart)
- **加 uf2 runner（必须）**
  set(BOARD_FLASH_RUNNER uf2)
  > 放在 find_package(Zephyr ...) 之前。XIAO 板上没有调试探针，默认 runner 是 nrfutil（要接探针），不加这行 west flash 会直接失败。
- **移植到 XIAO 要留意**
  - **删掉 DK 专有依赖**
    > CONFIG_DK_LIBRARY=y 加上 dk_buttons_and_leds_* 在 XIAO 上用不了，板子没有按键（没有 sw0 别名）。改成直接操作 GPIO 或删掉。
  - **日志输出方式要换**
    > XIAO 没有调试器，CONFIG_USE_SEGGER_RTT=y / CONFIG_LOG_BACKEND_RTT=y 看不到任何输出。改成 CDC ACM 串口控制台，或直接用 printk。
  - **不要抢 console 的串口**
    > XIAO 的 console 默认走 USB CDC ACM，uart0（排针 D6/D7）是空出来的，正好做透传串口。但别在 prj.conf 里用 CONFIG_UART_CONSOLE=y 把 console 抢回 uart0，会和透传串口打架。
  - **Flash / RAM 预算**
    > 板级用了 nrf52840_partition_uf2_sdv7.dtsi（为 Adafruit bootloader 预留 SoftDevice 分区），1MB flash / 256KB RAM。加 BLE + 日志后注意看构建输出里剩下的余量。
- **编译烧录**
  west build -b xiao_ble/nrf52840 -p always
  双按 RESET → west flash
- **验证**
  > 串口（USB CDC ACM，115200）看启动日志。手机 nRF Connect App → Scanner → 找到广播名 → 连接 → 看 NUS 服务。NUS 服务 UUID：6E400001-B5A3-F393-E0A9-E50E24DCCA9E。也可以用桌面版 nRF Connect for Desktop → Bluetooth Low Energy。
## 3. 常见报错速查
- source directory ... does not exist
  > 原因：路径写错（如漏了一层目录）。处理：用 Tab 补全；或 cd 进项目再 build。
- source and build directory ... cannot be the same
  > 原因：人正在 build 目录里跑 west build，源码目录和构建目录被解析成同一个。处理：cd .. 回到项目根目录。
- **west: unknown command "build"**
  > 原因：终端没加载工具链环境。处理：换 VS Code 集成终端；或 cd 到 C:/ncs/v3.4.1 再用 -s 指源码。
- source directory "." does not contain a CMakeLists.txt
  > 原因：在 workspace 根目录下跑，没给源码路径。处理：补 -s 。
- zephyr.h/kernel.h: No such file or directory
  > 原因：头文件路径写错。正确写法是 #include 。zephyr 是目录，kernel.h 在它里面。
- **west flash 结尾 WinError 433**
  > 原因：bootloader 收完文件立刻重启，MSC 设备消失，shutil 的 copymode 收尾动作失败。数据在 copyfile 阶段就已经写完了。处理：忽略。
- **VS Code 里 zephyr/kernel.h 画红线**
  > 原因：C/C++ 插件没读到 Zephyr 的 include 路径。误报，忽略。
- **west flash 走了 nrfutil 而不是 uf2**
  > 原因：CMakeLists.txt 没设 BOARD_FLASH_RUNNER。处理：加 set(BOARD_FLASH_RUNNER uf2)，再 -p always 重配。
## 4. west 参数速查
- **west —— Zephyr 元工具**
  必须在 workspace 内或已设 ZEPHYR_BASE
- **build —— 先 CMake 配置，再 Ninja 编译**
- **-b / --board**
  board target，如 xiao_ble/nrf52840
- **-p / --pristine**
  清空构建目录重配，取值 auto / always（默认 auto）
- **-s / --source-dir**
  应用源码目录（含 CMakeLists.txt），默认当前目录
- **-d / --build-dir**
  构建产物目录，默认 <source-dir>/build
- **-r / --runner**
  烧录器，如 uf2；默认由 BOARD_FLASH_RUNNER 决定
## 5. 本机关键路径
- **SDK workspace**
  C:/ncs/v3.4.1
- **Zephyr**
  C:/ncs/v3.4.1/zephyr
- **工具链**
  C:/ncs/toolchains/4f5b6ad6dd/opt
- **板级定义**
  C:/ncs/v3.4.1/zephyr/boards/seeed/xiao_ble
- **我的项目**
  C:/Users/cz/Desktop/Nordic/my_project/
## 附：板子型号确认（备用）
> XIAO nRF52840 的 Sense 和非 Sense 版出厂共用同一份 bootloader，所以 bootloader U 盘的名字和 INFO_UF2.TXT 里的 Board-ID 都带 Sense，不能用来判断硬件版本。INFO_UF2.TXT 里 Model: Seeed XIAO nRF52840 这行才是型号，而 Board-ID: Seeed_XIAO_nRF52840_Sense 两个版本都一样。要确认硬件，只能扫 I2C0 上的 0x6A（LSM6DS3TR-C IMU，Sense 独有），或目视板上有没有 IMU / 麦克风元件。
