/**
 * 一次性术语框架增强：向 KNOWLEDGE_FRAMEWORK 追加「药品分类 / 生产工艺 / 质量控制重点」
 * 三类高价值、且当前缺失的主题词，保持原有 topic schema 与跨界面跳转（relatedTopics / relatedVarieties）。
 * 仅做追加，不修改既有词条；保留文件头部注释与可读中文（\uXXXX → 字符）。
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'js', 'knowledge-framework.js');
const raw = fs.readFileSync(FILE, 'utf8');
const MARKER = 'globalThis.KNOWLEDGE_FRAMEWORK =';
const idx = raw.lastIndexOf(MARKER);
if (idx < 0) { console.error('未找到', MARKER); process.exit(1); }
const header = raw.slice(0, idx);
let jsonStr = raw.slice(idx + MARKER.length).trim().replace(/;\s*$/, '');
const KF = JSON.parse(jsonStr);

// 将 \uXXXX（含代理对）还原为可读字符
function decodeUnicode(s) {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function serialize(KF) {
  let out = JSON.stringify(KF, null, 2);
  out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return out;
}

// 既有 topic id 集合，避免重复
const existing = new Set();
KF.groups.forEach(g => (g.topics || []).forEach(t => { if (t.id) existing.add(t.id); }));

function groupById(id) { return KF.groups.find(g => g.id === id); }

// 待追加词条
const NEW = [
  // ===== g6 特殊品类专题：药品分类（顶层大类 + 缺失品种）=====
  {
    group: 'g6',
    topic: {
      id: 'chemical', term: '化学药品（化药）', cat: '特殊品类专题',
      def: '化学药品指以化学合成、半合成或从天然产物中提取修饰得到的药用物质及其制剂，按《药品注册管理办法》分为 1–5 类（创新药、改良型、仿制、境外已上市境内未上市等）。研发与生产核心关注 CMC（化学、制造与控制）、有关物质与杂质谱、晶型/粒度、溶出与稳定性。',
      summary: '化药是注册分类与质量研究的基线对象，质量源于设计（QbD）贯穿工艺开发与风险控制。无菌药品、原料药、口服固体制剂与放射性药品是其主要子类，分别适用相应 GMP 附录。申报资料以 CTD M3 为核心的 CMC 模块，须与临床、非临床数据联动；上市后变更依《药品上市后变更管理办法》分级管理。',
      keyPoints: ['注册分类 1–5 类', 'CMC 为核心质量模块', '杂质谱与晶型/粒度控制', 'QbD 与工艺验证', '无菌/口服/原料药等子类附录'],
      difficulties: ['复杂杂质（基因毒性/降解）限度设定', 'BE 与溶出方法开发', '多场地/多规格变更管理'],
      relatedTopics: ['ctd', 'change', 'impurity', 'api', 'sterile', 'oral_solid'],
      relatedVarieties: ['sterile', 'api', 'radiopharm', 'oral_solid']
    }
  },
  {
    group: 'g6',
    topic: {
      id: 'biological', term: '生物制品', cat: '特殊品类专题',
      def: '生物制品以微生物、细胞、动物或人源组织/体液为原料，经生物学技术（发酵、细胞培养、分离纯化、基因工程等）制备，含重组蛋白、单抗、血液制品、疫苗及细胞与基因治疗产品。质量高度依赖生产工艺与过程控制，对应 ICH Q5 系列与 Q11。',
      summary: '生物制品的结构复杂、异质性强，难以用理化方法完全表征，故以过程控制（CPP/关键质量属性 CQA）+ 可比性研究为核心。病毒安全（清除/灭活）、无菌保证与冷链是重点；场地/工艺变更须开展可比性研究（ICH Q5E）。生物制品多适用 GMP 生物制品附录，部分（血液制品、疫苗）需批签发。',
      keyPoints: ['CQA/CPP 过程控制', '可比性研究（Q5E）', '病毒安全与无菌保证', '冷链与批签发', 'ICH Q5 / Q11'],
      difficulties: ['复杂分子表征', '培养/纯化工艺放大', '变更可比性桥接'],
      relatedTopics: ['ctd', 'change', 'comparability', 'pv', 'sterile', 'sp_bio'],
      relatedVarieties: ['biological', 'blood', 'vaccine', 'cell_gene']
    }
  },
  {
    group: 'g6',
    topic: {
      id: 'tcm', term: '中药（中药材·饮片·制剂）', cat: '特殊品类专题',
      def: '中药在中医药理论指导下使用，涵盖中药材、中药饮片与中药制剂（丸散膏丹、颗粒、注射剂等）。注册分 1–4 类（如古代经典名方、中药创新药、同名同方等）；质量控制关注指纹/特征图谱、浸出物、含量、重金属、农残与真菌毒素及毒性成分。',
      summary: '中药质量受基原、产地、采收与炮制影响显著，强调全过程可追溯与质量均一。中药饮片须遵循《中国药典》与炮制规范；中药制剂真实世界证据与质量源于设计逐步引入。2026 年中药审评审批改革（前置服务、立卷、核查检验一体化）显著缩短变更与说明书安全性修订的技术审评用时。',
      keyPoints: ['基原与产地溯源', '指纹/特征图谱', '饮片炮制规范', '重金属/农残/真菌毒素', '中药注册分类 1–4 类'],
      difficulties: ['物质基础复杂、批间波动', '炮制工艺标准化', '质量标志物确定'],
      relatedTopics: ['regclass', 'change', 'spec', 'sp_tcm', 'sp_radio'],
      relatedVarieties: ['tcm_prep', 'tcm_pieces']
    }
  },
  {
    group: 'g6',
    topic: {
      id: 'oral_solid', term: '口服固体制剂', cat: '特殊品类专题',
      def: '口服固体制剂包括片剂、胶囊剂、颗粒剂、散剂等，经口服给药。工艺涉及制粒（湿法/干法/直压）、压片/充填、包衣与溶出控制；共线生产下的清洁验证与交叉污染控制是关键。对应 GMP 口服固体制剂附录与 ICH Q8。',
      summary: '口服固体制剂是用量最大的剂型，质量核心为含量均匀度、溶出度/释放度与稳定性。工艺验证须覆盖最差条件；多产品共线须经污染矩阵与 PDE/ADE 评估并开展清洁验证。BE 试验是仿制药及部分改剂型品种的评价基础。',
      keyPoints: ['制粒/压片/包衣工艺', '溶出度与 BE', '清洁验证与共线评估', '工艺最差条件验证'],
      difficulties: ['难溶性药物溶出', '多品种共线交叉污染', '工艺放大一致性'],
      relatedTopics: ['pv', 'coc', 'spec', 'stability', 'cm'],
      relatedVarieties: ['oral_solid', 'api']
    }
  },
  {
    group: 'g6',
    topic: {
      id: 'blood', term: '血液制品', cat: '特殊品类专题',
      def: '血液制品以健康人血浆为原料，经分离纯化制得血浆蛋白类制品（人血白蛋白、免疫球蛋白、凝血因子类等）。须原料血浆检疫期、病毒灭活/去除与批签发管理，对应 GMP 血液制品附录与《生物制品批签发管理办法》。',
      summary: '血液制品属生物制品中监管最严的子类之一，原料血浆的可追溯与检疫期（窗口期）是安全基石；生产工艺须多步病毒清除/灭活并验证清除因子（LRV）。每批上市前须经批签发机构检验/审核，持有人承担全过程质量主体责任。',
      keyPoints: ['原料血浆检疫期', '多步病毒清除/灭活', '批签发', '血浆溯源与供浆者管理'],
      difficulties: ['血浆供应与检疫期平衡', '病毒安全验证', '产能与短缺预警'],
      relatedTopics: ['sp_bio', 'pv', 'comparability', 'release'],
      relatedVarieties: ['blood', 'biological']
    }
  },
  {
    group: 'g6',
    topic: {
      id: 'tcm_pieces', term: '中药饮片', cat: '特殊品类专题',
      def: '中药饮片是中药材经净制、切制、炮炙等炮制工艺加工后的成品，是中药制剂与临床汤剂的原料。炮制须遵循《中国药典》与全国/省级中药饮片炮制规范；质量控制关注性状、鉴别、浸出物、含量、重金属、农残与毒性成分。',
      summary: '中药饮片质量受基原、产地、采收季节与炮制工艺影响大，2026 年《药品生产质量管理规范（2010年修订）中药饮片附录》征求意见稿强化全链条监管（范围、人员、厂房设施、确认与验证、文件、生产管理、质量控制与信息化追溯）。供应商审核须向种植养殖/采集源头延伸（CFDI 中药材供应商审核指导原则）。',
      keyPoints: ['炮制规范依从', '性状/浸出物/含量', '重金属/农残/毒性成分', '信息化追溯', '源头供应商审核'],
      difficulties: ['炮制工艺标准化', '性状判别主观性', '源头质量波动'],
      relatedTopics: ['tcm', 'spec', 'supplier', 'sp_tcm'],
      relatedVarieties: ['tcm_pieces', 'tcm_prep']
    }
  },
  {
    group: 'g6',
    topic: {
      id: 'medical_gas', term: '医用气体', cat: '特殊品类专题',
      def: '医用气体用于医疗目的的气体（医用氧、二氧化碳、氧化亚氮、医用压缩空气、医用氮气等），按药品管理。质量关注纯度、水分、一氧化碳/二氧化碳等杂质、微生物与颗粒物，对应 GMP 医用气体附录。',
      summary: '医用气体多通过管道或钢瓶供应，生产（空分、纯化、充装）与配送环节须防止污染与混淆；无菌/低微生物要求是部分品种的重点。须建立批记录、留样与追溯，并关注气体钢瓶与管道系统的清洁与确认。',
      keyPoints: ['纯度与杂质控制', '微生物/颗粒物', 'GMP 医用气体附录', '充装与配送防污染'],
      difficulties: ['管道系统污染控制', '在线监测与取样', '多品种共用系统'],
      relatedTopics: ['spec', 'qaqc', 'sterile'],
      relatedVarieties: ['medical_gas']
    }
  },
  // ===== g3 生产制造：生产工艺（缺失项）=====
  {
    group: 'g3',
    topic: {
      id: 'cmc', term: 'CMC（化学、制造与控制）', cat: '生产制造',
      def: 'CMC（Chemistry, Manufacturing, and Controls）涵盖原料药与制剂的化学结构、生产工艺、质量标准和质量控制，是 IND/NDA/BLA 申报资料的核心模块（CTD M3），贯穿靶点发现至上市后变更全生命周期。',
      summary: 'CMC 将药学研发成果转化为可申报、可生产的控制策略：包括工艺路线、关键工艺参数（CPP）与关键质量属性（CQA）的界定、中试放大、分析方法开发与验证、质量标准制定。早期以临床 Supply 为导向，后期以商业化与稳定性为支撑；任何重大变更须按法规分级申报。',
      keyPoints: ['CTD M3 核心模块', 'CQA/CPP 控制策略', '方法开发与验证', '稳定性支撑标准', '全生命周期管理'],
      difficulties: ['早期工艺不确定性', 'CQA 识别与限度设定', '变更的可比性论证'],
      relatedTopics: ['ctd', 'methodval', 'stability', 'change', 'spec'],
      relatedVarieties: ['sterile', 'api', 'oral_solid', 'biological']
    }
  },
  {
    group: 'g3',
    topic: {
      id: 'sterilization', term: '灭菌工艺（Sterilization）', cat: '生产制造',
      def: '灭菌工艺使产品达到无菌保证水平（SAL ≤ 10⁻⁶），分为终端灭菌（湿热 F0≥8 过度杀灭法 / 残存概率法）与无菌生产工艺（除菌过滤、无菌灌装）。须开展灭菌工艺验证、装载热分布/热穿透与生物指示剂挑战。',
      summary: '灭菌策略首选终端灭菌（安全性最高）。对热不稳定产品采用残存概率法或无菌工艺。湿热灭菌须确认 F0 与装载方式；干热用于玻璃/金属与除热原；辐射/环氧乙烷用于特定器械与辅料。所有灭菌须验证并定期再验证，偏差须调查对无菌保证的影响。',
      keyPoints: ['SAL ≤ 10⁻⁶', 'F0≥8 过度杀灭', '残存概率法', '装载验证与 BI 挑战', '定期再验证'],
      difficulties: ['热不稳定产品选择', '多孔/液体装载均匀性', '生物指示剂代表性'],
      relatedTopics: ['sterile', 'pv', 'aseptic', 'ccs'],
      relatedVarieties: ['sterile', 'api']
    }
  },
  {
    group: 'g3',
    topic: {
      id: 'aseptic', term: '无菌生产工艺（Aseptic Processing）', cat: '生产制造',
      def: '无菌生产工艺用于无法终端灭菌的产品，在受控无菌环境下通过除菌过滤、无菌灌装/分装避免污染。核心为洁净区等级（A/B/C/D）、无菌操作、环境监控与介质模拟灌装（APS）。',
      summary: '无菌工艺须基于污染控制策略（CCS）整体设计：人员更衣与行为、环境分级与压差、单向流（A 级层流）、无菌工器具处理、除菌过滤完整性（起泡点/扩散流）及 APS 验证（含最差条件与干预）。EU/WHO GMP 附录1（2022）为国际基准，强调CCS 前瞻性评估。',
      keyPoints: ['A/B/C/D 洁净分级', '除菌过滤完整性', '介质模拟灌装 APS', '环境监控 EM', 'CCS 整体设计'],
      difficulties: ['人员干预污染', 'APS 最差条件设计', '无菌保证持续维持'],
      relatedTopics: ['sterile', 'sterilization', 'ccs', 'pv', 'qaqc'],
      relatedVarieties: ['sterile', 'api', 'biological']
    }
  },
  {
    group: 'g3',
    topic: {
      id: 'viralclear', term: '病毒清除与灭活（Viral Clearance）', cat: '生产制造',
      def: '病毒清除/灭活是生物制品（尤其血液制品、细胞培养来源产品）的病毒安全策略：通过低 pH、热处理、纳米过滤、层析等多步互补工艺累计降低病毒载量，每步以模型病毒验证清除因子（LRV）。',
      summary: '病毒安全采用“多步互补、机制不同”的原则：既包含灭活步骤（如低 pH、加热、有机溶剂/去污剂）也包含去除步骤（如纳米过滤、层析）。须选用相关/模型病毒（含细小病毒等难清除病毒）进行缩小规模验证，计算总体 LRV 并评估工艺 Robustness。是生物制品 IND/BLA 与场地变更的核心申报内容。',
      keyPoints: ['多步互补机制', '模型病毒验证 LRV', '灭活+去除组合', '缩小规模研究', '总体安全裕度'],
      difficulties: ['难清除病毒（细小病毒）', '工艺稳健性论证', '规模化与缩小模型相关性'],
      relatedTopics: ['sp_bio', 'blood', 'pv', 'comparability'],
      relatedVarieties: ['biological', 'blood', 'vaccine', 'cell_gene']
    }
  },
  {
    group: 'g3',
    topic: {
      id: 'csv', term: '计算机化系统验证（CSV）', cat: '生产制造',
      def: '计算机化系统验证（CSV）依据 GAMP 5 与 GMP 附录《计算机化系统》，以 V 模型对软件/硬件全生命周期验证（URS→DQ→IQ/OQ/PQ），确保系统受控、数据可靠，支撑 ALCOA+ 数据完整性。',
      summary: 'CSV 按系统影响与软件类别分级（GAMP 5 类别 1–5），关键系统须有审计追踪、权限分级、时间同步、备份与灾难恢复与电子签名（21 CFR Part 11 / 中国电子记录要求）。验证须与变更、偏差、CAPA 联动；退役须有数据迁移与存档计划。临床试验计算机系统亦须满足数据可靠性（CDE 临床试验计算机化系统技术要求）。',
      keyPoints: ['GAMP 5 分类与 V 模型', 'URS/DQ/IQ/OQ/PQ', 'ALCOA+ 与审计追踪', '权限/备份/应急', '与变更偏差联动'],
      difficulties: ['遗留系统合规改造', '审计追踪完整性', '云/外包系统验证'],
      relatedTopics: ['di', 'change', 'devi', 'capa', 'qms'],
      relatedVarieties: ['sterile', 'biological', 'api']
    }
  },
  {
    group: 'g3',
    topic: {
      id: 'ccs', term: '污染控制策略（CCS）', cat: '生产制造',
      def: '污染控制策略（CCS, Contamination Control Strategy）依据 ICH Q9 与 EU/WHO GMP 附录1（无菌），对无菌产品污染风险进行前瞻性识别、评估与综合控制（人、机、料、法、环），整合环境监控与介质模拟。',
      summary: 'CCS 是无菌制造质量风险管理的核心输出：从厂房设计、气流/压差、人员更衣与培训、物料/容器灭菌去污染、设备清洁与消毒、工艺无菌操作到 EM 与 APS 的全要素闭环。须形成书面策略并持续回顾更新，作为监管检查重点。CCS 与共线交叉污染控制（coc）在理念上一致、范围互补。',
      keyPoints: ['ICH Q9 风险基础', '人/机/料/法/环全要素', '环境监控 EM 整合', '与 APS 联动', '持续回顾更新'],
      difficulties: ['多要素交互风险量化', '人员因素控制', '策略落地与维持'],
      relatedTopics: ['sterile', 'aseptic', 'coc', 'rm', 'qaqc'],
      relatedVarieties: ['sterile', 'biological', 'api']
    }
  },
  // ===== g4 质量管理：质量控制重点（缺失项）=====
  {
    group: 'g4',
    topic: {
      id: 'oos', term: 'OOS（超标结果）与 OOT', cat: '质量管理',
      def: 'OOS（Out of Specification，超标结果）指检验结果超出法定或企业内控标准；OOT（Out of Trend，超趋势）指虽在标准内但偏离历史趋势。须启动规范调查（Phase 1 实验室调查→Phase 2 生产/工艺调查）区分实验室误差与真实偏差。',
      summary: 'OOS 调查遵循 FDA/NMPA 指南：先排除取样与检验误差（复核、复测受控），确属真实超标则延伸至生产工艺与物料调查，必要时召回/扣留批次。任何“无效检验”（OOS 无效）须有充分科学理由并审批。OOT 用于早期预警质量漂移。所有 OOS/OOT 须记录、趋势分析并纳入 CAPA 与年度质量回顾。',
      keyPoints: ['Phase 1/2 分级调查', '先排除实验室误差', '无效 OOS 须科学论证', 'OOT 早期预警', '趋势分析与 CAPA'],
      difficulties: ['复测的合规边界', '无效 OOS 判定', '根因调查深度'],
      relatedTopics: ['devi', 'capa', 'di', 'qaqc', 'pqr'],
      relatedVarieties: ['sterile', 'api', 'biological', 'oral_solid']
    }
  },
  {
    group: 'g4',
    topic: {
      id: 'pqr', term: '年度质量回顾（PQR）', cat: '质量管理',
      def: '年度质量回顾（PQR, Product Quality Review）依据 GMP 每年对产品质量与工艺稳定性进行系统回顾，覆盖生产、检验、偏差、变更、投诉、OOS/OOT、稳定性与CAPA 趋势，识别改进机会并形成报告。',
      summary: 'PQR 是质量体系持续改进与监管报告的关键动作：须量化关键质量指标（CQA）趋势、确认工艺处于受控状态、评估变更/偏差的影响并触发 CAPA。回顾结论支撑质量标准复评、有效期确认与再注册。须由 QA 组织、多部门参与并经质量受权人批准。',
      keyPoints: ['年度系统化回顾', 'CQA 趋势分析', '偏差/变更/CAPA 汇总', '触发改进与再确认', 'QP 批准'],
      difficulties: ['数据归集与口径一致', '趋势判读与 action 限', '跨部门协同'],
      relatedTopics: ['qms', 'devi', 'change', 'capa', 'stability', 'oos'],
      relatedVarieties: ['sterile', 'api', 'biological', 'oral_solid', 'vaccine']
    }
  },
  {
    group: 'g4',
    topic: {
      id: 'release', term: '产品放行与批签发', cat: '质量管理',
      def: '产品放行由质量受权人（QP/MAH 质量负责人）依据批生产、批检验记录、偏差处理与稳定性等对每批产品审核放行；血液制品、疫苗、部分生物制品等须经批签发机构检验/审核合格后方可上市。',
      summary: '放行是质量责任的最后关口：须确认该批符合注册标准、工艺一致、偏差已闭环、检验合格且无未决质量事件。批签发品种（疫苗、血液制品、部分重组蛋白等）须取得批签发证明。委托生产/检验须有明确质量协议；上市许可持有人对放行与上市后质量负主体责任。',
      keyPoints: ['QP/质量受权人审核', '偏差闭环前提', '批签发品种强制', 'MAH 主体责任', '质量协议'],
      difficulties: ['跨场地/委托放行责任界定', '批签发周期与供应', '未决偏差处置'],
      relatedTopics: ['qaqc', 'qms', 'devi', 'capa', 'sp_bio', 'blood'],
      relatedVarieties: ['sterile', 'biological', 'blood', 'vaccine']
    }
  }
];

let added = 0, skipped = 0;
for (const { group, topic } of NEW) {
  const g = groupById(group);
  if (!g) { console.warn('缺少分组', group); continue; }
  if (existing.has(topic.id)) { skipped++; continue; }
  g.topics = g.topics || [];
  g.topics.push(topic);
  existing.add(topic.id);
  added++;
}

const out = header + MARKER + ' ' + serialize(KF) + ';\n';
fs.writeFileSync(FILE, out, 'utf8');
console.log(`完成：新增 ${added} 条，跳过已存在 ${skipped} 条；当前 groups=${KF.groups.length}`);
