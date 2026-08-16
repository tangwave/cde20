/**
 * 生产工艺 · 质量控制 深度扩充数据
 * ------------------------------------------------------------------
 * 为 MANUFACTURE_KB 的每个品种条目补充结构化深度字段：
 *   · cpp            关键工艺参数（CQA 的来源，工艺控制核心）
 *   · cqa            关键质量属性（产品放行/工艺确认的核心属性）
 *   · process_control 中控策略（生产过程中/工序间的控制点）
 *   · reg_cat        关联注册分类（与"按注册分类"体系打通）
 *   · gmp            适用 GMP 附录 / 关键规范
 *   · qc_note        重点控制项"为什么控"解读（深化 QC 要点表）
 *
 * 本文件在 manufacture-kb.js 之后加载；加载即把上述字段合并进对应 ENTRIES 对象。
 * 渲染由 app.js（药品分类·产品镜头详情）与 manufacture-kb.js（生产工艺门户详情）共用。
 */

globalThis.MF_DETAIL = {
  /* ===================== 化学药 · 原料药 ===================== */
  'chem-api-synth': {
    reg_cat: ['化学药 1 类（创新药）原料药', '化学药 2 类（改良型）原料药', '化学药 3 类（仿制）原料药', '化学药 4/5 类（原料+制剂）'],
    gmp: ['《药品生产质量管理规范（2010年修订）》原料药附录', 'ICH Q7 原料药 GMP', 'ICH Q11 原料药开发生产'],
    cqa: [
      { a: '有关物质（单杂/总杂）', target: '单杂≤0.10%~0.5%，总杂≤0.5%~2.0%', method: 'HPLC 自身对照/面积归一', why: '直接反映工艺杂质与降解杂质水平，是安全性与批间一致性的核心。' },
      { a: '晶型 / 多晶型', target: '与目标晶型一致', method: 'XRPD/DSC/IR', why: '不同晶型溶解度、溶出与稳定性差异显著，影响体内疗效。' },
      { a: '粒度分布 PSD', target: 'D10/D50/D90 符合工艺要求', method: '激光衍射', why: '影响制剂可压性、溶出与含量均匀度，需验证。' },
      { a: '残留元素 / 基因毒杂质', target: '符合 ICH Q3D / M7', method: 'ICP-MS / LC-MS', why: '金属催化剂残留与基因毒杂质风险高，须按 PDE/TTC 控制。' }
    ],
    cpp: [
      { p: '反应温度 / 时间', range: '按路线验证（如 0~80℃，数小时）', why: '决定反应速率、副反应与杂质生成。' },
      { p: '结晶溶剂比例与降温速率', range: '小试确认后锁定', why: '控制晶型、纯度与晶习。' },
      { p: '终点控制（中控）', range: 'TLC/HPLC 主峰≥规定', why: '防止反应不完全导致杂质累积。' }
    ],
    process_control: [
      { stage: '化学反应', check: '反应进度', method: 'HPLC/TLC 中控', limit: '主成分≥90% 或副产≤限' },
      { stage: '成盐/精制', check: '金属催化剂残留', method: 'ICP-MS', limit: 'Pd 等≤Q3D PDE' },
      { stage: '干燥', check: '残留溶剂/水分', method: 'GC 顶空/费休', limit: '符合 Q3C / 内控' },
      { stage: '粉碎过筛', check: '粒度 D50', method: '激光衍射', limit: '目标范围±10%' }
    ],
    qc_note: [
      { t: '基因毒杂质', why: '即使痕量也有致癌风险，须按 ICH M7 用灵敏方法（LC-MS/MS）定量，并按 TTC 设限度。' },
      { t: '晶型 / 多晶型', why: '申报时需明确目标晶型并全程控制，避免生产中转晶导致溶出与生物利用度漂移。' },
      { t: '元素杂质', why: '主要来自催化剂与设备，应按 ICH Q3D 做风险评估与内控，而非仅终产品检测。' }
    ]
  },
  'chem-api-ferment': {
    reg_cat: ['化学药 3 类（发酵半合成仿制）', '化学药 1/2 类（半合成创新/改良）'],
    gmp: ['《药品生产质量管理规范（2010年修订）》原料药附录', '生化药品相关 GMP 附录', 'ICH Q7 / Q11'],
    cqa: [
      { a: '效价 / 含量', target: '符合各论', method: 'HPLC/微生物法', why: '发酵效价波动大，是收率与一致性的直接体现。' },
      { a: '热原 / 细菌内毒素', target: '注射级符合规定', method: 'LAL/家兔法', why: '发酵来源易带内毒素，注射级须严控。' },
      { a: '有关物质', target: '发酵副产物+化学杂质均符合', method: 'HPLC', why: '发酵代谢物复杂，需同时控制两类杂质。' },
      { a: '残留溶剂 / 重金属', target: '符合 Q3C/Q3D', method: 'GC/ICP-MS', why: '萃取剂、树脂与设备带来残留风险。' }
    ],
    cpp: [
      { p: '发酵 DO / pH / 温度', range: '在线控制（DO 20~40%，pH 6.8~7.4）', why: '决定菌体活力、代谢与产物表达。' },
      { p: '补料速率', range: '按糖/氮消耗模型', why: '防止底物抑制与染菌，提高效价。' },
      { p: '染菌监控', range: '每班镜检+无菌', why: '染菌导致整批报废，须前置防控。' }
    ],
    process_control: [
      { stage: '发酵', check: 'OD600/效价', method: '在线+取样 HPLC', limit: '效价达平台期放行' },
      { stage: '预处理', check: '菌体去除率', method: '镜检/浊度', limit: '澄清度达标' },
      { stage: '提取', check: '转移率', method: 'HPLC 计算', limit: '≥验证范围' },
      { stage: '精制', check: '内毒素', method: 'LAL', limit: '≤注射级限值' }
    ],
    qc_note: [
      { t: '热原 / 细菌内毒素', why: '发酵与下游纯化易引入内毒素，注射级每批必检，超标整批报废。' },
      { t: '染菌风险', why: '发酵周期长、营养丰富的环境极易染菌，须以无菌操作+在线监测前置防控。' }
    ]
  },

  /* ===================== 化学药 · 固体制剂 ===================== */
  'chemo-solid-tablet': {
    reg_cat: ['化学药 1~5 类口服固体制剂', '注册分类不区分剂型，按品种路径'],
    gmp: ['《药品生产质量管理规范》口服固体制剂', 'ICH Q8 制剂开发', 'ICH Q6A 规格'],
    cqa: [
      { a: '含量均匀度', target: 'AV≤15.0（低剂量）', method: 'HPLC 单剂', why: '低剂量品种含量波动直接关系疗效与安全。' },
      { a: '溶出度', target: '符合各论 Q 限度', method: '桨/篮法+HPLC', why: '体外溶出是体内生物利用度的关键替代指标。' },
      { a: '含量', target: '90.0%~110.0% 标示量', method: 'HPLC/UV', why: '主药量准确是基本有效性属性。' },
      { a: '有关物质', target: '降解杂质符合', method: 'HPLC', why: '湿法制粒/包衣受热湿，须控降解。' }
    ],
    cpp: [
      { p: '混合均匀度', range: 'RSD≤5%（低剂量更严）', why: '决定含量均匀度，低剂量关键。' },
      { p: '压片压力 / 片重', range: '硬度 5~10 kgf，片重±5%', why: '影响硬度、脆碎与溶出。' },
      { p: '制粒水分', range: '2%~5%', why: '影响流动性、compressibility 与溶出。' }
    ],
    process_control: [
      { stage: '混合', check: '混合均匀度', method: '取样 HPLC', limit: 'RSD≤验证值' },
      { stage: '压片', check: '片重/硬度', method: '在线称重+硬度仪', limit: '±5%/内控' },
      { stage: '包衣', check: '包衣增重/衣膜', method: '称重/视觉', limit: '±偏差内' },
      { stage: '中间产品', check: '含量/有关物质', method: 'HPLC', limit: '符合中间体标准' }
    ],
    qc_note: [
      { t: '含量均匀度', why: '主药比例低或粉体混合不均时极易超标，需在工艺开发阶段用 DoE 确定混合参数。' },
      { t: '溶出度', why: '不仅是 QC 项目，更是工艺变更（处方、压片力）可比性的核心桥接指标。' }
    ]
  },
  'chemo-solid-capsule': {
    reg_cat: ['化学药 1~5 类硬胶囊剂'],
    gmp: ['《药品生产质量管理规范》口服固体制剂', 'ICH Q6A'],
    cqa: [
      { a: '装量差异', target: '平均装量±7.5%/±10%', method: '称重', why: '内容物流动性决定装量，是胶囊核心属性。' },
      { a: '水分平衡', target: '内容物与囊壳水分内控', method: '费休', why: '囊壳与内容物水分迁移致脆碎/粘连。' },
      { a: '溶出度', target: '符合各论 Q', method: '桨/篮法', why: '同片剂，体内释放替代指标。' },
      { a: '崩解时限', target: '≤30 min', method: '崩解仪', why: '影响释放，肠溶/缓释另有专规。' }
    ],
    cpp: [
      { p: '充填精度', range: '装量 RSD≤3%', why: '直接决定装量差异与含量。' },
      { p: '环境湿度', range: 'RH 45%~55%', why: '控制囊壳脆碎与内容物吸湿。' },
      { p: '内容物流动性', range: '休止角≤40°', why: '流动性差致装量不稳。' }
    ],
    process_control: [
      { stage: '充填', check: '装量', method: '在线称重剔除', limit: '±限度' },
      { stage: '环境', check: 'RH/温度', method: '温湿度记录', limit: 'RH≤55%' },
      { stage: '抛光', check: '外观/损伤', method: '目视', limit: '无破损' }
    ],
    qc_note: [
      { t: '水分平衡', why: '明胶囊壳吸湿后变软粘连、失水则脆碎，须平衡内容物与囊壳水分并控贮运湿度。' }
    ]
  },
  'chemo-solid-granule': {
    reg_cat: ['化学药 颗粒剂', '中药配方颗粒（按中药注册路径）'],
    gmp: ['《药品生产质量管理规范》口服固体制剂', '中药配方颗粒技术要求'],
    cqa: [
      { a: '溶化性', target: '全部溶化、无焦屑', method: '目视', why: '直接关系服用体验与均匀性。' },
      { a: '水分', target: '≤限度（防结块）', method: '费休/干燥失重', why: '吸潮明显，影响稳定性与微生物。' },
      { a: '装量差异', target: '符合限度', method: '称重', why: '分装均匀性。' },
      { a: '含量（指标成分）', target: '90%~110% 标示', method: 'HPLC', why: '中药颗粒还看指标成分转移率。' }
    ],
    cpp: [
      { p: '制粒水分', range: '湿法制粒 8%~15%', why: '影响颗粒强度与溶化。' },
      { p: '干燥温度', range: '60~80℃', why: '过热致焦化、成分破坏。' },
      { p: '分装精度', range: '±5%', why: '单剂量准确。' }
    ],
    process_control: [
      { stage: '干燥', check: '水分', method: '在线/费休', limit: '≤限度' },
      { stage: '分装', check: '装量', method: '在线称重', limit: '±限度' },
      { stage: '中药颗粒', check: '指标成分转移率', method: 'HPLC 计算', limit: '≥验证下限' }
    ],
    qc_note: [
      { t: '溶化性', why: '颗粒直接冲服，溶化不全提示制粒过度或成分不溶，须工艺控制。' }
    ]
  },

  /* ===================== 化学药 · 液体制剂 ===================== */
  'chemo-liq-oral': {
    reg_cat: ['化学药 口服溶液剂 / 糖浆剂'],
    gmp: ['《药品生产质量管理规范》', '抑菌效力检查法指导原则'],
    cqa: [
      { a: '防腐剂含量', target: '处方量 90%~110%', method: 'HPLC', why: '防腐剂不足则微生物滋生，过量则安全性风险。' },
      { a: '防腐效力', target: '14/28 天下降≥规定', method: 'USP/EP 抑菌效力', why: '验证有效期内维持抑菌，是液体制剂特有。' },
      { a: 'pH / 渗透压', target: '符合各论', method: 'pH 计/渗透压计', why: '影响稳定性、口感与黏膜刺激。' },
      { a: '微生物限度', target: '符合非无菌液体制剂', method: '平皿法', why: '水基质易被微生物污染。' }
    ],
    cpp: [
      { p: '防腐剂投料量', range: '处方±5%', why: '决定抑菌效力边界。' },
      { p: '配制温度', range: '室温~60℃', why: '过热破坏主药/防腐剂。' },
      { p: '过滤精度', range: '0.45 μm 预滤', why: '去除不溶物与热原。' }
    ],
    process_control: [
      { stage: '配制', check: 'pH/相对密度', method: 'pH 计/密度计', limit: '各论范围' },
      { stage: '中间体', check: '含量/可见异物', method: 'HPLC/灯检', limit: '合格方可灌装' },
      { stage: '灌装', check: '装量', method: '容量法', limit: '±限度' }
    ],
    qc_note: [
      { t: '防腐效力', why: '液体制剂开放使用易污染，须以抑菌效力试验证明整个效期内有效，而非仅测防腐剂含量。' }
    ]
  },
  'chemo-inj-solution': {
    reg_cat: ['化学药 小容量注射剂（含化药 1~5 类无菌水针）'],
    gmp: ['《药品生产质量管理规范》无菌药品附录', '中国药典 注射剂通则'],
    cqa: [
      { a: '无菌', target: '应符合无菌', method: '薄膜过滤法', why: '注射给药，无菌保证水平 SAL≤10⁻⁶ 是底线。' },
      { a: '细菌内毒素', target: '≤各论限值', method: 'LAL', why: '热原致热原反应可致命，须严控。' },
      { a: '不溶性微粒', target: '≥10μm/≥25μm 限度', method: '光阻法', why: '微粒可致血管栓塞与肉芽肿。' },
      { a: '可见异物', target: '不得检出明显异物', method: '灯检', why: '直接关系用药安全与外观。' }
    ],
    cpp: [
      { p: '除菌过滤完整性', range: '起泡点/WBT 合格', why: '过滤是无菌保障关键，每批须完整性测试。' },
      { p: '灭菌 F0', range: '≥8（或验证）', method: '温度-时间曲线', why: '决定无菌保证水平。' },
      { p: '灌封环境', range: 'A/B 级，暴露最短', why: '降低微生物与微粒污染。' }
    ],
    process_control: [
      { stage: '配制', check: 'pH/含量/可见异物', method: '在线 HPL/灯检', limit: '合格' },
      { stage: '除菌过滤', check: '过滤器完整性', method: '起泡点', limit: '≥限值' },
      { stage: '灭菌', check: 'F0/温度曲线', method: '记录仪', limit: 'F0≥8' },
      { stage: '灯检', check: '可见异物', method: '目检/自动', limit: '剔除异品' }
    ],
    qc_note: [
      { t: '无菌', why: '无法终端灭菌者依赖除菌过滤+无菌工艺；须培养基灌装模拟验证并每批做无菌检查。' },
      { t: '不溶性微粒', why: '源于包材、配制与灌装，需从源控制+过滤+灯检多道防线，光阻法逐批检。' }
    ]
  },
  'chemo-inj-freeze': {
    reg_cat: ['化学药 冻干粉针（无菌）'],
    gmp: ['《药品生产质量管理规范》无菌药品附录', '冻干工艺验证'],
    cqa: [
      { a: '残留水分', target: '≤规定（关键 CQA）', method: '费休', why: '水分直接决定复溶与稳定性，热敏药尤甚。' },
      { a: '复溶时间', target: '≤规定（通常≤5 min）', method: '目视计时', why: '临床使用的便利与一致性。' },
      { a: '无菌 / 内毒素', target: '符合', method: '薄膜过滤/LAL', why: '同水针底线要求。' },
      { a: '有关物质', target: '降解杂质限度', method: 'HPLC', why: '冻干/复溶过程可能产生降解。' }
    ],
    cpp: [
      { p: '冻干曲线', range: '预冻-45℃、一次干燥-25℃/0.1mbar、二次干燥+25℃', why: '曲线决定外观、水分与活性。' },
      { p: '制品温度', range: '共熔点以下', why: '超过则塌陷、失活。' },
      { p: '压塞真空', range: '箱内充氮压塞', why: '防回潮与氧化。' }
    ],
    process_control: [
      { stage: '冻干', check: '制品温度/真空', method: '探头+真空计', limit: '按验证曲线' },
      { stage: '全压塞', check: '真空度/密封', method: 'CCIT', limit: '容器完整性合格' },
      { stage: '成品', check: '残留水分', method: '费休', limit: '≤规定' }
    ],
    qc_note: [
      { t: '残留水分', why: '冻干核心 CQA，水分过高加速降解、复溶变差，须以费休逐批测定并关联稳定性。' }
    ]
  },
  'chemo-semi-ointment': {
    reg_cat: ['化学药 软膏剂 / 乳膏剂'],
    gmp: ['《药品生产质量管理规范》', '中国药典 软膏剂/乳膏剂通则'],
    cqa: [
      { a: '粒径分布（乳膏）', target: '内控（影响释放）', method: '激光衍射', why: '乳化粒径决定铺展与释放速率。' },
      { a: '含量均匀度（管装）', target: '管间/管内差值≤限度', method: 'HPLC', why: '半固体灌装不均致剂量偏差。' },
      { a: '黏度 / 流变', target: '符合处方', method: '旋转黏度计', why: '影响铺展、稳定性与外观。' },
      { a: '微生物限度（非无菌）', target: '符合', method: '平皿法', why: '水相乳膏易染菌，眼用须无菌。' }
    ],
    cpp: [
      { p: '乳化转速/时间', range: '按处方（数千 rpm，数 min）', why: '决定粒径与乳化稳定性。' },
      { p: '相温控制', range: '油相/水相 70~80℃', why: '防止成分降解与破乳。' },
      { p: '均质脱气', range: '真空脱气', why: '去除气泡改善灌装。' }
    ],
    process_control: [
      { stage: '乳化', check: '粒径/黏度', method: '激光衍射/黏度计', limit: '内控' },
      { stage: '灌装', check: '装量', method: '称重', limit: '±限度' },
      { stage: '成品', check: '含量均匀度', method: 'HPLC 管上/下', limit: '≤限度' }
    ],
    qc_note: [
      { t: '粒径分布', why: '乳膏为 O/W 或 W/O 体系，粒径影响释放速率与稳定性，工艺变更须重新确认。' }
    ]
  },

  /* ===================== 化学药 · 连续制造 ===================== */
  'chemo-cm': {
    reg_cat: ['化学药 连续制造（原料药/制剂，注册路径依品种）'],
    gmp: ['ICH Q13 连续制造', '《药品生产质量管理规范》', 'ICH Q8~Q12'],
    cqa: [
      { a: '在线 CQA（PAT）', target: '实时监控在控', method: 'NIR/Raman/UV', why: '连续制造以过程数据替代部分终检，CQA 须在线可控。' },
      { a: '物料追溯', target: '全程可追溯', method: '条码/批管理', why: '连续流转下批次界定与混批追踪关键。' },
      { a: '参数漂移', target: '超阈预警纠偏', method: 'SPC', why: '稳态运行中漂移须即时识别。' },
      { a: '杂质累积 / 混批', target: '累积受控、混批均匀', method: 'HPLC/过程分析', why: '连续累积易使杂质富集。' }
    ],
    cpp: [
      { p: '停留时间分布 RTD', range: '验证稳态', why: '决定物料年龄与混批边界。' },
      { p: 'PAT 采样频率', range: '实时/近线', why: '保证 CQA 覆盖。' },
      { p: '过程控制回路', range: '闭环反馈', why: '偏差即时纠偏。' }
    ],
    process_control: [
      { stage: '连续反应', check: '转化率/中控', method: '在线 HPLC/Raman', limit: '在控' },
      { stage: '连续结晶', check: '晶型/粒度', method: '在线 XRPD/FBRM', limit: '目标' },
      { stage: '汇集混批', check: '混批均匀性', method: '取样分析', limit: '均匀' }
    ],
    qc_note: [
      { t: '在线 CQA', why: '连续制造监管接受实时放行（RTR），须以验证过的 PAT 与统计过程控制保障质量，而非仅终产品检验。' }
    ]
  },

  /* ===================== 生物制品 · 单抗 ===================== */
  'bio-mab': {
    reg_cat: ['治疗用生物制品（单抗类，按生物制品注册分类）'],
    gmp: ['《药品生产质量管理规范》生物制品附录', '中国药典 三部', 'ICH Q5 系列', 'CDE 单抗类药学评价指导原则'],
    cqa: [
      { a: '聚集体 / 片段', target: '聚集体≤x%', method: 'SEC-HPLC/CE-SDS', why: '聚集体影响安全性（免疫原性）与活性。' },
      { a: '糖基化（N-糖谱）', target: '各糖型比例在验证范围', method: 'HILIC/UPLC-FLR', why: '糖基化影响活性、PK 与免疫原性。' },
      { a: '电荷异质性', target: '主峰比例范围', method: 'iCIEF/cIEF', why: '电荷变体反映批间一致性。' },
      { a: '残留 HCP / 残留 DNA', target: '≤ppm/pg 级', method: 'ELISA/qPCR', why: '宿主杂质致免疫与原癌风险。' }
    ],
    cpp: [
      { p: '上游 DO/pH/温度/pCO₂', range: 'DO 30~60%，pH 7.0~7.2', why: '决定活率、滴度与糖基化。' },
      { p: '低 pH 病毒灭活', range: 'pH 3.6±0.2，时间≥30 min', why: '灭活包膜病毒的对数值须验证。' },
      { p: '除病毒过滤载量', range: '≤验证载量', why: '过载致病毒穿透。' }
    ],
    process_control: [
      { stage: '上游', check: '活率/滴度/pH', method: '在线+取样', limit: '过程区间' },
      { stage: '亲和层析', check: '洗脱纯度', method: 'HPLC/UPLC', limit: '达标' },
      { stage: '低pH灭活', check: 'pH/时间', method: '在线记录', limit: '验证范围' },
      { stage: 'UF/DF', check: '浓度/电导', method: 'A280/电导', limit: '内控' }
    ],
    qc_note: [
      { t: '聚集体', why: '抗体聚集既降活又增免疫原性，生产中须以 SEC/CE-SDS 监控并控制纯化与冻存条件。' },
      { t: '糖基化', why: '翻译后修饰受培养与纯化影响大，须以糖谱作为批间一致性关键属性并设范围。' }
    ]
  },
  'bio-bsab': {
    reg_cat: ['治疗用生物制品（双抗，生物制品注册分类）'],
    gmp: ['《药品生产质量管理规范》生物制品附录', 'CDE 双特异性抗体类药学评价指导原则'],
    cqa: [
      { a: '正确装配率 / 异源二聚体', target: '≥内控比例', method: 'SEC/CE/亲和', why: '错配产品无活性甚至有害。' },
      { a: '错配体 / 同源二聚体 / 半抗体', target: '各≤限度', method: '多方法定量', why: '特有异质性来源。' },
      { a: '双靶点效价', target: '标示效价±范围', method: '双结合 assay', why: '双特异性功能的核心。' },
      { a: '聚集体 / 电荷异质', target: '限度范围', method: 'SEC/iCIEF', why: '同单抗。' }
    ],
    cpp: [
      { p: '共表达比例', range: '轻重链按设计', why: '决定正确组装比例。' },
      { p: '分离条件', range: '电荷/疏水梯度', why: '分离错配产物。' },
      { p: '上游培养', range: '同单抗', why: '影响表达与质量。' }
    ],
    process_control: [
      { stage: '组装', check: '异源二聚体比例', method: 'CE/SEC', limit: '≥下限' },
      { stage: '精纯', check: '错配体残留', method: '多法', limit: '≤限' },
      { stage: '原液', check: '双效价', method: '双 assay', limit: '±范围' }
    ],
    qc_note: [
      { t: '错配体', why: '双抗特有难点，需专属方法分离定量同源二聚体/半抗体，工艺须优先抑制错配。' }
    ]
  },
  'bio-adc': {
    reg_cat: ['治疗用生物制品（ADC，生物制品注册分类）'],
    gmp: ['《药品生产质量管理规范》生物制品附录（高活性防护 OEB）', 'CDE ADC 药学评价指导原则'],
    cqa: [
      { a: 'DAR（药物抗体比）', target: '均值及分布范围', method: 'HIC/UPLC', why: 'DAR 决定效力与毒性平衡，是 ADC 核心 CQA。' },
      { a: '游离毒素', target: '≤极低安全限度', method: 'LC-MS/HPLC', why: '游离毒素剧毒，脱靶毒性来源。' },
      { a: '未偶联抗体', target: '≤限度', method: 'SEC/HIC', why: '裸抗无效且占剂量。' },
      { a: '脱偶联 / 聚集体', target: '受控范围', method: 'LC-MS/SEC', why: '稳定性与安全性。' }
    ],
    cpp: [
      { p: '偶联摩尔比 / pH / 时间', range: '按处方（如 偶联比 3.5~4.0）', why: '决定 DAR 与均一性。' },
      { p: '偶联物纯化载量', range: '去除游离毒素', why: '纯化决定安全性。' },
      { p: 'OEB 防护', range: '隔离器/密闭线', why: '剧毒物料人员防护。' }
    ],
    process_control: [
      { stage: '偶联', check: 'DAR 分布', method: 'HIC 中控', limit: '目标分布' },
      { stage: '纯化', check: '游离毒素', method: 'LC-MS', limit: '≤安全限' },
      { stage: '灌装', check: 'OEB/密封', method: '密闭操作', limit: '无暴露' }
    ],
    qc_note: [
      { t: 'DAR', why: 'ADC 疗效与毒性随 DAR 变化，须以 HIC 严格控制均值与分布，偶联工艺变更须可比性研究。' },
      { t: '游离毒素', why: '剧毒，纯化与全程封闭操作确保残留低于安全限度，是 ADC 安全底线。' }
    ]
  },
  'bio-recombin': {
    reg_cat: ['治疗用生物制品（重组蛋白，生物制品注册分类）'],
    gmp: ['《药品生产质量管理规范》生物制品附录', '中国药典 三部'],
    cqa: [
      { a: '活性 / 比活', target: '标示比活±范围', method: '效价 assay', why: '重组蛋白以活性为核心，比活反映结构正确。' },
      { a: '聚集体 / 纯度', target: '主峰≥x%，聚集体≤限', method: 'RP-HPLC/SEC', why: '影响安全与效价。' },
      { a: '糖基化（如适用）', target: '范围', method: '糖谱', why: '真核表达需控。' },
      { a: 'HCP / DNA 残留', target: '≤限度', method: 'ELISA/qPCR', why: '宿主杂质。' }
    ],
    cpp: [
      { p: '发酵/培养 DO/pH', range: '依系统', why: '决定表达与活性。' },
      { p: '复性条件（原核）', range: '氧化还原梯度', why: '包涵体正确折叠关键。' },
      { p: '纯化回收', range: '≥验证', why: '成本与一致性。' }
    ],
    process_control: [
      { stage: '收获', check: '效价/纯度', method: 'HPLC', limit: '达标' },
      { stage: '复性', check: '正确折叠比例', method: '圆二/活性', limit: '内控' },
      { stage: '精纯', check: 'HCP/DNA', method: 'ELISA/qPCR', limit: '≤限' }
    ],
    qc_note: [
      { t: '活性/比活', why: '重组蛋白价值在于正确折叠的活性构象，须以功能 assay 确证而不仅看纯度。' }
    ]
  },
  'bio-vaccine': {
    reg_cat: ['预防用生物制品（疫苗，生物制品注册分类）'],
    gmp: ['《药品生产质量管理规范》生物制品（疫苗）附录', '《疫苗管理法》', '中国药典 三部'],
    cqa: [
      { a: '效价（免疫原性/中和抗体）', target: '≥最低要求', method: '动物/体外 assay', why: '疫苗以免疫原性为核心质量属性。' },
      { a: '残留（宿主蛋白/DNA/灭活剂）', target: '≤限度', method: 'ELISA/qPCR', why: '安全相关残留。' },
      { a: '铝含量（铝佐剂）', target: '规定范围', method: '铬天青', why: '佐剂剂量影响应答与安全。' },
      { a: '热稳定性', target: '效价保持', method: '加速/实时稳定性', why: '冷链敏感，须验证。' }
    ],
    cpp: [
      { p: '灭活验证', range: '灭活完全、无返祖', why: '减毒/灭活疫苗安全底线。' },
      { p: '佐剂吸附率', range: '≥验证', why: '决定免疫应答。' },
      { p: '冻干曲线', range: '护抗水分', why: '稳定性。' }
    ],
    process_control: [
      { stage: '抗原', check: '纯度/滴度', method: 'HPLC/效价', limit: '达标' },
      { stage: '灭活', check: '灭活剂残留/灭活验证', method: 'qPCR/动物', limit: '安全' },
      { stage: '配制', check: '佐剂吸附率', method: '铬天青', limit: '≥下限' }
    ],
    qc_note: [
      { t: '效价', why: '疫苗有效性靠免疫原性，效价 assay 是放行核心，批间一致性要求高。' },
      { t: '热稳定性', why: '冷链中断即失效，须以稳定性数据支持运输与贮存条件。' }
    ]
  },
  'bio-cgt': {
    reg_cat: ['细胞治疗 / 基因治疗产品（按生物制品注册分类，多为1类创新）'],
    gmp: ['《药品生产质量管理规范》生物制品（细胞治疗）附录', 'CDE 细胞/基因治疗产品指导原则', '中国药典 三部'],
    cqa: [
      { a: '细胞活率 / 数量', target: '≥下限', method: '流式/计数', why: '个体化产品剂量即疗效基础。' },
      { a: '转导效率', target: '≥范围', method: '流式', why: '基因修饰比例决定效力。' },
      { a: '载体相关杂质（RCL）', target: '阴性', method: '指示细胞', why: '复制型病毒安全风险。' },
      { a: '鉴别（STR/基因）', target: '患者/产品匹配', method: 'STR/qPCR', why: '防止混淆（个体化）。' }
    ],
    cpp: [
      { p: '密闭培养', range: '封闭式自动化', why: '减少开放污染与混淆。' },
      { p: '转导条件', range: 'MOI/时间', why: '决定效率与活性。' },
      { p: '身份核对', range: '双人+条码', why: '个体化防混淆关键。' }
    ],
    process_control: [
      { stage: '采集', check: '供体筛查/身份', method: 'STR/血清学', limit: '匹配' },
      { stage: '扩增', check: '活率/污染', method: '流式/无菌', limit: '≥下限/无菌' },
      { stage: '放行', check: '效力/支原体', method: '功能/培养', limit: '加速放行' }
    ],
    qc_note: [
      { t: '鉴别/身份', why: '自体细胞产品一旦混淆无法挽回，须全流程 STR/条码双重身份核对。' },
      { t: '效期极短', why: '难以终端灭菌、效期以小时计，放行须优先关键无菌/活率项并加速。' }
    ]
  },
  'bio-blood': {
    reg_cat: ['生物制品（血液制品，生物制品注册分类）'],
    gmp: ['《药品生产质量管理规范》生物制品附录', '《血液制品管理条例》', '中国药典 三部'],
    cqa: [
      { a: '病毒灭活验证', target: 'log 降低≥要求', method: '指示病毒挑战', why: '血浆 pooled 风险，多重灭活是安全核心。' },
      { a: 'HBsAg/HIV/HCV', target: '阴性', method: 'ELISA/核酸', why: '原料血浆安全底线。' },
      { a: '蛋白质含量 / 纯度', target: '标示范围', method: '双缩脲/电泳', why: '效价与纯度。' },
      { a: '效价（凝血因子等）', target: '标示效价', method: '凝血 assay', why: '功能属性。' }
    ],
    cpp: [
      { p: '血浆检疫期', range: '检疫合格方可投料', why: '窗口期病原防控。' },
      { p: '低温乙醇参数', range: '温度/pH/乙醇浓度', why: '决定组分分离。' },
      { p: '病毒灭活步骤', range: 'S/D+干热+纳米膜', why: '多重保障。' }
    ],
    process_control: [
      { stage: '投料', check: '检疫/筛查', method: 'ELISA/核酸', limit: '阴性' },
      { stage: '分离', check: '蛋白纯度', method: '电泳', limit: '达标' },
      { stage: '批签发', check: '全项', method: '批签发机构', limit: '合格上市' }
    ],
    qc_note: [
      { t: '病毒灭活验证', why: '血浆来自众多供体 pooled，须以 S/D、干热、纳米膜等多重步骤并验证 log 降低值。' },
      { t: '批签发', why: '血液制品强制逐批批签发，是上市前最后一道官方把关。' }
    ]
  },

  /* ===================== 中药 ===================== */
  'tcm-decoction': {
    reg_cat: ['中药饮片（按中药材/饮片监管，非注册分类，执行炮制规范）'],
    gmp: ['《药品生产质量管理规范》中药制剂附录', '中国药典 四部 炮制通则', '中药材 GAP'],
    cqa: [
      { a: '有毒成分限度（乌头碱/马兜铃酸）', target: '≤毒性限度', method: 'LC-MS/MS', why: '炮制减毒须以毒性成分达标确认。' },
      { a: '水分', target: '≤10%~13%', method: '烘干法', why: '防霉变、虫蛀。' },
      { a: '浸出物', target: '≥下限', method: '溶剂回流', why: '反映有效物质转移。' },
      { a: '二氧化硫残留', target: '≤150 mg/kg', method: '蒸馏-滴定/IC', why: '硫熏带来残留风险。' }
    ],
    cpp: [
      { p: '炮炙火候 / 时间', range: '依品种经验参数', why: '火候决定药性改变与减毒。' },
      { p: '辅料用量（酒/醋/蜜/盐）', range: '处方比例', why: '影响引经与减毒增效。' },
      { p: '干燥温度', range: '依品种', why: '防成分破坏/霉变。' }
    ],
    process_control: [
      { stage: '净制', check: '净度/非药用部位', method: '目视', limit: '无杂质' },
      { stage: '炮炙', check: '性状/颜色', method: '目视', limit: '符合规范' },
      { stage: '成品', check: '毒性成分/水分', method: 'LC-MS/烘干', limit: '≤限' }
    ],
    qc_note: [
      { t: '有毒成分限度', why: '制川乌、制半夏等靠炮制减毒，须以 LC-MS/MS 确认毒性成分降至安全限度，而非仅凭外观。' },
      { t: '二氧化硫残留', why: '硫熏漂白普遍，残留刺激呼吸道，须按 150 mg/kg 控制并鼓励无硫加工。' }
    ]
  },
  'tcm-extract': {
    reg_cat: ['中药提取物（按中药注册路径，配方颗粒提取另有技术要求）'],
    gmp: ['《药品生产质量管理规范》中药制剂附录', '中药配方颗粒（提取）技术要求', 'Q-Marker 指导原则'],
    cqa: [
      { a: '指标成分含量', target: '符合标准', method: 'HPLC', why: '物质基础可控的核心。' },
      { a: '转移率', target: '工艺验证范围', method: '计算', why: '反映工艺效率与批间一致。' },
      { a: '浸膏得率', target: '范围', method: '称重', why: '影响成本与一致性。' },
      { a: '外源污染物', target: '符合药典', method: 'ICP-MS/GC-MS/FLD', why: '农残/重金属/黄曲霉毒素。' }
    ],
    cpp: [
      { p: '提取温度/时间/溶媒倍数', range: '按工艺', why: '决定转移率与成分破坏。' },
      { p: '纯化树脂/溶剂', range: '验证载量', why: '树脂/溶剂残留风险。' },
      { p: '浓缩温度', range: '减压低温', why: '防热敏成分破坏。' }
    ],
    process_control: [
      { stage: '提取', check: '指标成分转移率', method: 'HPLC', limit: '≥下限' },
      { stage: '纯化', check: '树脂残留', method: 'GC', limit: '≤限' },
      { stage: '干膏粉', check: '水分/微生物', method: '费休/平皿', limit: '达标' }
    ],
    qc_note: [
      { t: '转移率', why: '中药提取以指标成分转移率衡量工艺，须验证并持续监控，避免批间物质基础漂移。' },
      { t: '外源污染物', why: '药材种植环节带入农残/重金属/黄曲霉毒素，提取富集后更须严控。' }
    ]
  },
  'tcm-gran': {
    reg_cat: ['中药制剂（颗粒/丸/片，按中药注册分类）'],
    gmp: ['《药品生产质量管理规范》中药制剂附录', '中国药典 中药制剂通则'],
    cqa: [
      { a: '指纹 / 特征图谱', target: '相似性≥0.9', method: 'HPLC/TLC', why: '复方整体质量一致性的核心手段。' },
      { a: '含量（指标成分）', target: '标示范围', method: 'HPLC', why: '主要成分可控。' },
      { a: '水分', target: '≤限度', method: '费休', why: '浸膏黏性强、易吸潮。' },
      { a: '溶化性（颗粒）', target: '全部溶化', method: '目视', why: '服用体验。' }
    ],
    cpp: [
      { p: '浸膏/辅料比', range: '处方', why: '影响制粒与吸潮。' },
      { p: '干燥水分', range: '≤限度', why: '稳定性。' },
      { p: '制粒粒径', range: '内控', why: '流动性与溶化。' }
    ],
    process_control: [
      { stage: '制粒', check: '水分/粒度', method: '费休/筛分', limit: '内控' },
      { stage: '成型', check: '装量/重量差异', method: '称重', limit: '±限度' },
      { stage: '成品', check: '指纹图谱', method: 'HPLC', limit: '≥0.9' }
    ],
    qc_note: [
      { t: '指纹/特征图谱', why: '中药复方成分复杂，单一指标难代表整体，须以图谱相似性控制批间一致性。' }
    ]
  },
  'tcm-inj': {
    reg_cat: ['中药注射剂（按中药注册分类，已严格限制新增）'],
    gmp: ['《药品生产质量管理规范》无菌药品附录', '中药注射剂安全性技术要求'],
    cqa: [
      { a: '高分子物（蛋白/鞣质/树脂）', target: '检查符合', method: '凝聚/沉淀法', why: '是过敏反应主要来源，中药注射剂特有风险。' },
      { a: '无菌 / 热原', target: '符合', method: '薄膜过滤/LAL', why: '注射底线。' },
      { a: '可见异物', target: '符合', method: '灯检', why: '安全。' },
      { a: '有关物质', target: '限度', method: 'HPLC', why: '成分复杂须控。' }
    ],
    cpp: [
      { p: '超滤截留', range: '去大分子杂质', why: '去除致敏高分子。' },
      { p: '除热原', range: '活性炭+过滤', why: '热原控制。' },
      { p: '除菌过滤', range: '0.22 μm', why: '无菌保障。' }
    ],
    process_control: [
      { stage: '精制', check: '高分子物', method: '凝聚法', limit: '符合' },
      { stage: '配液', check: 'pH/渗透压', method: 'pH/渗透压计', limit: '各论' },
      { stage: '灌封/灭菌', check: '无菌/热原', method: '灯检/LAL', limit: '符合' }
    ],
    qc_note: [
      { t: '高分子物', why: '中药注射剂不良反应多与蛋白/鞣质/树脂等高分子有关，须专项检查并严格控制。' }
    ]
  },
  'tcm-ferment': {
    reg_cat: ['发酵类中药（按中药饮片/药材监管，执行发酵法）'],
    gmp: ['《药品生产质量管理规范》中药制剂附录', '中国药典 发酵类药材'],
    cqa: [
      { a: '黄曲霉毒素', target: '严禁超标', method: 'HPLC-FLD/ELISA', why: '发酵环境产毒菌风险，安全底线。' },
      { a: '特征成分（洛伐他汀等）', target: '标示范围', method: 'HPLC', why: '反映发酵转化与活性。' },
      { a: '水分', target: '≤限度', method: '费休', why: '防霉变。' },
      { a: '杂菌控制', target: '限度', method: '培养计数', why: '防杂菌污染。' }
    ],
    cpp: [
      { p: '发酵温湿度/时间', range: '依品种', why: '决定产物谱。' },
      { p: '接种量', range: '验证', why: '抑制杂菌、提高转化。' },
      { p: '菌种纯度', range: '纯种', why: '防产毒杂菌。' }
    ],
    process_control: [
      { stage: '接种', check: '菌种纯度', method: '镜检/培养', limit: '纯种' },
      { stage: '发酵', check: '温湿度/杂菌', method: '记录/计数', limit: '受控' },
      { stage: '成品', check: '黄曲霉毒素', method: 'HPLC-FLD', limit: '符合' }
    ],
    qc_note: [
      { t: '黄曲霉毒素', why: '发酵中药温湿环境易产毒，须以 HPLC-FLD 严控，超标即整批报废。' }
    ]
  },

  /* ===================== 放射性药品 ===================== */
  'radio-syn': {
    reg_cat: ['放射性药品（按放射性药品监管，注册路径依品种）'],
    gmp: ['《药品生产质量管理规范》放射性药品附录', '《放射性药品管理办法》', '中国药典 放射性药品通则'],
    cqa: [
      { a: '放射化学纯度', target: '>90%~95%', method: 'HPLC/TLC（放射性检测）', why: '未反应前体与副产物影响靶组织摄取与安全。' },
      { a: '放射性核纯度', target: '符合（杂质核素限度）', method: 'γ 谱仪/半衰期', why: '杂质核素带来额外辐射剂量。' },
      { a: '比活度 / 放射性浓度', target: '范围', method: '活度计/剂量仪', why: '决定给药剂量与体积。' },
      { a: '无菌 / 内毒素', target: '符合（快速放行）', method: '薄膜过滤/LAL', why: '注射底线，短半衰期下快速放行。' }
    ],
    cpp: [
      { p: '合成时间', range: '尽快（保活度）', why: '半衰期短，时间=活度。' },
      { p: '纯化效率', range: '高回收', why: '减少时间损失。' },
      { p: '分装活度', range: '衰变校正', why: '标示给药时刻活度。' }
    ],
    process_control: [
      { stage: '合成', check: '产率/时间', method: '在线', limit: '保活度' },
      { stage: '纯化', check: '放化纯度', method: '在线 HPLC/TLC', limit: '>90%' },
      { stage: '分装', check: '活度/装量', method: '活度计', limit: '校正值' }
    ],
    qc_note: [
      { t: '放射化学纯度', why: '短半衰期下须在数分钟内完成在线测定并放行，未反应前体竞争靶摄取并增本底。' },
      { t: '无菌/内毒快速放行', why: '无法等无菌培养结果，须在验证的无菌工艺基础上快速放行并留样追溯。' }
    ]
  }
};

/* 加载即合并进 MANUFACTURE_KB.ENTRIES */
(function mergeMfDetail() {
  const D = globalThis.MF_DETAIL;
  const MK = globalThis.MANUFACTURE_KB;
  if (!D || !MK || !MK.ENTRIES) return;
  MK.ENTRIES.forEach(e => {
    const d = D[e.id];
    if (!d) return;
    if (d.cpp) e.cpp = d.cpp;
    if (d.cqa) e.cqa = d.cqa;
    if (d.process_control) e.process_control = d.process_control;
    if (d.reg_cat) e.reg_cat = d.reg_cat;
    if (d.gmp) e.gmp = d.gmp;
    if (d.qc_note) e.qc_note = d.qc_note;
  });
})();
