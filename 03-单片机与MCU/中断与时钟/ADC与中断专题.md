---
tags: []
created: 2026-10-29
updated: 2026-10-29
---

# ADC 与中断专题

> 本笔记由 XMind 导图自动转换，图片已提取至 `99-附件/ADC与中断专题/`。
> 原导图见 `xmind导图/ADC与中断专题.xmind`。

## 双 ADC 模式对比（ADC1 主 ADC 的 CR1 寄存器 DUALMOD[3:0] 位段 bit16~19）
- **前置概念：**
  规则组 Regular：常规转换通道，最多16个顺序转换，结果存 DR
  注入组 Injected：4个可打断规则转换的高优先级通道，结果存 JDR1~4
  同时模式：两个ADC由同一触发源触发，同一时刻分别采样各自通道（相位一致）
  交叉模式：两个ADC交替对同一信号采样，等效提升采样率
  交替触发：两个ADC由各自触发源先后触发，互不同步
- 独立模式：ADC_Mode_Independent(0x0) → 各干各的，默认值；注意双ADC模式下从机ADC2的DUALMOD位无效，联合模式实际只由ADC1的CR1决定
- **同时模式（同步采样）**
  - RegSimult(0x6)：规则组同时转换——同一触发，两ADC同时转各自规则序列（最常用）
  - **InjecSimult(0x5)：注入组同时转换**
  - RegInjecSimult(0x1)：规则组同时 + 注入组同时
  - RegSimult_AlterTrig(0x2)：规则组同时 + 注入组交替触发
  - InjecSimult_FastInterl(0x3)：注入组同时 + 规则组快速交叉
  - InjecSimult_SlowInterl(0x4)：注入组同时 + 规则组慢速交叉
- **交叉模式（追求高等效采样率）**
  - FastInterl(0x7)：快速交叉——两ADC交替采同一输入，采样间隔短（1~2.5个ADCCLK），等效采样率接近2×，精度较低
  - SlowInterl(0x8)：慢速交叉——等ADC1完成一个完整转换后才轮到ADC2，间隔长，等效采样率提升有限，可配长采样时间精度高
- 交替触发：AlterTrig(0x9) → 两ADC各由自己的触发源先后触发，互不同步；结果仍合并进ADC1->DR，可用同一个DMA通道统一搬运两路数据
- **快速 vs 慢速交叉对比**
  - 采样间隔：快速=短（1~2.5个ADCCLK）；慢速=长（等一个完整转换）
  - **等效采样率：快速≈2×；慢速≈1.5×（提升有限）**
  - **精度：快速=采样时间短精度低；慢速=可长采样时间精度高**
  - 适用信号：快速=音频/示波器/电机高速电流波形；慢速=中高速但要求精度的信号
- **结果读取（重要细节）**
  - 同时/交叉模式下，两个ADC的结果合并进ADC1的DR寄存器；DMA用32位数据宽度搬运时，一次读出{ADC2[15:0] | ADC1[15:0]}
- 代码示例（RegSimult 双ADC同步采样 + DMA）：
  // ADC1（主）配置规则同时模式
  ADC_InitStructure.ADC_Mode = ADC_Mode_RegSimult;
  ADC_InitStructure.ADC_ScanConvMode = ENABLE;
  ADC_InitStructure.ADC_NbrOfChannel = 1;      // 各ADC 1个通道
  ADC_Init(ADC1, &ADC_InitStructure);
  // ADC2（从）——DUALMOD由ADC1决定，配Independent即可
  ADC_InitStructure.ADC_Mode = ADC_Mode_Independent;
  ADC_Init(ADC2, &ADC_InitStructure);
  // DMA：32位宽，外设=ADC1->DR，高16位=ADC2结果，低16位=ADC1结果
  DMA_InitStructure.DMA_PeripheralDataSize = DMA_PeripheralDataSize_Word;
  DMA_InitStructure.DMA_MemoryDataSize = DMA_MemoryDataSize_Word;
- **应用场景**
  - 电机 FOC：RegSimult 同步采样两相电流Iu/Iv，保证采样点相位一致（否则角度与电流不匹配）
  - **功率测量：RegSimult 电压+电流同步采集计算功率**
  - 音频/示波器：FastInterl 提高等效采样率采集高频信号
  - **中高速高精度采样：SlowInterl**
  - **两路独立触发+共享DMA搬运：AlterTrig**
- 一句话记忆：Independent=各干各的；xxxSimult=要同步采样（FOC电流/功率）；xxxInterl=要高采样率（音频/示波器，快速=快但精度低，慢速=精度高）；AlterTrig=各自触发共享DMA
