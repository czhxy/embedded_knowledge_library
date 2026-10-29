---
tags: []
created: 2026-10-29
updated: 2026-10-29
---

# BLE

> 本笔记由 XMind 导图自动转换，图片已提取至 `99-附件/无线BLE/`。
> 原导图见 `90-旧XMind导图/无线BLE/BLE.xmind`。

## 蓝牙分为经典蓝牙（BR/EDR）和低功耗蓝牙（BLE）两大类；本导图讨论的 BLE（Bluetooth Low Energy）即低功耗蓝牙
## MAC 地址（Media Access Control Address）
- 定义：中文叫媒体访问控制地址，也常被称为物理地址或硬件地址，是网卡、Wi-Fi 芯片等网络接口在数据链路层的标识。
  示例：
  00:1A:2B:3C:4D:5E
  或 00-1A-2B-3C-4D-5E
  前 3 个字节为厂商编号（OUI），后 3 个字节由厂商分配给具体设备。
- 作用：同一局域网内，交换机根据 MAC 地址转发数据帧。例如电脑向同一 Wi-Fi 下的另一台设备发送数据时，底层需要知道对端的 MAC 地址。
- **和 IP 地址的区别：**
  MAC 地址：链路层地址，通常和网卡绑定，用于局域网内部识别设备。
  IP 地址：网络层逻辑地址，用于跨网络路由，可以变化。
  跨网通信时 IP 地址通常不变，但每经过一个路由器，源/目的 MAC 地址会被重写。
  是否唯一：设计上 MAC 地址应全球唯一，但可以通过软件修改或伪造（MAC 地址欺骗）；手机连 Wi-Fi 时也常用随机 MAC 地址保护隐私。
- **和 BLE 设备地址（BD_ADDR）的区别：**
  上面是以太网 / Wi-Fi 的 MAC 地址。BLE 使用「蓝牙设备地址」（Device Address，俗称 BD_ADDR），同样是 48 位：
  高 24 位为公司标识（类似 OUI，由 IEEE 分配），低 24 位为设备标识。
  分为 Public（公共）和 Random（随机）两大类：
  Public：公司标识由 IEEE 分配，设备地址出厂固化、永久不变；
  Random：由设备自行生成，又分 Static（静态随机）与 Private（私有，含 Resolvable 可解析 / Non-resolvable 不可解析）。
  用于隐私保护的主要是 Resolvable Private Address（RPA）：定时轮换，只有持有 IRK 的已配对设备才能解析识别。
## 协议栈
- **BLE 单模协议栈框图**
  自上而下：APP 应用 → Host 主机（GAP、GATT、ATT、SMP、L2CAP）→ HCI → Controller 控制器（LL 链路层、LE PHY 物理层）
  ![[99-附件/无线BLE/4t4d4kt1lnvsq8cg0crb03fmi6.png]]
  - **BLE 协议栈分层细节**
    Application 应用层；Host 主机（GATT / GAP / ATT / SMP / L2CAP）；
    Host Controller Interface（HCI，图中虚线为分界）；
    Controller 控制器（Link Layer 链路层、Physical Layer 物理层）
    ![[99-附件/无线BLE/7cp9djace1t3kt3vbn6t91bnoc.png]]
- **控制器 Controller**
  协议栈由 Host（主机）和 Controller（控制器）两部分组成，HCI 是二者之间的接口。
  Controller 包含：
  1）PHY（Physical）：物理层，负责频段、信道、调制/解调、速率、包格式与收发时序
  2）LL（Link Layer）：链路层，负责广播、扫描、发起连接、连接事件、跳频、重传、加密控制等
  - **PHY 物理层**
    - 职责：负责频段、信道、调制/解调、符号率/数据率、包格式与收发时序
    - **1. 频段与信道**
      BLE 工作在 2.4 GHz ISM 频段。
      共 40 个 RF 信道，信道间隔 2 MHz，中心频率 = 2402 + 2 × k MHz（k = 0 ~ 39）。
      广播信道 3 个：
      37：2402 MHz
      38：2426 MHz
      39：2480 MHz
      数据信道 37 个：0 ~ 36
      广播信道用于设备发现和连接建立；数据信道用于连接后的通信与跳频。
    - **2. 调制方式**
      所有 LE PHY 均使用 GFSK：
      BT（带宽时间积）= 0.5
      调制指数 h ≈ 0.5（容差约 0.45 ~ 0.55）
      抗干扰能力较好，适合低功耗场景。
    - **3. BLE PHY 类型**
      - LE 1M：GFSK，1 Msym/s，1 Mbps，基础 PHY，兼容性最好
      - LE 2M：GFSK，2 Msym/s，2 Mbps，速率更高、功耗略高
      - LE Coded S=2：GFSK + FEC，1 Msym/s，500 kbps，距离更远、抗干扰更强
      - LE Coded S=8：GFSK + FEC，1 Msym/s，125 kbps，距离最远、速率最低
      - 说明：LE Coded PHY 通过前向纠错（FEC）提高接收灵敏度，适合远距离、低速率场景。
    - **4. PHY 更新**
      连接建立后，Central 或 Peripheral 均可发起 PHY 切换，通过 LL 控制流程完成：
      LL_PHY_REQ
      LL_PHY_RSP
      LL_PHY_UPDATE_IND
      例如从 LE 1M 切到 LE 2M 提高吞吐，或切到 LE Coded 提高距离。
  - **LL 链路层**
    - **1. 主要职责**
      广播、扫描、发起连接
      维护连接事件
      跳频和信道图管理
      数据包确认与重传
      流控和加密控制
      连接参数更新
      PHY 切换、Data Length 扩展、功率控制等
    - **2. LL 状态机**
      传统 BLE LL 主要有 5 个状态：
      （1）Standby：待机
      （2）Advertising：广播态
      （3）Scanning：扫描态
      （4）Initiating：发起态
      （5）Connection：连接态
      - Central：中心设备，发起连接
      - Peripheral：外围设备，接受连接
      Bluetooth 5.1 新增：
      Synchronization：周期广播同步（Periodic Advertising Sync）
      Bluetooth 5.2 新增：
      Isochronous Broadcasting：同步广播态
      Isochronous Receiving：同步接收态
      - **连接态：**
        在连接态中，设备有两种角色：中心设备（Central，旧称主机/主设备 Master）与外围设备（Peripheral，旧称从机/从设备 Slave）。
        Central 只能从 Initiating 态进入连接态，向对端发起连接请求，并且必须定期（连接间隔）向 Peripheral 发送报文（连接事件）；Peripheral 只能从 Advertising 态进入连接态。
        Peripheral 不能主动发起数据发送（类似 USB），只能在响应 Central 的报文时发送自己的数据。
        每隔一个连接间隔，Central 在数据信道发送连接事件的第一个包；Peripheral 收到后如需发送数据，应在 150 μs（T_IFS，帧间间隔）内应答。也就是说，每个连接事件至少包含 Central 发送的一个包，Peripheral 可以不发送包。
    - 3. 广播、扫描、发起（Advertising / Scanning / Initiating）
      - **传统广播 PDU：**
        ADV_IND：可连接、可扫描
        ADV_DIRECT_IND：定向可连接
        ADV_NONCONN_IND：不可连接、不可扫描
        ADV_SCAN_IND：可扫描、不可连接
        SCAN_REQ / SCAN_RSP：主动扫描请求 / 响应
        CONNECT_IND：连接请求
      - **扩展广播 PDU（Bluetooth 5.0+）：**
        ADV_EXT_IND
        AUX_ADV_IND
        AUX_SCAN_REQ / AUX_SCAN_RSP
        AUX_CONNECT_REQ / AUX_CONNECT_RSP
        周期性广播：AUX_SYNC_IND
      - **扫描与广播间隔：**
        广播间隔：通常 20 ms ~ 10.24 s（单位 0.625 ms）
        扫描方式：
        被动扫描（Passive Scanning）：只接收广播包
        主动扫描（Active Scanning）：发送 SCAN_REQ 请求 SCAN_RSP 补充数据
    - **4. 连接与连接事件**
      - 建立连接：Central 发送 CONNECT_IND（传统广播）或 AUX_CONNECT_REQ（扩展广播）后，双方进入连接态。
      - **关键连接参数**
        - ConnInterval（连接间隔）：7.5 ms ~ 4 s，单位 1.25 ms
        - Slave Latency（从设备延迟）：0 ~ 499 个连接事件
        - Supervision Timeout（监督超时）：100 ms ~ 32 s，单位 10 ms
        - Data Length（LL 数据长度）：传统最大 27 字节；Data Length Extension 后最大 251 字节
      - **连接事件流程：**
        Central 在锚点（anchor point）发送第一个包。
        Peripheral 在对应数据信道监听并回复。
        每个数据 PDU 使用 SN/NESN 做确认和重传。
        MD 位表示是否还有更多数据。
        一个连接事件可以传输多个包。
    - **5. 数据信道 PDU**
      连接态主要有两类 PDU：
      LL Data PDU：承载 L2CAP 数据
      LL Control PDU：控制流程（如参数更新、加密、PHY 切换）
      LL PDU 头中常见字段：
      LLID：区分数据开始 / 继续或控制
      SN：发送序号
      NESN：下一个期望序号
      MD：更多数据
      Length：payload 长度
    - **6. 常见 LL 控制 PDU**
      LL_CONNECTION_UPDATE_IND：连接参数更新
      LL_CHANNEL_MAP_IND：信道图更新
      LL_ENC_REQ / RSP、LL_START_ENC_REQ / RSP：加密启动
      LL_FEATURE_REQ / RSP：特性交换
      LL_VERSION_IND：版本交换
      LL_LENGTH_REQ / RSP：数据长度扩展
      LL_PHY_REQ / RSP / LL_PHY_UPDATE_IND：PHY 更新
      LL_TERMINATE_IND：断开连接
      LL_POWER_CONTROL_REQ / RSP：功率控制
      LL_CTE_REQ / RSP：测向相关
      LL_CIS_* / LL_BIS_*：ISO 同步连接 / 广播
- **HCI**
  - HCI（Host Controller Interface，主机控制器接口）
    位置：介于 Controller（控制器）和 Host（主机）之间，是二者之间的桥梁接口。
    HCI 既不属于 Controller，也不属于 Host，而是二者的分界/接口层。
    - 1. 逻辑位置：夹在 Controller 与 Host 之间
      向下：与 Controller 的 LL 交互
      向上：与 Host 的 L2CAP 交互
      2. 作用：定义命令、事件、数据包的格式，实现 Host ↔ Controller 双向通信
      Host 通过 HCI 命令控制 Controller：开启广播、建立连接、参数配置
      Controller 通过 HCI 事件上报 Host：连接成功、断开、状态变化
      通过 ACL 数据包传输业务数据
      3. 物理载体：HCI 只是逻辑接口；物理传输介质可以是 UART、USB、SDIO（也支持三线 UART）
    - **两种硬件形态：**
      1. Host、Controller 分属两个芯片（比如电脑蓝牙适配器）：HCI 走 UART/USB 物理总线；
      2. 单芯片 SoC（ESP32 / N32 这类 BLE 单片机）：Host 和 Controller 都跑在同一块芯片内部，HCI 是软件内部接口，外部看不到硬件总线。
- **主机 Host：**
  1）L2CAP（Logical Link Control and Adaptation Protocol）：逻辑链路控制与适配协议
  L2CAP 位于 Host 内，向上为上层协议提供数据封装与复用，向下通过 HCI 与 Controller 交互，使上层无需关心控制器细节。
  2）ATT（Attribute Protocol）：属性协议
  ATT 定义了属性实体的概念，包括 UUID、句柄和属性值，规定了属性的读、写、通知、指示等操作方法和细节。
  3）GATT（Generic Attribute Profile）：通用属性配置文件
  两个设备应用数据的通信通过 GATT 层实现。GATT 分为 GATT 服务器和 GATT 客户端：服务器为客户端提供数据服务，客户端向服务器读写应用数据。
  4）SMP（Security Manager Protocol）：安全管理协议
  SMP 提供配对和密钥分发服务，实现安全连接和数据交换。
  5）GAP（Generic Access Profile）：通用访问规范
  - BLE Host 主机包含的层：L2CAP 数据封装、SMP 安全管理、ATT 属性协议、GATT 通用属性规范、GAP 通用访问规范
    ![[99-附件/无线BLE/1oeq1r77maah4objqjiogdlqrh.png]]
  - **L2CAP**
    逻辑链路控制与适配协议：提供数据封装、复用与分段/重组；向上承载 ATT / SMP，向下通过 HCI ACL 与 Controller 交互
  - **SMP**
    安全管理协议：负责配对、密钥分发与加密流程（LE Legacy Pairing / LE Secure Connections）
  - **ATT**
    - ATT 定义了一种称为属性（Attribute）的基本数据结构，以及基于服务器/客户端架构的数据访问方式。
      数据以属性的形式存储在服务器上，等待客户端访问。
      - **属性这一数据结构一般由以下四部分构成：**
        句柄（Handle）
        类型（Type，UUID）
        值（Value）
        访问权限（Permissions）
        在协议栈实现中，属性一般放在称为属性表（Attribute Table）的结构体数组中管理。属性在表中的索引就是句柄，通常为 16 位无符号整型（0x0000 ~ 0xFFFF）。
        属性的类型由 UUID 表示，分为 16 位、32 位与 128 位三类。16 位 UUID 由蓝牙技术联盟（Bluetooth SIG）统一定义，可在其公开的 Assigned Numbers 文件中查询；32 位 UUID 同样属于 SIG 管理范围但较少使用；厂商自定义应使用 128 位 UUID。
  - **GATT**
    管的是连上后怎么读写数据
    - **GATT 在 ATT 的基础上，定义了以下概念：**
      规范（Profile）
      服务（Service）
      特征（Characteristic）
      描述符（Descriptor）
      - 服务、特征和描述符都是以属性为基本数据结构的复合结构。一个特征通常由两个以上属性描述，包括：
        特征声明属性（Characteristic Declaration Attribute）
        特征值属性（Characteristic Value Attribute）
        以及可选的描述符（如 CCCD 0x2902）
    - **GATT 中的层次关系**
      ![[99-附件/无线BLE/2m6pinbm8d2utu3673l7kkh80q.png]]
      - 一个 Profile 就像一份产品说明书，包含多个 Service（功能模块，如“心率监测”）；每个 Service 又包含多个 Characteristic（具体数据点，如“心率值”）；每个 Characteristic 可通过 Descriptor 做额外配置（如“开启心率数据推送”）。所有这些最终都以 Attribute 的形式存储，并通过唯一的 UUID 标识。
  - **GAP 层：定义设备的连接行为**
    管的是设备如何连接上
    - GAP 全称通用访问规范（Generic Access Profile），定义了低功耗蓝牙设备之间的连接行为以及设备在连接中所扮演的角色。
      GAP 定义了 4 种角色（见下一节点）。设备在不同阶段的状态/模式：
      Idle（空闲）
      - 无角色，处于就绪状态（Standby）
      Device Discovery（设备发现）
      - Advertising（广播）
      - Scanning（扫描）
      - Initiating（发起连接）
      Connection（连接）
      - Peripheral（外围设备）
      - Central（中央设备）
    - **GAP 的 4 种角色：**
      Broadcaster（广播者）：只发广播，不接受连接
      Observer（观察者）：只扫描广播，不发起连接
      Peripheral（外围设备）：广播 + 接受连接（连接后旧称从机 Slave）
      Central（中央设备）：扫描 + 发起连接（连接后旧称主机 Master）
    - 广播者向外广播的数据中包含设备地址等信息，用于表明自身存在，并告知其他设备是否可以连接。扫描者持续接收环境中的广播数据包。
      若扫描者发现一个可连接的广播者并希望建立连接，可切换为连接发起者（Initiator）。当连接发起者再次收到该广播者的广播数据时，会立即发送连接请求（CONNECT_IND）。
      在广播者未开启白名单（Filter Accept List，旧称 White List），或连接发起者在白名单中时，连接成功建立。
      进入连接后：原广播者转变为外围设备（Peripheral，旧称从设备 Slave），原扫描者/连接发起者转变为中央设备（Central，旧称主设备 Master）。
    - **GAP 角色转换**
      ![[99-附件/无线BLE/1e8beg1jn68aop7eg5gmrm4sbv.png]]
## UUID
- **是什么？**
  - 1、UUID 是用于标识 GATT 属性类型的全局唯一标识，作用类似键名。
    2、16 位短 UUID 是完整 128 位 UUID 的简写：0x2A00 → 00002A00-0000-1000-8000-00805F9B34FB
    3、官方查询位置：SIG Assigned Numbers 页面（GATT Services、GATT Characteristics、GATT Descriptors、GATT Appearance 四张分表）
    4、本地查询位置：NimBLE 的 services/*/include，例如 ble_svc_gap.h:34-36
    5、自定义特征不能占用 16 位编号，必须使用自己生成的 128 位 UUID
- **核心层级**
  - 属性 attribute = (handle, type = UUID, value)
                     ↑门牌号   ↑键(类型)      ↑值
    - **handle 说明“在哪个位置”（唯一，用来寻址）**
    - UUID 说明“这是什么属性”（同一个 UUID 可以出现多处）
    - **value 是实际数据**
  - eg：Service 声明        0x2800  value={0x1800}
     └─ Characteristic 声明  0x2803  value={权限, value_handle, UUID=0x2A00}
         └─ Characteristic 值  0x2A00  value="NimBLE_Beacon"
             └─ Descriptor      0x2902 / 0x2901 …
## 蓝牙地址
- **蓝牙设备地址分类**
  Public（公共）与 Random（随机）；
  Random 又分 Static（静态）与 Private（私有），
  Private 再分 Resolvable（可解析）与 Non-resolvable（不可解析）
  ![[99-附件/无线BLE/2rs2rob7bveibj0k4fbbi5nlqd.png]]
- **各地址类型对比**
  Public：公司标识由 IEEE 分配、地址出厂固化，永久不变；隐私差、易被追踪
  Static：上电时随机生成，在一次上电周期内保持不变（重新上电后可变化）
  Resolvable（RPA）：定时轮换，靠 IRK 识别，主流隐私方案
  Non-resolvable：定时轮换，无密钥可识别，完全匿名
  ![[99-附件/无线BLE/1cshikk0dv2d3v79m2g3n90d8o.png]]
## BLE链路层数据包组成
- **1. 包结构总览（两类信道通用）**
  - **完整格式：**
    前导码 Preamble → 访问地址 Access Address → PDU（Header + Payload）→ [MIC] → CRC
    各段长度：
    前导码 1 / 2 / 10 B（随 PHY 变化）
    访问地址 4 B
    PDU 头 2 B + 载荷 0~251 B
    MIC 4 B（仅加密连接存在）
    CRC 3 B
  - 广播包示例（ADV_IND，未加密，AdvData 31 B）：
    1 + 4 + 2 + (6 + 31) + 3 = 47 B
  - **两类信道的差异：**
    AA：广播信道固定 0x8E89BED6；数据信道由 CONNECT_IND 分配随机 32 位
    PDU 头：广播用 4 bit PDU Type；数据用 LLID / SN / NESN / MD / CP
    Payload：广播是 AdvA + 广播数据；数据是 L2CAP 分片或 LL 控制命令
  - **位序与字节序：**
    所有字段均 LSB 先发（最低位先发、低字节先发）
    空中顺序 = Preamble → AA → Header → Payload → [MIC] → CRC
  - **长度边界：**
    广播 PDU payload 最大 37 B（AdvA 6 + AdvData 31）
    数据 PDU payload 传统最大 27 B，DLE 后最大 251 B
    MIC 4 B 计入 Length 字段，CRC 不计入
- **2. 前导码 Preamble**
  - 作用：让接收机完成位同步和 AGC 收敛，确定从哪一位开始采样
  - **LE 1M：1 字节，交替比特**
    AA 最低位 = 1 → 01010101（0x55）
    AA 最低位 = 0 → 10101010（0xAA）
    广播 AA 0x8E89BED6 的最低位为 0，所以广播包前导码是 0xAA
  - **LE 2M：2 字节（16 bit 交替）**
    第 1 字节规则同 LE 1M，第 2 字节重复同一模式：0x55 55 或 0xAA AA
  - LE Coded：10 字节 = 80 symbol（80 µs）
    固定模式 00111100（0x3C）重复 10 次
    前导码本身不做 FEC 编码，因此三种 PHY 都能先靠它检测到包
  - 注意：前导码不属于 PDU，不参与 CRC；接收端只拿它做同步和增益调整
- **3. 访问地址 Access Address（4 Byte）**
  - 作用：区分“这个包是不是发给我的”；接收机用它做相关检测，不匹配直接丢弃
  - 广播信道：固定 0x8E89BED6，所有设备都用它，所以任何 BLE 设备都能收到广播包。
    数据信道：连接建立时由 CONNECT_IND 分配一个随机 32 位值，主从双方各自保存。规范对它有约束（不能等于广播地址、不能有超过 24 个连续相同位、与 AA 最多 6 个比特不同等），目的是降低误同步概率。
    接收机在数据信道上用本地保存的 AA 做相关检测，不匹配直接丢弃 —— 这是 BLE 在 2.4G 拥挤频段里能共存的基础。
  - 广播 AA 在包中的位置：紧接前导码之后，4 字节按 LSB 先发（0x8E89BED6 在空中先出现 0xD6）
- **4. 广播信道 PDU**
  - 作用：承载广播信息；由 2 字节头 + 载荷组成，头里的字段决定这个包是什么、多长、怎么应答
  - **广播 PDU 头（2 Byte）**
    字节 0（按 bit 编号）：
    bit 0~3  PDU Type：广播信道 PDU 类型，如 ADV_IND
    bit 4    RFU：保留位，填 0
    bit 5    ChSel：支持 LE 信道选择算法 #2 时为 1
    bit 6    TxAdd：发送方地址类型，0 = Public，1 = Random
    bit 7    RxAdd：接收方地址类型，0 = Public，1 = Random
    字节 1：
    bit 0~7  Length：Payload 长度（不含 2 字节头）
    ![[99-附件/无线BLE/1s5pj37i780vnp9gva5uulvs9q.png]]
    - **PDU Type 取值（传统广播）**
      0x00 ADV_IND：可连接、可扫描
      0x01 ADV_DIRECT_IND：定向可连接
      0x02 ADV_NONCONN_IND：不可连接、不可扫描
      0x03 ADV_SCAN_IND：可扫描、不可连接
      0x04 SCAN_REQ：扫描请求
      0x05 SCAN_RSP：扫描响应
      0x06 CONNECT_IND：连接请求
      0x07 ADV_EXT_IND：扩展广播（AUX_ADV_IND 同用此类型）
      其余取值见附图
      ![[99-附件/无线BLE/46t7e9nu3937hu4hmon13fdirr.png]]
  - **Payload 结构随 PDU Type 变化**
    - ADV_IND / ADV_NONCONN_IND / ADV_SCAN_IND：
      AdvA（6 B）+ AdvData（0~31 B）
    - **ADV_DIRECT_IND：**
      AdvA（6 B）+ TargetA（6 B），共 12 B
    - **SCAN_REQ：**
      ScanA（6 B）+ AdvA（6 B），共 12 B
    - **SCAN_RSP：**
      AdvA（6 B）+ ScanRspData（0~31 B）
    - **CONNECT_IND：**
      InitA（6 B）+ AdvA（6 B）+ LLData（22 B），共 34 B
      LLData 字段拆解：
      AA（4）访问地址
      CRCInit（3）CRC 初值
      WinSize（1）发送窗口大小
      WinOffset（2）发送窗口偏移
      Interval（2）连接间隔
      Latency（2）从设备延迟
      Timeout（2）监督超时
      ChM（5）信道图
      Hop / SCA（1）跳频增量 5 bit + 时钟精度 3 bit
    - ADV_EXT_IND / AUX_ADV_IND（Bluetooth 5.0+）：
      扩展头（2~255 B）+ AdvData（0~254 B）
      可用 AUX_CHAIN_IND 链式继续扩展
  - **PDU Payload 包含：**
    AdvA（6 bytes）：广播设备自身的蓝牙地址
    AdvData（0~31 bytes）：广播数据，由若干 AD Structure 组成
    传统广播的 PDU payload 最大 37 B = AdvA 6 + AdvData 31；
    AdvData 不够用时，主动扫描的扫描方可再拿一个 SCAN_RSP（同样最多 31 B），合计 62 B。
    Bluetooth 5.0 扩展广播的 AdvData 可超过 31 B（扩展头 + 最多 254 B，并可用 AUX_CHAIN_IND 链式扩展）。
    ![[99-附件/无线BLE/6tis5radrcvmjeikokf2icb2ad.png]]
    - **AdvA（6 bytes）**
      广播设备地址；TxAdd 位指示它是 Public 还是 Random 地址
    - **AdvData（广播数据）**
      由多个 AD Structure 组成，每个结构为：
      1 字节长度（Length）+ 1 字节 AD Type + AD Data
      Length 只统计 AD Type + AD Data，不含自身这 1 字节
      ![[99-附件/无线BLE/4eg4n5cfbh1qihue9povttljjj.png]]
      - **AD Type 常见类型：**
        Complete Local Name（BT_DATA_NAME_COMPLETE）：完整设备名，手机扫描时显示的名字
        Shortened Local Name（BT_DATA_NAME_SHORTENED）：简化的设备名
        URI（BT_DATA_URI）：广播网址等 URI
        Service UUID：服务的全局唯一标识，帮助扫描方判断设备是否值得连接
        Manufacturer Specific Data（BT_DATA_MANUFACTURER_DATA）：厂商自定义数据，iBeacon 使用它
        Flags：1 字节（8 bit）标志位，指示设备是否可发现/可连接、是否支持 BR/EDR 等
        ![[99-附件/无线BLE/6djg07l8km8fjgto33o2bk4uic.png]]
        - **example**
          ![[99-附件/无线BLE/5h7eeu283rte3cqng6j6dlh4r2.png]]
      - **常见 AD Type 编号**
        ![[99-附件/无线BLE/0pft5vobqd1ehj8nu01gm0d7fv.png]]
      - **AD长度示例**
        ![[99-附件/无线BLE/2dma8odqqtlpbd72hlelr2kacj.png]]
- **5. 数据信道 PDU**
  - **三类 PDU：**
    LL Data PDU：LLID = 10（起始/完整）或 01（续段），承载 L2CAP 数据
    LL Control PDU：LLID = 11，承载链路层控制流程
    空包：LLID = 01 且 Length = 0，仅用于确认（ACK），没有载荷
  - **数据 PDU 头（2 Byte）**
    字节 0（按 bit 编号）：
    bit 0~1  LLID：01 = LL 续段或空包，10 = LL 起始/完整 L2CAP 包，11 = LL Control，00 = RFU
    bit 2    NESN：期望对方发的下一个序号，用于 ACK/重传
    bit 3    SN：本包序号，每发一个新包翻转一次
    bit 4    MD：More Data，还有后续数据
    bit 5    CP：CTE Present，包内是否含恒定音调扩展（5.1 测向）
    bit 6~7  RFU：保留，填 0
    字节 1：
    bit 0~7  Length：Payload 长度（加密时包含 4 字节 MIC）
  - **LL Data PDU：**
    Header（2 B）+ Payload（0~251 B）+ [MIC 4 B] + CRC（3 B）
    Length 上限：
    传统（无 DLE）最大 27 B；加密时含 MIC，有效数据 23 B
    DLE 后最大 251 B；加密时有效数据 247 B
  - **LL Control PDU：**
    Header（2 B，LLID = 11）+ Opcode（1 B）+ CtrData（0~26 B）
    Length 最大 27 B
    Opcode 对应 LL_CONNECTION_UPDATE_IND、LL_ENC_REQ、LL_FEATURE_REQ 等（见 LL 链路层第 6 项）
  - **SN / NESN / MD 的作用：**
    SN 每发一个新包翻转一次；NESN 表示期望对方下一个包的 SN，收包正确时维持，失败时翻转以请求重传
    MD = 1 表示本设备还有数据要发，避免连接事件被提前结束
- **6. MIC（消息完整性校验，仅加密时存在）**
  - 4 字节，由 AES-CCM 计算，位于 Payload 之后、CRC 之前
  - Length 字段包含 MIC：加密后实际可承载的业务数据减少 4 字节（27 → 23，251 → 247）
  - 接收端 MIC 校验失败 → 丢弃该包，不回复 ACK，由发送端重传
- **7. CRC（循环冗余校验，3 Byte）**
  - 24 位校验，多项式：x^24 + x^10 + x^9 + x^6 + x^4 + x^3 + x + 1（实现值 0x00065B）
  - **初值（CRCInit）：**
    广播信道固定 0x555555
    数据信道由 CONNECT_IND 的 CRCInit 字段指定（3 字节随机值）
  - 覆盖范围：PDU 的 Header + Payload（加密时包含 MIC）；不含前导码和访问地址
  - 发送顺序 LSB 先行；接收端 CRC 校验失败 → 丢包、不 ACK，发送端在后续连接事件重传
- **8. 速记与易错点**
  - 顺序：前导码 → 访问地址 → PDU（头 + 载荷）→ [MIC] → CRC
  - Length 只表示 Payload：不含 2 字节头，不含 CRC；加密时含 4 字节 MIC
  - 广播 Payload 最大 37 B（AdvA 6 + AdvData 31），不是 31 B；31 B 只是 AdvData 的上限
  - 前导码长度随 PHY 变化：LE 1M = 1 B，LE 2M = 2 B，LE Coded = 10 B
  - MIC 在 Payload 之后、CRC 之前，CRC 覆盖到 MIC
## 几种连接拓扑图
- **广播拓扑示例**
  一个设备 P 充当 Broadcaster 向外广播，多个设备 C 充当 Observer 接收，双方不建立连接
  ![[99-附件/无线BLE/30g5gn769vht6n7fhmri6a0a98.png]]
- **连接拓扑示例**
  一个中央设备 C 可同时连接多个外围设备 P，每条连接相互独立、各有自己的连接事件
  ![[99-附件/无线BLE/7nbp9c6l24i7vv0n64hh4smqmu.png]]
- **多角色拓扑示例**
  同一设备同时充当 Central 和 Peripheral（图中 P|C）：一侧作为外围设备被连接，另一侧作为中心设备去连接别人
  ![[99-附件/无线BLE/5ir3ool7oscrbjqi7h5qb4gbsb.png]]
- **多角色拓扑的应用场景**
  智能中枢（如智能音箱，P|C）同时被手机 / 平板连接（作 Peripheral），又去连接灯泡、温控器、传感器等（作 Central）
  ![[99-附件/无线BLE/3qg9nlmu9fjkksdgtdsamu5hap.png]]
