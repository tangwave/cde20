/*
 * qs-gmp-detail.js
 * 质量体系分类（9 类 / 11 品种）下钻 —— 各品种 GMP 要求卡片数据
 * 每个品种含：
 *   gmpAppendix  适用 GMP 附录 / 依据
 *   intro        一句话概述
 *   gmpItems     GMP 符合性要点 [{text, basis, detail}]
 *   process      典型工艺流程图数据 {title, steps:[{label, sub?, branch?}], note?}
 *   coLine        共线 / 交叉污染评估 {applicable, risk, summary, factors[], strategy[], dedicated?[]}
 * 并提供 QS_FLOW_SVG(steps) 横向流程图生成器（支持 branch 分叉）。
 */
(function () {
  'use strict';

  var QS_GMP_DETAIL = {

    /* ============ 化药 ============ */

    sterile: {
      gmpAppendix: 'GMP 附录1 无菌药品',
      intro: '无菌药品指法定标准中列有无菌检查项目的制剂与原料药，须以无菌保证水平（SAL ≤ 10⁻⁶）为核心组织生产与质量体系。',
      gmpItems: [
        { text: '无菌工艺验证（介质模拟灌装）', basis: 'GMP 附录1', detail: '每生产线每班次每半年至少一次培养基模拟灌装，灌装数量≥5000 支或覆盖最大批量的最差条件；连续3批成功方可确认无菌工艺；须包含最差干预（设备干预、环境干预、人员干预）。' },
        { text: '灭菌工艺验证（如采用终端灭菌）', basis: 'GMP 附录1 / ChP 1101', detail: '优先采用终端灭菌（F0≥8 过度杀灭法）；验证含热分布、热穿透、生物指示剂挑战；残存概率法（F0≥8 但非过度杀灭）须额外论证微生物负载控制。' },
        { text: '环境监控（EM）与洁净级别管理', basis: 'GMP 附录1', detail: 'A/B/C/D 级洁净区，动态监测悬浮粒子与微生物（浮游菌、沉降菌、表面接触碟、人员手套）；定期趋势分析，超标触发偏差与 CAPA，HVAC 维护与再确认纳入体系。' },
        { text: '无菌检查与容器密封完整性（CCI）', basis: 'GMP 附录1 / ChP 1101/1143', detail: '逐批无菌检查；CCI 方法验证（真空衰减、染料侵入、高压放电 HVLD、氦质谱等），建立最大允许泄漏限（MALL），覆盖产品全生命周期并纳入稳定性考察。' },
        { text: '人员资质与无菌操作', basis: 'GMP 附录1', detail: '更衣确认（A/B 级无菌更衣）、手消毒规程、干预次数最小化；无菌操作人员经考核与定期复训，培训记录纳入质量体系。' },
        { text: 'HVAC 与压差控制', basis: 'GMP 附录1 / 空调净化系统检查指南', detail: '定向气流、相邻级别≥10 Pa 压差梯度、合理换气次数、高效过滤器（PAO）检漏；气流流型可视化确认，防止低级别污染倒灌。' }
      ],
      process: {
        title: '典型无菌制剂（注射剂）生产工艺流程',
        steps: [
          { label: '原辅料称量与配制', sub: '称量室·防交叉' },
          { label: '除菌过滤', sub: '0.22 μm ×2' },
          { label: '灌装 / 分装', sub: '核心无菌操作', branch: ['终端灭菌工艺（F0≥8）', '无菌工艺（除菌过滤 / 残存概率）'] },
          { label: '密封 / 轧盖' },
          { label: '灭菌', sub: '仅终端灭菌路线' },
          { label: '目检 / 灯检' },
          { label: '贴签与包装' },
          { label: '无菌检查与放行', sub: '含 CCI' }
        ],
        note: '无菌药品不可在灌装后补灭菌者（无菌工艺）须以无菌工艺验证 + 逐批无菌检查兜底；可终端灭菌品种优先选终端灭菌。'
      },
      coLine: {
        applicable: true,
        risk: 'high',
        summary: '无菌药品共线生产交叉污染风险极高，微生物 / 微粒 / 细菌内毒素一旦引入即直接危及患者；高致敏性与高活性品种须专线。',
        factors: [
          '微生物、微粒、细菌内毒素的交叉污染',
          '高致敏性品种（青霉素类、头孢菌素类）混淆',
          '细胞毒性 / 高活性成分残留',
          '空调系统气流倒灌导致级别间污染'
        ],
        strategy: [
          'β-内酰胺类、性激素类、细胞毒性抗肿瘤药、高活性药品应专用厂房与设施',
          '阶段性生产 + 清洁验证（限度含微生物与细菌内毒素挑战）',
          '基于 HBEL / PDE 的健康暴露限度评估设定可接受残留',
          '独立 HVAC 与定向气流、相邻级别≥10 Pa 压差',
          '环境监控趋势分析与气流流型确认'
        ],
        dedicated: ['β-内酰胺类（青霉素 / 头孢）', '性激素类', '细胞毒性抗肿瘤药', '高活性药品（如高 potency 无菌制剂）']
      }
    },

    api: {
      gmpAppendix: 'GMP 附录2 原料药 / ICH Q7',
      intro: '原料药（API）生产涵盖化学合成、发酵、提取等，以关键质量属性（CQA）与关键工艺参数（CPP）为主轴实施持续工艺确认。',
      gmpItems: [
        { text: '工艺验证（前验证 / 同步 / 回顾性）', basis: 'ICH Q7 / 确认与验证附录', detail: '商业化生产前应完成至少连续3批成功的前验证；持续工艺确认（CPV）监测 CPP/CQA 漂移；变更后重新验证。' },
        { text: '杂质控制（有机 / 无机 / 残留溶剂）', basis: 'ICH Q3A / Q3C / M7', detail: '系统研究有关物质、降解杂质、元素杂质与残留溶剂；基因毒性杂质按 M7 设定控制限度并做安全性界定。' },
        { text: 'CQA 与 CPP 管理', basis: 'ICH Q7 / Q8-Q11', detail: '通过风险评估识别 CQA 与 CPP，建立设计空间与控制策略；工艺开发数据支撑注册标准与货架期。' },
        { text: '交叉污染控制', basis: 'GMP 第46条 / ICH Q7', detail: '高致敏性、高毒性原料药应专用设施；多用途生产线实施粉尘控制、阶段性生产与清洁验证。' },
        { text: '物料与起始物料管理', basis: 'ICH Q7 / Q11', detail: '起始物料论证（合理性、控制策略）；中间体 / 起始物料供应商审计与质量协议。' },
        { text: '厂房设备与粉尘控制', basis: 'ICH Q7 / 附录2', detail: '高活 / 高毒品种专用；多用途设备密闭化与粉尘捕集，防止交叉污染与职业暴露。' }
      ],
      process: {
        title: '典型化学原料药生产工艺流程',
        steps: [
          { label: '起始物料接收与检验' },
          { label: '合成 / 反应', sub: '多步' },
          { label: '分离与纯化', sub: '萃取 / 结晶 / 过滤' },
          { label: '干燥' },
          { label: '粉碎 / 过筛', branch: ['直接包装（非无菌原料药）', '无菌化处理（无菌原料药）'] },
          { label: '混合与总混' },
          { label: '内包装' },
          { label: '放行检验' }
        ],
        note: '无菌原料药须在最终处理步骤（如粉碎、混粉、分装）按无菌药品要求组织；非无菌原料药重点在杂质与晶型控制。'
      },
      coLine: {
        applicable: true,
        risk: 'medium',
        summary: '一般原料药多产品共线，但高活性、高致敏性（尤其青霉素类）须专用设施；粉尘与溶剂残留是主要交叉污染途径。',
        factors: [
          '粉尘交叉污染（多品种共线）',
          '高活性 / 高致敏性原料药残留（青霉素、细胞毒）',
          '溶剂残留与异味转移',
          '降解产物与晶型混淆'
        ],
        strategy: [
          '青霉素类等高致敏性、高毒性原料药专用厂房与设备',
          '粉尘捕集与负压称量罩',
          '阶段性生产 + 基于 PDE / HBEL 的清洁验证',
          '设备密闭化与专线隔离',
          '交叉污染风险评估（含职业暴露）'
        ],
        dedicated: ['青霉素类等高致敏性原料药', '高毒性 / 高活性原料药']
      }
    },

    radiopharm: {
      gmpAppendix: '放射性药品管理办法 / GMP 附录1（注射放射性药品）',
      intro: '放射性药品指用于临床诊断或治疗的放射性核素标记药物，须同时满足辐射防护、短半衰期时间窗与（注射用）无菌要求。',
      gmpItems: [
        { text: '辐射防护与安全管理', basis: '放射性药品管理办法', detail: '放射工作人员资质、个人剂量监测；生产场所辐射分区（控制区 / 监督区）；屏蔽热室与远程操作，表面污染监测。' },
        { text: '短半衰期与时间控制', basis: '放射性药品管理办法', detail: '生产、分装、检验、使用须在衰变允许时间内完成；正电子类（如 ¹⁸F）QC 可并行或豁免部分检验，但活度与放化纯度仍须控制。' },
        { text: '无菌与细菌内毒素（注射用）', basis: 'GMP 附录1', detail: '注射用放射性药品按无菌药品要求组织无菌工艺验证、环境监控与逐批无菌检查。' },
        { text: '活度测定与放射性核素纯度', basis: 'ChP 放射性药品检定', detail: '活度计定期校准；放射性核素纯度 / 放射化学纯度（放化纯）检验，防止杂质核素与未标记前体。' },
        { text: '分装与防误标签', basis: '放射性药品管理办法', detail: '自动分装减少人员暴露；标签须醒目标注核素、活度、校准时间、有效期，防止误用。' },
        { text: '放射性废物处理与去污', basis: '放射性药品管理办法', detail: '放射性废物分类收集、衰变存放后按普通废物处置；设备与台面定期去污监测。' }
      ],
      process: {
        title: '典型放射性药品（正电子 / 发生器）生产工艺流程',
        steps: [
          { label: '核素制备', sub: '发生器 / 回旋加速器' },
          { label: '标记合成', sub: '屏蔽热室' },
          { label: '纯化', branch: ['即时配制（正电子类）', '常规分装'] },
          { label: '无菌过滤', sub: '如注射' },
          { label: '分装与活度校正' },
          { label: '质量检验', sub: '活度 / 放化纯 / 无菌' },
          { label: '放行', sub: '校准时间窗内' }
        ],
        note: '短半衰期品种（如 ¹⁸F，t½≈110 min）强调时间窗控制，检验可与分装并行；长半衰期品种按常规无菌放行。'
      },
      coLine: {
        applicable: true,
        risk: 'high',
        summary: '同时具备辐射危害与（注射用）无菌要求，交叉污染表现形式包括放射性表面污染与核素 / 活度混淆，须独立分区与屏蔽。',
        factors: [
          '辐射暴露（人员与环境污染）',
          '放射性表面污染与扩散',
          '核素 / 活度混淆导致误用',
          '注射用品种的无菌保证'
        ],
        strategy: [
          '生产场所独立、辐射分区（控制区 / 监督区）',
          '屏蔽热室、远程操作与表面污染监测',
          '时间-距离-屏蔽三原则控制暴露',
          '独立通风（负压 + 高效排风）',
          '防误标签与活度双重核对'
        ],
        dedicated: ['放射性药品生产场所（独立、辐射分区）']
      }
    },

    oral_solid: {
      gmpAppendix: '药品生产质量管理规范（通则）',
      intro: '口服固体制剂（片剂、胶囊、颗粒等）是最常见剂型，质量体系核心是混合均匀度、溶出度与粉尘交叉污染控制。',
      gmpItems: [
        { text: '制粒工艺验证', basis: 'GMP 通则 / ICH Q8', detail: '湿法制粒 / 干法制粒 / 直压工艺验证，确认混合均匀度（含量均匀度）与批内均一性；工艺参数（如润湿剂用量、干燥温度）纳入 CPP。' },
        { text: '含量均匀度与溶出度', basis: 'ChP 0941 / 0931', detail: '溶出曲线（BCS 分类）表征体内行为；生产过程溶出度控制，防止批间释放差异。' },
        { text: '交叉污染控制（粉尘）', basis: 'GMP 第46条', detail: '多产品共线生产须清洁验证，基于 PDE / HBEL 设定可接受残留限度；高活性 / 激素 / 细胞毒性品种专用或强隔离。' },
        { text: '粉碎 / 过筛 / 总混', basis: 'GMP 通则', detail: '粉尘捕集与顺序生产；润滑剂 / 助流剂加入顺序与混合时间影响含量均匀度。' },
        { text: '包装与防混淆', basis: 'GMP 通则', detail: '铝塑泡罩 / 瓶装；外观相似品种重点防混淆（标签、批号、在线检测）。' },
        { text: '持续工艺确认（CPV）', basis: 'ICH Q10', detail: '商业化后持续监测关键质量属性趋势，及时识别漂移并启动 CAPA。' }
      ],
      process: {
        title: '典型口服固体制剂生产工艺流程',
        steps: [
          { label: '原辅料粉碎 / 过筛' },
          { label: '称量与配料' },
          { label: '混合 / 制粒', branch: ['湿法制粒（黏合剂→干燥→整粒）', '直压 / 干法制粒'] },
          { label: '总混', sub: '加润滑剂 / 助流剂' },
          { label: '压片 / 充填胶囊' },
          { label: '包衣', sub: '薄膜 / 糖衣（可选）' },
          { label: '包装', sub: '泡罩 / 瓶装' },
          { label: '放行检验' }
        ],
        note: '直压工艺对物料流动性与含量均匀度要求更高；湿法制粒须控制干燥失水与有关物质。'
      },
      coLine: {
        applicable: true,
        risk: 'medium',
        summary: '口服固体制剂多产品共线普遍，主要风险为粉尘交叉污染与外观相似品种混淆；高活性 / 激素 / 细胞毒性品种须专用或强隔离。',
        factors: [
          '粉尘 / 片段交叉污染（多品种共线）',
          '高活性 / 激素 / 细胞毒性成分残留',
          '致敏性成分残留',
          '外观相似品种混淆'
        ],
        strategy: [
          '阶段性生产 + 基于 PDE / HBEL 的清洁验证',
          '粉尘捕集称量罩与负压操作',
          '激素、细胞毒性、高活性口服制剂专用或隔离操作',
          '物理隔离与在线检测防混淆',
          '清场确认（含目视与残留检测）'
        ],
        dedicated: ['激素类口服制剂', '细胞毒性类口服制剂', '高活性口服制剂']
      }
    },

    /* ============ 生物药 ============ */

    biological: {
      gmpAppendix: 'GMP 附录3 生物制品',
      intro: '生物制品以活细胞 / 培养表达为起点，质量体系核心是细胞库管理、病毒安全与无菌工艺，难以终端灭菌。',
      gmpItems: [
        { text: '细胞库与病毒种子库管理', basis: 'GMP 附录3', detail: '主细胞库（MCB）/ 工作细胞库（WCB）与工作种子批建库、全面检定、专帐保管与追溯；防止污染与混淆。' },
        { text: '无菌工艺与封闭系统', basis: 'GMP 附录3 / 附录1', detail: '活细胞制品不可终端灭菌，须无菌工艺验证；一次性系统（SUS）须完整性 / 兼容性与浸出物验证。' },
        { text: '病毒安全（如适用）', basis: 'GMP 附录3 / 药典', detail: '外源病毒检测；病毒清除验证覆盖灭活与去除步骤（低 pH、除病毒过滤、层析），积累对数下降因子（LRV）。' },
        { text: '纯化与病毒过滤', basis: 'GMP 附录3', detail: '层析、超滤、沉淀等纯化；除病毒过滤步骤验证（载量、流速、LRV）。' },
        { text: '细胞培养工艺验证', basis: 'GMP 附录3', detail: '培养参数（pH、DO、温度、搅拌）作为 CPP 验证；批间一致性监测。' },
        { text: '质量控制（效价 / 杂质 / 聚体）', basis: 'ChP 生物制品', detail: '生物学活性（效价）、残留宿主细胞蛋白 / DNA、聚集体 / 片段、糖基化等结构相关性质量属性控制。' }
      ],
      process: {
        title: '典型生物制品（重组蛋白）生产工艺流程',
        steps: [
          { label: '细胞建库 / 复苏', sub: 'MCB / WCB' },
          { label: '接种与培养', sub: '生物反应器' },
          { label: '收获' },
          { label: '纯化', sub: '层析 / 超滤' },
          { label: '除病毒过滤', branch: ['无菌过滤（制剂）', '病毒灭活 / 去除验证'] },
          { label: '配制与灌装' },
          { label: '冻干', sub: '如冻干粉' },
          { label: '灯检与包装' },
          { label: '放行', sub: '效价 + 无菌' }
        ],
        note: '生物制品不可终端灭菌，无菌工艺验证 + 一次性系统验证是放行前提；聚集体与翻译后修饰须全程监控。'
      },
      coLine: {
        applicable: true,
        risk: 'high',
        summary: '活细胞 / 病毒载体带来病毒安全与细胞系混淆风险，且难以终端灭菌，须专区、单向流与严格物流隔离。',
        factors: [
          '病毒 / 支原体交叉污染',
          '不同产品 / 细胞系混淆',
          '过敏原与免疫原性风险',
          '清洁剂 / 缓冲液残留'
        ],
        strategy: [
          '不同产品（尤其活病毒、不同细胞系）独立区域或独立 HVAC',
          '病毒清除验证（灭活 + 去除双保险）',
          '一次性系统或彻底清洁验证',
          '单向物流与物流隔离',
          '细胞系鉴别与种子批追溯'
        ],
        dedicated: ['生产用活细胞 / 活病毒品种', '不同生物制品的独立生产区域']
      }
    },

    blood: {
      gmpAppendix: 'GMP 附录4 血液制品',
      intro: '血液制品以原料血浆分离纯化制得，质量体系核心是原料血浆检疫、病毒灭活去除与批签发。',
      gmpItems: [
        { text: '原料血浆管理', basis: 'GMP 附录4 / 单采血浆站', detail: '单采血浆站采集；血浆检疫期（≥90 天复检合格）后方可投料；批血浆追溯与供浆员健康档案。' },
        { text: '病毒灭活 / 去除', basis: 'GMP 附录4', detail: '每步添加至少两种不同机制的病毒去除 / 灭活（如 S/D 法、干热、纳米过滤），验证对数下降因子。' },
        { text: '分离纯化（低温乙醇法）', basis: 'GMP 附录4', detail: 'Cohn 低温乙醇法组分分离，严格控制温度与 pH；组分追溯。' },
        { text: '批混合与规格化', basis: 'GMP 附录4', detail: '批血浆量须满足最低要求；混合后统一检定与规格化。' },
        { text: '无菌与热原 / 细菌内毒素', basis: 'GMP 附录1 / ChP', detail: '注射用人血制品无菌与细菌内毒素控制；内毒素限值严格。' },
        { text: '批签发', basis: '生物制品批签发', detail: '血液制品实施批签发，经指定机构检验合格方可上市。' }
      ],
      process: {
        title: '典型血液制品（人血白蛋白）生产工艺流程',
        steps: [
          { label: '原料血浆采集与检疫', sub: '≥90 天复检' },
          { label: '解冻与分离', sub: '低温乙醇法' },
          { label: '组分沉淀与离心' },
          { label: '溶解与超滤 / 透析' },
          { label: '病毒灭活 / 去除', sub: 'S/D / 干热 / 纳米过滤' },
          { label: '配制与除菌过滤' },
          { label: '分装 / 冻干 / 灌装' },
          { label: '批签发与放行' }
        ],
        note: '血液制品病毒安全是底线，须双重病毒去除 / 灭活步骤并验证；批签发为上市前置。'
      },
      coLine: {
        applicable: true,
        risk: 'high',
        summary: '原料血浆携带血源传播病毒（HBV / HCV / HIV）风险，须检疫期与病毒灭活双重保障，防止不同批血浆混批污染。',
        factors: [
          '血源传播病毒（HBV / HCV / HIV）',
          '不同批血浆混合污染',
          '过敏原与免疫原性',
          '组分间交叉污染'
        ],
        strategy: [
          '血浆检疫期 + 复检合格方可投料',
          '病毒灭活双重步骤验证（不同机制）',
          '专用设备（不同蛋白组分）',
          '防止混批与全程追溯',
          '冷链与温度监控'
        ],
        dedicated: ['血液制品生产专区（病毒灭活设施专用）']
      }
    },

    vaccine: {
      gmpAppendix: 'GMP 附录3 生物制品',
      intro: '疫苗以毒种 / 菌种培养制备，质量体系核心是种子批管理、病毒 / 细菌灭活验证与批签发。',
      gmpItems: [
        { text: '毒种 / 菌种种子批', basis: 'GMP 附录3', detail: '主种子 / 工作种子批建库与全面检定、专帐保管，防止污染与毒力返祖。' },
        { text: '生产过程控制（培养 / 发酵）', basis: 'GMP 附录3', detail: '菌体密度 / 病毒滴度作为 CPP 验证；培养参数一致性监测。' },
        { text: '纯化与佐剂配制', basis: 'GMP 附录3', detail: '铝佐剂等佐剂质量与配制均匀性；佐剂相关安全性（如结节）监控。' },
        { text: '病毒 / 细菌灭活（灭活疫苗）', basis: 'GMP 附录3', detail: '灭活验证须证明完全灭活（无活病毒 / 活菌残留），设定安全余量；每批灭活监测。' },
        { text: '无菌与抗原含量', basis: 'ChP 疫苗', detail: '效价（动物 / 免疫原性）与抗原含量控制；无菌保证。' },
        { text: '批签发', basis: '生物制品批签发', detail: '疫苗实施批签发，经指定机构检验合格方可上市。' }
      ],
      process: {
        title: '典型疫苗（灭活疫苗）生产工艺流程',
        steps: [
          { label: '毒种 / 菌种复苏与扩增' },
          { label: '培养 / 发酵', sub: '生物反应器 / 鸡胚' },
          { label: '收获', branch: ['灭活（灭活疫苗）', '减毒活（活疫苗）'] },
          { label: '纯化与裂解', sub: '如适用' },
          { label: '佐剂配制与混合' },
          { label: '分装' },
          { label: '冻干 / 灌装' },
          { label: '检定与批签发' }
        ],
        note: '灭活疫苗须验证无活病毒残留（安全余量）；活疫苗须独立负压专区防止扩散。'
      },
      coLine: {
        applicable: true,
        risk: 'high',
        summary: '活病毒 / 活菌存在扩散风险，灭活疫苗须确保完全灭活；不同疫苗混淆与种子批污染须严格防控。',
        factors: [
          '活病毒 / 活菌扩散（环境与人）',
          '不同疫苗混淆',
          '灭活不完全导致活病原残留',
          '致敏性'
        ],
        strategy: [
          '灭活验证（确保无活病毒 / 活菌残留，安全余量）',
          '活疫苗独立厂房、负压、高效排风',
          '种子批管理与鉴别',
          '单向流与物流隔离',
          '批签发前置'
        ],
        dedicated: ['活疫苗生产独立厂房（负压、高效排风）']
      }
    },

    cell_gene: {
      gmpAppendix: '细胞治疗产品 GMP 附录 / 基因治疗产品 GMP',
      intro: '细胞与基因治疗产品（CAR-T、干细胞、基因修饰产品等）为患者特异性活细胞制品，须密闭系统、身份核对与时限控制。',
      gmpItems: [
        { text: '供者材料与细胞来源管理', basis: '细胞治疗产品 GMP 附录', detail: '供者筛查（传染病指标）；自体 / 异体全程唯一标识与追溯，防止混淆。' },
        { text: '密闭系统与无菌工艺', basis: '细胞治疗产品 GMP 附录 / GMP 附录1', detail: '一次性密闭系统减少开放操作；无菌工艺验证，活细胞不可终端灭菌。' },
        { text: '基因修饰（如 CAR 转导）', basis: '细胞治疗产品 GMP 附录', detail: '慢病毒 / 逆转录病毒载体质控；转导效率与载体拷贝数验证，防止可复制型病毒（RCL）风险。' },
        { text: '细胞培养与扩增', basis: '细胞治疗产品 GMP 附录', detail: '培养参数（密度、因子、时间）CPP 验证；细胞鉴别与活力监测。' },
        { text: '转运与回输时限', basis: '细胞治疗产品 GMP 附录', detail: '冷链与严格时间窗（患者特异性），超时影响活性与合规。' },
        { text: '身份核对与患者特异性', basis: '细胞治疗产品 GMP 附录', detail: '唯一标识 + 双人核对防止不同患者细胞混淆，是放行关键控制。' }
      ],
      process: {
        title: '典型细胞与基因治疗产品（CAR-T）生产工艺流程',
        steps: [
          { label: '供者筛查与单采 / 采集' },
          { label: '细胞分离与激活' },
          { label: '基因修饰 / 转导', sub: 'CAR 等（如适用）' },
          { label: '扩增与培养', sub: '密闭系统' },
          { label: '配制与制剂' },
          { label: '质检', sub: '鉴别 / 活力 / 无菌 / 载体拷贝' },
          { label: '冷链转运与回输', branch: ['自体回输', '异体冻存'] }
        ],
        note: '活细胞不可终端灭菌，无菌工艺 + 密闭系统 + 时限控制是核心；身份核对失误不可逆，须双人确认。'
      },
      coLine: {
        applicable: true,
        risk: 'high',
        summary: '患者特异性活细胞 + 病毒载体，混淆与污染均不可逆；须密闭系统、独立操作区与严格时限。',
        factors: [
          '供者材料传染病污染',
          '不同患者细胞混淆（不可逆）',
          '病毒载体扩散（可复制型风险）',
          '无菌保证（活细胞不可终端灭菌）'
        ],
        strategy: [
          '密闭系统 + 无菌工艺验证',
          '患者唯一标识与双人身份核对',
          '不同供者独立操作区避免交叉',
          '病毒载体专区生产与 RCL 监测',
          '严格时限与冷链监控'
        ],
        dedicated: ['细胞治疗产品独立生产区域（异体 / 自体分区）', '病毒载体生产专用区']
      }
    },

    /* ============ 中药 ============ */

    tcm_prep: {
      gmpAppendix: 'GMP 附录5 中药制剂',
      intro: '中药制剂以药材炮制后提取精制制得，质量体系核心是前处理炮制、提取浓缩与（较化药更严的）农残 / 重金属 / 微生物控制。',
      gmpItems: [
        { text: '药材前处理与炮制', basis: 'GMP 附录5', detail: '净制、切制、炮炙按药典与炮制规范；毒性药材专用炮制设施与设备。' },
        { text: '提取浓缩与干燥', basis: 'GMP 附录5', detail: '水提 / 醇提参数（温度、时间、溶媒比）CPP 验证；浸膏相对密度控制；挥发性成分（挥发油）收集。' },
        { text: '制剂工艺（丸散膏丹颗粒片）', basis: 'GMP 附录5', detail: '丸剂、颗粒剂、片剂等工艺验证；成型与干燥参数控制。' },
        { text: '微生物与农残 / 重金属', basis: 'ChP 中药', detail: '中药微生物限度、农药残留、重金属与有害元素、真菌毒素（黄曲霉毒素）控制较化药更受关注。' },
        { text: '交叉污染（药材粉尘 / 挥发性）', basis: 'GMP 附录5 / 第46条', detail: '多品种共线清洁验证；含挥发性、致敏或毒性药材专用或隔离。' },
        { text: '辅料与矫味', basis: 'GMP 附录5', detail: '蜂蜜、酒、醋、炼蜜等炮制 / 制剂辅料质量控制，防止引入污染。' }
      ],
      process: {
        title: '典型中药制剂（提取物 / 丸颗粒）生产工艺流程',
        steps: [
          { label: '药材净制与炮制' },
          { label: '提取', sub: '水提 / 醇提' },
          { label: '浓缩与收膏' },
          { label: '干燥 / 制粉' },
          { label: '制剂成型', sub: '丸 / 颗粒 / 片' },
          { label: '包衣 / 包合', sub: '如适用' },
          { label: '包装' },
          { label: '放行' }
        ],
        note: '挥发性成分须在提取阶段收集（挥发油）；毒性药材炮制前后须专区与专用设备。'
      },
      coLine: {
        applicable: true,
        risk: 'medium',
        summary: '主要风险为药材粉尘、挥发性成分与毒性药材交叉污染，以及外观相似药材混淆；清洁验证与专区是关键。',
        factors: [
          '药材粉尘交叉污染',
          '挥发性 / 芳香成分扩散混淆',
          '毒性药材（如附子、生川乌）残留',
          '同名异物 / 易混淆药材'
        ],
        strategy: [
          '炮制专区与毒性药材专用设施',
          '粉尘捕集与阶段性生产',
          '基于 PDE / HBEL 的清洁验证',
          '性状相似药材防混淆管理',
          '农残 / 重金属 / 真菌毒素批批控制'
        ],
        dedicated: ['毒性中药制剂生产专区', '含强挥发性药材专用区']
      }
    },

    tcm_pieces: {
      gmpAppendix: 'GMP 附录6 中药饮片',
      intro: '中药饮片为药材经净制、切制、炮炙制成，质量体系核心是炮炙规范、基原鉴别与二氧化硫 / 黄曲霉毒素控制。',
      gmpItems: [
        { text: '净制与切制', basis: 'GMP 附录6', detail: '挑选、洗润、切制规格（片 / 段 / 丝 / 块）符合要求；润药适度防有效成分流失。' },
        { text: '炮炙（炒 / 炙 / 煅 / 蒸 / 煮）', basis: 'GMP 附录6 / 药典', detail: '火候、辅料（酒、醋、盐、蜜）与炮制程度控制；毒性饮片炮制减毒验证。' },
        { text: '饮片性状与鉴别', basis: 'ChP 中药', detail: '性状、显微、薄层鉴别；基原鉴别防伪品与混淆品。' },
        { text: '二氧化硫残留与黄曲霉毒素', basis: 'ChP 中药', detail: '硫熏控制（二氧化硫残留限度）；黄曲霉毒素与重金属控制，尤其易霉变品种。' },
        { text: '仓储与养护', basis: 'GMP 附录6', detail: '防虫蛀、霉变、泛油；分类存放、温湿度监控。' },
        { text: '包装与追溯码', basis: 'GMP 附录6', detail: '按附录6 要求赋追溯码，实现产地到使用的可追溯。' }
      ],
      process: {
        title: '典型中药饮片生产工艺流程',
        steps: [
          { label: '净选', sub: '挑选 / 洗' },
          { label: '润药' },
          { label: '切制', sub: '片 / 段 / 丝' },
          { label: '干燥' },
          { label: '炮炙', sub: '炒 / 炙 / 煅 / 蒸' },
          { label: '筛分与矫味' },
          { label: '包装与赋码' },
          { label: '放行' }
        ],
        note: '毒性饮片（如附子）炮炙须减毒并专区；硫熏须严控二氧化硫残留。'
      },
      coLine: {
        applicable: true,
        risk: 'medium',
        summary: '风险以粉尘、毒性药材残留与混淆为主；毒性饮片须专用炮制区与设备，仓储防霉变。',
        factors: [
          '药材粉尘交叉污染',
          '毒性药材（附子、生川乌等）残留',
          '易混淆 / 伪品药材',
          '硫熏残留与霉变'
        ],
        strategy: [
          '毒性饮片专用炮制区与设备',
          '粉尘捕集与清洁验证',
          '独立仓储与温湿度监控',
          '基原鉴别与防混淆',
          '二氧化硫 / 黄曲霉毒素批控'
        ],
        dedicated: ['毒性中药饮片专用生产区域']
      }
    },

    /* ============ 其他 ============ */

    medical_gas: {
      gmpAppendix: 'GMP 附录7 医用气体',
      intro: '医用气体（医用氧、医用二氧化碳、医用氮气等）以空气分离或净化制得，质量体系核心是防止气体混杂与充装安全。',
      gmpItems: [
        { text: '生产场所与设备', basis: 'GMP 附录7', detail: '空气压缩、液化、分馏（空分）系统；管道与储罐洁净与专用，防止不同气体混入。' },
        { text: '充装管理', basis: 'GMP 附录7', detail: '气瓶清洗、置换与干燥；按充装系数 / 压力充装，防止超装与混装。' },
        { text: '质量控制（纯度 / 杂质）', basis: 'ChP 医用气体', detail: '逐瓶或逐批检验纯度、水分、CO、CO₂、油分；在线监测关键杂质。' },
        { text: '标签与追溯', basis: 'GMP 附录7', detail: '医用气体专用标签（品名、批号、有效期）；可追溯。' },
        { text: '交叉污染（气体混合）', basis: 'GMP 附录7 / 第46条', detail: '不同气体管道、储罐、气瓶系统相互独立，防止混入导致成分错误。' },
        { text: '无菌（如适用）', basis: 'GMP 附录1', detail: '用于呼吸的医用气体关注微生物与微粒（如适用）。' }
      ],
      process: {
        title: '典型医用气体（医用氧）生产工艺流程',
        steps: [
          { label: '空气压缩与净化' },
          { label: '冷却与分馏', sub: '空分' },
          { label: '纯化', sub: '除水 / CO / CO₂ / 油' },
          { label: '充装', sub: '气瓶 / 槽车' },
          { label: '检验', sub: '纯度 / 杂质' },
          { label: '贴标与追溯' },
          { label: '放行' }
        ],
        note: '医用气体不可混用管道与储罐；气瓶须清洗置换，防止残留气体污染。'
      },
      coLine: {
        applicable: true,
        risk: 'medium',
        summary: '气体混杂是独特风险（不同气体同系统混入导致成分错误），水分 / 油污染亦须控制；气瓶残留须清洗置换。',
        factors: [
          '不同医用气体系统混入',
          '水分 / 油分污染',
          '气瓶残留气体污染',
          '充装超压 / 混装'
        ],
        strategy: [
          '不同医用气体生产系统相互独立（管道 / 储罐 / 气瓶）',
          '气瓶清洗、置换与干燥',
          '在线监测水分 / CO / CO₂',
          '逐瓶 / 逐批检验与专用标签',
          '充装系数与压力控制'
        ],
        dedicated: ['不同医用气体相互独立的生产系统']
      }
    }
  };

  /* ---------- 横向工艺流程图 SVG 生成器（支持 branch 分叉） ---------- */
  function QS_FLOW_SVG(steps) {
    if (!steps || !steps.length) return '';
    var NW = 150, NH = 60, GAP = 40, BW = 158, BH = 44, BGAP = 10, M = 26;
    var esc = function (s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    var items = steps.map(function (s) {
      return s.branch ? { kind: 'branch', label: s.label, sub: s.sub || '', branches: s.branch } : { kind: 'node', label: s.label, sub: s.sub || '' };
    });
    function widthOf(it) {
      if (it.kind === 'branch') {
        var maxw = BW;
        it.branches.forEach(function (b) {
          var w = Math.min(BW, String(b.label || '').length * 13 + 26);
          if (w > maxw) maxw = w;
        });
        return maxw;
      }
      return NW;
    }
    var placed = [];
    var x = M;
    items.forEach(function (it) {
      var w = widthOf(it);
      placed.push({ kind: it.kind, label: it.label, sub: it.sub, branches: it.branches, x: x, w: w });
      x += w + GAP;
    });
    var totalW = x - GAP + M;
    function halfOf(it) {
      if (it.kind === 'branch') {
        var ch = it.branches.length * BH + (it.branches.length + 1) * BGAP;
        return ch / 2;
      }
      return NH / 2;
    }
    var maxHalf = 1;
    placed.forEach(function (it) { var h = halfOf(it); if (h > maxHalf) maxHalf = h; });
    var midY = maxHalf + 22;
    var totalH = 2 * maxHalf + 44;

    var svg = '<svg class="qs-flow" viewBox="0 0 ' + totalW + ' ' + totalH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="典型工艺流程图">';

    // 箭头（置于节点之下层）
    for (var i = 1; i < placed.length; i++) {
      var prev = placed[i - 1], cur = placed[i];
      var x1 = prev.x + prev.w, x2 = cur.x;
      var yc = midY;
      svg += '<line class="qs-flow-arrow" x1="' + x1 + '" y1="' + yc + '" x2="' + (x2 - 7) + '" y2="' + yc + '"/>';
      svg += '<polygon class="qs-flow-arrow-head" points="' + (x2 - 7) + ',' + (yc - 5) + ' ' + (x2 - 7) + ',' + (yc + 5) + ' ' + (x2 + 2) + ',' + yc + '"/>';
    }

    // 节点 / 分支
    placed.forEach(function (it, idx) {
      var cx = it.x + it.w / 2;
      if (it.kind === 'branch') {
        var ch = it.branches.length * BH + (it.branches.length + 1) * BGAP;
        var top = midY - ch / 2;
        svg += '<g class="qs-flow-branch">';
        svg += '<rect class="qs-flow-node" x="' + it.x + '" y="' + top + '" width="' + it.w + '" height="' + ch + '" rx="10"/>';
        svg += '<text class="qs-flow-node-label" x="' + cx + '" y="' + (top + 16) + '" text-anchor="middle">' + esc(it.label) + '</text>';
        if (it.sub) svg += '<text class="qs-flow-node-sub" x="' + cx + '" y="' + (top + 32) + '" text-anchor="middle">' + esc(it.sub) + '</text>';
        it.branches.forEach(function (b, bi) {
          var by = top + BGAP + bi * (BH + BGAP);
          svg += '<rect class="qs-flow-branch-box" x="' + (it.x + (it.w - BW) / 2) + '" y="' + by + '" width="' + BW + '" height="' + BH + '" rx="7"/>';
          svg += '<text class="qs-flow-branch-text" x="' + cx + '" y="' + (by + BH / 2 + 4) + '" text-anchor="middle">' + esc(b || '') + '</text>';
        });
        svg += '</g>';
      } else {
        var top2 = midY - NH / 2;
        svg += '<g class="qs-flow-node-g">';
        svg += '<rect class="qs-flow-node" x="' + it.x + '" y="' + top2 + '" width="' + it.w + '" height="' + NH + '" rx="10"/>';
        svg += '<text class="qs-flow-node-label" x="' + cx + '" y="' + (top2 + NH / 2 - 4) + '" text-anchor="middle">' + esc(it.label) + '</text>';
        if (it.sub) svg += '<text class="qs-flow-node-sub" x="' + cx + '" y="' + (top2 + NH / 2 + 14) + '" text-anchor="middle">' + esc(it.sub) + '</text>';
        svg += '</g>';
      }
      // 序号徽标
      var half = halfOf(it);
      var by2 = midY - half + 14;
      svg += '<g class="qs-flow-badge"><circle cx="' + (it.x + 14) + '" cy="' + by2 + '" r="11"/>';
      svg += '<text class="qs-flow-badge-text" x="' + (it.x + 14) + '" y="' + (by2 + 4) + '" text-anchor="middle">' + (idx + 1) + '</text></g>';
    });

    svg += '</svg>';
    return svg;
  }

  globalThis.QS_GMP_DETAIL = QS_GMP_DETAIL;
  globalThis.QS_FLOW_SVG = QS_FLOW_SVG;
})();
