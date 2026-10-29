---
tags: []
created: 2026-10-29
updated: 2026-10-29
---

# STM32 外设

> 本笔记由 XMind 导图自动转换，图片已提取至 `99-附件/STM32外设/`。
> 原导图见 `xmind导图/STM32外设/STM32外设.xmind`。

## 时钟树
![[99-附件/STM32外设/0egu3r8302cpn328hn74qns36s.png]]
## Timer
- **硬件框图**
  ![[99-附件/STM32外设/3mko9ji0i0nvffktiqfds01kjv.png]]
- **基本结构**
  ![[99-附件/STM32外设/7prfms3s1ljcisr8uuft09d6qi.png]]
- **模式：**
  - **1、定时**
    - **关注参数：**
      1、pre 预分频系数
      2、arr 自动重装载值
      3、countermode 计数器模式
  - **2、输出比较（PWM输出）**
    - **1、pre 分配系数**
      2、arr 自动重装载值
      3、TIM_CounterMode 计数方向
      4、ccr 比较值
      5、pwmmode（TIM_OCMode）决定计数值大于CCR时输出有效电平还是小于CCR时输出有效电平
      6、TIM_OCPolarity 决定有效电平是低还是高
  - **3、输出捕获**
  - **4、编码器输入**
## ADC
## DAC
## DMA
## NVIC
## 看门狗
- **基本结构**
  - **独立看门狗**
    ![[99-附件/STM32外设/3gc8n7r6ol2bnvq8csel09hvu1.png]]
  - **窗口看门狗**
    ![[99-附件/STM32外设/6mf6b3pm3sha58uk58i3p1mavb.png]]
- **用法**
  - **启动看门狗**
    - **(无标题)**
      ![[99-附件/STM32外设/10gs1omero1ttjhf17jnr1b8im.png]]
  - **规定时间内喂狗，一般是任务结束后进行喂狗**
    - **超时时间计算：**
      T=（(RLR+1)*预分频系数）/LSI
## 复位
- **复位的作用：把程序重置成确定的已知的状态**
- **复位的类型**
  ![[99-附件/STM32外设/0cp13ku3k39ldke5kmiarnop98.png]]
  - **上电复位：**
    确保电压稳定后再运行程序
    ![[99-附件/STM32外设/5ji4apsabjrhdfrnoc50vaog0q.png]]
  - **欠压复位：**
    1、电池不够电
    2、突然有个大负载启动
    ![[99-附件/STM32外设/0vtp0ub6j31qfqtagdn1b955fs.png]]
  - **外部引脚复位**
    ![[99-附件/STM32外设/1risln0c3cs3tiphnql1lrljca.png]]
    - **外围复位电路**
      ![[99-附件/STM32外设/2h9sg8ea4c7d5aoj0k00jom455.png]]
      - **电容如何选择**
        ![[99-附件/STM32外设/3uinu7tlqofliphq8aabrrjr3e.png]]
  - **看门狗复位**
    - **独立看门狗**
      ![[99-附件/STM32外设/7q4genv19a8a7t15hvl1qrrk1o.png]]
    - **窗口看门狗**
      ![[99-附件/STM32外设/0i7n9ps89h9pdhurlmm80q6nr0.png]]
  - **软件复位**
    ![[99-附件/STM32外设/57micpvqokn46su9e7kjg1nde0.png]]
  - **低功耗模式退出复位**
    ![[99-附件/STM32外设/27bbgrglrj3n254rv7b1533pe5.png]]
  - **备份域复位**
    ![[99-附件/STM32外设/1g62uiq03qniiss8ph7kvffukt.png]]
- **复位源寄存器（复位后不清标志，用来获取复位原因）**
  - **(无标题)**
    ![[99-附件/STM32外设/3lu2iu3c3hq9v87t5qs7h6nohd.png]]
- **复位的层级**
  ![[99-附件/STM32外设/6ub3m6sq2dgfi33gkfsgtterf2.png]]
