/**
 * 生产工艺与质控知识库（Manufacturing Process & QC Knowledge Base）
 * ------------------------------------------------------------------
 * 维度：药品类型（化学药 / 生物制品 / 中药 / 放射性药品）
 *       × 剂型 / 细分（原料药、固体制剂、液体制剂、单抗、双抗、ADC…）
 *       × 技术路线（传统炮制、现代提取、生物发酵、化学合成、连续制造、细胞培养、标记合成…）
 * 每条目给出：生产工序（有序步骤）/ 工艺特点 / 质控重点 / 主要依据·指导原则。
 *
 * 挂载方式：纯客户端静态渲染，写入主内容区 #content（与全景/知识框架等门户一致）。
 * 依赖：App（app.js 定义）、App.openPortal（knowledge-portal.js 定义）。
 * 本文件须位于 knowledge-portal.js 之后加载。
 */
(function () {
  'use strict';

  /* ============================== 1) 数据 ============================== */

  // 技术路线筛选条
  const ROUTE_CHIPS = [
    { id: 'synth',      name: '化学合成' },
    { id: 'ferment',    name: '生物发酵/半合成' },
    { id: 'paozhi',     name: '传统炮制' },
    { id: 'modern-ext', name: '现代提取' },
    { id: 'culture',    name: '细胞培养' },
    { id: 'radio-syn',  name: '标记合成' },
    { id: 'cm',         name: '连续制造' },
    { id: 'blood',      name: '血液分离' },
    { id: 'formulation',name: '制剂工艺' }
  ];

  // 分类树（药品类型 → 剂型/细分）
  const CLASSES = [
    {
      id: 'chem', name: '化学药', icon: '💊',
      forms: [
        { id: 'api',        name: '原料药' },
        { id: 'tablet',     name: '片剂' },
        { id: 'capsule',    name: '胶囊剂' },
        { id: 'granule',    name: '颗粒剂' },
        { id: 'oral-liq',   name: '口服液体' },
        { id: 'inj-solution',name: '小容量注射剂' },
        { id: 'inj-freeze', name: '冻干粉针' },
        { id: 'ointment',   name: '软膏/乳膏' },
        { id: 'cm',         name: '连续制造' }
      ]
    },
    {
      id: 'bio', name: '生物制品', icon: '🧬',
      forms: [
        { id: 'mab',     name: '单抗 (mAb)' },
        { id: 'bsab',    name: '双抗 (bsAb)' },
        { id: 'adc',     name: 'ADC' },
        { id: 'recombin',name: '重组蛋白' },
        { id: 'vaccine', name: '疫苗' },
        { id: 'cgt',     name: '细胞与基因治疗' },
        { id: 'blood',   name: '血液制品' }
      ]
    },
    {
      id: 'tcm', name: '中药', icon: '🌿',
      forms: [
        { id: 'decoction',  name: '中药饮片·炮制' },
        { id: 'extract',    name: '现代提取纯化' },
        { id: 'tcm-gran',   name: '颗粒/丸/片' },
        { id: 'tcm-inj',    name: '中药注射剂' },
        { id: 'tcm-ferment',name: '发酵类中药' }
      ]
    },
    {
      id: 'radio', name: '放射性药品', icon: '☢️',
      forms: [
        { id: 'radio-syn', name: '合成/标记/分装' }
      ]
    }
  ];

  // 条目（生产工序 / 工艺特点 / 质控重点 / 主要依据）
  const ENTRIES = [
    /* ---------------------- 化学药 · 原料药 ---------------------- */
    {
      id: 'chem-api-synth', name: '化学原料药（全合成 / 半合成路线）',
      cls: 'chem', forms: ['api'], routes: ['synth'],
      summary: '以多步有机合成为核心，经反应、分离、结晶、干燥得到高纯度活性成分；杂质谱与晶型控制是质量关键。',
      steps: [
        { n: '工艺路线设计与起始物料确立', d: '论证起始物料（ICH Q11），评估变更对杂质与质量属性的影响。' },
        { n: '化学反应', d: '多步合成、保护/脱保护、催化氢化等；控制温度、投料比、反应终点。' },
        { n: '分离与纯化', d: '萃取、结晶、重结晶、柱层析去除工艺杂质与副产物。' },
        { n: '成盐 / 精制', d: '根据需要成盐改善溶解性与稳定性，去除残留金属催化剂。' },
        { n: '干燥', d: '真空干燥或流化床干燥，控制残留溶剂与水分。' },
        { n: '粉碎与过筛', d: '控制粒度分布（PSD）以满足后续制剂需求。' },
        { n: '包装与贮存', d: '防潮/避光包装，明确贮藏条件与有效期。' }
      ],
      features: [
        '路线长、步骤多，工艺杂质与降解杂质谱复杂',
        '晶型/多晶型、粒度显著影响制剂溶出与生物利用度',
        '起始物料与试剂质量决定下游杂质水平',
        '连续制造（CM）与酶催化等绿色工艺是趋势'
      ],
      qc: [
        '鉴别与含量（HPLC/滴定）',
        '有关物质（工艺杂质+降解杂质，ICH Q3A/B）',
        '基因毒杂质（ICH M7，痕量限度）',
        '残留溶剂（ICH Q3C，一类溶剂禁用）',
        '元素杂质（ICH Q3D）',
        '晶型 / 多晶型（XRPD、DSC）',
        '粒度分布 PSD（激光衍射）',
        '水分、重金属、微生物限度（非无菌原料药）'
      ],
      regs: ['《药品生产质量管理规范（2010年修订）》原料药附录', 'ICH Q7 原料药GMP', 'ICH Q11 原料药开发生产', 'ICH Q3A/Q3B 杂质', 'ICH Q3C 残留溶剂', 'ICH Q3D 元素杂质', 'ICH M7 基因毒杂质', 'ICH Q1A 稳定性']
    },
    {
      id: 'chem-api-ferment', name: '化学原料药（微生物发酵 / 半合成）',
      cls: 'chem', forms: ['api'], routes: ['ferment'],
      summary: '以微生物发酵获得中间体，再经化学半合成修饰得到原料药；发酵批次差异与下游提取是难点。',
      steps: [
        { n: '菌种构建与种子扩培', d: '工程菌/高产菌株，逐级扩培保证活力与纯度。' },
        { n: '发酵', d: '补料分批或连续发酵，控制 DO、pH、温度、补料速率。' },
        { n: '发酵液预处理', d: '絮凝、离心或过滤实现固液分离。' },
        { n: '提取', d: '溶剂萃取或大孔树脂吸附富集目标物。' },
        { n: '化学半合成', d: '侧链修饰/保护等化学反应得到API。' },
        { n: '精制与结晶', d: '去除发酵副产物与化学杂质，重结晶纯化。' },
        { n: '干燥与包装', d: '控制水分与残留溶剂，规范包装。' }
      ],
      features: [
        '生物转化与化学修饰相结合，兼顾成本与立体选择性',
        '发酵批次差异大，需加强过程参数与中控',
        '下游提取纯化复杂，溶剂与树脂残留需控制',
        '染菌风险与热原控制是重点'
      ],
      qc: [
        '效价/含量',
        '有关物质（发酵副产物与化学杂质）',
        '残留溶剂',
        '热原/细菌内毒素',
        '重金属与有害元素',
        '晶型与粒度',
        '水分',
        '微生物限度（源头控制）'
      ],
      regs: ['《药品生产质量管理规范（2010年修订）》原料药附录', 'ICH Q7 原料药GMP', '生化药品相关GMP附录', 'ICH Q11 开发生产', '中国药典 二部']
    },

    /* ---------------------- 化学药 · 固体制剂 ---------------------- */
    {
      id: 'chemo-solid-tablet', name: '片剂（湿法制粒 / 直压）',
      cls: 'chem', forms: ['tablet'], routes: ['formulation'],
      summary: '将原辅料经粉碎、混合、制粒、压片、包衣制成片剂；含量均匀度与溶出度是核心质量属性。',
      steps: [
        { n: '原辅料粉碎过筛', d: '控制粒度，保证混合均匀性与压缩成型。' },
        { n: '称量与配料', d: '按处方精确称量，双人复核。' },
        { n: '混合', d: '总混保证含量均匀度（尤其低剂量）。' },
        { n: '制粒', d: '湿法制粒（黏合剂）、干法制粒或粉末直压。' },
        { n: '干燥与整粒', d: '流化床干燥，控制水分，整粒恢复流动性。' },
        { n: '外加辅料混合', d: '加入润滑剂/助流剂（如硬脂酸镁）。' },
        { n: '压片', d: '控制片重、硬度、厚度与脆碎度。' },
        { n: '包衣', d: '薄膜包衣或糖衣，改善稳定性与吞咽性。' },
        { n: '包装', d: '铝塑/瓶装，防潮避光。' }
      ],
      features: [
        '粉体学性质（流动性、压缩性）决定可生产性',
        '含量均匀度对低剂量品种尤为关键',
        '溶出度影响体内生物利用度',
        '工序多、参数多，适合连续制造'
      ],
      qc: [
        '性状、鉴别、含量',
        '含量均匀度',
        '溶出度（关键 CQA）',
        '脆碎度、硬度、重量差异',
        '有关物质',
        '水分、残留溶剂（包衣材料）',
        '微生物限度',
        '元素杂质（如适用）'
      ],
      regs: ['中国药典 制剂通则 片剂', '《药品生产质量管理规范》口服固体制剂', 'ICH Q6A 规格', '溶出度指导原则', 'ICH Q3 系列杂质']
    },
    {
      id: 'chemo-solid-capsule', name: '胶囊剂（硬胶囊）',
      cls: 'chem', forms: ['capsule'], routes: ['formulation'],
      summary: '将物料充填于空心胶囊；内容物流动性与装量差异控制为核心，囊壳水分平衡需关注。',
      steps: [
        { n: '物料预处理', d: '粉碎、过筛保证流动性。' },
        { n: '混合 / 制粒', d: '内容物均匀混合或制粒。' },
        { n: '干燥整粒', d: '控制水分以利于充填。' },
        { n: '胶囊充填', d: '控制装量差异与锁合。' },
        { n: '抛光', d: '去除附着粉末。' },
        { n: '包装', d: '铝塑或瓶装，控制贮存湿度。' }
      ],
      features: [
        '内容物流动性决定装量差异',
        '明胶囊壳与内容物水分迁移需平衡',
        '对吸湿/热敏物料需特殊囊壳或工艺'
      ],
      qc: [
        '装量差异',
        '含量均匀度',
        '溶出度',
        '水分（内容物与囊壳平衡）',
        '崩解时限',
        '有关物质',
        '微生物限度',
        '铬与明胶来源（如适用）'
      ],
      regs: ['中国药典 制剂通则 胶囊剂', '《药品生产质量管理规范》口服固体制剂', 'ICH Q6A 规格']
    },
    {
      id: 'chemo-solid-granule', name: '颗粒剂（含中药颗粒）',
      cls: 'chem', forms: ['granule'], routes: ['formulation'],
      summary: '将药物与辅料制成颗粒供冲服或分装；溶化性与水分控制是关键，中药配方颗粒尤为关注。',
      steps: [
        { n: '物料粉碎', d: '保证细度与混合均匀。' },
        { n: '混合', d: '主药与辅料均匀混合。' },
        { n: '制粒', d: '湿法制粒、一步制粒或干法制粒。' },
        { n: '干燥', d: '控制水分防止结块。' },
        { n: '整粒', d: '过筛保证粒度均一。' },
        { n: '分装', d: '袋装/瓶装定量分装。' },
        { n: '包装', d: '防潮包装。' }
      ],
      features: [
        '可直接冲服或作为中间体',
        '中药颗粒常采用干法/湿法制粒',
        '吸潮明显，水分与包装要求高'
      ],
      qc: [
        '粒度',
        '溶化性',
        '水分',
        '装量差异',
        '含量',
        '微生物限度',
        '农残/重金属（中药颗粒）'
      ],
      regs: ['中国药典 制剂通则 颗粒剂', '中药配方颗粒相关研究技术指导原则', '《药品生产质量管理规范》']
    },

    /* ---------------------- 化学药 · 液体制剂 ---------------------- */
    {
      id: 'chemo-liq-oral', name: '口服溶液 / 糖浆剂',
      cls: 'chem', forms: ['oral-liq'], routes: ['formulation'],
      summary: '将药物溶解/分散于水性介质并矫味；均一性好，但防腐效力与微生物控制是重点。',
      steps: [
        { n: '配制', d: '溶解主药，加入矫味剂、防腐剂、稳定剂。' },
        { n: '过滤', d: '活性炭脱色/除热原，精滤。' },
        { n: '中间体检验', d: 'pH、含量、相对密度等。' },
        { n: '灌装', d: '定量灌装、封口。' },
        { n: '灭菌（必要时）', d: '热敏品种可过滤除菌或无菌灌装。' },
        { n: '包装', d: '避光容器，标签警示。' }
      ],
      features: [
        '体系均一、给药方便',
        '需防腐剂并开展防腐效力试验',
        'pH、渗透压与稳定性密切相关',
        '微生物污染风险需重点防范'
      ],
      qc: [
        '性状、pH',
        '含量',
        '相对密度',
        '微生物限度',
        '防腐剂含量与防腐效力',
        '有关物质',
        '装量'
      ],
      regs: ['中国药典 口服溶液剂/糖浆剂通则', '抑菌效力检查法指导原则', '《药品生产质量管理规范》']
    },
    {
      id: 'chemo-inj-solution', name: '小容量注射剂（无菌水针）',
      cls: 'chem', forms: ['inj-solution'], routes: ['formulation'],
      summary: '在无菌条件下配制、过滤、灌封、灭菌；无菌保证水平（SAL 10⁻⁶）与不溶性微粒是核心。',
      steps: [
        { n: '原辅料称量', d: '注射级原料，严格控制可见异物来源。' },
        { n: '配制', d: '以注射用水为溶剂，调 pH、渗透压。' },
        { n: '活性炭吸附 / 除热原', d: '去除热原与杂质。' },
        { n: '过滤', d: '0.22 μm 除菌过滤（或终端灭菌）。' },
        { n: '灌封', d: '充氮保护、控制暴露时间。' },
        { n: '灭菌', d: '湿热灭菌，确保 F0 达标（SAL 10⁻⁶）。' },
        { n: '灯检', d: '人工/自动检查可见异物。' },
        { n: '包装', d: '贴标、装盒。' }
      ],
      features: [
        '无菌保障水平要求极高',
        '过滤除菌或终端灭菌二选一并验证',
        '不溶性微粒与细菌内毒素严格控制',
        '共线生产需评估交叉污染'
      ],
      qc: [
        '无菌',
        '细菌内毒素/热原',
        '不溶性微粒',
        'pH、含量',
        '有关物质',
        '渗透压摩尔浓度',
        '可见异物',
        '装量'
      ],
      regs: ['《药品生产质量管理规范》无菌药品附录', '中国药典 注射剂通则', '灭菌工艺验证相关指导原则']
    },
    {
      id: 'chemo-inj-freeze', name: '冻干粉针（无菌）',
      cls: 'chem', forms: ['inj-freeze'], routes: ['formulation'],
      summary: '适用于热敏药物；经冻干去除水分以提高稳定性，冻干曲线与残留水分控制是关键。',
      steps: [
        { n: '配制与过滤', d: '同水针，除菌过滤。' },
        { n: '灌装半加塞', d: '定量灌装、半压塞。' },
        { n: '冻干', d: '预冻—一次干燥—二次干燥，控制升温速率与真空。' },
        { n: '全压塞', d: '箱内压塞隔绝空气。' },
        { n: '扎盖', d: '轧盖密封。' },
        { n: '灯检与包装', d: '检查外观与真空度指示。' }
      ],
      features: [
        '热敏药物首选，提高稳定性',
        '冻干周期长，工艺验证复杂',
        '残留水分直接影响复溶与稳定性',
        '需无菌工艺模拟（培养基灌装）'
      ],
      qc: [
        '无菌',
        '细菌内毒素',
        '残留水分',
        '复溶时间',
        '可见异物',
        '含量',
        '有关物质',
        '不溶性微粒'
      ],
      regs: ['《药品生产质量管理规范》无菌药品附录', '冻干工艺验证相关', '中国药典 注射剂通则']
    },
    {
      id: 'chemo-semi-ointment', name: '软膏 / 乳膏剂（半固体）',
      cls: 'chem', forms: ['ointment'], routes: ['formulation'],
      summary: '以基质承载药物，经熔融、乳化、均质制成；乳化体系稳定与粒径控制是重点。',
      steps: [
        { n: '基质制备', d: '熔融或配制油/水相基质。' },
        { n: '加药', d: '溶解、研磨或乳化加入主药。' },
        { n: '均质 / 乳化', d: '高速剪切形成稳定体系。' },
        { n: '脱气', d: '真空脱除气泡。' },
        { n: '灌装', d: ' tube 灌装、封尾。' },
        { n: '包装', d: '避光、控温。' }
      ],
      features: [
        '乳膏为水包油/油包水乳化体系，稳定性关键',
        '粒径与流变学影响铺展与释放',
        '眼用制剂需无菌，其他需微生物限度'
      ],
      qc: [
        '性状、黏度',
        '含量均匀度（管装）',
        '微生物限度（非无菌）/无菌（眼用）',
        '有关物质',
        'pH（乳膏）',
        '粒径分布（乳膏）'
      ],
      regs: ['中国药典 软膏剂/乳膏剂通则', '《药品生产质量管理规范》']
    },

    /* ---------------------- 化学药 · 连续制造 ---------------------- */
    {
      id: 'chemo-cm', name: '化学药连续制造（Continuous Manufacturing）',
      cls: 'chem', forms: ['cm'], routes: ['cm', 'synth'],
      summary: '以流动化学与连续单元操作替代批次生产，配合 PAT 在线监控实现实时放行（RTR），提升一致性与效率。',
      steps: [
        { n: '连续反应', d: '流动化学反应器串联，稳态运行。' },
        { n: '连续结晶 / 分离', d: '连续结晶、过滤、干燥一体化。' },
        { n: '在线 PAT 监控', d: '近红外/拉曼等实时监测 CQA。' },
        { n: '实时放行 RTR', d: '基于过程数据替代部分终产品检验。' },
        { n: '汇集与调配', d: '缓存、混批与制剂衔接。' },
        { n: '包装', d: '连续或在线包装。' }
      ],
      features: [
        '时空收率高、占地小',
        '批间一致性好，参数漂移可即时纠偏',
        'PAT 与过程模型是核心使能技术',
        '监管接受度持续提升（ICH Q13）'
      ],
      qc: [
        '在线 CQA 监测（PAT）',
        '物料全程追溯',
        '参数漂移预警（CPV）',
        '关键属性实时放行',
        '杂质累积与混批控制'
      ],
      regs: ['ICH Q13 连续制造', 'ICH Q8/Q9/Q10/Q11/Q12', '《药品生产质量管理规范》']
    },

    /* ---------------------- 生物制品 · 单抗 ---------------------- */
    {
      id: 'bio-mab', name: '单克隆抗体（CHO 细胞培养 + 下游纯化）',
      cls: 'bio', forms: ['mab'], routes: ['culture'],
      summary: '以 CHO 细胞表达、上下游工艺制得；结构复杂（糖基化、二硫键），病毒安全与批间一致性是核心。',
      steps: [
        { n: '细胞株构建', d: 'GS/CHO-K1 系统等，筛选高表达单克隆。' },
        { n: '细胞库建立', d: 'MCB/WCB，进行鉴定与全面检定（ICH Q5D）。' },
        { n: '上游培养', d: '分批/补料/灌流培养，控制 DO、pH、温度、pCO₂。' },
        { n: '收获与澄清', d: '离心/深层过滤去除细胞与碎片。' },
        { n: '亲和层析', d: 'Protein A 捕获抗体。' },
        { n: '低 pH 病毒灭活', d: '灭活脂包膜病毒。' },
        { n: '精纯', d: '离子交换/疏水层析去除聚集体与杂质。' },
        { n: '除病毒过滤', d: '纳米级过滤去除病毒。' },
        { n: '超滤/换液 UF/DF', d: '浓缩并置换至制剂缓冲液。' },
        { n: '制剂灌装', d: '调 pH/渗透压，除菌过滤灌装。' }
      ],
      features: [
        '结构复杂，翻译后修饰（糖基化）影响活性与PK',
        '批间一致性依赖 CPP 与培养基控制',
        '病毒安全性是重中之重',
        '聚集体、电荷异质性需严格控制'
      ],
      qc: [
        '鉴别（肽图、WCX）',
        '含量（A280/UV）',
        '纯度（聚集体 SEC-HPLC、片段、HCP ELISA）',
        '糖基化（N-糖谱）',
        '电荷异质性（iCIEF/cIEF）',
        '效价（细胞/结合 Assay）',
        '残留宿主细胞蛋白 HCP / DNA',
        '细菌内毒素、无菌、可见异物'
      ],
      regs: ['ICH Q5A 病毒安全性', 'ICH Q5B 遗传稳定性', 'ICH Q5C 质量', 'ICH Q5D 细胞库', 'ICH Q5E 可比性', 'ICH Q6B 生物制品规格', '中国药典 三部', '生物制品批签发', '《药品生产质量管理规范》生物制品附录', 'CDE 单抗类药学评价指导原则']
    },
    {
      id: 'bio-bsab', name: '双特异性抗体（bsAb）',
      cls: 'bio', forms: ['bsab'], routes: ['culture'],
      summary: '同时结合两个靶点的抗体；链错配控制与异源二聚体纯化为特有难点。',
      steps: [
        { n: '分子设计与细胞株', d: 'knob-into-hole、Common Light Chain 等策略减少错配。' },
        { n: '共表达 / 组装', d: '轻重链正确配对表达。' },
        { n: '上游培养', d: '同单抗培养工艺。' },
        { n: '收获澄清', d: '去除细胞与碎片。' },
        { n: '亲和层析', d: 'Protein A 捕获。' },
        { n: '错配 / 异源二聚体分离', d: '利用电荷/疏水差异分离同源二聚体与半抗体。' },
        { n: '精纯', d: '去除聚集体与工艺杂质。' },
        { n: '除病毒 / UFDF / 制剂', d: '同单抗下游与制剂。' }
      ],
      features: [
        '链错配是核心工艺难点',
        '需分离同源二聚体、半抗体等错配产物',
        '表达量常低于单抗',
        '结构异质性更高，表征要求更细'
      ],
      qc: [
        '正确装配率 / 异源二聚体比例',
        '错配体、同源二聚体、半抗体',
        '聚集体（SEC）',
        '电荷异质性',
        '效价（双靶点结合）',
        '糖基化、HCP/DNA、内毒素',
        '无菌、可见异物'
      ],
      regs: ['ICH Q5 系列', 'CDE 双特异性抗体类药学研究与评价技术指导原则', '中国药典 三部', '《药品生产质量管理规范》生物制品附录']
    },
    {
      id: 'bio-adc', name: '抗体药物偶联物（ADC）',
      cls: 'bio', forms: ['adc'], routes: ['culture'],
      summary: '由抗体、连接子与细胞毒素三部分组成；药物抗体比（DAR）均一性与游离毒素控制是特有重点。',
      steps: [
        { n: '抗体生产', d: '同单抗上游/下游工艺。' },
        { n: '连接子-有效载荷合成', d: '小分子毒素与连接子化学合成。' },
        { n: '偶联反应', d: '定点或随机偶联，控制反应条件。' },
        { n: '偶联物纯化', d: '去除游离毒素与未偶联抗体。' },
        { n: '超滤换液', d: '浓缩并置换缓冲液。' },
        { n: '冻干 / 液体制剂', d: '保护偶联物稳定。' },
        { n: '灌装', d: '高活性物料需密闭与防护操作。' }
      ],
      features: [
        '三部分构成，工艺链长',
        'DAR 均一性决定效力与毒性平衡',
        '游离毒素剧毒，需 OEB 防护与封闭操作',
        '异质性高（不同 DAR 组分），稳定性/脱偶联需关注'
      ],
      qc: [
        'DAR（HIC/UPLC）',
        '游离毒素与游离抗体',
        '未偶联抗体比例',
        '连接子完整性与毒素含量/鉴别',
        '聚集体',
        '糖基化、HCP/DNA',
        '内毒素、无菌、可见异物',
        '偶联后效价（结合+内化/杀伤）'
      ],
      regs: ['ICH Q5 系列', 'CDE 抗体药物偶联物药学评价技术指导原则', '《药品生产质量管理规范》生物制品附录', '高活性物料防护（OEB）']
    },
    {
      id: 'bio-recombin', name: '重组蛋白（非抗体）',
      cls: 'bio', forms: ['recombin'], routes: ['culture'],
      summary: '在大肠杆菌、酵母或 CHO 中表达，经纯化制得；原核包涵体复性与真核糖基化是工艺关键。',
      steps: [
        { n: '工程菌 / 细胞构建', d: '选择宿主与表达系统。' },
        { n: '发酵 / 培养', d: '大肠杆菌高密度发酵或真核培养。' },
        { n: '收获', d: '破壁（原核）或离心澄清（真核）。' },
        { n: '变性 / 复性', d: '包涵体需变复性正确折叠（原核）。' },
        { n: '亲和 / 离子层析', d: '标签或性质纯化。' },
        { n: '酶切 / 修饰', d: '切除标签或化学修饰。' },
        { n: '精纯 / UFDF / 制剂', d: '去除杂质并灌装。' }
      ],
      features: [
        '原核表达常需复性与二硫键正确形成',
        '真核表达需关注糖基化与活性',
        '活性中心保护影响比活',
        '宿主蛋白/DNA 残留为主要杂质'
      ],
      qc: [
        '含量',
        '纯度（HPLC/CE）',
        '活性（效价/比活）',
        '聚集体',
        '糖基化（如适用）',
        'HCP/DNA',
        '细菌内毒素',
        '无菌、鉴别（肽图）'
      ],
      regs: ['ICH Q5 系列', '中国药典 三部', '《药品生产质量管理规范》生物制品附录']
    },
    {
      id: 'bio-vaccine', name: '疫苗（重组 / 亚单位 / 病毒载体）',
      cls: 'bio', forms: ['vaccine'], routes: ['culture'],
      summary: '以抗原免疫原性为核心；批间一致性、佐剂与冷链稳定性是重点，病毒载体需病毒安全。',
      steps: [
        { n: '抗原生产', d: '重组表达或病毒培养/灭活。' },
        { n: '纯化抗原', d: '去除宿主与工艺杂质。' },
        { n: '灭活 / 减毒', d: '如适用，确保安全性。' },
        { n: '佐剂配制', d: '铝佐剂等配制与检定。' },
        { n: '配制', d: '抗原与佐剂混合。' },
        { n: '灌装', d: '无菌灌装。' },
        { n: '冻干（如适用）', d: '提高稳定性。' }
      ],
      features: [
        '免疫原性是核心质量属性',
        '批间一致性要求高',
        '佐剂影响免疫应答',
        '冷链与热稳定性敏感'
      ],
      qc: [
        '鉴别',
        '效价（免疫原性/中和抗体）',
        '纯度',
        '残留（宿主蛋白/DNA/灭活剂）',
        '细菌内毒素',
        'pH、铝含量（铝佐剂）',
        '无菌、异常毒性',
        '热稳定性'
      ],
      regs: ['疫苗生产用细胞基质相关', '病毒类疫苗病毒安全', '中国药典 三部 疫苗', '《药品生产质量管理规范》生物制品（疫苗）附录', '《疫苗管理法》']
    },
    {
      id: 'bio-cgt', name: '细胞与基因治疗产品（CGT）',
      cls: 'bio', forms: ['cgt'], routes: ['culture'],
      summary: '以个体化（多为自体）细胞或基因载体为核心；短效期、密闭无菌与全程追溯是显著特征。',
      steps: [
        { n: '起始物料', d: '载体或细胞供体采集与检定。' },
        { n: '载体生产', d: '慢病毒/AAV 制备与纯化（如适用）。' },
        { n: '细胞采集 / 激活', d: '白细胞单采与激活。' },
        { n: '转导 / 转染', d: '导入治疗性基因。' },
        { n: '细胞扩增', d: '密闭系统扩增。' },
        { n: '制剂', d: '冻存或新鲜回输。' },
        { n: '灌装', d: '密闭无菌灌装。' },
        { n: '放行', d: '快速检定以满足效期。' }
      ],
      features: [
        '个体化、自体为主，难以规模化',
        '效期极短，放行时效性强',
        '难以终端灭菌，依赖密闭与无菌操作',
        '起始物料与全程追溯要求极高'
      ],
      qc: [
        '细胞活率/数量',
        '载体滴度/整合',
        '转导效率',
        '无菌、支原体',
        '细菌内毒素',
        '鉴别（STR/基因）',
        '纯度（杂质细胞）',
        '效力 potency、载体相关杂质（如 RCL）'
      ],
      regs: ['CDE 细胞治疗产品研究与评价技术指导原则', 'CDE 基因治疗产品相关指导原则', '《药品生产质量管理规范》生物制品（细胞治疗）附录', '中国药典 三部']
    },
    {
      id: 'bio-blood', name: '血液制品',
      cls: 'bio', forms: ['blood'], routes: ['blood'],
      summary: '以血浆分离制得；多步病毒灭活/去除与原料血浆检疫是安全核心，原料受限。',
      steps: [
        { n: '血浆采集与检疫', d: '供浆者筛查，检疫期管理。' },
        { n: '血浆分离', d: '低温乙醇法（Cohn）分离组分。' },
        { n: '组分纯化', d: '进一步纯化目标蛋白。' },
        { n: '病毒灭活 / 去除', d: 'S/D、干热、纳米膜等多步处理。' },
        { n: '配制', d: '调浓度与稳定剂。' },
        { n: '分装', d: '无菌分装。' },
        { n: '冻干 / 液体', d: '按品种选择。' },
        { n: '批签发', d: '逐批检验放行。' }
      ],
      features: [
        '病毒安全重中之重，多重灭活/去除',
        '原料血浆资源受限、 pooled 风险',
        '多组分综合利用',
        '批签发强制'
      ],
      qc: [
        '蛋白质含量',
        '纯度',
        '病毒灭活验证',
        'HBsAg/HIV/HCV 等',
        '细菌内毒素',
        '无菌',
        '铝/枸橼酸（如适用）',
        '效价（凝血因子等）'
      ],
      regs: ['《血液制品管理条例》', '中国药典 三部 血液制品', '《药品生产质量管理规范》生物制品附录', '生物制品批签发']
    },

    /* ---------------------- 中药 · 饮片炮制 ---------------------- */
    {
      id: 'tcm-decoction', name: '中药饮片·传统炮制',
      cls: 'tcm', forms: ['decoction'], routes: ['paozhi'],
      summary: '通过净制、切制、炮炙改变药性、减毒增效；火候与辅料的经验性控制及有毒成分限度是重点。',
      steps: [
        { n: '净制', d: '挑选、水洗、去非药用部位。' },
        { n: '切制', d: '切片、段、丝、块便于调剂与提取。' },
        { n: '炮炙—炒', d: '清炒、麸炒、砂炒等。' },
        { n: '炮炙—炙', d: '酒炙、醋炙、蜜炙、盐炙等辅料炮制。' },
        { n: '炮炙—煅/蒸煮𬊤', d: '明煅/闷煅、蒸、煮、𬊤法。' },
        { n: '其他炮法', d: '煨、制霜、发芽/发酵、水飞、复制（如半夏）。' },
        { n: '干燥 / 筛分包装', d: '控制水分并分级包装。' }
      ],
      features: [
        '传统经验性强，火候与辅料决定性味改变',
        '减毒增效（如制川乌、制半夏）',
        '成分在炮制中发生转化',
        '批间差异大，标准化挑战'
      ],
      qc: [
        '性状（色泽、气味、形态）',
        '水分、灰分/酸不溶性灰分',
        '浸出物',
        '有毒成分限度（乌头碱、马兜铃酸等）',
        '显微/薄层鉴别',
        '二氧化硫残留（硫熏）',
        '重金属、农残（药材来源）',
        '净度'
      ],
      regs: ['中国药典 四部 炮制通则', '各省中药炮制规范', '《药品生产质量管理规范》中药制剂附录', '中药材生产质量管理规范（GAP）', '中药饮片质量管理相关']
    },
    {
      id: 'tcm-extract', name: '中药·现代提取纯化',
      cls: 'tcm', forms: ['extract'], routes: ['modern-ext'],
      summary: '以水煎煮、醇提、超临界萃取、大孔树脂等现代技术富集有效成分；指标成分转移率与浸膏得率是关键。',
      steps: [
        { n: '药材前处理', d: '净选、浸润、粉碎。' },
        { n: '提取', d: '水煎煮、醇提、渗漉、动态逆流。' },
        { n: '分离', d: '离心、板框压滤。' },
        { n: '纯化', d: '水提醇沉、大孔树脂吸附、超临界 CO₂、膜分离。' },
        { n: '浓缩', d: '减压/薄膜浓缩。' },
        { n: '干燥', d: '喷雾干燥/真空干燥得干膏粉。' }
      ],
      features: [
        '以指标成分转移率衡量工艺效率',
        '浸膏得率需稳定可控',
        '树脂/溶剂残留需控制',
        '热敏成分需保护，Q-Marker 导向'
      ],
      qc: [
        '指标成分含量（HPLC）',
        '转移率',
        '浸膏得率',
        '水分（干膏粉）',
        '重金属、农残、黄曲霉毒素',
        '残留溶剂（乙醇/树脂洗脱剂）',
        '微生物限度',
        '灰分'
      ],
      regs: ['中国药典 制剂通则（提取）', '中药提取物相关管理', '《药品生产质量管理规范》中药制剂附录', '中药配方颗粒（提取）技术要求', '中药质量标志物（Q-Marker）相关指导原则']
    },
    {
      id: 'tcm-gran', name: '中药制剂（颗粒 / 丸 / 片）',
      cls: 'tcm', forms: ['tcm-gran'], routes: ['formulation'],
      summary: '以提取浸膏配合辅料制成制剂；复方量效复杂、浸膏黏性强、吸潮，需全程指纹/特征图谱。',
      steps: [
        { n: '提取浸膏制备', d: '见现代提取工艺。' },
        { n: '浸膏 + 辅料', d: '制粒或丸块制备。' },
        { n: '干燥 / 整粒', d: '控制水分与粒度。' },
        { n: '压片 / 丸制 / 分装', d: '成型并定量。' },
        { n: '包衣（如适用）', d: '薄膜衣片等。' },
        { n: '包装', d: '防潮包装。' }
      ],
      features: [
        '复方量效关系复杂',
        '浸膏黏性强，制粒难度大',
        '易吸潮，稳定性挑战',
        '需指纹/特征图谱全程控制'
      ],
      qc: [
        '含量（指标成分/浸出物）',
        '指纹图谱/特征图谱',
        '水分',
        '溶化性（颗粒）',
        '重量差异/装量',
        '微生物限度',
        '重金属、农残',
        '崩解/溶出（片剂）'
      ],
      regs: ['中国药典 中药制剂通则', '《药品生产质量管理规范》中药制剂附录', '中药新药研究相关技术指导原则']
    },
    {
      id: 'tcm-inj', name: '中药注射剂（高风险）',
      cls: 'tcm', forms: ['tcm-inj'], routes: ['formulation'],
      summary: '成分复杂、安全性风险高；无菌、热原与高分子物质检查是核心，目前已严格受限。',
      steps: [
        { n: '药材前处理', d: '净选、浸润。' },
        { n: '提取', d: '水提/醇提。' },
        { n: '精制', d: '除杂、超滤、树脂纯化。' },
        { n: '配液', d: '等渗/pH 调节。' },
        { n: '活性炭脱热原', d: '去除热原与杂质。' },
        { n: '过滤', d: '0.22 μm 除菌过滤。' },
        { n: '灌封 / 灭菌 / 灯检', d: '无菌保障与外观检查。' }
      ],
      features: [
        '成分复杂、未知物多',
        '过敏/热原风险高，安全性为核心',
        '工艺冗长，已严格限制新增',
        '高分子物质（蛋白/鞣质/树脂）需检查'
      ],
      qc: [
        '无菌',
        '细菌内毒素/热原',
        '可见异物',
        '蛋白质/鞣质/树脂等高分子物检查',
        '炽灼残渣',
        'pH、含量（指标成分）',
        '有关物质',
        '重金属、渗透压'
      ],
      regs: ['中药注射剂研究/生产技术要求', '《药品生产质量管理规范》无菌药品附录', '中药注射剂安全性再评价', '中国药典 注射剂']
    },
    {
      id: 'tcm-ferment', name: '发酵类中药（红曲、六神曲、淡豆豉等）',
      cls: 'tcm', forms: ['tcm-ferment'], routes: ['ferment'],
      summary: '借微生物发酵转化药材成分、改变药性；菌种与发酵条件决定产物，产毒菌与黄曲霉毒素是安全底线。',
      steps: [
        { n: '基质准备', d: '药材/培养基配制。' },
        { n: '接种', d: '接种菌种/曲种。' },
        { n: '控温发酵', d: '控制温湿度与时间。' },
        { n: '干燥', d: '控制水分。' },
        { n: '净制包装', d: '去除杂质并包装。' }
      ],
      features: [
        '微生物转化改变成分与活性',
        '传统发酵经验强',
        '菌种与条件决定产物谱',
        '安全性（产毒菌）必须严控'
      ],
      qc: [
        '性状',
        '水分',
        '微生物限度（发酵来源）',
        '黄曲霉毒素（严禁超标）',
        '特征成分（如洛伐他汀/莫纳可林K）',
        '重金属',
        '杂菌控制'
      ],
      regs: ['中国药典 发酵类药材', '中药炮制规范（发酵法）', '《药品生产质量管理规范》中药制剂附录']
    },

    /* ---------------------- 放射性药品 ---------------------- */
    {
      id: 'radio-syn', name: '放射性药品（合成 / 标记 / 分装）',
      cls: 'radio', forms: ['radio-syn'], routes: ['radio-syn'],
      summary: '半衰期短（如 F-18 约 110 min），需即时合成与快速放行；辐射防护与无菌无热原并行。',
      steps: [
        { n: '靶核制备 / 加速', d: '如 F-18 用 O-18 水经回旋加速产额。' },
        { n: '核反应', d: '获得放射性核素。' },
        { n: '放射性合成', d: '标记反应得到放射性药物。' },
        { n: '纯化', d: '固相萃取/HPLC 纯化。' },
        { n: '快速质量检验', d: '放射化学纯度等即时检测。' },
        { n: '分装', d: '屏蔽分装。' },
        { n: '放行', d: '短半衰期下快速放行。' }
      ],
      features: [
        '半衰期短，时间压力极大',
        '合成与放行需即时完成',
        '辐射防护贯穿全流程',
        '无菌无热原与放射化学质量并重'
      ],
      qc: [
        '放射化学纯度（>90~95%）',
        '放射性核纯度',
        '比活度',
        '放射性浓度',
        '化学纯度',
        'pH',
        '无菌、细菌内毒素',
        '不溶性微粒、稳定性（衰变校正）'
      ],
      regs: ['《放射性药品管理办法》', '《药品生产质量管理规范》放射性药品附录', '中国药典 放射性药品通则', '辐射安全许可相关']
    }
  ];

  /* ============================== 2) 工具 ============================== */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  const FORM_MAP = {};                 // formId -> {clsId, name}
  const CLS_NAME = {};                 // clsId -> name
  CLASSES.forEach(function (cl) {
    CLS_NAME[cl.id] = cl.name;
    cl.forms.forEach(function (f) { FORM_MAP[f.id] = { clsId: cl.id, name: f.name }; });
  });
  function routeName(id) {
    const r = ROUTE_CHIPS.find(function (x) { return x.id === id; });
    return r ? r.name : id;
  }
  function clsIcon(id) {
    const c = CLASSES.find(function (x) { return x.id === id; });
    return c ? c.icon : '📦';
  }

  const mfState = { cls: null, form: null, route: null, q: '', entryId: null };

  function entryMatches(e) {
    if (mfState.cls && e.cls !== mfState.cls) return false;
    if (mfState.form && (e.forms || []).indexOf(mfState.form) === -1) return false;
    if (mfState.route && (e.routes || []).indexOf(mfState.route) === -1) return false;
    if (mfState.q) {
      const hay = (e.name + ' ' + (e.summary || '') + ' ' + (e.routes || []).map(routeName).join(' ')).toLowerCase();
      if (hay.indexOf(mfState.q.toLowerCase()) === -1) return false;
    }
    return true;
  }

  /* ============================== 3) 渲染 ============================== */
  function sidebarHtml() {
    let h = '<div class="mf-side-title">药品类型 · 剂型</div>';
    CLASSES.forEach(function (cl) {
      const clsActive = mfState.cls === cl.id ? ' active' : '';
      h += '<div class="mf-class">';
      h += '<button class="mf-class-name' + clsActive + '" data-mf-class="' + cl.id + '">' +
           '<span class="mf-class-ico">' + cl.icon + '</span>' + esc(cl.name) + '</button>';
      h += '<div class="mf-forms">';
      cl.forms.forEach(function (f) {
        const fActive = mfState.form === f.id ? ' active' : '';
        h += '<button class="mf-form-btn' + fActive + '" data-mf-form="' + f.id + '">' + esc(f.name) + '</button>';
      });
      h += '</div></div>';
    });
    return h;
  }

  function routesHtml() {
    let h = '<div class="mf-routes-label">技术路线</div><div class="mf-routechips-list">';
    ROUTE_CHIPS.forEach(function (r) {
      const act = mfState.route === r.id ? ' active' : '';
      h += '<button class="mf-chip' + act + '" data-mf-route="' + r.id + '">' + esc(r.name) + '</button>';
    });
    h += '</div>';
    return h;
  }

  function listHtml(list) {
    if (!list.length) {
      return '<div class="mf-empty">未找到匹配的条目，试试调整筛选或搜索词。</div>';
    }
    let h = '<div class="mf-list">';
    list.forEach(function (e) {
      const tags = (e.routes || []).map(function (r) {
        return '<span class="mf-tag">' + esc(routeName(r)) + '</span>';
      }).join('');
      h += '<a class="mf-card" data-mf-entry="' + e.id + '">' +
           '<div class="mf-card-h"><span class="mf-card-cls">' + clsIcon(e.cls) + ' ' + esc(CLS_NAME[e.cls]) + '</span>' +
           '<span class="mf-card-name">' + esc(e.name) + '</span></div>' +
           '<div class="mf-card-tags">' + tags + '</div>' +
           '<div class="mf-card-sum">' + esc(e.summary) + '</div>' +
           '</a>';
    });
    h += '</div>';
    return h;
  }

  function detailHtml(e) {
    const steps = (e.steps || []).map(function (s, i) {
      return '<div class="mf-step"><div class="mf-step-no">' + (i + 1) + '</div>' +
             '<div class="mf-step-body"><div class="mf-step-name">' + esc(s.n) + '</div>' +
             '<div class="mf-step-desc">' + esc(s.d) + '</div></div></div>';
    }).join('');
    const feats = (e.features || []).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('');
    const qc = (e.qc || []).map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('');
    const regs = (e.regs || []).map(function (r) { return '<span class="mf-regchip">' + esc(r) + '</span>'; }).join('');
    const tags = (e.routes || []).map(function (r) { return '<span class="mf-tag">' + esc(routeName(r)) + '</span>'; }).join('');
    return '<div class="mf-detail">' +
      '<button class="mf-back" data-mf-back>← 返回列表</button>' +
      '<div class="mf-detail-head">' +
        '<div class="mf-detail-cls">' + clsIcon(e.cls) + ' ' + esc(CLS_NAME[e.cls]) +
          (FORM_MAP[mfState.form] ? ' · ' + esc(FORM_MAP[mfState.form].name) : '') + '</div>' +
        '<h1 class="mf-detail-title">' + esc(e.name) + '</h1>' +
        '<div class="mf-detail-summary">' + esc(e.summary) + '</div>' +
        '<div class="mf-card-tags">' + tags + '</div>' +
      '</div>' +
      '<div class="mf-section"><div class="mf-section-title">🔧 生产工序</div><div class="mf-steps">' + steps + '</div></div>' +
      '<div class="mf-section"><div class="mf-section-title">✨ 工艺特点</div><ul class="mf-feat">' + feats + '</ul></div>' +
      '<div class="mf-section mf-section-qc"><div class="mf-section-title">🔍 质控重点</div><ul class="mf-qc">' + qc + '</ul></div>' +
      '<div class="mf-section"><div class="mf-section-title">📜 主要依据 · 指导原则</div><div class="mf-regs">' + regs + '</div></div>' +
      '</div>';
  }

  let mfContainer = null;

  function paintBody() {
    if (!mfContainer) return;
    const body = mfContainer.querySelector('#mfBody');
    if (!body) return;
    let list = ENTRIES.filter(entryMatches);
    const count = mfContainer.querySelector('#mfCount');
    if (count) {
      const scope = [mfState.cls ? CLS_NAME[mfState.cls] : '全部类型',
                     mfState.form ? FORM_MAP[mfState.form].name : '',
                     mfState.route ? routeName(mfState.route) : '',
                     mfState.q ? '搜索“' + mfState.q + '”' : '']
                    .filter(Boolean).join(' · ');
      count.textContent = '筛选：' + (scope || '全部') + '　|　共 ' + list.length + ' 条';
    }
    body.innerHTML = mfState.entryId
      ? detailHtml(ENTRIES.find(function (e) { return e.id === mfState.entryId; }) || { steps: [], features: [], qc: [], regs: [] })
      : listHtml(list);
    const sc = mfContainer.querySelector('.mf-body');
    if (sc) sc.scrollTop = 0;
  }

  function paintAll() {
    if (!mfContainer) return;
    mfContainer.querySelector('#mfSide').innerHTML = sidebarHtml();
    mfContainer.querySelector('#mfRoutes').innerHTML = routesHtml();
    paintBody();
  }

  function renderManufacture() {
    if (!globalThis.App) return;
    const App = globalThis.App;
    App._exitPortalIfOpen && App._exitPortalIfOpen();
    App.state.view = 'manufacture';

    const b = document.getElementById('breadcrumb');
    if (b) b.innerHTML = '<span class="breadcrumb-item">首页</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-item">生产工艺与质控</span>';
    const st = document.getElementById('stageTabs'); if (st) st.style.display = 'none';
    const mv = document.getElementById('matrixView'); if (mv) mv.style.display = 'none';
    const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
    const c = document.getElementById('content');
    if (!c) return;

    c.innerHTML =
      '<div class="mf">' +
        '<aside class="mf-side" id="mfSide"></aside>' +
        '<section class="mf-main">' +
          '<div class="mf-toolbar">' +
            '<input id="mfSearch" class="mf-search" type="text" placeholder="搜索品种 / 工序 / 质控要点…" autocomplete="off" />' +
            '<button class="mf-reset" data-mf-reset>清除筛选</button>' +
          '</div>' +
          '<div class="mf-routes" id="mfRoutes"></div>' +
          '<div class="mf-count" id="mfCount"></div>' +
          '<div class="mf-body" id="mfBody"></div>' +
        '</section>' +
      '</div>';

    mfContainer = c;
    const search = c.querySelector('#mfSearch');
    if (search) {
      search.value = mfState.q || '';
      search.addEventListener('input', function (e) {
        mfState.q = e.target.value.trim();
        mfState.entryId = null;
        paintBody();
      });
    }
    paintAll();
    App._markPortalActive && App._markPortalActive('manufacture');
  }

  /* ============================== 4) 挂载 ============================== */
  Object.assign(globalThis.App, { renderManufacture: renderManufacture });

  // 路由 manufacture 到 openPortal（包装 knowledge-portal.js 已定义的方法）
  const _origOpenPortal = globalThis.App.openPortal.bind(globalThis.App);
  globalThis.App.openPortal = function (name) {
    if (name === 'manufacture') { renderManufacture(); return; }
    return _origOpenPortal(name);
  };

  // 全局委托点击（数据属性驱动）
  document.addEventListener('click', function (e) {
    if (!globalThis.App) return;
    const el = e.target.closest && e.target.closest('[data-mf-class],[data-mf-form],[data-mf-route],[data-mf-entry],[data-mf-back],[data-mf-reset]');
    if (!el) return;
    if (el.dataset.mfClass) {
      mfState.cls = el.dataset.mfClass; mfState.form = null; mfState.route = null; mfState.entryId = null;
      paintAll(); return;
    }
    if (el.dataset.mfForm) {
      const fid = el.dataset.mfForm;
      mfState.form = fid;
      mfState.cls = (FORM_MAP[fid] ? FORM_MAP[fid].clsId : mfState.cls);
      mfState.route = null; mfState.entryId = null;
      paintAll(); return;
    }
    if (el.dataset.mfRoute) {
      const rid = el.dataset.mfRoute;
      mfState.route = (mfState.route === rid) ? null : rid;
      mfState.entryId = null;
      paintAll(); return;
    }
    if (el.dataset.mfReset) {
      mfState.cls = null; mfState.form = null; mfState.route = null; mfState.q = ''; mfState.entryId = null;
      paintAll();
      const s = mfContainer && mfContainer.querySelector('#mfSearch'); if (s) s.value = '';
      return;
    }
    if (el.dataset.mfEntry) {
      mfState.entryId = el.dataset.mfEntry;
      paintBody();
      return;
    }
    if (el.dataset.mfBack) {
      mfState.entryId = null;
      paintBody();
      return;
    }
  });

  globalThis.MANUFACTURE_KB = { CLASSES: CLASSES, ROUTE_CHIPS: ROUTE_CHIPS, ENTRIES: ENTRIES };
})();
