---
tags: []
created: 2026-10-29
updated: 2026-10-29
---

# FreeRTOS

> 本笔记由 XMind 导图自动转换，图片已提取至 `99-附件/FreeRTOS/`。
> 原导图见 `xmind导图/FreeRTOS/FreeRTOS.xmind`。

## FreeRTOS的移植
- **从github上下载LTS（长期支持版本）**
  - **需要移植的文件**
    - FreeRTOSv202604.00-LTS\FreeRTOS-LTS\FreeRTOS\FreeRTOS-Kernel中
      - **heap4.h（堆管理文件）**
        - 为什么要选freertos的堆管理方案而不是用c语言自带的malloc和free？
          1.malloc和free速度慢且不确定，影响实时性
          2.malloc和free容易产生碎片化问题
          3.malloc和free不具有可重入性（可重入：一个函数可以被多个任务同时调用而不出错）
          - **为什么选heap4？**
            - **heap_1（极简主义，高可靠性）**
              它只是简单的“指针移动”。申请内存时，直接返回当前空闲指针，并将指针后移。
              优点：执行速度最快，时间确定性最强（无链表遍历），绝对安全。
              缺点：内存“只借不还”，一旦用完就耗尽。
              适用：系统启动后所有任务、队列、信号量均创建完毕，且永不被删除的静态项目（如大部分工业传感器采集）。
            - **heap_2（已被抛弃的过渡方案）**
              它支持释放，但释放后不会合并相邻的空闲块。例如：申请 10、20、10 字节，释放中间的 20 字节，这 20 字节永远无法再被大于 20 字节的申请使用。
              致命伤：频繁创建/删除任务会导致内存“千疮百孔”，最终分配失败。新项目中请直接跳过它。
            - **heap_3（封装调试器）**
              它只是简单地调用标准库的 malloc() 和 free()，并加上了关中断保护（临界区）。
              注意：这会增加代码体积，且 malloc 非线程安全（虽然加了保护），且耗时不可预测。
              适用：仅用于PC模拟环境（如Win32模拟器）或快速验证标准库内存行为，绝不推荐用于真实MCU固件。
            - **heap_4（日常开发首选，生产环境标准）**
              它是 heap_2 的升级版，首次适配算法（First Fit）加上释放时自动合并相邻空闲块。
              威力：即使频繁创建/删除任务，内存碎片也能被有效回收，可用性极高。
              附加福利：提供 xPortGetFreeHeapSize() 接口，可实时监控剩余堆大小，便于优化内存配置。
              适用：90%以上的Cortex-M单片机项目（STM32、ESP32、NXP等）默认选这个
            - **heap_5（“缝合怪”，解决内存碎片化布局）**
              很多MCU的RAM不是一整块连续的（比如内部192KB + 外部4MB SDRAM，物理地址不连续）。heap_5允许你定义一个内存区域数组（HeapRegion_t），将多个不连续的RAM块“逻辑拼接”成一个统一的堆供FreeRTOS使用。
              必须：在启动调度器前，必须调用 vPortDefineHeapRegions() 进行初始化。
              核心：除了初始化方式不同，其内部的分配/释放/合并算法完全等同于 heap_4。
          - **printf不具有可重入性**
        - void * pvPortMalloc( size_t xWantedSize )
          void vPortFree( void * pv )
          源码分析
          - void * pvPortMalloc( size_t xWantedSize )
            一句话版：
            加块头 + 对齐 → 关调度器 → first-fit 从低地址找第一块够大的 → 跳过 8 字节块头拿到返回地址 → 把块从链表摘除 → 剩余超过 16 字节就切回空闲链表 → 最高位置 1 标记已分配 → 更新空闲统计 → 开调度器返回。
            - **1.初始化**
              BlockLink_t * pxBlock;
              BlockLink_t * pxPreviousBlock;
              BlockLink_t * pxNewBlockLink;
              void * pvReturn = NULL;
              size_t xAdditionalRequiredSize;
              size_t xAllocatedBlockSize = 0;
              - **块头定义**
                ![[99-附件/FreeRTOS/27lc23uj0u3401t4d1a2l2vbsk.png]]
            - **2.判断xWantedSize是否被满足**
            - **3.挂起调度器，进行prvHeapInit()**
              if( pxEnd == NULL )
                      {
                          prvHeapInit();
                      }
              - （1）将ucheap地址赋给uxStartAddress并进行对齐
                uxStartAddress = (portPOINTER_SIZE_TYPE) ucHeap;
                if ((uxStartAddress & portBYTE_ALIGNMENT_MASK) != 0) {
                    uxStartAddress += portBYTE_ALIGNMENT - 1;
                    uxStartAddress &= ~portBYTE_ALIGNMENT_MASK;
                    xTotalHeapSize -= (uxStartAddress - (portPOINTER_SIZE_TYPE) ucHeap);
                }
                - **(无标题)**
                  ![[99-附件/FreeRTOS/7u9pijchn1k73esbksjsiju14h.png]]
              - **（2）设置哨兵节点**
                xStart.pxNextFreeBlock = (void*) uxStartAddress;
                xStart.xBlockSize = 0;
                （3）根据设定的heap大小确定尾地址并进行对其以及取出一个xHeapStructSize的大小（计算并放置尾地址）
                uxEndAddress = uxStartAddress + xTotalHeapSize;   // 堆的末尾地址
                uxEndAddress -= xHeapStructSize;                  // 预留 8 字节给 pxEnd
                uxEndAddress &= ~portBYTE_ALIGNMENT_MASK;         // 再向下对齐到 8 字节
                pxEnd = (BlockLink_t*) uxEndAddress;
                pxEnd->xBlockSize = 0;
                pxEnd->pxNextFreeBlock = NULL;
                - **(无标题)**
                  ![[99-附件/FreeRTOS/7h2715abror77rohb5koho2834.png]]
              - **（4）创建第一个空闲块**
                pxFirstFreeBlock = (BlockLink_t*) uxStartAddress;
                pxFirstFreeBlock->xBlockSize = uxEndAddress - uxStartAddress;
                pxFirstFreeBlock->pxNextFreeBlock = pxEnd;
                - **(无标题)**
                  ![[99-附件/FreeRTOS/1q1neb0kdu383paind9c0d5rdu.png]]
              - **（5）初始化统计变量**
                xMinimumEverFreeBytesRemaining = pxFirstFreeBlock->xBlockSize;
                xFreeBytesRemaining = pxFirstFreeBlock->xBlockSize;
                这也是堆相关获取函数的来源
                - **(无标题)**
                  ![[99-附件/FreeRTOS/01mkk79km1mph29ogv1bgtcisc.png]]
            - **4.入口检查**
              if (heapBLOCK_SIZE_IS_VALID(xWantedSize) != 0)      // ① 最高位没被占
                  if (xWantedSize > 0 && xWantedSize <= xFreeBytesRemaining)  // ② 空闲够不够
              ① heapBLOCK_SIZE_IS_VALID 展开是 ((xWantedSize) & 0x80000000) == 0。因为 xBlockSize 的最高位是"已分配"标志，一个合法的申请大小绝不能碰到最高位，否则会和标志位打架。这其实在防御"申请了 2GB 以上的荒谬大小"。
              ② 全局变量 xFreeBytesRemaining 记录当前空闲总字节。这里是快速短路：如果总空闲都不够，根本不用遍历链表，直接失败
              - **(无标题)**
                ![[99-附件/FreeRTOS/520scv001hsh2i3b9ijcco4ipg.png]]
            - **5.first_fit遍历**
              pxPreviousBlock = &xStart;                              // 前驱从哨兵开始
              pxBlock = xStart.pxNextFreeBlock;                       // 当前指向第一块空闲块
              while (pxBlock->xBlockSize < xWantedSize                // 当前块不够大
                     && pxBlock->pxNextFreeBlock != NULL) {           // 且还没到链表尾
                  pxPreviousBlock = pxBlock;                          // 前驱前移
                  pxBlock = pxBlock->pxNextFreeBlock;                 // 当前块前移
              }
              6.跳过头算返回地址
              pvReturn = ( void * ) ( ( ( uint8_t * ) heapPROTECT_BLOCK_POINTER( pxPreviousBlock->pxNextFreeBlock ) ) + xHeapStructSize );
              - **(无标题)**
                ![[99-附件/FreeRTOS/79qrttdci6975tu5ataun0tuh5.png]]
            - **7.摘除块**
              pxPreviousBlock->pxNextFreeBlock = pxBlock->pxNextFreeBlock;
              摘除前：  pxPrev ──► pxBlock ──► next
              摘除后：  pxPrev ──► next          （pxBlock 被"抠"出来）
              8.切分新块
              if ((pxBlock->xBlockSize - xWantedSize) > heapMINIMUM_BLOCK_SIZE) {
                  pxNewBlockLink = (BlockLink_t*)((uint8_t*)pxBlock + xWantedSize);  // 新块 = 块后半段
                  pxNewBlockLink->xBlockSize = pxBlock->xBlockSize - xWantedSize;   // 剩余大小
                  pxBlock->xBlockSize = xWantedSize;                                // 分配块大小
                  pxNewBlockLink->pxNextFreeBlock = pxPreviousBlock->pxNextFreeBlock; // 新块接上 next
                  pxPreviousBlock->pxNextFreeBlock = pxNewBlockLink;                  // 前驱指向新块
              }
              - **(无标题)**
                ![[99-附件/FreeRTOS/49k2kqhike8ajf5254gf2a936q.png]]
              - **(无标题)**
                ![[99-附件/FreeRTOS/2iagns697n3kdtojec1ump8550.png]]
            - **9.更新统计以及标记已分配**
              xFreeBytesRemaining -= pxBlock->xBlockSize;                    // 空闲总量扣掉分配块
              if (xFreeBytesRemaining < xMinimumEverFreeBytesRemaining)
                  xMinimumEverFreeBytesRemaining = xFreeBytesRemaining;      // 刷新历史最低
              ...
              heapALLOCATE_BLOCK(pxBlock);          // xBlockSize 最高位置 1 = 标记"已分配"
              pxBlock->pxNextFreeBlock = NULL;      // 已分配块不再有 next
              xNumberOfSuccessfulAllocations++;     // 成功计数 +1
              - **(无标题)**
                ![[99-附件/FreeRTOS/1uogmkjdi9am0k5ulqvmb9ipm5.png]]
            - **10.断言与失败**
              #if configUSE_MALLOC_FAILED_HOOK == 1
                  if (pvReturn == NULL) vApplicationMallocFailedHook();
              #endif
              configASSERT(((size_t)pvReturn & portBYTE_ALIGNMENT_MASK) == 0);
              return pvReturn;
          - **void vPortFree( void * pv )**
            - **1.找回块头**
              puc -= xHeapStructSize;          // pv - 8
              pxLink = (BlockLink_t*) puc;
              这就是 FreeRTOS 的 vPortFree 不需要你传大小的原因——大小就存在块头里。
              2.断言检查
              heapVALIDATE_BLOCK_POINTER(pxLink);                 // 块头必须在堆范围内
              configASSERT(heapBLOCK_IS_ALLOCATED(pxLink) != 0);  // 最高位必须 = 1（已分配）
              configASSERT(pxLink->pxNextFreeBlock == NULL);      // next 必须 = NULL
              3.heapFREE_BLOCK(pxLink);   // xBlockSize &= ~0x80000000，清掉最高位
              - **(无标题)**
                ![[99-附件/FreeRTOS/3lpfcde2vioi04raqo0bou5fq3.png]]
            - **4.关调度器 + 加回统计 + 插入链表**
              vTaskSuspendAll();                             // 和 malloc 一样，停调度保证原子
              xFreeBytesRemaining += pxLink->xBlockSize;     // 空闲总量加回来
              prvInsertBlockIntoFreeList(pxLink);            // ★ 插入并按地址合并
              xNumberOfSuccessfulFrees++;
              xTaskResumeAll();
              - prvInsertBlockIntoFreeList：定位 + 双向合并
                - **1.定位**
                  for (pxIterator = &xStart;
                       pxIterator->pxNextFreeBlock < pxBlockToInsert;
                       pxIterator = pxIterator->pxNextFreeBlock)
                      ;
                  空闲链表按地址升序排列，这个循环从 xStart 往后走，直到 下一个块的地址 >= 待插入块的地址。循环结束后 pxIterator 就是待插入块的直接前驱（地址刚好小于它的那个节点）。
                  - **(无标题)**
                    ![[99-附件/FreeRTOS/2qbpi2rmqb1nkm9krgf3lge3lj.png]]
                - **2.向前合并**
                  puc = (uint8_t*) pxIterator;
                  if ((puc + pxIterator->xBlockSize) == (uint8_t*) pxBlockToInsert) {
                      pxIterator->xBlockSize += pxBlockToInsert->xBlockSize;  // 大小加给前驱
                      pxBlockToInsert = pxIterator;                           // 待插入块 = 前驱
                  }
                  判断"前驱的末尾地址 == 待插入块的起始地址"。相等说明两块在物理上紧挨着，就合并成一块，并把 pxBlockToInsert 改成前驱（后续操作都作用在这块合并体上）。
                  - **(无标题)**
                    ![[99-附件/FreeRTOS/44gp9pg4o3e463mhtocjufove6.png]]
                - **3.向后合并**
                  puc = (uint8_t*) pxBlockToInsert;
                  if ((puc + pxBlockToInsert->xBlockSize) == (uint8_t*) pxIterator->pxNextFreeBlock) {
                      if (pxIterator->pxNextFreeBlock != pxEnd) {
                          pxBlockToInsert->xBlockSize += pxIterator->pxNextFreeBlock->xBlockSize; // 吞并后继大小
                          pxBlockToInsert->pxNextFreeBlock = pxIterator->pxNextFreeBlock->pxNextFreeBlock; // 跳过后继
                      } else {
                          pxBlockToInsert->pxNextFreeBlock = pxEnd;
                      }
                  } else {
                      pxBlockToInsert->pxNextFreeBlock = pxIterator->pxNextFreeBlock;
                  }
                  - **(无标题)**
                    ![[99-附件/FreeRTOS/0c4f2itj26ooub3uf72emvprgn.png]]
                - **4.链接**
                  if (pxIterator != pxBlockToInsert)
                      pxIterator->pxNextFreeBlock = pxBlockToInsert;
                  - **(无标题)**
                    ![[99-附件/FreeRTOS/3sf6l4jitupm7u7mh8va199fqi.png]]
      - **portable**
        - 平台相关：ccs、keil、cubeide、gcc等（注意keil要选rvds）
          - 内核相关部分：armcm3、armcm4等，在这找到port.c和protmacro.h
      - **task**
      - **list**
      - **queue**
      - **timer**
      - 建议将所有.c和.h都添加到文件夹中，然后项目中添加上面的组件
  - **FreeRTOSconfig中需要修改的内容**
    - **cpu频率**
      - **选择芯片对应的时钟频率。**
        #define configCPU_CLOCK_HZ    ( ( unsigned long ) 168000000 )
        - **时钟倍频问题**
    - **任务调度频率**
      - **设置时间片的长度，一般为1000hz，也就是1ms。**
        #define configTICK_RATE_HZ                         1000
    - **内核的中断优先级。（15<<4）。**
      #define configKERNEL_INTERRUPT_PRIORITY          (15<<4)
      - 设置pendsv（任务切换的中断优先级，设置为最低，确保所有中断都执行完了，再在该中断中进行任务的切换）和systick中断（时间片轮询）。
        有些单片机只使用高四位用来表示优先级，低四位不使用
    - **syscall（可屏蔽中断的优先级）**
      - freertos不可屏蔽的等级设置，一般设为（5<<4）。freertos只能在屏蔽该优先级以下的中断，也只能在该优先级以下的中断中调用带中断isr标志的api。
        #define configMAX_SYSCALL_INTERRUPT_PRIORITY     (5<<4)
        #define configMAX_API_CALL_INTERRUPT_PRIORITY    (5<<4)
        - 中断优先级数字越小优先级越高，freertos任务优先级数字越大优先级越高。最大优先级的设置可以通过max_priority的宏设置，一般为32，即0-31，共32个优先级
          #define configMAX_PRIORITIES                       32
    - 位宽，32位单片机选32bit，8位和16位都选16bit。位宽影响时间戳回绕的频率
      #define configTICK_TYPE_WIDTH_IN_BITS              TICK_TYPE_WIDTH_32_BITS
  - **启动文件中需要修改的内容**
    - 需要修改启动向量表中的systick pendsv svc中断函数，改为freertos的api也可以通过宏定义别名实现
## 核心组件
- **任务管理**
  - **任务的状态**
    - **运行态**
    - **就绪态**
      - readylist中取优先级最高的。这部分后面需要看源码深入探索
    - **阻塞态**
      - **调用vtaskdelay或等待信号量的场景。**
        - systick中会检查哪个任务符合条件，比如delayuntil或delay的时间到了将会将其放回就绪态
    - **挂起态**
      - 调用suspend后挂起，此时不再被调度器调度，要是有resume才会重回调度
  - **任务切换过程**
    - **SVC（Supervisor Call）：启动第一个任务**
      - SVC获取当前任务的tcb，然后将msp切换成第一个任务的psp，然后返回exc_return = 0xFFFFFFFD （意思是返回模式是thread，使用的栈是psp）
        - **(无标题)**
          ![[99-附件/FreeRTOS/2igej4jt01rj991vlge4qhkl9o.png]]
    - **Systick**
      - 作用：维护系统时间基准、把到期的阻塞任务唤醒、判断是否需要调度
        - **Systick**
          ![[99-附件/FreeRTOS/5ao0132aoti995cpg55dqfnsr4.png]]
        - **具体执行：**
          1.关闭临界区（具体做法是提升 BASEPRI 寄存器，屏蔽低优先级中断。BASEPRI 是 Cortex-M 内核的一个寄存器，写入非零值后，优先级数值 ≥ 该值的中断都会被屏蔽。）
        - 2.启用追踪调试（宏，用于调试和可视化工具的追踪（如 SystemView/Tracealyzer）。默认情况下是空宏（什么都不做），但如果配置了 trace 工具，会在这里记录 ISR 进入事件，用于生成时序图。不影响功能。
        - **3.调用xTaskIncrementTick()：**
          - **具体过程为：**
            （1）检查调度器是否被挂起
            （2）系统滴答计数器加一（带溢出处理，溢出后交换延时列表）
            - **(无标题)**
              ![[99-附件/FreeRTOS/22h2pub3ksq1970kro0b94ke64.png]]
          - （3）检查延时任务是否有到期的（用xConstTickCount >= xNextTaskUnblockTime判断）
            （4）检查列表是否为空，若非空取列表第一个，也就是最早到期的。判断是否到时间，没到则更新任务时间
            （5）任务到期则将其移除（通过xItemValue进行判断）
            listREMOVE_ITEM( &( pxTCB->xStateListItem ) );如果是等待时间带超时的，也进行移除。
            （6）将不阻塞的任务加入readylist
            - **(无标题)**
              ![[99-附件/FreeRTOS/4ibif401obcqatnk1n6otijf5a.png]]
              - xItemValue 本身只是一个通用的排序值/附加值，它代表什么，完全取决于这个 ListItem_t 当前挂在哪个链表、以及内核怎么使用这个链表。
            - **(无标题)**
              ![[99-附件/FreeRTOS/7pa6kvr8f2csr1ibcbceqskr9o.png]]
          - （7）若是选择了抢占式调度且优先级大于正在执行的任务， xSwitchRequired = pdTRUE;
            （8）若是同优先级，且开启了时间片，且任务大于1，也进行任务的切换
            （9）返回 xSwitchRequired值（若是调度器被挂起，只进行计数，不进行调度）
            - **(无标题)**
              ![[99-附件/FreeRTOS/74sdiou83qet49hvoscau2bh4l.png]]
            - **(无标题)**
              ![[99-附件/FreeRTOS/6vft8qforfu210theuv77d9a32.png]]
        - 4.若是xTaskIncrementTick() != pdFALSE，则 portNVIC_INT_CTRL_REG=portNVIC_PENDSVSET_BIT;这一步是将pendsv的中断位置位，相当于触发pendsv中断。（ 这行代码直接写 NVIC 的中断控制及状态寄存器（地址 0xE000ED04），将其第 28 位（PENDSVSET）置 1）
          为什么不在这里直接切？说明: 当前仍在 ISR 上下文中。直接在 ISR 内切换任务会导致调用栈混乱，且可能被嵌套中断打断（比如在一些优先级高的中断中调用带isr后缀的api，然后唤起了更高优先级的任务，那么此时就需要立刻切换，如果在systick中切换，就需要等到1ms的周期到了才能切换）。同时pendsv可以即时用一条寄存器写操作唤醒，保证了实时性
        - 5.vPortClearBASEPRIFromISR()     ── 恢复 BASEPRI = 0
    - **在PendSV中进行切换**
      - **PendSV中做的事**
        - 1.首先会关中断进入临界区。然后pendsv是属于一个中断，中断会硬件自动压栈8个寄存器，包括 pc lr xpsr r0-r3 r12(ip)
          - xPSR 是"组合视图"而非独立物理寄存器。Cortex-M 把三个程序状态寄存器（APSR/IPSR/EPSR）在同一段 32 位物理位上做别名叠加（bit-alias），于是它们可以一起被压栈、一起被恢复**，这在异常进出时只需一次访存。
            APSR（Application PSR）：条件标志 `N/Z/C/V/Q`（Q 用于饱和指令 SAT）；
            IPSR（Interrupt PSR）：当前正在处理的异常号（含 0=Thread、16=SysTick、NMI…HardFault=3）；
            EPSR（Execution PSR）：T 位（Thumb 状态，Cortex-M 永远为 1，清零立即 HardFault）+ ITSTATE（if-then 条件执行块的状态机）。
            - **进一步思考——为什么硬件只保存 8 个寄存器**
              根源是 AAPCS（ARM Architecture Procedure Call Standard）的寄存器分类：
              | 寄存器 | 别名 | 分类                            | 含义                                               |
              | ------ | ---- | ------------------------------- | -------------------------------------------------- |
              | R0-R3  |      | 调用者保存 (caller-saved)   | 函数调用后这些值不保证保留，调用者自己负责保存 |
              | R12    | IP   | 调用者保存                  | 临时暂存寄存器 (Intra-Procedure)                   |
              | R4-R11 |      | 被调用者保存 (callee-saved) | 函数调用后这些值必须保留，被调用者负责保存     |
              | R13    | SP   | 特殊                            | 栈指针                                             |
              | R14    | LR   | 特殊                            | 返回地址                                           |
              | R15    | PC   | 特殊                            | 程序计数器                                         |
              中断/异常 ≈ 一次函数调用：
              硬件做的事  =  caller 的责任（保存 caller-saved 寄存器）
              ISR 做的事  =  callee 的责任（保存 callee-saved 寄存器，按需）
              为什么不是全部 16 个寄存器都由硬件保存？
              如果硬件每次中断都保存全部寄存器（R0-R15）：
              需要 16×4 = 64 字节栈空间
              需要约 16 个时钟周期
              但很多 ISR 很简单，根本不碰 R4-R11：
              ```asm
              ; 一个简单的 ISR，只用了 R0
              my_isr:
                  LDR   R0, =flag     ; 只用了 R0（已被硬件保存）
                  MOV   R1, #1        ; 只用了 R1（已被硬件保存）
                  STR   R1, [R0]
                  BX    LR            ; 返回
              ```
              这个 ISR 完全不需要保存 R4-R11。如果硬件强制保存，就是**白白浪费 8 次内存写入 + 8 次内存读取**。
        - 2.获取当前的栈指针（进程栈），将剩下的寄存器软件保存，然后将保存好寄存器值的栈指针更新到旧的tcb栈指针中
        - **3.调用调度器选择下一个任务**
        - **4.从新任务的tcb中取出栈指针**
        - **5.从栈中回复软件压栈的值**
        - **6.开中断**
        - **7.触发异常返回。中断有特殊的返回值（lr的值）**
          - **不同的lr值代表什么**
            - **exc_return 异常返回值**
              - | EXC_RETURN    | 返回模式       | 使用栈  | bit3(PSP?) | bit2(Thread?) | 典型场景                            |
              - | ------------- | -------------- | ------- | ---------- | ------------- | ----------------------------------- |
              - | 0xFFFFFFF1    | Handler        | MSP     | 0          | 0             | 异常嵌套返回到上一级 ISR            |
              - | 0xFFFFFFF9    | Thread         | MSP     | 0          | 1             | 裸机主循环被中断后返回              |
              - | 0xFFFFFFFD    | Thread         | PSP     | 1          | 1             | RTOS 任务被中断后返回（任务栈 PSP） |
              - | 0xFFFFFFE1…ED | Handler/Thread | MSP/PSP | —          | —             | 带 FPU 扩展栈帧的返回（bit4=1）     |
        - **(无标题)**
          ![[99-附件/FreeRTOS/7n6qj7onv40devrhsvbalj6rpi.png]]
        - **PendSV**
          ![[99-附件/FreeRTOS/4gbtnd3pjmlhk7r36ep6g8v385.png]]
        - **任务调度**
          - **(无标题)**
            ![[99-附件/FreeRTOS/4ub2dvbrq41ritldh7seji1k6i.png]]
          - **为什么就绪列表不用排序：**
            1、就绪列表本身是一个数组，不是一个链表，每个优先级对应一个独立的链表。下标就是优先级。
            2、同一优先级内用 vListInsertEnd，实现轮转。
            3、怎么快速找到最高优先级的就绪任务FreeRTOS 用了一个位图变量 uxTopReadyPriority。
            当某个优先级 uxPriority 有任务就绪时，就把对应位置 1：taskRECORD_READY_PRIORITY( uxPriority );
            本质是：
             #define portRECORD_READY_PRIORITY( uxPriority, uxReadyPriorities )    ( uxReadyPriorities ) |= ( 1UL << ( uxPriority ) )
            当某个优先级空了，就清掉对应位：
            #define portRESET_READY_PRIORITY( uxPriority, uxReadyPriorities )     ( uxReadyPriorities ) &= ~( 1UL << ( uxPriority ) )
            选下一个任务时，用 CLZ（Count Leading Zeros）指令或查表，从高位往低位找第一个为 1 的位，那就是最高优先级
             #define portGET_HIGHEST_PRIORITY( uxTopPriority, uxReadyPriorities )    uxTopPriority = ( 31UL - ( uint32_t ) __clz( ( uxReadyPriorities ) ) )
    - **为什么中断中只能调用带isr的freertosAPI**
      - **临界区问题**
        宏可以分为三组
        第一组是使能和使能中断（本质是直接把config中设定的可屏蔽优先级宏直接加载到basepri寄存器中，basepri寄存器可以屏蔽比它优先级低的中断，注意数字大的优先级低。使能就是把basepri直接设置为0，0就是所有中断都不屏蔽）
        第二组是任务级的进入临界区和退出临界区。内部根本的实现也是提高basepri的数值，也就是屏蔽优先级低的中断。然后还多了一个中断的嵌套计数以及断言。这两个其实是共同作用的。断言触发说明这是在中断中调用了需要用到临界区的api，而在中断中调用这些api这是不被允许的。而嵌套计数可以用来配合这个断言的判断，因为只要第一次进入临界区是合法的，后面嵌套进入临界区也是安全的环境
        第三组是中断级临界区。这里没有嵌套计数器，而是直接存储现在的中断，因为isr中还采用任务级的临界区退出，直接把basepri清0的话，任务的临界区还没结束就可能导致现在不同的中断访问同一份内核数据结构，导致数据被破坏，就相当于还在任务级临界区，但是isr临界区退出时把任务级的也退出了，但任务还认为自己处于任务及临界区内
        - #define portDISABLE_INTERRUPTS()                  vPortRaiseBASEPRI()
          #define portENABLE_INTERRUPTS()                   vPortSetBASEPRI( 0 )
          - static portFORCE_INLINE void vPortRaiseBASEPRI( void )
            {
                uint32_t ulNewBASEPRI = configMAX_SYSCALL_INTERRUPT_PRIORITY;
                __asm
                {
                    /* Set BASEPRI to the max syscall priority to effect a critical
                     * section. */
            /* *INDENT-OFF* */
                        msr basepri, ulNewBASEPRI
                        dsb
                        isb
            /* *INDENT-ON* */
                }
            }
            - msr basepri, configMAX_SYSCALL_INTERRUPT_PRIORITY  ; ①写屏蔽值
              dsb                                                  ; ②数据屏障：确保写入在后续内存访问前生效
              isb                                                  ; ③指令屏障：冲刷流水线，之后指令都在新上下文执行
        - #define portENTER_CRITICAL()                      vPortEnterCritical()
          #define portEXIT_CRITICAL()                       vPortExitCritical()
          - void vPortEnterCritical( void )
            {
                portDISABLE_INTERRUPTS();
                uxCriticalNesting++;
                /* This is not the interrupt safe version of the enter critical function so
                 * assert() if it is being called from an interrupt context.  Only API
                 * functions that end in "FromISR" can be used in an interrupt.  Only assert if
                 * the critical nesting count is 1 to protect against recursive calls if the
                 * assert function also uses a critical section. */
                if( uxCriticalNesting == 1 )
                {
                    configASSERT( ( portNVIC_INT_CTRL_REG & portVECTACTIVE_MASK ) == 0 );
                }
            }
        - #define portSET_INTERRUPT_MASK_FROM_ISR()         ulPortRaiseBASEPRI()
          #define portCLEAR_INTERRUPT_MASK_FROM_ISR( x )    vPortSetBASEPRI( x )
          - static portFORCE_INLINE uint32_t ulPortRaiseBASEPRI( void )
            {
                uint32_t ulReturn, ulNewBASEPRI = configMAX_SYSCALL_INTERRUPT_PRIORITY;
                __asm
                {
                    /* Set BASEPRI to the max syscall priority to effect a critical
                     * section. */
            /* *INDENT-OFF* */
                        mrs ulReturn, basepri
                        msr basepri, ulNewBASEPRI
                        dsb
                        isb
            /* *INDENT-ON* */
                }
                return ulReturn;
            }
            - 调用队列isr等可能会触发任务调度的api需要在后面调用portYIELD_FROM_ISR
              portYIELD_FROM_ISR`不调会怎样？
              高优任务在 ISR 里被唤醒但不会立即执行——中断返回是硬件行为，CPU 原封不动恢复被打断的低优任务上下文。必须通过 `portYIELD_FROM_ISR` 置 PendSV 挂起位，在所有 ISR 执行完后触发 PendSV Handler 做任务切换。不调 = 高优任务最多等一个 tick 周期（通常 1ms），实时系统的"实时"二字作废。
              pxHigherPriorityTaskWoken` 的作用：每个 FromISR 函数都可能把它设为 pdTRUE，但 ISR 只在尾部统一调一次 `portYIELD_FROM_ISR`——多个 ISR 调用共享一个标志，只做一次切换决策。硬编码 `pdTRUE` 会带来不必要的 PendSV 触发和中断延迟。
  - **任务创建与删除**
    - **动态创建**
    - **静态创建**
  - **调度启动**
    - **vTaskStartScheduler()**
          → 创建空闲任务
          → 可选创建定时器任务
          → 关中断、初始化全局状态变量
          → xPortStartScheduler()
               → 配置 PendSV/SysTick 最低优先级
               → 配置 SysTick 但不启动
               → 开中断
               → prvStartFirstTask() → SVC → 从 TCB 恢复第一个任务上下文 → bx lr
          → 函数永远不返回，CPU 进入多任务世界
      - /* Make PendSV and SysTick the lowest priority interrupts. */
            portNVIC_SHPR3_REG |= portNVIC_PENDSV_PRI;
            portNVIC_SHPR3_REG |= portNVIC_SYSTICK_PRI;
            /* Start the timer that generates the tick ISR.  Interrupts are disabled
             * here already. */
            vPortSetupTimerInterrupt();
- IPC(Inter-Process Communication)
  - **选择逻辑：**
    需要传数据？
    ├── 是，需要缓冲（不能丢）        → 队列
    ├── 是，只要最新值（旧值可覆盖）  → 任务通知（eSetValueWithOverwrite）
    └── 否，只传信号 →
          ├── 需要通知多个任务      → 事件组
          ├── 保护共享资源          → 互斥信号量（唯一有优先级继承）
          ├── 管理多个同类资源      → 计数信号量
          ├── 简单一对一同步        → 任务通知（最快）或二值信号量（兼容）
          └── ISR→任务唤醒          → 任务通知 或 二值信号量
    - **队列**
      - 队列创建（xQueueCreate / xQueueCreateStatic）
      - 队列发送：xQueueSend / xQueueSendToBack / xQueueSendToFront
        - xQueueSend / xQueueSendToBack：一样的函数，为了兼容以前的命名。把队列元素送到队列的末尾，多数情况都是这样使用
        - xQueueSendToFrontL:把队列元素送到队列最前面，相当于插队。一般是失败但是又不想丢数据，就把它塞回重试，或者有优先级很高的元素优先需要发送
      - **队列接收：xQueueReceive**
      - **队列的阻塞等待机制**
      - **队列集（Queue Set）：同时等待多个队列**
      - 队列与中断：xQueueSendFromISR / xQueueReceiveFromISR
      - **队列复用作数据缓冲区**
    - **任务通知**
      - FreeRTOS 较新的特性，比信号量高效 45%，比队列更快：
        - 并且是在tcb中自带的，每个tcb中都有ulNotifiedValue，不需要花费额外的ram。
      - xTaskNotifyGive / ulTaskNotifyTake
      - **xTaskNotify / xTaskNotifyWait**
      - **任务通知只能指向单个任务的局限性**
      - **适用场景：替代二值信号量、计数信号量、轻量事件**
    - **事件组**
      - **事件组的底层实现**
        ![[99-附件/FreeRTOS/32gai7fpj9ihnb4ja06h1ct6ab.png]]
      - **事件组的七种操作**
        ![[99-附件/FreeRTOS/7dnde2pcqr7n3fbug1ngvekfih.png]]
        - 事件组的自动清除（pdtrue读取后清除，后面等待的就读不到标志位，pdfalse读取后不清除，所有任务都能读到）
        - **等待**
          - EventBits_t xEventGroupWaitBits(
            EventGroupHandle_t xEventGroup,
            const EventBits_t uxBitsToWaitFor,
            const BaseType_t xClearOnExit,
            const BaseType_t xWaitForAllBits,
            TickType_t xTicksToWait )
        - **同步**
          - **EventBits_t xEventGroupSync(**
            EventGroupHandle_t xEventGroup,
            const EventBits_t uxBitsToSet,
            const EventBits_t uxBitsToWaitFor,
            TickType_t xTicksToWait
            )
            - 通过设置 + 等待 + 自动清除的原子操作，安全地实现了多任务在同步点的汇合。
              作用：使所有任务在同步点（sync point）汇合，然后一起执行后面的任务。
      - **事件位（Event Bits）的概念**
        - **本质是一个无符号二进制数（可选16位 32位 64位）**
      - xEventGroupCreate / xEventGroupSetBits / xEventGroupWaitBits
      - **多事件同步（等待多个事件 AND/OR）**
    - **信号量**
      - **二值信号量：同步用途 vs 互斥用途**
      - **计数信号量：资源管理、事件计数**
      - **互斥信号量（Mutex）：与二值信号量的区别、优先级继承机制**
        - **优先级反转问题**
          - 本质是低优先级抢占本应该运行的高优先级任务。如有低中高三个优先级的任务，低优先级和高优先级都需要一个量才能执行任务。那么在这样一种情况：低优先级先运行，然后中优先级抢占了低优先级任务，此时若是中优先级的任务一直运行，由于高优先级的任务需要低优先级任务持有的量才能运行，但是由于中优先级的任务一直在执行，导致低优先级的任务一直不能释放这个量，高优先级获取不到这个量，导致虽然它的优先级较高，但还是只能让中优先级任务执行。
            - **优先级继承：**
              当需要获取互斥量时，临时将持有互斥量的任务优先级提高到与现在的任务一致，等获取到互斥量后，再把任务优先级还原
      - **递归互斥信号量：同一任务多次获取**
        - **死锁问题：**
          成立的条件：
          1.互斥：资源同一时刻只能被一个任务占用
          2.占有并等待：任务持有一个资源同时等待另一个
          3.不可剥夺：资源只能由持有者释放，不能被别的任务强行抢占
          4.循环等待：任务间存在循环等待
          兜底措施：
          看门狗复位
          - **AB锁**
            - **两个任务互相持有对方的锁，导致都被卡死**
              - **// 任务 A：先拿 mutex1，再要 mutex2**
                  xSemaphoreTake(mutex1, portMAX_DELAY);
                  xSemaphoreTake(mutex2, portMAX_DELAY);  // ←卡死
                  // 任务 B：先拿 mutex2，再要 mutex1
                  xSemaphoreTake(mutex2, portMAX_DELAY);
                  xSemaphoreTake(mutex1, portMAX_DELAY);  // ←卡死
                  任务 A 拿着 mutex1 等 mutex2，任务 B 拿着 mutex2 等 mutex1 →循环等待 →死锁。
                - **解决方法：所有任务都按同一顺序获取互斥量**
          - **自死锁**
            - 使用普通的互斥量，同一任务内,在获取了互斥量后，又再次尝试获取。由于普通互斥量不能识别持有它的任务，所以只能一直等待，但是由于被它本身持有，所以一直不能被释放，形成死锁
              - **void taskA(void *pv) {**
                      for (;;) {
                          funcA();
                          vTaskDelay(100);
                      }
                  }
                  void funcA(void) {
                      xSemaphoreTake(mutex, portMAX_DELAY);   // ①加锁
                      funcB();                                 // ②调用 B（B 内部也要这个锁）
                      xSemaphoreGive(mutex);
                  }
                  void funcB(void) {
                      xSemaphoreTake(mutex, portMAX_DELAY);   // ③自死锁！
                      /* 操作共享数据 */
                      xSemaphoreGive(mutex);
                  }
                - **解决方法：**
                  1.使用递归互斥锁
                  2.将任务内获取的代码进行更改
                  3.使用带超时的获取函数
      - **信号量的 Give/Take 操作及阻塞机制**
- **软件定时器**
  - **软件定时器创建（单次/周期）**
  - **定时器回调函数与上下文（定时器服务任务）**
    - 回调函数中不能调用阻塞的api以及耗时的api，不然会影响多个软件定时器运行时其他定时器回调函数的运行。
  - **定时器命令队列**
    - 定时器不是直接操作定时器任务的，而是通过定时器队列发送消息，定时器任务接收队列消息执行对于回调函数。
  - **定时器的启动、停止、重置**
    - **启动**
      BaseType_t xTimerStart( TimerHandle_t xTimer, TickType_t xTicksToWait );
      - **启动定时器。**
        注意：
        对于运行中的定时器，再次调用启动不会影响计时。
    - **停止**
    - **重置**
      BaseType_t xTimerReset( TimerHandle_t xTimer, TickType_t xTicksToWait );
      - 对未运行的定时器会启动它；对运行中的定时器会重新计时。运行中想要重新计时或喂狗，应调用 xTimerReset()。
        例如“一段时间屏幕无点击就息屏”：创建一个单次定时器，每次点击时调用 xTimerReset()，超时回调中息屏。
  - **与硬件定时器的区别**
    - 硬件定时器可设置的精度更好，软件定时器最小只能到设定的时间片大小，如设置为1ms，最小只能到1ms。
  - **定时器任务的大小**
    - **任务大小计算**
      ![[99-附件/FreeRTOS/2docevr59gfooim6h8cj599357.png]]
    - **定时器队列大小计算**
      ![[99-附件/FreeRTOS/7ulae6oouh1umqenmodcv6tv56.png]]
    - **定时器结构大小**
      ![[99-附件/FreeRTOS/72e6ebcvposj836na2562klceb.png]]
- **中断管理**
  - **FromISR API 系列**
  - taskYIELD_FROM_ISR 的作用（中断退出时触发任务切换）
    - **标准用法**
        void UART_RX_ISR(void)
        {
            BaseType_t xHigherPriorityTaskWoken = pdFALSE;
            uint8_t rxByte = UART->DR;
            xTaskNotifyFromISR(
                xUartHandlerTask,
                rxByte,
                eSetValueWithOverwrite,
                &xHigherPriorityTaskWoken
            );
            /* ISR 退出时若有必要则触发 PendSV 切换 */
            portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
        }
      - portYIELD_FROM_ISR的本质，通过触发pendsv进行切换
        #define portYIELD()                                     \
            {                                                   \
                /* Set a PendSV to request a context switch. */ \
                portNVIC_INT_CTRL_REG = portNVIC_PENDSVSET_BIT; \
                                                                \
                /* Barriers are normally not required but do ensure the code is completely \
                 * within the specified behaviour for the architecture. */ \
                __dsb( portSY_FULL_READ_WRITE );                           \
                __isb( portSY_FULL_READ_WRITE );                           \
            }
- **资源管理与同步**
  - **临界区（关中断 vs 挂起调度器）**
  - **互斥锁保护共享资源**
- **调试与性能分析**
  - **快速判断使用栈的最大深度**
    - **裸机和rtos下都可以使用：**
      填充法（Stack Painting / Watermark）
      这是最经典、简单且准确的方法，适用于裸机和任何 RTOS。
      步骤：
      初始化时填充：在系统启动或任务创建前，将整个栈内存区域填充为一个固定的模式值，例如 0xAA 或 0xCD（不要用 0x00 或 0xFF，因为容易被误判）。
      运行系统：让程序或任务运行足够长的时间，覆盖各种可能的执行路径（特别是最深调用链和最大中断嵌套）。
      检查栈使用量：从栈的最低地址（栈底）开始，向上扫描，找到第一个不再是填充模式值的字节。该位置到栈顶（最高地址）的距离即为已使用的栈深度。
      若栈向下增长（常见于 ARM、x86），栈底是高地址，栈顶是低地址。扫描从低地址（栈顶）向高地址进行，直到遇到填充值。
      最大使用深度 = 栈底地址 - 第一个未改变字节的地址。
      优点：无需额外硬件，结果精确。
      缺点：需要预留填充时间，且填充值可能被正常数据偶然写为相同值（概率极低，但可用多字节模式降低风险）。
    - rtos下使用：开启调试对应的宏，使用uxTaskGetStackHighWaterMark()获取使用历史最深栈的那一刻还有多少剩余量
  - **栈内容变化的原因**
    - **栈内容变化的原因**
      栈内容的变化本质上是由于函数调用、中断处理以及局部变量的生命周期引起的。具体包括：
      函数调用与返回
      每次函数调用都会在栈上压入返回地址、帧指针（如有）以及被调用者保存的寄存器。函数返回时弹出这些内容，导致栈内容动态变化。
      局部变量分配
      函数内部的非静态局部变量通常分配在栈上。变量的创建和销毁（进入/离开作用域）会改变栈内容。
      参数传递
      当参数较多或类型特殊时，部分参数通过栈传递，占用栈空间。
      中断服务程序（ISR）
      中断发生时，CPU 自动压入部分寄存器（如程序计数器、状态寄存器），ISR 中使用的局部变量和进一步调用的函数也会使用栈。如果中断嵌套，栈使用深度会累加。
      上下文切换（RTOS 中）
      任务切换时，当前任务的上下文（寄存器、栈指针等）被保存到任务自己的栈中，恢复另一个任务的上下文时从另一栈弹出，导致各任务栈内容动态变化。
## 为什么要用RTOS，与裸机的区别？
- **1.实时性：可以控制每个任务运行的时间**
  - **如何实现实时性？**
    - **调度策略**
      - **抢占式调度**
        - **带时间片**
          - 优先级高的任务可以直接打断低优先级的任务，同时同优先级的任务（没有更高优先级打断的情况下）按时间片的长度进行执行，确保同优先级的任务能获得相对均等的执行时间。时间片可通过宏开启
            #define configUSE_TIME_SLICING                     1
        - **不带时间片**
          - 高优先级的任务可以直接打断低优先级的任务进行执行，由于没有时间片，同优先级的任务可能不一定能获得相对均等的执行时间，可能出现同优先级下一个任务占据所有的执行时间
      - **协作式调度**
        - 高优先级的任务不能抢占低优先级的任务，只能等低优先级的任务执行完释放cpu才能执行。由于它对优先级的响应不及时，所以一般不选择协作式调度。可通过宏配置，
          #define configUSE_PREEMPTION                      1，
          默认是开启抢占式调度
- **2.进行多任务开发时难度降低**
## 面试RTOS相关题目
- **介绍对rtos的理解，裸机多任务和rtos多任务的区别**
  - **自我评价：答得一般⚠️**
  - **正确回答：**
    - 定义：rtos是带任务调度、时间管理和任务通信机制的操作系统内核（如FreeRTOS），核心价值是“确定性 + 多任务并发”。
    - **裸机多任务 vs rtos多任务的区别：**
      - 任务调度方式：裸机是“伪多任务”（前后台系统，主循环+中断，靠状态机/标志位手动切换）；rtos由内核按优先级抢占式调度
      - 时间确定性：裸机任务响应时间依赖主循环周期，不可控；rtos通过优先级抢占保证关键任务在确定时间内被调度
      - 任务通信：裸机只能靠全局变量（有原子性风险）；rtos提供队列/信号量/事件组
      - **引入新风险：死锁、优先级反转、栈溢出、任务间耦合**
    - **rtos相对于裸机的优势：**
      - **1.实时性。**
        通过抢占任务优先级以及时间片轮转时间等的合理设置可以实现高实时性，让高优先级的任务可以实现优先运行，且每个任务的执行时间都能得到保证。
      - **2.提高多任务项目的开发效率。**
        多任务的项目中经常会设计到数据竞争的问题，对于裸机来说需要使用加锁，关中断等方式才能避免数据的撕裂，
        同时对于并行多任务执行，还需要复杂的调度机制，来确保每个任务都能有对应的执行时间，同时还要根据任务的优先级来制定执行顺序。
        那这些开发的内容在rtos中都帮你做好了，所以开发者需要关注每个任务要执行什么内容，以及任务间的通信就好了，减少了很多代码量。
    - 当然裸机的优势就是省内存，当项目资源比较紧张时，那就不得不使用裸机了。
- **rtos实时性如何保证？**
  - 怎么确保每次时间一样？若是4ms周期任务需要花费10ms会发生什么？
    - **使用定时器任务或者使用xtaskdelayuntil。**
      若有高优先级任务，该任务会导致被打断，
      若是该任务就是最高优先级任务，那么就无法让出cpu，别的任务得不到执行
    - **完善补充：**
      - 核心结论：单次耗时（10ms）超过周期（4ms）→ 周期漂移、错过下一周期，实时性失效
        - **定时原理：xTaskDelayUntil是绝对延时，**
          下次唤醒时刻 = 上次计划唤醒 + 周期，
          按0/4/8/12ms固定刻度唤醒，不累积误差
        - 出错过程：任务0ms开始执行第1轮（prev=0），4ms/8ms唤醒点被错过；
          10ms执行完调vTaskDelayUntil(prev=0,4)→目标4ms已过→立即返回不阻塞，
          任务无缝进入第2轮（10~20ms），12ms/16ms唤醒点同样被错过
        - xTaskDelayUntil行为：目标唤醒时刻已过 → 立即返回不阻塞 → 形成忙循环，几乎不停歇
        - 后果①错过唤醒点：周期失效，采样/控制频率从250Hz跌到100Hz
        - 后果②周期漂移：vTaskDelay相对延时每轮“跑10ms+睡4ms”，
          实际周期变14ms且累积偏移
        - **后果③占死CPU：其他任务饿死**
          （呼应原始回答：最高优先级任务无法让出cpu）
        - **本质：不可调度**
          实时性=任务必须在周期（deadline）内完成；
          CPU利用率=执行时间/周期=10ms/4ms=250%>100%，
          结构性失败，不是偶尔超时
      - 正确解法：拆分任务，用状态机分段执行，保证每个周期内占用时间 < 周期时间
      - xTaskDelayUntil（绝对延时，下一次唤醒=上次+周期，不累积漂移，适合固定周期任务）
        vs
        vTaskDelay（相对延时，睡眠固定时长，会累积误差）
  - **除了设置高优先级外还有什么方法？**
    - 非常重要的任务就设置高优先级中断，中断比任何任务的优先级都要高，靠中断可以保证最快的响应。
      如foc控制，高频的且需快速进行响应就需要使用中断实现
    - **完善补充：**
      - **配置tick时钟节拍频率，决定时间精度**
      - **高优先级任务必须短小、非阻塞（避免长延时、阻塞式IO）**
      - **临界区/调度锁尽量短，降低关中断时间和中断延迟**
      - **避免在任务里malloc（耗时不确定）**
      - **中断里只做快速处理（置标志/给信号量），重活放任务；**
        响应时间 = 硬件中断延迟 + 上下文切换时间
- **rtos多任务通信**
  - **常用通信方式**
    - **回答：决策树**
  - **普通量跟二值信号量的区别**
    - **自我评价：答得不好 ⚠️**
    - **正确回答：**
      - **1.等待机制（这也是最大的区别）**
        普通量想要读到标志只能不断的通过轮询读，这是十分占用cpu的，但是二值信号量有阻塞机制，
        在没有等到信号量时会被放进阻塞列表里，不影响cpu，
        当接收到信号量时，由于有xTasksWaitingToSend和xTasksWaitingToReceive的双向链表机制，可以准确进行快速唤醒
      - **2.原子性与临界保护**
        变量的读写改并不是一条指令。
        不同变量若有中断和高优先级的任务访问的情况下，可能在执行到一半时被打断，造成数据错误，
        所以普通变量在这种情况下需要注意使用关中断或者加锁的方式进行保护。
        二值信号量自带临界保护，它的操作是在临界区内执行的，操作是线程安全的
      - **3.中断同步的效率（isr场景下）**
        普通变量：在 ISR 中置 1 后，任务不知道何时去读，除非任务一直轮询（这极不推荐，会卡死低优先级任务）。
        二值信号量：在ISR 中调用xSemaphoreGiveFromISR() 并传入 pxHigherPriorityTaskWoken，
        RTOS 能在中断退出时直接切换上下文，立即执行等待该信号量的高优先级任务，
        中断响应和任务处理无缝衔接。
      - **4.功能语义与承载信息：**
        二值信号量是bool类型的，只能传递0和1。
        普通变量可以传递不同的数值，代表不同的含义
      - **5.内存与系统开销：**
        普通量的内存开销极小。
        二值信号量开销较大，需要几十字节的ram
      - **6.经典的“优先级反转”风险**
        - 定义：低优先级任务占着共享资源，导致高优先级任务被阻塞在它后面，中优先级任务趁机抢占，系统实时性劣化
        - 解决：优先级继承 / 优先级天花板；二值信号量本身不防反转，需使用互斥量
      - **补充：二值信号量 vs 互斥量（mutex）**
        - 互斥量有所有权（谁拿谁释放），支持优先级继承，适合互斥保护共享资源
        - **二值信号量用于同步（生产者/消费者通知），没有所有权**
      - 补充：任务通信更常用队列（Queue），能携带数据；信号量只传状态不传内容
## 侵入式链表
