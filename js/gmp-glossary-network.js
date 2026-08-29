
/* ============== 术语数据（id / 中文术语 / 英文缩写 / 分类 / 详细解释 / 关联id） ============== */
const CATS = {
  sys:{name:"体系与机构",color:"#2563eb"},
  risk:{name:"质量风险",color:"#d97706"},
  mat:{name:"物料",color:"#0891b2"},
  proc:{name:"工艺与验证",color:"#7c3aed"},
  cqa:{name:"质量属性",color:"#db2777"},
  data:{name:"数据与计算机化",color:"#059669"},
  dc:{name:"偏差·变更·CAPA",color:"#dc2626"},
  rel:{name:"放行与回顾",color:"#ca8a04"},
  type:{name:"分品种",color:"#4f46e5"},
  spec:{name:"专项专页",color:"#0d9488"}
};

const TERMS = [
  // ===== 体系与机构 =====
  {id:"gmp",t:"药品生产质量管理规范",e:"GMP",c:"sys",d:"Good Manufacturing Practice，药品生产和质量管理的基本准则。旨在最大限度降低生产过程中的污染、交叉污染以及混淆、差错等风险，确保持续稳定地生产出符合预定用途和注册要求的药品。2010年修订版为现行核心版本，配套无菌药品、原料药、生物制品、血液制品、中药、临床试验用药品等十余个附录。",r:["pqs","glp","gcp","mau","nmpa","cfdi","imp","wuxian","yuanliao","kfzt","shengwu","xuezhipin","ccs"]},
  {id:"glp",t:"药物非临床研究质量管理规范",e:"GLP",c:"sys",d:"Good Laboratory Practice，为保证药物非临床安全性评价研究质量，对研究机构组织管理、人员、设施、仪器、标准操作规程（SOP）和资料档案进行的规范化要求。覆盖安全性评价机构认证、供试品检测、年度报告等。",r:["gmp","nmpa","cfdi"]},
  {id:"gcp",t:"药物临床试验质量管理规范",e:"GCP",c:"sys",d:"Good Clinical Practice，对临床试验全过程（方案设计、组织实施、监查、稽查、记录、分析、报告）的标准规定，保障受试者权益与安全、保证数据真实可靠。现行依据ICH E6(R3)及2026年修订版公告。",r:["gmp","ich","imp","nmpa"]},
  {id:"gdp",t:"药品经营质量管理规范",e:"GSP",c:"sys",d:"Good Supply Practice，药品在流通环节（购进、储存、销售、运输）的质量管理规范，与GMP共同保障药品全生命周期质量。",r:["gmp","mau"]},
  {id:"pqs",t:"药品质量管理体系",e:"PQS / ICH Q10",c:"sys",d:"Pharmaceutical Quality System，ICH Q10提出的贯穿产品生命周期的集成化质量管理体系，包含四大要素：工艺性能与产品质量监控系统、纠正与预防措施（CAPA）系统、变更管理系统、工艺与产品质量回顾与管理评审。是GMP的顶层框架。",r:["gmp","capa","biangeng","apr","cpv","qrm"]},
  {id:"ich",t:"国际人用药品注册技术协调会",e:"ICH",c:"sys",d:"International Council for Harmonisation，制定药品注册技术指导原则的国际组织，分Q（质量）、S（安全）、E（有效）、M（多学科）四大系列。中国2017年成为管理委员会成员，Q系列为核心质量指导原则（Q1稳定性、Q2分析方法、Q3杂质、Q4药典、Q5生物、Q6标准、Q7原料药、Q8研发、Q9风险、Q10体系、Q11原料药开发、Q12生命周期、Q13连续制造、Q14分析方法开发）。",r:["gmp","gcp","qbd","q8","q9","q11","q12","q13","q3a","q3c","q3d","m7","q5a","q1a","q1b","q2","q14"]},
  {id:"q8",t:"ICH Q8 药物研发",e:"Q8",c:"proc",d:"药物研发指导原则，提出传统研发与增强方法(QbD)两条路径，强调在科学理解与质量风险管理基础上、从研发阶段即系统设计产品与工艺；定义设计空间、控制策略与实时放行(RTRT)等核心概念，是 ICH Q9/Q10/Q11/Q12/Q13 的上游基石。",r:["ich","qbd","cqa","cpp","qrm"]},
  {id:"q12",t:"ICH Q12 药品生命周期管理",e:"Q12",c:"proc",d:"药品生命周期管理的指导原则，建立一致的上市后变更管理框架，引入既定条件(EC)与上市后变更管理方案(PACMP)等工具，使已批准的变更可在预设路径下高效执行、减少重复申报，支撑产品全生命周期持续革新。",r:["ich","biangeng","biangengkz","pqs","qrm","kbyx"]},
  {id:"q2",t:"ICH Q2 分析方法论证",e:"Q2",c:"cqa",d:"分析方法论证(Analytical Validation)指导原则，规定鉴别、杂质检查、含量测定等分析方法的专属性、准确性、精密度、线性、范围、检测限(LOD)、定量限(LOQ)、耐用性等验证项目与可接受标准，按检验目的区分要求；与 ICH Q14（分析方法开发）形成「开发—论证」闭环。",r:["ich","q14","zhiliang","q1a"]},
  {id:"q14",t:"ICH Q14 分析方法开发",e:"Q14",c:"cqa",d:"分析方法开发指导原则，提出增强方法开发（科学风险驱动、先验知识+实验设计DoE）、分析方法生命周期管理与所属空间(established range / 可报告范围)等概念，强调方法在上市后持续监控与变更，与 Q2 配套。",r:["ich","q2","zhiliang"]},
  {id:"nmpa",t:"国家药品监督管理局",e:"NMPA",c:"sys",d:"中国国家药品监督管理部门，负责药品、医疗器械、化妆品的注册、生产、经营、使用环节监管与GMP认证/检查。",r:["gmp","cde","cfdi","mau","guanlian"]},
  {id:"cde",t:"药品审评中心",e:"CDE",c:"sys",d:"药品注册技术审评机构，负责化学药、中药、生物制品等注册申请的技术审评，发布各类药学技术指导原则。",r:["nmpa","q11","q13","q3a","q3d","m7","guanlian","virus"]},
  {id:"cfdi",t:"食品药品审核查验中心",e:"CFDI",c:"sys",d:"负责GMP符合性检查、注册核查、飞行检查、境外检查的技术机构，发布各类检查指南（共线生产、工艺验证、细胞治疗、清洁验证等）。",r:["nmpa","gmp","ccs","cleaning","gongxian","virus","wuxian"]},
  {id:"mau",t:"药品上市许可持有人",e:"MAH",c:"sys",d:"Marketing Authorization Holder，取得药品注册证书的企业或研制机构，对药品全生命周期（研制、生产、经营、使用）质量与风险承担主体责任，可自行生产也可委托生产/经营，须签订质量协议。",r:["gmp","weituo","zhiliangxy","gys","fayun","apr","gdp"]},
  {id:"weituo",t:"委托生产",e:"Contract Manufacturing",c:"sys",d:"持有人委托符合条件的企业生产药品。受托方须具备相应GMP条件，持有人承担主体责任，双方须签质量协议并明确质量责任、变更沟通与召回义务。",r:["mau","zhiliangxy","gmp"]},
  {id:"zhiliangxy",t:"质量协议",e:"Quality Agreement",c:"sys",d:"持有人与受托生产企业/关键物料供应商就质量责任、技术标准、变更控制、偏差处理、投诉召回、信息沟通等达成的书面协议，是委托生产与供应链管理的基础文件。",r:["mau","weituo","gys"]},

  // ===== 质量风险 =====
  {id:"qrm",t:"质量风险管理",e:"QRM / ICH Q9",c:"risk",d:"Quality Risk Management，ICH Q9定义的、对药品质量风险进行评估、控制、沟通、审核的系统化过程。贯穿物料、工艺、设备、共线、变更等各环节，是QbD与PQS的基础思维。",r:["q9","gmp","pqs","fmea","yugu","gongxian","cpp","cqa"]},
  {id:"q9",t:"ICH Q9 质量风险管理",e:"Q9(R1)",c:"risk",d:"提供质量风险管理的原则与常用工具（FMEA、HACCP、故障树分析、鱼骨图、流程图、风险矩阵等），并明确管理流程：风险评估—风险控制—风险沟通—风险审核。",r:["ich","qrm","fmea","yugu"]},
  {id:"fmea",t:"失效模式与效应分析",e:"FMEA",c:"risk",d:"Failure Mode and Effects Analysis，识别潜在失效模式、原因与后果，并以严重度/发生概率/可检测性（RPN）排序风险的工具，常用于工艺、设备与共线风险评估。",r:["qrm","q9","yugu","gongxian"]},
  {id:"yugu",t:"鱼骨图（因果图）",e:"Ishikawa",c:"risk",d:"以人、机、料、法、环、测（5M1E）为维度分析质量问题潜在原因的工具，常与FMEA配合用于偏差调查与风险评估。",r:["q9","fmea","piancha"]},
  {id:"hbel",t:"健康暴露限度",e:"HBEL",c:"risk",d:"Health-Based Exposure Limit，基于毒性数据（如PDE）推导的、用于共线生产交叉污染控制的 allowable 暴露限度。现行国际（EU 2018问答）优先采用HBEL/PDE方法，取代传统10ppm、1/1000日剂量等经验限度。",r:["pde","gongxian","cleaning","qingjie"]},
  {id:"pde",t:"每日允许暴露量",e:"PDE",c:"risk",d:"Permitted Daily Exposure，基于无可见有害作用水平（NOAEL）等毒理数据、经种属/个体差异校正系数计算的、终生每日摄入不产生可察觉风险的剂量，是HBEL的计算基础，用于残留限度与共线评估。",r:["hbel","q3d","gongxian","cleaning"]},

  // ===== 物料 =====
  {id:"wuliao",t:"物料",e:"Material",c:"mat",d:"GMP中泛指原料、辅料、包装材料等药品生产的物质基础，须建立接收、储存、标识、取样检验、放行、发放与使用的全过程控制，防止混淆、差错与污染。",r:["gmp","yaofl","yaobc","wuliaobz","dailing","wuliaoph","liuyang","gys","jieshou","quyang"]},
  {id:"qishi",t:"起始物料",e:"Starting Material",c:"mat",d:"原料药（API）合成路线起点的重要原料。其选择须基于对工艺理解与杂质谱控制（ICH Q11），通常具有既定化学结构、商业可得、在工艺早期引入，且下游步骤足以清除其杂质。",r:["q11","yuanliao","youguan","impurity"]},
  {id:"yuanliao",t:"原料药",e:"API",c:"mat",d:"Active Pharmaceutical Ingredient，用于药品制造的、具有药理活性的物质。其生产须符合ICH Q7，关注晶型、粒度、有关物质、手性杂质、元素/致突变杂质与稳定性。",r:["q7","qishi","jingxing","youguan","q3a","q3d","m7","wuliao","shengwu"]},
  {id:"yaofl",t:"药用辅料",e:"Excipient",c:"mat",d:"药物制剂中除活性成分以外、在安全性方面已合理评估并包含在制剂中的物质。实行关联审评审批（2019年56号公告），2025年第1号公告发布辅料附录，强调功能性、安全性与质量一致性。",r:["guanlian","wuliao","yaobc","nmpa"]},
  {id:"yaobc",t:"药包材",e:"Packaging Material",c:"mat",d:"直接接触药品的包装材料与容器。须符合适用性并与药品相容（相容性研究），2025年第1号公告发布药包材附录；无菌制剂须关注容器密封完整性（CCI）。",r:["guanlian","yaofl","xcl","wuliao","nmpa"]},
  {id:"guanlian",t:"关联审评审批",e:"Linked Review",c:"mat",d:"原料药、药用辅料、药包材在制剂注册申请时与制剂关联申报审评，不再单独发放批准文号（2019年第56号公告）。制剂持有人对整体质量负责，供应商须登记并动态维护。",r:["yaofl","yaobc","nmpa","cde","mau"]},
  {id:"wuliaobz",t:"物料质量标准",e:"Material Spec",c:"mat",d:"规定物料鉴别、含量、杂质、微生物等控制项目的文件，须经质量部门批准，作为接收检验与放行的依据；变更须走变更控制。",r:["wuliao","jieshou","fangxing","biangeng"]},
  {id:"gys",t:"供应商管理",e:"Supplier Management",c:"mat",d:"对物料供应商的审计、评估、批准与持续监控，含质量协议、现场审计、质量档案与定期回顾，是物料风险控制的第一道关口。",r:["wuliao","zhiliangxy","mau","fangxing","audit"]},
  {id:"dailing",t:"待验",e:"Quarantine",c:"mat",d:"物料或产品处于等待检验结果以决定是否放行的隔离状态，须物理/电子标识并存放于待验区，防止误用。",r:["wuliao","jieshou","fangxing"]},
  {id:"wuliaoph",t:"物料平衡",e:"Material Balance",c:"mat",d:"理论产量与实际产量在规定限度内的比较，用于发现潜在混淆、丢失或差错，是生产过程监控与偏差预警的重要手段。",r:["wuliao","piancha","shengchan"]},
  {id:"liuyang",t:"留样",e:"Retention Sample",c:"mat",d:"按规定条件与期限保存的、用于追溯与必要时复检的样品，原料、中间体、成品均须留样管理。",r:["wuliao","fangxing"]},

  // ===== 工艺与验证 =====
  {id:"gongyi",t:"工艺",e:"Process",c:"proc",d:"将物料转化为符合预定用途药品的操作过程与参数集合，是产品质量形成的核心。须以工艺规程固定，并通过工艺验证确认其可靠性。",r:["cpp","gongygz","bpr","gongyzy","cpv","qbd","iqoqpq"]},
  {id:"cpp",t:"关键工艺参数",e:"CPP",c:"proc",d:"Critical Process Parameter，其变动对关键质量属性（CQA）有潜在影响、须控制在适当范围的工艺参数。通过风险评估与工艺表征确定（ICH Q8），并在工艺规程与监控中重点管控。",r:["cqa","qbd","gongybf","shejikj","doe","gongyzy","cpv"]},
  {id:"qbd",t:"质量源于设计",e:"QbD / ICH Q8",c:"proc",d:"Quality by Design，ICH Q8理念：在科学理解与质量风险管理基础上，从研发阶段即系统设计产品质量（而非仅靠终端检验），确立CQA、CPP、设计空间与控制策略。",r:["ich","cqa","cpp","shejikj","gongyka","qrm"]},
  {id:"shejikj",t:"设计空间",e:"Design Space",c:"proc",d:"经证明能保证质量的物料属性与工艺参数的多维组合与交互作用范围（ICH Q8）。在设计空间内操作不视为变更；超出则需走变更控制。",r:["qbd","cpp","cqa","biangeng"]},
  {id:"gongyka",t:"工艺开发",e:"Process Development",c:"proc",d:"从实验室到商业规模的工艺研究与优化，通过DoE与中试确立CQA、CPP、设计空间与控制策略，是QbD的落地过程。",r:["qbd","cpp","cqa","zhongshi","doe","gongybf"]},
  {id:"doe",t:"实验设计",e:"DoE",c:"proc",d:"Design of Experiments，以多因素、多水平系统化安排实验，识别CQA与CPP间交互作用、确立设计空间与参数范围的统计方法，避免单纯单因素试验的局限。",r:["gongyka","cpp","cqa","zhongshi","gongybf"]},
  {id:"gongybf",t:"工艺表征",e:"Process Characterization",c:"proc",d:"在代表性/最差条件下开展实验，量化CQA–CPP关联、确定关键参数及其可接受范围（PAR）或设计空间的活动，是工艺验证的前提。",r:["cpp","cqa","doe","gongyzy","shejikj"]},
  {id:"gongyzy",t:"工艺验证",e:"Process Validation",c:"proc",d:"证明工艺在预定参数下能持续可靠地生产出符合标准产品的活动。FDA/国际通行三阶段：工艺设计—工艺确认（IQ/OQ/PQ）—持续工艺确认（CPV）。",r:["iqoqpq","cpv","cpp","gongyi","gongybf","pq","zhongshi"]},
  {id:"iqoqpq",t:"安装/运行/性能确认",e:"IQ/OQ/PQ",c:"proc",d:"设备/系统确认三阶段：安装确认（IQ，符合设计与采购要求）、运行确认（OQ，在预期操作范围内运行）、性能确认（PQ，在商业化条件下持续产出合格产品）。",r:["gongyzy","cpv","shebei","pq"]},
  {id:"pq",t:"性能确认",e:"PQ",c:"proc",d:"Performance Qualification，确认与商业化生产相同条件下、由训练有素人员使用既定方法能持续生产出符合标准的产品，是工艺验证第三阶段的商业化确认。",r:["iqoqpq","gongyzy","cpv"]},
  {id:"cpv",t:"持续工艺确认",e:"CPV",c:"proc",d:"Continued Process Verification，工艺验证第三阶段，在商业生产中持续收集与分析工艺数据与质量属性，证明工艺维持在受控状态，是PQS的监控组成。",r:["gongyzy","pq","iqoqpq","cqa","apr","pqs"]},
  {id:"gongygz",t:"工艺规程",e:"Master Formula",c:"proc",d:"经批准的标准文件，规定生产工艺、关键参数、控制要求与操作顺序，是生产操作与批生产记录编制的依据。",r:["gongyi","bpr","cpp"]},
  {id:"bpr",t:"批生产记录",e:"BPR",c:"proc",d:"Batch Production Record，记录每批产品生产的全部操作与结果的文件，须及时、真实、完整地填写，是数据完整性与批放行的核心依据。",r:["gongyi","gongygz","shujuwc","fangxing"]},
  {id:"gongyzy2",t:"工艺转移",e:"Tech Transfer",c:"proc",d:"将工艺从一个场地/场地规模转移至另一场地，须进行对比研究、风险评估与验证，确保接收方均能稳定重现产品质量。",r:["gongyka","gongyzy","biangeng","kbyx"]},
  {id:"biangeng",t:"工艺变更",e:"Process Change",c:"proc",d:"生产工艺（路线、参数、规模、场地、设备）的改变，按风险分级（重大/中等/微小）开展可比性研究与验证，重大变更须经批准。",r:["kbyx","biangengkz","pqs","shejikj","gongyzy2"]},
  {id:"q13",t:"连续制造",e:"Continuous Mfg / ICH Q13",c:"proc",d:"原料连续输入、产品连续输出的生产方式（ICH Q13），对比传统批生产具有实时过程控制、减小在制品库存、快速响应等优势，须配套实时放行（RTRT）与模型。",r:["ich","gongyi","gongyzy","cpv"]},
  {id:"zhongshi",t:"中试放大",e:"Pilot Scale",c:"proc",d:"从小试到商业规模的过渡研究，考察放大效应（传热/传质/混合），确立可转移的工艺参数；中药申报临床须提供≥1批稳定中试数据。",r:["gongyka","gongyzy","doe","cpp","tcm"]},

  // ===== 质量属性 =====
  {id:"cqa",t:"关键质量属性",e:"CQA",c:"cqa",d:"Critical Quality Attribute，产品物理、化学、生物或微生物性质，应在适当限度/范围/分布内以保证预期质量（ICH Q8）。由QTPP自上而下推导、经风险评估与实验确证，是控制策略的核心对象。",r:["qtpp","cpp","qbd","gongybf","kzcl","youguan","rongji","yuansu","m7","jingxing","rongjie","ronghe","xiaodu","xiaoshou","xcl","bukejian"]},
  {id:"qtpp",t:"目标产品质量概况",e:"QTPP",c:"cqa",d:"Quality Target Product Profile，基于预期用途与质量需求定义产品关键质量特性的前瞻性概要，是CQA推导的起点（ICH Q8），涵盖剂型、给药途径、规格、稳定性与安全性预期。",r:["cqa","qbd","kzcl"]},
  {id:"youguan",t:"有关物质",e:"Related Substances / Q3A·Q3B",c:"cqa",d:"药品中存在的、非预期的结构与活性成分不同的微量杂质。ICH Q3A（原料药）/Q3B（制剂）规定鉴定限度与质控限度，关注降解产物与工艺杂质。",r:["cqa","q3a","q3b","yuanliao","impurity","m7"]},
  {id:"q3a",t:"ICH Q3A 新原料药杂质",e:"Q3A(R2)",c:"cqa",d:"规定新原料药中有机杂质的报告、鉴定与质控限度，以及降解产物控制原则。",r:["ich","youguan","yuanliao","impurity"]},
  {id:"q3b",t:"ICH Q3B 新药制剂杂质",e:"Q3B(R2)",c:"cqa",d:"规定新药制剂中降解产物与工艺杂质的限度与鉴定阈值，与Q3A衔接。",r:["ich","youguan","impurity"]},
  {id:"rongji",t:"残留溶剂",e:"Residual Solvents / Q3C",c:"cqa",d:"原料药/制剂中残留的有机溶剂（ICH Q3C分类：一类应避免、二类限度控制、三类低毒）。限度基于每日允许暴露量（PDE）设定。",r:["cqa","q3c","pde","yuanliao"]},
  {id:"q3c",t:"ICH Q3C 残留溶剂",e:"Q3C(R9)",c:"cqa",d:"按健康风险对残留溶剂分类（一类禁用/限用、二类限度控制、三类低毒）并给出可接受浓度的指导原则。",r:["ich","rongji","pde"]},
  {id:"yuansu",t:"元素杂质",e:"Elemental Impurities / Q3D",c:"cqa",d:"药品中存在的金属元素杂质（ICH Q3D），按口服/注射/吸入等给药途径以PDE控制，关注催化剂与环境引入物。",r:["cqa","q3d","pde","yuanliao"]},
  {id:"q3d",t:"ICH Q3D 元素杂质",e:"Q3D(R2)",c:"cqa",d:"规定原料药与制剂中元素杂质的评估与控制策略，按给药途径给出各类元素的PDE。",r:["ich","yuansu","pde"]},
  {id:"m7",t:"致突变杂质",e:"Mutagenic Impurities / ICH M7",c:"cqa",d:"具致突变性、可能致癌的杂质（ICH M7），按风险分级控制：已知致突变致癌物按可接受摄入（AI）控制，其余按阈值（TTC）管理，并关注警示结构。",r:["cqa","youguan","impurity","qrm"]},
  {id:"jingxing",t:"晶型",e:"Polymorph",c:"cqa",d:"药物多晶型（同一分子不同晶体排列），影响溶解度、生物利用度与工艺行为。须控制优势晶型与粒度分布，避免转晶导致质量波动。",r:["cqa","yuanliao","rongjie","gongyi"]},
  {id:"rongjie",t:"溶出度",e:"Dissolution",c:"cqa",d:"固体制剂在规定条件下从剂型中释放活性成分的速度与程度，是口服制剂关键CQA，常作为体内生物等效性的体外替代指标。",r:["cqa","kfzt","jingxing"]},
  {id:"ronghe",t:"指纹图谱",e:"Fingerprint",c:"cqa",d:"中药等复杂体系的特征色谱/光谱图，以整体特征评价质量一致性，是中药CQA的重要表征手段。",r:["cqa","tcm","zhiliang"]},
  {id:"xiaodu",t:"效价",e:"Potency",c:"cqa",d:"生物制品/抗生素等以生物学方法测定的、反映产品特定生理活性的指标，是生物制品核心CQA。",r:["cqa","shengwu","chundu"]},
  {id:"chundu",t:"纯度",e:"Purity",c:"cqa",d:"生物制品中目标产物的含量，关注聚集体、宿主细胞蛋白（HCP）、残留DNA等工艺相关杂质。",r:["cqa","shengwu","xiaodu","virus"]},
  {id:"xcl",t:"容器密封完整性",e:"CCI",c:"cqa",d:"Container Closure Integrity，包装系统防止微生物侵入与内容物泄漏的能力，是无菌制剂关键CQA，须通过密封完整性试验（如染色、真空泄漏、氦质谱）验证。",r:["cqa","yaobc","wuxian","ccs"]},
  {id:"xiaoshou",t:"可见异物",e:"Visible Particles",c:"cqa",d:"注射剂等目视可见的外来物质或容器缺陷，须通过灯检或在线检测控制，属无菌/非无菌注射剂关键CQA。",r:["cqa","wuxian","bukejian"]},
  {id:"bukejian",t:"不溶性微粒",e:"Subvisible/Insoluble Particles",c:"cqa",d:"注射剂中不溶性的外来颗粒，须以光阻法/显微计数法控制限度，反映生产洁净与包装完整性。",r:["cqa","xiaoshou","wuxian"]},

  // ===== 数据与计算机化 =====
  {id:"shujuwc",t:"数据完整性",e:"Data Integrity",c:"data",d:"数据在整个生命周期内的全面性、一致性与可信性，遵循ALCOA+原则（可归因、清晰、同步、原始、准确，外加完整、一致、持久、可用）。是GMP合规与审计的核心。",r:["alcoa","jsjxt","sjzj","gmp","bpr"]},
  {id:"alcoa",t:"ALCOA+ 原则",e:"ALCOA+",c:"data",d:"数据完整性的国际公认基本原则：Attributable（可归因）、Legible（清晰）、Contemporaneous（同步）、Original（原始）、Accurate（准确），扩展 +Complete/Consistent/Enduring/Available（完整/一致/持久/可用）。",r:["shujuwc","jsjxt"]},
  {id:"jsjxt",t:"计算机化系统",e:"Computerized System",c:"data",d:"GMP中由计算机硬件/软件、网络与人员组成的、用于生产质量活动的系统（如LIMS、SCADA、MES），须验证、权限管理与审计追踪，是数据完整性的承载基础。",r:["shujuwc","alcoa","sjzj","gmp","gongyzy"]},
  {id:"sjzj",t:"审计追踪",e:"Audit Trail",c:"data",d:"计算机化系统自动记录的操作日志，可追溯数据的创建、修改、删除与时间/人员，是数据完整性与防篡改的核心机制，须定期审核。",r:["jsjxt","shujuwc","alcoa"]},

  // ===== 偏差·变更·CAPA =====
  {id:"piancha",t:"偏差",e:"Deviation",c:"dc",d:"偏离已批准标准/程序的情况，须记录、评估（对产品质量/注册/合规的影响）、调查与处理，重大偏差须报告监管。",r:["oos","oot","capa","yugu","gmp","wuliaoph"]},
  {id:"oos",t:"检验结果超标",e:"OOS",c:"dc",d:"Out of Specification，超出既定可接受标准的检验结果，须立即启动调查，先排查实验室原因（复测、仪器、操作）再延伸至生产/取样/储存原因。",r:["piancha","oot","capa","fangxing"]},
  {id:"oot",t:"检验结果超趋势",e:"OOT",c:"dc",d:"Out of Trend，检验结果在限度内但偏离历史趋势，提示潜在工艺漂移或系统变化，须评估是否预警。",r:["oos","piancha","capa","cpv"]},
  {id:"capa",t:"纠正与预防措施",e:"CAPA",c:"dc",d:"Corrective and Preventive Actions，为消除已发生或潜在不符合原因而采取的措施，是PQS核心要素，须根本原因分析、有效性确认与闭环。",r:["pqs","piancha","biangengkz","oos","oot"]},
  {id:"biangengkz",t:"变更控制",e:"Change Control",c:"dc",d:"对影响产品质量的变更（工艺、设备、物料、场地、标准）进行系统化管理：申请—评估—批准—实施—验证—关闭，重大变更须监管批准。",r:["biangeng","capa","pqs","wuliaobz","shejikj"]},
  {id:"kbyx",t:"可比性研究",e:"Comparability",c:"dc",d:"工艺/场地/规模变更前后产品质量、安全性与有效性的对比研究，证明变更不降低质量、可不额外开展临床，是变更分级与免临床的依据。",r:["biangeng","gongyzy2","cqa","pqs"]},

  // ===== 放行与回顾 =====
  {id:"fangxing",t:"批放行",e:"Batch Release",c:"rel",d:"质量受权人基于完整生产记录、检验结果与偏差/CAPA处理情况，批准每批产品上市放行的活动，是质量责任的最后关口。",r:["bpr","piancha","oos","gmp","pzqf","pillzh"]},
  {id:"pzqf",t:"质量受权人",e:"QP",c:"rel",d:"Qualified Person，具备资质、独立行使产品放行职责的人员，对每批产品是否符合GMP与注册要求作出放行裁决。",r:["fangxing","gmp","mau"]},
  {id:"pillzh",t:"批签发",e:"Lot Release",c:"rel",d:"对疫苗、血液制品等高风险生物制品，在上市前由指定机构对其生产与检验资料审核、必要时检验后发放销售证明的制度。",r:["fangxing","shengwu","xuezhipin","gmp"]},
  {id:"apr",t:"年度质量回顾",e:"APR",c:"rel",d:"Annual Product Review，每年对产品报告期内质量（批次、偏差、变更、OOS、稳定性、投诉、召回等）的系统回顾，识别趋势与改进机会，是PQS的回顾要素。",r:["pqs","cpv","piancha","biangeng","tousu","zhiliangld"]},
  {id:"tousu",t:"投诉与召回",e:"Complaint & Recall",c:"rel",d:"对产品投诉的调查处理与必要时启动召回，是上市后质量反馈与风险控制的闭环环节，须记录并纳入年度回顾。",r:["apr","mau","fayun","piancha"]},
  {id:"zhiliangld",t:"质量量度",e:"Quality Metrics",c:"rel",d:"以量化指标（批次合格率、偏差数、OOS率、CAPA及时率等）衡量质量管理体系绩效的工具，支撑管理评审与持续改进。",r:["apr","pqs","zhiliang"]},

  // ===== 分品种 =====
  {id:"wuxian",t:"无菌制剂",e:"Sterile Products",c:"type",d:"须保证无菌、无热原的制剂（注射剂、滴眼剂等），GMP附录无菌药品为核心，2023指南强化污染控制策略（CCS）、无菌工艺模拟、环境监测与隔离技术。",r:["ccs","wugongymn","hjjk","glsx","xcl","xiaoshou","bukejian","gmp"]},
  {id:"ccs",t:"污染控制策略",e:"CCS",c:"spec",d:"Contamination Control Strategy，2023版无菌制剂指南系统提出的、基于风险的文件化措施集合（厂房/设备/人员/工艺/物料/环境/监测），将微生物、微粒与热原污染风险降至适当水平并确保持续受控。",r:["wuxian","hjjk","wugongymn","glsx","xcl","qingjie","cfdi"]},
  {id:"hjjk",t:"环境监测",e:"EM",c:"spec",d:"对洁净区/无菌生产环境的悬浮粒子与微生物（浮游菌、沉降菌、表面/人员微生物）的持续监测，是CCS的重要组成与无菌保障的证据来源。",r:["ccs","wuxian","glsx"]},
  {id:"wugongymn",t:"无菌工艺模拟",e:"Media Fill",c:"spec",d:"以培养基替代产品的「培养基灌装」试验，在最差条件下验证无菌工艺的无菌保障能力，须规定批次、干预与可接受标准。",r:["ccs","wuxian","hjjk"]},
  {id:"glsx",t:"隔离器 / RABS",e:"Isolator/RABS",c:"spec",d:"限制进入屏障系统（RABS）与隔离器（Isolator）技术，提供无菌生产与操作的保护屏障，降低人员干预带来的污染风险。",r:["ccs","wuxian","hjjk","sus"]},
  {id:"yuanliao2",t:"原料药（分品种）",e:"API (by type)",c:"type",d:"原料药生产须符合ICH Q7，分合成、发酵、提取路线，关注晶型粒度、杂质谱与起始物料（ICH Q11）；与制剂质量直接关联。",r:["yuanliao","q7","q11","jingxing","youguan","yuanliaoyz"]},
  {id:"q7",t:"ICH Q7 原料药GMP",e:"Q7",c:"type",d:"原料药的药品生产质量管理规范指南，覆盖厂房、生产、工艺控制、物料、质量、验证等，适用于化学合成与发酵/提取原料药。",r:["ich","yuanliao","yuanliaoyz"]},
  {id:"yuanliaoyz",t:"原料药（中药/生物来源）",e:"API botanical/bio",c:"type",d:"来源于植物提取或生物技术/生物实体的原料药，其开发生产适用ICH Q11（生物技术/生物实体药物），关注生物来源一致性与病毒安全。",r:["yuanliao2","q11","shengwu","virus"]},
  {id:"kfzt",t:"口服固体制剂",e:"OSD",c:"type",d:"片剂、胶囊、颗粒等口服固体制剂，须控制制粒-压片-包衣工艺、溶出度与含量均匀度；其清洁验证与交叉污染控制是共线生产重点。",r:["rongjie","qingjie","gongxian","cleaning","gmp"]},
  {id:"tcm",t:"中药 / 天然药物",e:"TCM",c:"type",d:"中药生产强调前处理—提取—纯化—浓缩—干燥—成型，关注量质传递、中试放大与生产过程质量控制；2025年第79号公告发布中药生产监督管理专门规定。",r:"zhongshi,ronghe,zhiliang,gmp,nmpa".split(",")},
  {id:"shengwu",t:"生物制品",e:"Biologics",c:"type",d:"以生物技术制备的制品（重组蛋白、单抗、疫苗等），须建立细胞库/种子批、控制病毒安全、关注纯度/效价/电荷异质性；附录2020年第58号修订。",r:["xiaodu","chundu","virus","q5a","pillzh","yuanliaoyz","xibao"]},
  {id:"virus",t:"病毒清除",e:"Viral Clearance",c:"spec",d:"生物制品生产中通过灭活与去除步骤降低潜在病毒污染风险的策略（ICH Q5A），以各步骤对数下降值（LRV）累加评估整体清除能力。",r:["shengwu","q5a","lrv","mxbd","ptyz","chundu","cde"]},
  {id:"lrv",t:"对数下降值",e:"LRV",c:"spec",d:"Log Reduction Value，病毒清除步骤使病毒滴度降低的对数值（如LRV≥4表示下降1万倍），各步骤LRV累加评估整体病毒清除能力。",r:["virus","mxbd","ptyz"]},
  {id:"mxbd",t:"模型病毒",e:"Model Viruses",c:"spec",d:"用于病毒清除研究的代表性病毒（相关病毒/模型病毒/指示病毒），覆盖不同理化与抗性特征，以充分证明清除工艺的广谱能力。",r:["virus","lrv","ptyz"]},
  {id:"ptyz",t:"平台验证",e:"Platform Validation",c:"spec",d:"基于同类产品/工艺既往数据，对病毒清除等工艺进行跨产品的验证策略，降低重复研究负担（重组蛋白病毒清除平台验证指导原则2024）。",r:["virus","lrv","mxbd","cde"]},
  {id:"xibao",t:"细胞治疗产品",e:"Cell Therapy",c:"type",d:"CGT类活细胞产品，须采用密闭无菌工艺进行细胞扩增/基因转导，关注载体滴度、转导效率与脱靶；检查依据细胞治疗产品生产检查指南。",r:["shengwu","cfdi","gmp"]},
  {id:"xuezhipin",t:"血液制品",e:"Blood Products",c:"type",d:"以血浆为原料的制品，须血浆筛查、病毒灭活/去除与批签发；附录2024年第70号修订，强调电子化记录与全过程监管。",r:["pillzh","virus","gmp","nmpa"]},
  {id:"imp",t:"临床试验用药品",e:"IMP",c:"type",d:"用于临床试验的药品，须建立「有限但适当」的质量体系（2022年第43号附录），强调受试者保护与数据可靠，区别于商业化GMP但须防混淆污染。",r:["gcp","gmp","nmpa","cfdi"]},

  // ===== 专项 / 交叉 =====
  {id:"qingjie",t:"清洁验证",e:"Cleaning Validation",c:"spec",d:"证明清洁程序能有效去除前批产品残留、清洁剂与微生物，使交叉污染风险受控的活动；以HBEL/PDE或10ppm等传统限度设定可接受残留，须关注最难清洁部位与最差条件。",r:["gongxian","hbel","pde","kfzt","ccs","cfdi"]},
  {id:"gongxian",t:"交叉污染",e:"Cross-contamination",c:"spec",d:"不同物料/产品间的相互污染，通过专用设施、阶段性生产、密闭与粉尘控制、清洁验证与共线生产风险评估进行控制。",r:["qingjie","hbel","kfzt","gmp","fmea"]},
  {id:"cleaning",t:"清洁验证技术指南",e:"Cleaning Guideline",c:"spec",d:"CFDI发布的清洁验证技术指南（征求意见稿），细化残留限度计算、取样策略、分析方法与最差条件选择，是口服固体制剂清洁验证的实操依据。",r:["qingjie","gongxian","kfzt","cfdi"]},
  {id:"shebei",t:"厂房设施与设备",e:"Facilities & Equipment",c:"sys",d:"GMP的核心硬件基础，涵盖洁净厂房分级、HVAC、水系统、设备确认（IQ/OQ/PQ）与维护，须与产品风险相匹配。",r:["gmp","iqoqpq","wuxian","ccs","qingjie"]},
  {id:"shengchan",t:"生产管理",e:"Production",c:"sys",d:"涵盖生产操作、批次管理、物料发放、过程控制与清场，强调防止混淆差错污染，是GMP现场执行主体。",r:["gmp","gongyi","bpr","wuliaoph","qingjie"]},
  {id:"zhiliang",t:"质量控制实验室",e:"QC Lab",c:"sys",d:"负责物料与产品检验的部门，须建立质量标准、方法学验证、取样与OOS管理，是批放行与质量判定的技术支撑。",r:["gmp","fangxing","wuliaobz","oos","ronghe","quyang","q2","q14"]},
  {id:"audit",t:"质量审计",e:"Audit",c:"sys",d:"对供应商、受托方与自身的系统化检查，分供应商审计、内部审计与监管检查，是PQS与供应商管理的重要手段。",r:["gys","mau","pqs","weituo"]},
  {id:"fayun",t:"发运与召回",e:"Distribution & Recall",c:"sys",d:"药品发运须防止运输污染混淆，召回是发现重大质量风险时收回已上市产品的应急机制，持有人负主体责任。",r:["mau","tousu","gmp","shebei"]},
  {id:"impurity",t:"杂质",e:"Impurity",c:"cqa",d:"药品中存在的非预期物质，分有机杂质（有关物质）、残留溶剂、元素杂质与致突变杂质，由Q3系列与M7分别控制。",r:["youguan","rongji","yuansu","m7","q3a","q3b"]},

  // ===== 补充术语（补全关联关系） =====
  {id:"jieshou",t:"物料接收与取样检验",e:"Receipt & Sampling",c:"mat",d:"物料到货后的接收核对（品名、批号、数量、包装、合格证）、待验隔离与按质量标准取样检验，合格后方可放行使用，是防止不合格物料流入生产的第一道关口。",r:["wuliao","dailing","wuliaobz","fangxing","zhiliang","gys","quyang"]},
  {id:"q11",t:"ICH Q11 原料药开发和生产",e:"Q11",c:"proc",d:"规定原料药（化学实体与生物技术/生物实体药物）的开发与生产原则，明确起始物料的选择与论证、工艺开发、杂质控制、工艺验证与生命周期管理，是原料药质量研究的核心指导原则。",r:["ich","qishi","yuanliao","yuanliao2","yuanliaoyz","cpp","gongyka"]},
  {id:"q5a",t:"ICH Q5A 病毒安全性",e:"Q5A",c:"sys",d:"生物技术产品病毒安全性指导原则，规定来源于细胞（含重组DNA、杂交瘤、转基因动物/植物）产品的潜在病毒污染风险评估与清除策略（灭活+去除），是生物制品病毒清除研究的上位依据。",r:["ich","shengwu","virus","yuanliaoyz","chundu","ptyz"]},
  {id:"kzcl",t:"控制策略",e:"Control Strategy",c:"proc",d:"Control Strategy，ICH Q8/Q10提出的、源于对产品与工艺理解、基于CQA–CPP关联的、确保工艺维持受控状态的一组有计划控制（如物料标准、工艺参数控制、中控、放行检验、监测）。是QbD的落地输出。",r:["cqa","cpp","qbd","gongybf","pqs","cpv"]},
  {id:"sus",t:"一次性系统",e:"SUS",c:"spec",d:"Single-Use System，生物制品等生产中使用的、免清洗灭菌的一次性组件（袋、管路、滤芯、生物反应器），降低交叉污染风险、缩短换批时间并减轻清洁验证负担，须在CCS与污染控制中评估其相容性与完整性。",r:["glsx","shengwu","ccs","qingjie","chundu"]},
  {id:"q1a",t:"ICH Q1A 稳定性研究",e:"Q1A",c:"cqa",d:"新原料药和制剂的稳定性研究指导原则，规定批次选择、放置条件（长期/加速/中间）、检测频率与限度，以确立有效期（货架期）与储存条件；与Q1B（气候带）、Q5C（生物制品稳定性）衔接。",r:["ich","apr","zhiliang","q2","q1b"]},
  {id:"q1b",t:"ICH Q1B 光稳定性与气候带",e:"Q1B",c:"cqa",d:"稳定性研究的配套指导原则，含两部分：① 光稳定性试验（参照ICH Q1B，对原料药与制剂进行可见光/紫外光照挑战，评估光降解敏感性与遮光包装必要性）；② 气候带(Climatic Zones)定义——全球划分为I(温带,21°C/45%RH)、II(亚热带/地中海,25°C/60%RH)、III(干热,30°C/35%RH)、IV(湿热,30°C/65%RH)四带，中国属II带，长期试验采用25°C/60%RH，据此确立有效期与储存条件。",r:["ich","q1a","apr","zhiliang"]},
  {id:"quyang",t:"GMP附录·取样",e:"Sampling",c:"mat",d:"规定物料、中间产品与成品的取样操作规程，包括取样方案、取样人员资质、取样工具与环境、代表性样品、留样与防止污染；是物料接收检验与质量控制的前置环节，须保证样品代表性与可追溯。",r:["wuliao","jieshou","zhiliang","liuyang","fangxing"]},

  // ===== 补充：其余 GMP 附录（放射性/中药饮片/医用氧/制药用水） =====
  {id:"radio",t:"放射性药品",e:"Radiopharmaceuticals",c:"type",d:"含放射性核素、用于诊断或治疗的药品，须符合GMP附录《放射性药品》特殊要求：辐射防护、短效期、专用生产与灭菌、活度与核素纯度控制，并满足放射性物质运输安全规定。",r:["gmp","nmpa","shengchan","zhiliang"]},
  {id:"ypian",t:"中药饮片",e:"Herbal Pieces",c:"type",d:"药材经净制、切制、炮炙等炮制加工后、可直接用于中医临床或制剂生产的药品。GMP附录《中药饮片》要求炮制依法度、毒性饮片专用设施、仓储防虫霉与批记录可追溯。",r:["tcm","gmp","nmpa","shengchan"]},
  {id:"oxygen",t:"医用氧",e:"Medical Oxygen",c:"type",d:"用于临床医疗的氧（包括液态氧），须符合GMP附录《医用氧》要求：空气压缩分离制得、无油洁净、纯度≥99.5%，并对水分、CO₂、CO 与微生物进行控制。",r:["gmp","shengchan","zhiliang","yaobc"]},
  {id:"pwater",t:"制药用水",e:"Pharma Water",c:"sys",d:"药品生产与设备清洗用水，按用途分饮用水、纯化水、注射用水（WFI）与纯蒸汽。须控制微生物/内毒素、TOC/电导率，WFI 通常 80℃以上循环或 4℃以下储存，是无菌与生物制品厂房设施的核心系统。",r:["gmp","ccs","shebei","wuxian","shengwu","yaobc"]}
];

/* ============== 深化条目：定义 + 条款对照 + 示例（ICH 指导原则 / GMP 附录） ============== */
const DEEP = {
  "q9":{
    clauses:[
      {src:"ICH Q9(R1)",art:"2. 质量风险管理的原则",txt:"应以科学知识和工艺经验为基础，最终保护患者；执行水平须与风险等级相称，并将管理整合到质量管理体系。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q9(R1)",art:"3. 质量风险管理流程",txt:"风险评估（识别/分析/评价）—风险控制—风险沟通—风险审核，形成四步闭环，支持决策。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q9(R1)",art:"附录I/II 常用工具",txt:"FMEA、HACCP、故障树分析(FTA)、鱼骨图、风险排序与过滤(PR&F)、预先危险分析(PHA)。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "无菌制剂 CCS：以 FMEA 识别人员/环境/物料/设备污染源，按严重度(R)×发生概率(P)×可检测性(D)排序，确定环境监测与干预重点。",
      "共线生产：用 HACCP 识别高活性成分交叉污染关键控制点(CCP)，制定专用/密闭/清洁措施并纳入质量协议。"
    ]
  },
  "pqs":{
    clauses:[
      {src:"ICH Q10",art:"2. 药品质量体系(PQS)",txt:"贯穿产品生命周期，含四大要素：工艺性能与产品质量监控、CAPA、变更管理、管理评审与持续改进。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q10",art:"3. 生命周期各阶段",txt:"研发、技术转移、商业生产、产品终止各阶段均须 PQS 支撑，并与 ICH Q8/Q9 衔接。",url:"https://www.cde.org.cn/"},
      {src:"GMP(2010)",art:"质量管理部门职责",txt:"企业须设独立质量管理部门，履行审核放行、偏差处理、变更控制、供应商审计、投诉与召回等职责。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"}
    ],
    examples:[
      "年度质量回顾(APR)作为 PQS 的回顾要素，每年汇总偏差/OOS/变更/稳定性趋势，识别改进机会并触发 CAPA。",
      "偏差→CAPA→变更控制闭环：根本原因分析(RCA)后更新 SOP，并纳入管理评审量化指标。"
    ]
  },
  "q11":{
    clauses:[
      {src:"ICH Q11",art:"5. 起始物料",txt:"应选择在工艺中较早引入、具既定结构、商业可得者；其选择须论证对杂质谱与工艺理解的影响，下游步骤须足以清除其杂质。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q11",art:"6. 工艺开发与控制策略",txt:"基于科学理解与风险评估建立控制策略，区分关键/非关键步骤，鼓励采用 QbD 方法。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q11 Q&A",art:"附录 常见问题",txt:"问答澄清起始物料论证、杂质去向、生命周期方法、生物技术药物开发等实务问题。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "某合成 API 选择中间体 B 为起始物料，论证其具商业来源且后续 3 步足以清除基因毒性杂质，获 CDE 认可。",
      "生物来源 API 依 Q11 生物技术部分，建立细胞库/病毒安全性控制策略与杂质谱监控。"
    ]
  },
  "q13":{
    clauses:[
      {src:"ICH Q13",art:"3. 连续制造的定义与模型",txt:"原料连续输入、产品连续输出的生产方式，含纯连续、半连续、混合(连续+批)多种模型。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q13",art:"4. 控制策略",txt:"强调实时过程分析技术(PAT)、实时放行(RTRT)、物料可追溯性与稳态/动态控制的整合。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q13",art:"5. 工艺验证与监管",txt:"采用增强方法（增强工艺设计+持续工艺确认），批次定义可灵活按时间间隔或产出量划分。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "连续直接压片线：近红外(NIR)在线监测含量均匀度，结合模型实时反馈调整，实现实时放行(RTRT)。",
      "连续制造主批记录按时间窗定义批，配套物料质量追溯与异常自动剔除逻辑。"
    ]
  },
  "m7":{
    clauses:[
      {src:"ICH M7(R2)",art:"5. 风险分类(1–5类)",txt:"1类已知致突变致癌物按 AI 控制；2类按 TTC；3类含警示结构但无致突变数据须研究；4类关注但无致突变；5类低风险。",url:"https://www.cde.org.cn/"},
      {src:"ICH M7(R2)",art:"6. 可接受摄入",txt:"1类按可接受摄入(AI)限度；2/3类按毒理学关注阈值(TTC，1.5 µg/天)；终生暴露适用，短期暴露可用更高限度。",url:"https://www.cde.org.cn/"},
      {src:"ICH M7(R2)",art:"7. 控制策略",txt:"基于构效关系(SAR)预测警示结构，优先采用工艺控制+终产品检测组合，减少动物试验。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "亚硝胺类(NDMA)：按 1 类，依终生 AI（如 96 ng/天）控制，原料药与制剂均需评估来源与去向。",
      "中间体含警示结构(如卤代烷)：经 Ames 试验确认阴性后归 4 类，仅工艺控制、无需终产品限度。"
    ]
  },
  "q3d":{
    clauses:[
      {src:"ICH Q3D(R2)",art:"3. 风险评估",txt:"按给药途径(口服/注射/吸入/透皮)评估元素杂质来源(工艺添加、设备、环境、包材)，绘制元素谱。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q3D(R2)",art:"4. 控制阈值(PDE)",txt:"给出各元素按途径的 PDE；1/2/3 类，关注类(1类)须评估，2/3类超 PDE 须控制。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q3D(R2)",art:"5. 控制策略",txt:"优先工艺控制，必要时加内控标准；包材可提取物/浸出物评估纳入元素杂质管理。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "注射剂催化剂钯(Pd)残留：依 Q3D 注射 PDE(10 µg/天)计算限度，靠工艺除钯步骤控制。",
      "玻璃包材元素浸出：考察硼/铝/砷等，依 Q3D 评估可提取物与浸出物风险并设限度。"
    ]
  },
  "wuxian":{
    clauses:[
      {src:"GMP无菌药品附录",art:"第三条 洁净级别",txt:"A/B/C/D 四级，A级为 0.36–0.54 m/s 单向流；核心灌装/分装/加塞在 A级，背景 B级。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"},
      {src:"GMP无菌药品附录",art:"第十七条 无菌工艺模拟",txt:"培养基灌装每班次每 6 个月至少一次，覆盖最差条件(最长时限、最多干预、最大批量)。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"},
      {src:"GMP无菌药品附录",art:"第四十八条 环境监测",txt:"动态监测浮游菌/沉降菌/表面/人员，设警戒限与纠偏限，OOS/OOT 须调查。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"},
      {src:"EU GMP 附录1(2022)",art:"CCS 强制要求",txt:"首次将污染控制策略(CCS)列为强制性整体策略，我国 2023版《无菌制剂》指南已全面对接。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"}
    ],
    examples:[
      "注射剂灌装：A级单向流下无菌灌装，背景 B级，RABS 隔离，每批动态 EM 监测浮游菌。",
      "冻干粉针：轧盖在 A级，CCI 真空衰减法验证，灯检剔除可见异物(xiaoshou)与不溶性微粒(bukejian)。"
    ]
  },
  "ccs":{
    clauses:[
      {src:"2023无菌制剂指南",art:"2.1.2 污染控制策略",txt:"以科学风险为基础，对微生物/热原(内毒素)/微粒污染来源系统识别控制，文件化并定期回顾。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"},
      {src:"EU GMP 附录1(2022)",art:"CCS 范围",txt:"覆盖厂房/设备/人员/工艺/物料/环境/监测七要素，确保污染持续受控。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"},
      {src:"GMP无菌药品附录",art:"第三十八条 人员",txt:"洁净区人数严控，无菌更衣确认 + 表面监测，作为 CCS 的人员要素。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"}
    ],
    examples:[
      "CCS 文件化：将 HVAC 压差报警、人员监测、EM 超标调查、培养基灌装再验证统一纳入年度回顾。",
      "隔离器(RABS)手套完整性测试与传递舱 VHP 灭菌验证，作为 CCS 屏障要素的证据链。"
    ]
  },
  "qingjie":{
    clauses:[
      {src:"清洁验证技术指南(征,2024)",art:"残留限度",txt:"三种方法取最严：10ppm、日剂量 1/1000、PDE(基于健康限度)；HBEL/PDE 优先于传统限度。",url:"https://www.cfdi.org.cn/cfdi/resource/news/16001.html"},
      {src:"共线生产指南(2023)",art:"风险评估",txt:"前瞻性识别共线危害与交叉污染路径，建立 HBEL，高活性/高致敏须评估是否专用设施。",url:"https://www.cfdi.org.cn/cfdi/resource/news/15186.html"},
      {src:"确认与验证附录(2015第54号)",art:"清洁验证",txt:"证明清洁程序去除前批残留/清洁剂/微生物，最差条件与最难清洁部位须验证。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"}
    ],
    examples:[
      "多产品共线：以 PDE 计算某高活性成分残留限度(如 2 µg/日)，擦拭取样回收率验证≥50%。",
      "连续 3 批清洁验证成功纳入 APR 趋势；设备/清洁剂变更触发再验证。"
    ]
  },
  "gongxian":{
    clauses:[
      {src:"GMP(2010)",art:"第四十六条",txt:"高致敏性药品(青霉素类)须专用设施；β-内酰胺类/激素/细胞毒性/高活性化学药须专用或特殊隔离。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"共线生产指南(2023)",art:"专用/密闭/阶段性",txt:"按风险选择专用设施、阶段性生产、密闭/粉尘控制、气流缓冲等措施，法规强制专用者不得以共线规避。",url:"https://www.cfdi.org.cn/cfdi/resource/news/15186.html"},
      {src:"2023口服固体指南",art:"2章 共线/粉尘",txt:"产尘操作间相对负压、局部除尘、专用工作服，计算机化扫码防混淆。",url:"quality-management.html"}
    ],
    examples:[
      "青霉素类：独立厂房 + 专用空调 + 专用设备，严禁与其他产品共线。",
      "高活性肿瘤药：隔离器(手套箱)密闭操作 + 负压，减少人员暴露与粉尘扩散。"
    ]
  },
  "shengwu":{
    clauses:[
      {src:"生物制品附录(2020第58号)",art:"通则",txt:"生物制品生产须建立细胞库/种子批、全程无菌、病毒安全性控制；分装/冻干在 B/A 级。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"},
      {src:"生物制品附录",art:"病毒安全性",txt:"来源于细胞的制品须评估潜在病毒污染并实施灭活/去除(见 ICH Q5A)。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"},
      {src:"生物制品附录",art:"工艺验证与质控",txt:"关注效价(potency)/纯度(purity)/电荷异质性，批记录与偏差管理严格。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"}
    ],
    examples:[
      "单抗：CHO-K1 细胞库建库+鉴定，上游培养 pH/DO 为 CPP，下游层析病毒灭活/去除 LRV 验证。",
      "疫苗：原液无菌过滤+分装 B/A 级，批签发前资料审核 + 必要检验。"
    ]
  },
  "virus":{
    clauses:[
      {src:"ICH Q5A(R1)",art:"病毒安全性评估",txt:"对来源于细胞的生物制品评估潜在病毒(内源/外源/非特异)，制定清除策略（灭活+去除）。",url:"https://www.cde.org.cn/"},
      {src:"CDE 病毒清除平台验证(2024)",art:"平台验证",txt:"同类产品/工艺可基于既往数据跨产品验证，降低重复研究负担。",url:"https://www.cde.org.cn/main/guide"},
      {src:"2023生物/无菌指南",art:"病毒灭活/去除步骤",txt:"低 pH、S/D 化学灭活、纳滤/层析去除等多步骤累加 LRV。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"}
    ],
    examples:[
      "单抗纯化：低 pH 病毒灭活(LRV≥4) + 20 nm 病毒过滤(LRV≥5) + 层析去除，整体 LRV≥15。",
      "平台验证：同 CHO 平台多产品共用病毒清除数据，仅补充产品特异性验证。"
    ]
  },
  "xuezhipin":{
    clauses:[
      {src:"血液制品附录(2024第70号)",art:"血浆筛查",txt:"原料血浆须检测 HBV/HCV/HIV 等，合格方可投料；电子化记录全过程监管。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"},
      {src:"血液制品附录",art:"病毒灭活/去除",txt:"采用两种不同原理的病毒灭活/去除工艺（如 S/D 法 + 干热/纳米过滤）。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"},
      {src:"批签发",art:"上市前批签发",txt:"血液制品上市前须批签发，审核生产与检验资料、必要时检验。",url:"https://www.cfdi.org.cn/cfdi/resource/news/5346.html"}
    ],
    examples:[
      "人血白蛋白：低温乙醇法分离 + 巴氏灭活，每批批签发。",
      "静注人免疫球蛋白：S/D 病毒灭活 + 低 pH 孵化，双重病毒清除。"
    ]
  },
  "tcm":{
    clauses:[
      {src:"中药生产监督管理规定(2025第79号)",art:"全过程质量",txt:"强调中药材基原/产地/采收、前处理、提取纯化全过程质量控制与量质传递。",url:"https://www.nmpa.gov.cn/"},
      {src:"2023 GMP指南·中药",art:"工艺与中试",txt:"关注量质传递、中试放大、生产过程质量控制；指纹图谱(ronghe)评价一致性。",url:"quality-management.html"},
      {src:"GMP(2010)",art:"中药制剂",txt:"中药提取需专用或有效分隔，防止污染与交叉污染；饮片炮制合规。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"}
    ],
    examples:[
      "复方中药提取：以指纹图谱(相似度≥0.9)监控批次间一致性，关键成分转移率控制。",
      "中药注射剂：原料药材基原鉴定+中间体质控+无菌保障，严于口服制剂。"
    ]
  },
  "imp":{
    clauses:[
      {src:"临床试验用药品附录(2022第43号)",art:"有限但适当的质量体系",txt:"建立区别于商业化 GMP、但能防止混淆/污染、保护受试者的质量体系。",url:"https://www.nmpa.gov.cn/"},
      {src:"GCP(2020)/ICH E6",art:"受试者保护",txt:"IMP 生产须保障受试者安全与数据可靠，标签含临床方案信息。",url:"https://www.nmpa.gov.cn/"},
      {src:"GMP(2010)",art:"防止混淆污染",txt:"IMP 仍须防混淆差错污染，批次可追溯，偏差及时记录。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"}
    ],
    examples:[
      "Ⅰ期临床试验用片剂：在专用小线生产，标签含盲法/随机信息，留样至试验结束。",
      "试验用单抗：超低温储存与运输温湿度监控，偏差按 GCP 报告。"
    ]
  },
  "q8":{
    clauses:[
      {src:"ICH Q8(R2)",art:"1. 目标与范围",txt:"提出传统研发与增强方法(QbD)两条路径，鼓励以科学理解设计产品与工艺，而非仅靠终端检验。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q8(R2)",art:"2. 关键质量属性 CQA",txt:"由 QTPP 推导 CQA，作为研发与工艺设计的起点，并随理解深化而更新。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q8(R2)",art:"3–5. 设计空间/控制策略/生命周期",txt:"设计空间内操作不视为变更；控制策略源于产品与工艺理解；产品生命周期须持续监控与改进。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q8(R2)",art:"附录 术语",txt:"定义 QbD、设计空间、控制策略、实时放行(RTRT) 等，是 Q9–Q13 的上游基石。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "口服固体制剂：以 DoE 确立溶出度为 CQA，建立溶出-处方设计空间，商业化后实时放行(RTRT)。",
      "生物药：QbD 驱动细胞培养参数(pH/DO 为 CPP)控制，下游病毒清除纳入整体控制策略。"
    ]
  },
  "q12":{
    clauses:[
      {src:"ICH Q12",art:"1. 目的",txt:"建立一致的药品上市后变更管理框架，促进全生命周期持续革新并减少不必要的监管负担。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q12",art:"3. 既定条件 EC",txt:"注册申报中确定的、须受变更管理约束的关键要素；变更 EC 须按相应类别申报。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q12",art:"4. 上市后变更管理方案 PACMP",txt:"预先批准的变更路径，符合条件的变更可简化或免予重复申报，提升效率。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q12",art:"5. 监管工具",txt:"支持产品生命周期管理的补充工具（如报告类别、变更分类、EC 概念）。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "场地变更：预先提交 PACMP，获批后同类场地变更按既定路径执行、减少重复申报。",
      "参数优化：在既定条件(EC)范围内调整非关键 CPP，走内部变更控制、无需监管申报。"
    ]
  },
  "q7":{
    clauses:[
      {src:"ICH Q7",art:"2. 质量管理",txt:"原料药生产须设独立于生产的质量部门，履行检验、偏差与放行职责。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q7",art:"4. 厂房设施",txt:"按风险分级（高致敏/细胞毒性须专用），防止交叉污染与混淆。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q7",art:"8. 生产操作与工艺控制",txt:"关键步骤须验证，中控与关键工艺参数(CPP)监控，偏差调查。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q7",art:"11–12. 物料与验证",txt:"起始物料论证、中间体控制；工艺验证、关键设备确认与清洁验证。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "合成 API：氢化步骤为关键，验证温度/压力 CPP 并建立中控与杂质谱控制。",
      "发酵 API：种子批+发酵工艺验证，关注效价与有关物质。"
    ]
  },
  "q3a":{
    clauses:[
      {src:"ICH Q3A(R2)",art:"2. 限度",txt:"按日剂量分级规定报告限度、鉴定限度与质控限度（如 0.10%/0.15% 等）。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q3A(R2)",art:"3. 鉴定",txt:"有机杂质达到鉴定限度须进行结构确证，明确来源与去向。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q3A(R2)",art:"4. 质控",txt:"降解产物须控制，批放行检验与稳定性考察监控趋势。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "原料药单杂 0.15% 超鉴定限度(0.10%)：须鉴定为某中间体并控制其来源。",
      "工艺杂质：经工艺优化降至限度内，建立内控标准与中控。"
    ]
  },
  "q3b":{
    clauses:[
      {src:"ICH Q3B(R2)",art:"2. 限度",txt:"新药制剂中降解产物/工艺杂质的报告、鉴定与质控限度，与 Q3A 衔接。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q3B(R2)",art:"3. 鉴定阈值",txt:"原料药降解产物在制剂中的鉴定阈值通常较宽，须分别论证。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q3B(R2)",art:"4. 申报",txt:"超过阈值杂质须列表、鉴定与论证，纳入质量标准。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "片剂贮藏降解产物超 0.2%：鉴定为水解物，优化包材/处方后控制。",
      "复方制剂：各原料药降解产物分别建立限度与控制策略。"
    ]
  },
  "q3c":{
    clauses:[
      {src:"ICH Q3C(R9)",art:"2. 分类",txt:"一类（应避免，如苯、四氯化碳）、二类（限度控制，如乙腈、甲醇）、三类（低毒，如乙醇、丙酮）。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q3C(R9)",art:"3. 限度",txt:"按 PDE 计算可接受浓度；二类须同时控制浓度与每日暴露量。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q3C(R9)",art:"4. 控制",txt:"优先工艺控制，必要时加内控标准与残留检测。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "原料药残留二氯甲烷(一类)：按 PDE(6 mg/天)计算并严格控制限度。",
      "结晶溶剂乙醇(三类)：低毒，仅工艺控制、无需终产品限度。"
    ]
  },
  "glp":{
    clauses:[
      {src:"GLP 规范",art:"机构与人员",txt:"非临床安全性评价研究机构须认证，人员具备资质并持续培训。",url:"https://www.nmpa.gov.cn/"},
      {src:"GLP 规范",art:"设施与仪器",txt:"实验动物设施、供试品/对照品管理、仪器校准与期间核查。",url:"https://www.nmpa.gov.cn/"},
      {src:"GLP 规范",art:"SOP 与档案",txt:"标准操作规程管理、试验方案、总结报告与资料档案长期保存。",url:"https://www.nmpa.gov.cn/"},
      {src:"GLP 规范",art:"质量保证 QAU",txt:"设独立 QA 单元对试验进行计划、实施与报告阶段稽查。",url:"https://www.nmpa.gov.cn/"}
    ],
    examples:[
      "新药急毒试验：在 GLP 认证机构开展，QAU 稽查方案与总结报告。",
      "供试品检测：按 SOP 配制并考察稳定性，档案妥善留存供核查。"
    ]
  },
  "gcp":{
    clauses:[
      {src:"GCP(2020)",art:"原则",txt:"保护受试者权益、安全与福祉，保证试验数据真实、准确、完整、可溯源。",url:"https://www.nmpa.gov.cn/"},
      {src:"GCP",art:"伦理与知情同意",txt:"伦理委员会(IRB/IEC)审批方案，受试者签署知情同意书方可入组。",url:"https://www.nmpa.gov.cn/"},
      {src:"GCP",art:"职责",txt:"申办者负责监查与稽查，研究者严格按方案执行并记录。",url:"https://www.nmpa.gov.cn/"},
      {src:"ICH E6(R3)",art:"质量设计",txt:"现行国际协调版，强化试验质量源于设计(QbD in trials)与风险比例方法。",url:"https://www.nmpa.gov.cn/"}
    ],
    examples:[
      "Ⅰ期试验：伦理审批+知情同意，IMP 标签含盲法与随机信息。",
      "多中心试验：申办者稽查+监查，源数据可溯源至 CRF。"
    ]
  },
  "jsjxt":{
    clauses:[
      {src:"GMP附录·计算机化系统",art:"3. 原则",txt:"系统须验证、权限分级管理、审计追踪，实施全生命周期管理。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·计算机化系统",art:"4. 系统生命周期",txt:"需求→设计→配置/编程→测试→放行→运维，变更须受控。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·计算机化系统",art:"数据完整性",txt:"遵循 ALCOA+，电子记录与手写记录同等效力，定期审核审计追踪。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·计算机化系统",art:"供应商与服务商",txt:"对供应商与服务商进行审计并签订协议，明确职责与数据归属。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"}
    ],
    examples:[
      "LIMS：上线前 CSV 验证，权限分级+审计追踪并定期审核。",
      "SCADA：生产数据自动采集，防篡改与定期备份。"
    ]
  },
  "gongyzy":{
    clauses:[
      {src:"GMP附录·确认与验证",art:"2. 验证总计划 VMP",txt:"规定验证范围、方法、职责与进度，统筹各类确认与验证活动。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·确认与验证",art:"3. 确认 IQ/OQ/PQ",txt:"设备与系统确认三阶段：安装、运行、性能确认。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·确认与验证",art:"4. 工艺验证",txt:"三阶段：工艺设计—工艺确认(IQ/OQ/PQ)—持续工艺确认(CPV)。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·确认与验证",art:"5. 清洁验证",txt:"残留限度、最难清洁部位与最差条件选择，连续 3 批验证。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"}
    ],
    examples:[
      "新生产线：先 VMP，再 IQ/OQ/PQ，最后工艺验证 3 批确认。",
      "设备变更：再确认(OQ/PQ)并评估对产品质量的影响。"
    ]
  },
  "wuliao":{
    clauses:[
      {src:"GMP附录·物料",art:"接收",txt:"核对品名、批号、数量、包装与合格证，立即待验隔离、防止误用。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·物料",art:"取样与检验",txt:"按质量标准取样，QC 检验合格并经质量受权人放行后方可使用。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·物料",art:"储存",txt:"分类分区、温湿度控制、明确标识与效期管理，近效期预警。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·物料",art:"发放",txt:"按批准标准与先进先出原则发放，防止混淆与差错。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"}
    ],
    examples:[
      "原料到货：核对→待验→取样→检验合格→绿标放行→按批发放。",
      "物料效期：系统近效期预警，必要时复验后使用。"
    ]
  },
  "zhiliang":{
    clauses:[
      {src:"GMP附录·质量控制实验室",art:"人员与设施",txt:"人员具备资质，区域独立，仪器校准与期间核查。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·质量控制实验室",art:"取样",txt:"按代表性原则取样并留样，保证样品可追溯。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·质量控制实验室",art:"检验方法",txt:"方法学验证/确认，OOS 先实验室后生产调查。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·质量控制实验室",art:"稳定性",txt:"按方案开展稳定性考察，监控趋势并支持有效期。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"}
    ],
    examples:[
      "OOS：先排查实验室（复测/仪器/操作）再延伸至生产/取样。",
      "含量测定：HPLC 方法验证后用于批放行检验。"
    ]
  },
  "shengchan":{
    clauses:[
      {src:"GMP附录·生产管理",art:"2. 原则",txt:"防止混淆、差错、污染与交叉污染，是现场执行的核心。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·生产管理",art:"批与批记录",txt:"明确批定义，批生产记录(BPR)及时、真实、完整填写。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·生产管理",art:"清场",txt:"每批生产结束清场，防止上批物料/产品残留造成混淆。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·生产管理",art:"工艺规程",txt:"严格按批准工艺规程生产，变更须走变更控制。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"}
    ],
    examples:[
      "每批生产：按 BPR 操作，清场合格方可进行下一批。",
      "物料平衡：理论/实际产量在规定限度内，超差须调查。"
    ]
  },
  "gmp":{
    clauses:[
      {src:"GMP(2010)",art:"第二条 宗旨",txt:"最大限度降低生产中的污染、交叉污染、混淆及差错风险，确保持续稳定生产符合预期用途的药品。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP(2010)",art:"第十条 质量受权人",txt:"企业须设独立质量管理部门，质量受权人(QP)履行审核与放行职责。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP(2010)",art:"第十四条 人员",txt:"各级人员职责明确，经培训合格并定期再培训，注重卫生与健康管理。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP(2010)",art:"第四十六条 专用设施",txt:"高致敏性(青霉素类)须专用设施；β-内酰胺类/激素/细胞毒/高活性化学药须专用或特殊隔离。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP(2010)",art:"第五十八条 厂房",txt:"厂房与设施须与药品生产质量风险相匹配，合理布局防止交叉污染。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"}
    ],
    examples:[
      "青霉素类：独立厂房设施，严禁与其他产品共线生产。",
      "质量受权人：每批审核 BPR+检验结果+偏差/CAPA 后作出放行裁决。"
    ]
  },
  "q1a":{
    clauses:[
      {src:"ICH Q1A(R2)",art:"2. 批次选择",txt:"原料药/制剂至少采用中试规模的代表性批次（通常3批），制剂可用不同批号原料药；样品须按拟定包装贮存。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q1A(R2)",art:"3. 放置条件",txt:"长期（气候带II：25°C/60%RH）、加速（40°C/75%RH）、中间（30°C/65%RH）条件与对应时限，明确温湿度容差。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q1A(R2)",art:"4. 检测频率与限度",txt:"长期/加速按 0/3/6/9/12/18/24…月设检测点；限度依据注册标准，降解产物趋势须评估。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q1A(R2)",art:"5. 结果评价与有效期",txt:"以 95% 置信度下 90% 单侧置信限不低于标准，确立货架期（有效期）；支持外推须有充分数据。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "口服固体制剂：3批中试产品加速6月+长期24月，依 Q1A 90%置信限法确立有效期24个月。",
      "原料药：气候带II长期条件考察晶型/有关物质/水分趋势，支持复检期与储存条件。"
    ]
  },
  "quyang":{
    clauses:[
      {src:"GMP附录·取样",art:"2. 原则",txt:"取样须保证样品代表性、不被污染、可追溯；取样前核对物料状态与标识，防止混淆。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·取样",art:"3. 取样方案",txt:"按总件数开平方根确定取样件数，规定取样部位、量与频次；均质/非均质分别处理。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·取样",art:"4. 取样操作",txt:"取样工具/容器清洁，无菌取样在洁净区进行，防止交叉污染；人员经培训并控制着装。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP附录·取样",art:"5. 留样与封存",txt:"留样量满足全检+必要复检，密封标识、与检验样分开管理，按效期保存。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"}
    ],
    examples:[
      "原料到货100件：按√100=10件取样，每件取代表性部位，分检验样与留样。",
      "无菌原辅料：在B/A级背景无菌取样，防止微生物污染并立即密封。"
    ]
  },
  "radio":{
    clauses:[
      {src:"GMP附录·放射性药品",art:"1. 特殊要求",txt:"须符合辐射防护与放射性废物处理规定；短半衰期产品须严格效期与配送时限管理。",url:"https://www.nmpa.gov.cn/"},
      {src:"GMP附录·放射性药品",art:"2. 生产",txt:"专用设施、辐射安全屏蔽与监测；生产/分装/灭菌须防止交叉污染与人员照射。",url:"https://www.nmpa.gov.cn/"},
      {src:"GMP附录·放射性药品",art:"3. 质量控制",txt:"放射性核素纯度、放射化学纯度、活度测定；无菌/细菌内毒素按剂型控制。",url:"https://www.nmpa.gov.cn/"},
      {src:"GMP附录·放射性药品",art:"4. 运输",txt:"按放射性物质运输安全规范包装与标识，防止辐射泄漏与公众照射。",url:"https://www.nmpa.gov.cn/"}
    ],
    examples:[
      "⁹⁹ᵐTc 标记药盒：淋洗、标记、质控在屏蔽热室内完成，活度与放化纯度即时测定。",
      "¹³¹I 胶囊：专用分装线 + 铅屏蔽，配送时限依半衰期严格控制。"
    ]
  },
  "ypian":{
    clauses:[
      {src:"GMP附录·中药饮片",art:"1–2. 净制与切制",txt:"净制除去非药用部位，切制规格符合药典；设备清洁防混杂，毒性饮片单独管理。",url:"https://www.nmpa.gov.cn/"},
      {src:"GMP附录·中药饮片",art:"3. 炮炙",txt:"炒/炙/煅/蒸等炮炙参数（温度/时间/辅料）记录，毒性饮片炮制须专用设施。",url:"https://www.nmpa.gov.cn/"},
      {src:"GMP附录·中药饮片",art:"4. 仓储",txt:"防虫霉、温湿度控制、分类分区；毒性饮片专区标识与追溯。",url:"https://www.nmpa.gov.cn/"},
      {src:"GMP附录·中药饮片",art:"5. 批记录",txt:"批生产记录完整可追溯，体现净制-切制-炮炙全过程与物料平衡。",url:"https://www.nmpa.gov.cn/"}
    ],
    examples:[
      "制首乌：黑豆汁炙，温度/时间受控，毒性成分（蒽醌）降至限度内。",
      "毒性饮片（附子）：专用炮制线与更衣，批记录独立归档防混淆。"
    ]
  },
  "oxygen":{
    clauses:[
      {src:"GMP附录·医用氧",art:"1. 生产",txt:"以空气为原料经压缩、分离、纯化制得，压缩机无油、管路不污染，过程防止水分/CO₂ 引入。",url:"https://www.nmpa.gov.cn/"},
      {src:"GMP附录·医用氧",art:"2. 质量控制",txt:"氧纯度≥99.5%，水分、CO₂、CO 与气态酸/碱、臭氧按标准控制；微生物限度视用途。",url:"https://www.nmpa.gov.cn/"},
      {src:"GMP附录·医用氧",art:"3. 充装与储存",txt:"充装前钢瓶处理、充装量核定；储存防静电、防油，标签与追溯。",url:"https://www.nmpa.gov.cn/"},
      {src:"GMP附录·医用氧",art:"4. 安全",txt:"助燃性气体，储存与使用须防火、通风与静电防护。",url:"https://www.nmpa.gov.cn/"}
    ],
    examples:[
      "医用氧生产：无油空压机 + 分子筛制氧，纯度在线监测≥99.5%。",
      "钢瓶充装：前处理除油除水，充装量按温度校正，标签含批号。"
    ]
  },
  "pwater":{
    clauses:[
      {src:"GMP(2010)·制药用水",art:"1. 分类",txt:"分饮用水、纯化水、注射用水（WFI）与纯蒸汽；用途与制备工艺须匹配产品质量风险。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP(2010)·制药用水",art:"2. 制备与储存",txt:"WFI 宜 80℃以上循环或 4℃以下储存；管路坡度/流速防滞留与生物膜滋生。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP(2010)·制药用水",art:"3. 微生物/内毒素",txt:"按用途控制微生物限度与细菌内毒素（WFI 须无菌、内毒素达标）。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"},
      {src:"GMP(2010)·制药用水",art:"4. 取样与监测",txt:"使用点取样计划、TOC/电导率/微生物监控，趋势纳入年度回顾。",url:"https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_d5e1dbaa8f284277a5f6c3e2fc840d00.html"}
    ],
    examples:[
      "无菌制剂 WFI：多效蒸馏制备，80℃以上循环，使用点 TOC/微生物月度监测。",
      "生物制品纯化水：RO+EDI 制备，按用途分级监控电导率与内毒素。"
    ]
  },
  "q2":{
    clauses:[
      {src:"ICH Q2(R1)",art:"1. 范围与目的",txt:"规定原料药与制剂中鉴别、杂质检查、含量测定等分析方法的论证要求，确保检验结果可靠、可重复。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q2(R1)",art:"2. 验证项目",txt:"专属性、准确性、精密度（重复性/中间精密度/重现性）、线性、范围、检测限(LOD)、定量限(LOQ)、耐用性。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q2(R1)",art:"3. 按检验类型区分",txt:"鉴别重点考察专属性；杂质检查重点专属性与灵敏度(LOD/LOQ)；含量测定重点准确/精密度/线性与范围。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q2(R1)",art:"附录 统计处理",txt:"提供置信区间、回归分析等统计方法，支撑验证数据的评价与限度确立。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "专属性(鉴别)：空白基质/辅料干扰试验无假阳性，强制降解样品主峰与降解峰分离度≥1.5，证明能区分目标物与干扰。",
      "准确度：有关物质加样回收率 98.0%–102.0%（n=9，3浓度×3重复），RSD<2%；含量测定回收率 99.5%–100.5%。",
      "精密度：重复性 RSD≤2.0%（同人同日），中间精密度 RSD≤3.0%（不同人/日/仪器），重现性经协同验证≤5.0%。",
      "耐用性：HPLC 流动相比例±2%、柱温±5℃、pH±0.2、色谱柱不同批号下系统适用性仍合格，界定方法操作宽容度。"
    ]
  },
  "q14":{
    clauses:[
      {src:"ICH Q14",art:"1. 目的与范围",txt:"建立科学的分析方法开发框架，衔接 Q2 论证与 Q12 生命周期变更管理。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q14",art:"3. 增强方法开发",txt:"基于先验知识与风险评估、实验设计(DoE)确定方法参数与可报告范围，减少后期变更与重复论证。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q14",art:"3. 所属空间 / 可报告范围",txt:"建立 established range 与可报告范围，范围内调整不视为方法变更，提升研发与监管效率。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q14",art:"4. 分析方法生命周期",txt:"上市后持续监控（系统适用性、趋势分析），按 Q12 框架管理变更，保持方法的持续适用性。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "HPLC 含量方法：DoE 优化流动相比例与柱温，确定可报告范围，上市后基线漂移在范围内免申报。",
      "生物活性 assay：增强开发确立平行性与精密度可接受标准，并纳入生命周期监控计划。"
    ]
  },
  "q1b":{
    clauses:[
      {src:"ICH Q1B",art:"1. 光稳定性试验",txt:"原料药与制剂均须进行光稳定性挑战，采用可见光(D65)/紫外光照条件（总照度≥1.2×10⁶ lux·hr、紫外能量≥200 W·hr/m²），与对照比较降解。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q1B",art:"2. 气候带定义",txt:"I带 21°C/45%RH（温带）、II带 25°C/60%RH（亚热带/地中海）、III带 30°C/35%RH（干热）、IV带 30°C/65%RH（湿热）；长期试验条件依注册上市地区所属气候带选取。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q1B / Q1A",art:"3. 中国归属与长期条件",txt:"中国属气候带II，长期试验采用 25°C±2°C/60%RH±5%RH；加速 40°C/75%RH，中间条件 30°C/65%RH 用于加速不合格时的补充。",url:"https://www.cde.org.cn/"},
      {src:"ICH Q1B",art:"4. 包装与有效期",txt:"光敏感品种须遮光包装并标注；有效期以最严气候带长期数据支持，必要时按IV带（30°C/65%RH）加严考察。",url:"https://www.cde.org.cn/"}
    ],
    examples:[
      "盐酸XX片：光稳定性试验见明显降解，改棕色玻璃瓶+铝箔遮光包装，标签加「遮光密封保存」。",
      "出口东南亚（气候带IV）品种：长期试验除25°C/60%RH外，追加30°C/65%RH考察以支持该区域有效期。"
    ]
  }
};

/* ============== 分品种子图聚类 ============== */
const HUBS = new Set(["gmp","cqa","cpp","qrm","pqs","ich","qbd","q8","q9","q11","q12"]);
const CLUSTERS = {
  wuxian:{label:"无菌制剂", members:["wuxian","ccs","hjjk","wugongymn","glsx","xcl","xiaoshou","bukejian","sus"]},
  kfzt:{label:"口服固体制剂", members:["kfzt","rongjie","qingjie","gongxian","cleaning","hbel","pde"]},
  shengwu:{label:"生物制品", members:["shengwu","virus","lrv","mxbd","ptyz","xiaodu","chundu","q5a","xibao","yuanliaoyz","sus"]},
  tcm:{label:"中药", members:["tcm","ronghe","zhongshi","zhiliang"]},
  yuanliao:{label:"原料药", members:["yuanliao","yuanliao2","q7","q11","qishi","jingxing","youguan"]},
  xuezhipin:{label:"血液制品", members:["xuezhipin","pillzh","virus"]},
  xibao:{label:"细胞治疗", members:["xibao","shengwu","sus"]},
  imp:{label:"临床试验用药品", members:["imp","gcp"]}
};

/* ============== 分品种二级子网（工艺 / 质量） ============== */
const SUBNET = {
  wuxian:{proc:["wuxian","ccs","hjjk","wugongymn","glsx","sus"], qual:["xcl","xiaoshou","bukejian"]},
  kfzt:{proc:["kfzt","qingjie","gongxian","cleaning"], qual:["rongjie","hbel","pde"]},
  shengwu:{proc:["shengwu","virus","lrv","mxbd","ptyz","q5a","xibao","yuanliaoyz","sus"], qual:["xiaodu","chundu"]},
  tcm:{proc:["tcm","zhongshi"], qual:["ronghe","zhiliang"]},
  yuanliao:{proc:["yuanliao2","q7","q11","qishi"], qual:["yuanliao","jingxing","youguan"]},
  xuezhipin:{proc:["xuezhipin","virus"], qual:["pillzh"]},
  xibao:{proc:["xibao","shengwu","sus"], qual:[]},
  imp:{proc:["imp","gcp"], qual:[]}
};

/* ============== 分品种二级子网·细拆维度（将「工艺子网」进一步拆为 厂房/设备/人员/监测 等） ============== */
const FINE = {
  wuxian:{
    "厂房/设施":["ccs","glsx","sus"],
    "人员/操作":["wuxian"],
    "监测/评价":["hjjk","wugongymn"]
  },
  kfzt:{
    "厂房/设备":["kfzt","gongxian"],
    "清洁/共线":["qingjie","cleaning"]
  },
  shengwu:{
    "细胞/培养":["shengwu","xibao","yuanliaoyz"],
    "病毒清除":["virus","lrv","mxbd","ptyz","q5a"],
    "设备":["sus"]
  }
};

/* ============== 构建网络 ============== */
const byId = {}; TERMS.forEach(t=>byId[t.id]=t);
// 边（去重、双向）
const edgeSet = new Set(); const edges=[];
TERMS.forEach(t=>{(t.r||[]).forEach(rid=>{
  if(!byId[rid])return;
  const key=[t.id,rid].sort().join("|");
  if(!edgeSet.has(key)){edgeSet.add(key);edges.push([t.id,rid]);}
});});

const W=960,H=600;
const nodes = TERMS.map((t,i)=>{
  const ang = (i/TERMS.length)*Math.PI*2;
  return {id:t.id,term:t.t,cat:t.c,
    x:W/2+Math.cos(ang)*230+ (Math.random()*30-15),
    y:H/2+Math.sin(ang)*180+ (Math.random()*30-15),
    vx:0,vy:0,fx:null,fy:null,vis:true};
});
const nodeMap={}; nodes.forEach(n=>nodeMap[n.id]=n);

// SVG 渲染
const svg=document.getElementById("net");
const gE=document.getElementById("edges"), gN=document.getElementById("nodes");
const edgeEls=edges.map(([a,b])=>{
  const l=document.createElementNS("http://www.w3.org/2000/svg","line");
  l.setAttribute("class","edge"); l.dataset.a=a; l.dataset.b=b;
  gE.appendChild(l); return l;
});
const nodeEls=nodes.map(n=>{
  const g=document.createElementNS("http://www.w3.org/2000/svg","g");
  g.setAttribute("class","node"); g.dataset.id=n.id;
  const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
  const r = 7 + (byId[n.id].t.length>8?2:0);
  c.setAttribute("r",r); c.setAttribute("fill",CATS[n.cat].color);
  const tx=document.createElementNS("http://www.w3.org/2000/svg","text");
  tx.setAttribute("text-anchor","middle"); tx.setAttribute("dy","-"+ (r+4));
  tx.textContent=byId[n.id].t.length>9?byId[n.id].t.slice(0,9)+"…":byId[n.id].t;
  g.appendChild(c); g.appendChild(tx);
  gN.appendChild(g); return {g,n,c,tx};
});

/* 力导向模拟 */
let alpha=1;
function tick(){
  const V=nodes.filter(n=>n.vis);
  // 斥力（仅可见节点）
  for(let i=0;i<V.length;i++){
    const a=V[i];
    for(let j=i+1;j<V.length;j++){
      const b=V[j];
      let dx=a.x-b.x, dy=a.y-b.y; let d2=dx*dx+dy*dy; if(d2<0.01)d2=0.01;
      const d=Math.sqrt(d2); const f= 1600/d2;
      const fx=dx/d*f, fy=dy/d*f;
      a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy;
    }
  }
  // 弹簧（边，仅两端均可见）
  edges.forEach(([a,b])=>{
    if(!nodeMap[a].vis||!nodeMap[b].vis)return;
    const na=nodeMap[a], nb=nodeMap[b];
    let dx=nb.x-na.x, dy=nb.y-na.y; const d=Math.sqrt(dx*dx+dy*dy)||1;
    const rest=95; const f=(d-rest)*0.012;
    const fx=dx/d*f, fy=dy/d*f;
    na.vx+=fx; na.vy+=fy; nb.vx-=fx; nb.vy-=fy;
  });
  // 向心力 + 阻尼（仅可见）
  V.forEach(n=>{
    if(n.fx!=null){n.x=n.fx;n.y=n.fy;n.vx=0;n.vy=0;return;}
    n.vx += (W/2-n.x)*0.0016; n.vy += (H/2-n.y)*0.0016;
    n.vx*=0.86; n.vy*=0.86;
    n.x+=n.vx*alpha; n.y+=n.vy*alpha;
    n.x=Math.max(24,Math.min(W-24,n.x)); n.y=Math.max(20,Math.min(H-20,n.y));
  });
  alpha*=0.992;
  // 更新位置（仅可见节点）
  nodeEls.forEach(ne=>{ if(ne.n.vis) ne.g.setAttribute("transform",`translate(${ne.n.x},${ne.n.y})`); });
  edgeEls.forEach((l,k)=>{const [a,b]=edges[k]; const na=nodeMap[a],nb=nodeMap[b];
    if(na.vis&&nb.vis){ l.setAttribute("x1",na.x);l.setAttribute("y1",na.y);l.setAttribute("x2",nb.x);l.setAttribute("y2",nb.y);} });
  if(alpha>0.02) requestAnimationFrame(tick);
}
function reheat(a){alpha=Math.max(alpha,a||0.8); if(alpha>0.02&&!running){running=true;requestAnimationFrame(tick);} }
let running=false;
// 初始跑若干帧后降速
running=true; requestAnimationFrame(tick);

/* 交互：高亮与详情 */
let selected=null;
function neighbors(id){const s=new Set();edges.forEach(([a,b])=>{if(a===id)s.add(b);if(b===id)s.add(a);});return s;}
function highlight(id){
  const nb=neighbors(id);
  nodeEls.forEach(ne=>{
    if(!id){ne.g.classList.remove("dim","hot");return;}
    if(ne.n.id===id)ne.g.classList.add("hot"),ne.g.classList.remove("dim");
    else if(nb.has(ne.n.id))ne.g.classList.remove("dim","hot");
    else ne.g.classList.add("dim");
  });
  edgeEls.forEach(l=>{
    if(!id){l.classList.remove("hot");return;}
    l.classList.toggle("hot", l.dataset.a===id||l.dataset.b===id);
  });
}
function showDetail(id){
  const t=byId[id]; if(!t)return;
  selected=id; highlight(id);
  const color=CATS[t.c].color;
  const rels=(t.r||[]).filter(rid=>byId[rid]).map(rid=>
    `<span class="rel-tag" data-go="${rid}">${byId[rid].t} <small style="color:#94a3b8">${byId[rid].e}</small></span>`).join("");
  const dd=DEEP[id];
  let deepHtml="";
  if(dd){
    const cls=(dd.clauses||[]).map(c=>`<tr><td style="white-space:nowrap;vertical-align:top"><b>${c.src}</b><br><span style="color:#64748b;font-size:11.5px">${c.art}</span></td><td>${c.txt}</td><td style="white-space:nowrap;text-align:center"><a href="${c.url}" target="_blank" rel="noopener">原文↗</a></td></tr>`).join("");
    const ex=(dd.examples||[]).map(e=>`<li>${e}</li>`).join("");
    deepHtml=`
    <div class="rel-title">📑 条款对照（定义 + 法规附录 / 指导原则）</div>
    <div class="deep-clause"><table class="clause-tbl"><thead><tr><th style="width:25%">文件 / 条款</th><th style="width:61%">要点</th><th style="width:14%">来源</th></tr></thead><tbody>${cls}</tbody></table></div>
    <div class="rel-title">💡 典型示例</div>
    <ul class="ex-list">${ex}</ul>`;
  }
  document.getElementById("detail-body").innerHTML=`
    <span class="dt-cat" style="background:${color}">${CATS[t.c].name}</span>
    <h3>${t.t}</h3>
    <div class="en">${t.e}</div>
    <div class="def">${t.d}</div>
    ${deepHtml}
    <div class="rel-title">🔗 关联术语（${ (t.r||[]).filter(r=>byId[r]).length }）</div>
    <div class="rel-list">${rels||"<span style='color:#94a3b8'>无</span>"}</div>`;
  document.getElementById("detail-hint").textContent=t.t;
  document.querySelectorAll(".rel-tag").forEach(el=>el.onclick=()=>showDetail(el.dataset.go));
  document.getElementById("detail").scrollIntoView({behavior:"smooth",block:"nearest"});
}
nodeEls.forEach(ne=>{
  ne.g.addEventListener("click",e=>{e.stopPropagation();showDetail(ne.n.id);});
  ne.g.addEventListener("mouseenter",()=>{if(!selected)highlight(ne.n.id);});
  ne.g.addEventListener("mouseleave",()=>{if(!selected)highlight(null);});
});
svg.addEventListener("click",()=>{selected=null;highlight(null);document.getElementById("detail-hint").textContent="点击任意节点或词条";document.getElementById("detail-body").innerHTML='<div class="empty">从左侧网络或下方词典中选择一个术语，这里会显示其详细解释与关联关系。</div>';});
// 拖拽
nodeEls.forEach(ne=>{
  ne.g.addEventListener("mousedown",e=>{e.stopPropagation();
    const pt=svgPoint(e); ne.n.fx=pt.x; ne.n.fy=pt.y;
    const mv=ev=>{const p=svgPoint(ev);ne.n.fx=p.x;ne.n.fy=p.y;};
    const up=()=>{ne.n.fx=null;ne.n.fy=null;document.removeEventListener("mousemove",mv);document.removeEventListener("mouseup",up);reheat(0.5);};
    document.addEventListener("mousemove",mv);document.addEventListener("mouseup",up);
  });
});
function svgPoint(e){const r=svg.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W, y:(e.clientY-r.top)/r.height*H};}

/* 词典 */
function buildDict(filterCat,query){
  const dict=document.getElementById("dict"); dict.innerHTML="";
  let list=TERMS.filter(t=>!filterCat||t.c===filterCat);
  if(query){const q=query.toLowerCase();
    list=list.filter(t=>(t.t+t.e+t.d+(t.r||[]).map(r=>byId[r]?byId[r].t:"").join("")).toLowerCase().includes(q));}
  document.getElementById("dict-count").textContent=`当前显示 ${list.length} / 共 ${TERMS.length} 个术语`;
  if(!list.length){dict.innerHTML='<div class="empty">未找到匹配的术语。</div>';return;}
  list.forEach(t=>{
    const card=document.createElement("div");card.className="term";card.dataset.id=t.id;
    const color=CATS[t.c].color;
    card.innerHTML=`<div class="bar" style="background:${color}"></div>
      <h4>${t.t}</h4><div class="en">${t.e} · ${CATS[t.c].name}</div>
      <div class="snip">${t.d}</div>
      <div class="cnt">▸ ${ (t.r||[]).filter(r=>byId[r]).length } 个关联</div>`;
    card.onclick=()=>{showDetail(t.id);nodeMap[t.id]&&reheat(0.6);};
    dict.appendChild(card);
  });
}
/* 分类筛选 chips */
const chipsBox=document.getElementById("chips");
const allChip=document.createElement("button");allChip.className="chip active";allChip.textContent="全部";allChip.onclick=()=>setCat(null);chipsBox.appendChild(allChip);
Object.entries(CATS).forEach(([k,v])=>{
  const c=document.createElement("button");c.className="chip";c.textContent=v.name;
  c.onclick=()=>setCat(k);chipsBox.appendChild(c);
});
let curCat=null;
function setCat(k){curCat=k;document.querySelectorAll("#chips .chip").forEach((c,i)=>c.classList.toggle("active",(k===null&&i===0)||c.textContent===CATS[k]?.name));buildDict(curCat,document.getElementById("search").value.trim());}
document.getElementById("search").addEventListener("input",e=>buildDict(curCat,e.target.value.trim()));
document.getElementById("reset").onclick=()=>{nodes.forEach((n,i)=>{const ang=(i/nodes.length)*Math.PI*2;n.x=W/2+Math.cos(ang)*230;n.y=H/2+Math.sin(ang)*180;n.vx=0;n.vy=0;n.fx=null;n.fy=null;});reheat(1);};
document.getElementById("center").onclick=()=>{nodes.forEach(n=>{n.fx=null;n.fy=null;});reheat(1);};

/* ============== 分品种子图（含二级子网） ============== */
function applyView(ptId, sub, fine){
  let nodeSet=null;
  if(ptId){
    let srcMembers;
    if(fine && FINE[ptId] && FINE[ptId][fine]){
      nodeSet=new Set(FINE[ptId][fine]);
      srcMembers=FINE[ptId][fine];
    } else if(sub && SUBNET[ptId] && SUBNET[ptId][sub]){
      nodeSet=new Set(SUBNET[ptId][sub]);
      srcMembers=SUBNET[ptId][sub];
    } else {
      nodeSet=new Set(CLUSTERS[ptId].members);
      srcMembers=CLUSTERS[ptId].members;
    }
    srcMembers.forEach(id=>{(byId[id].r||[]).forEach(rid=>{ if(byId[rid]&&HUBS.has(rid)) nodeSet.add(rid); });});
  }
  nodes.forEach(n=>{ n.vis = nodeSet? nodeSet.has(n.id):true; });
  nodeEls.forEach(ne=>{ ne.g.style.display = ne.n.vis? "" : "none"; });
  const visEdges = edges.map(([a,b],k)=>({k,a,b,vis: nodeSet? (nodeSet.has(a)&&nodeSet.has(b)) : true}));
  visEdges.forEach(e=>{ edgeEls[e.k].style.display = e.vis? "" : "none"; });
  const V=nodes.filter(n=>n.vis);
  V.forEach((n,i)=>{ const ang=(i/V.length)*Math.PI*2;
    n.x=W/2+Math.cos(ang)*210; n.y=H/2+Math.sin(ang)*165; n.vx=0;n.vy=0;n.fx=null;n.fy=null; });
  reheat(1);
}
const sgbar=document.getElementById("sgbar");
const sgAll=document.createElement("button"); sgAll.className="sg-btn active"; sgAll.textContent="🌐 总网络"; sgAll.onclick=()=>setSG(null); sgbar.appendChild(sgAll);
Object.entries(CLUSTERS).forEach(([k,v])=>{
  const b=document.createElement("button"); b.className="sg-btn"; b.textContent=v.label; b.onclick=()=>setSG(k); sgbar.appendChild(b);
});
let curSG=null, curSub=null, curFine=null;
function setSG(k){
  curSG=k; curSub=null; curFine=null;
  document.querySelectorAll("#sgbar .sg-btn").forEach((b,i)=>b.classList.toggle("active",(k===null&&i===0)||b.textContent===CLUSTERS[k]?.label));
  const subbar=document.getElementById("subbar");
  if(k){ renderSubBar(k); subbar.style.display="flex"; }
  else subbar.style.display="none";
  applyView(k,null,null);
  updateSGHint();
}
function renderSubBar(ptId){
  const subbar=document.getElementById("subbar"); subbar.innerHTML="";
  const lab=document.createElement("span"); lab.style.cssText="font-size:12px;color:#64748b;align-self:center;margin-right:2px"; lab.textContent="二级子网："; subbar.appendChild(lab);
  const mk=(label,sub,fine,active)=>{const b=document.createElement("button");b.className="sg-btn"+(active?" active":"");b.textContent=label;b.onclick=()=>{curSub=sub;curFine=fine;document.querySelectorAll("#subbar .sg-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");applyView(ptId,sub,fine);updateSGHint();};subbar.appendChild(b);};
  mk("全部子图",null,null,curSub===null&&curFine===null);
  mk("🔧 工艺子网","proc",null,curSub==="proc");
  if(SUBNET[ptId]&&SUBNET[ptId].qual.length) mk("🔬 质量子网","qual",null,curSub==="qual");
  if(FINE[ptId]){
    const flab=document.createElement("span"); flab.style.cssText="font-size:12px;color:#0d9488;align-self:center;margin:0 2px 0 10px;font-weight:600"; flab.textContent="▸ 细拆维度："; subbar.appendChild(flab);
    Object.keys(FINE[ptId]).forEach(dim=>{ mk(dim,null,dim,curFine===dim); });
  }
}
function updateSGHint(){
  const hint=document.getElementById("sg-hint");
  if(!curSG){hint.textContent="拖拽节点 · 悬停高亮邻居 · 点击查看详情（38 个 ICH/GMP 深化条目含条款对照）";return;}
  let subTxt="";
  if(curFine) subTxt=" · "+curFine;
  else if(curSub) subTxt = curSub==="proc"?" · 工艺子网":" · 质量子网";
  hint.textContent=`当前：${CLUSTERS[curSG].label}${subTxt} · 共 ${nodes.filter(n=>n.vis).length} 个术语`;
}

/* 图例 */
const legend=document.getElementById("legend");
legend.innerHTML="<div style='font-weight:600;margin-bottom:4px'>知识域颜色</div>"+
  Object.values(CATS).map(v=>`<div class="row"><span class="dot" style="background:${v.color}"></span>${v.name}</div>`).join("");

/* 统计 */
document.getElementById("st-terms").textContent=TERMS.length;
document.getElementById("st-edges").textContent=edges.length;

buildDict(null,"");
