---
tags: []
created: 2026-10-29
updated: 2026-10-29
---

# Zephyr

> 本笔记由 XMind 导图自动转换，图片已提取至 `99-附件/Zephyr/`。
> 原导图见 `xmind导图/zephyr/zephyr.xmind`。

## what
- **集成驱动、协议栈和工具的开源操作系统生态**
## 核心
- **kconfig:管理功能配置与依赖**
  - **depends on vs select**
    - **depends on 只有父项打开才出现，被动配置**
    - **select 只要当前配置开启，就强制开启另一个示例**
  - **数据类型**
    - **bool: 布尔型（y/n），常用于功能使能。**
    - **int: 整型，例如缓冲区大小、优先级。**
    - **string: 字符串，例如设备名称、版本号。**
  - **转换链路**
  - **example**
    - **config ANT_SENSOR**
          bool "Ant Sensor Driver"
          depends on SPI
          select SENSOR_HELPER
- **DeviceTree(DTS)：描述硬件拓扑**
- **west：管理多仓库与开发工具流**
## 概述
![[99-附件/Zephyr/0ghgqme08ig2apo5dn7kuku7in.png]]
