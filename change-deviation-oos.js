
/* =========================================================
   三大判定树数据
   ========================================================= */
const TREES = {

/* ------------------ 变更分级树 ------------------ */
change: {
  start: "c1",
  nodes: {
    c1: { q: "本次变更是否属于《药品上市后变更管理办法（试行）》及各变更技术指导原则列明的「注册/备案变更事项」？",
      tip: "注册变更 = 改变<b>已批准/已登记载明</b>的事项。拿不准时选「不确定」，会带您逐项核对。",
      opts: [
        { t: "是，属于注册/备案变更事项", to: "c2" },
        { t: "否，属企业内部管理事项（文件修订、同型号设备更换等）", to: "c5" },
        { t: "不确定，逐项核对", to: "c1b" }
      ]},
    c1b: { q: "变更是否涉及以下<b>任一</b>事项？", tag: "注册事项核对",
      hitlist: ["处方或辅料组成 / 用量", "生产工艺或工艺参数范围", "质量标准或检验方法",
                "规格、包装规格", "生产场地或生产线", "直接接触药品的包装材料 / 容器",
                "有效期或贮藏条件", "原料药合成路线或起始物料", "生产批量（超出已批准范围）"],
      opts: [
        { t: "涉及上述任一项 → 属注册变更", to: "c2" },
        { t: "均不涉及 → 属内部变更", to: "c5" }
      ]},
    c2: { q: "【重大变更筛查】变更是否命中下列<b>任一</b>重大情形？", tag: "第 1 层筛查",
      hitlist: ["改变剂型、给药途径、规格、适应症或用法用量",
                "改变原料药合成路线（起始物料之后的反应步骤）",
                "变更制剂处方中<b>关键辅料</b>的种类或用量，且超出已批准范围",
                "无菌药品<b>灭菌方式</b>或无菌保证工艺变更",
                "<b>放宽</b>或<b>删除</b>注册标准中的质控项目或限度",
                "变更生产场地（新增生产地址 / 跨省迁移）",
                "变更可能影响<b>生物等效性、免疫原性或体内释放特性</b>",
                "新增或变更可能引入新的杂质谱 / 新的安全性风险"],
      opts: [
        { t: "命中上述任一情形", to: "RC", hit: "命中重大变更情形" },
        { t: "均未命中", to: "c3" }
      ]},
    c3: { q: "【中等变更筛查】变更是否命中下列<b>任一</b>中等情形？", tag: "第 2 层筛查",
      hitlist: ["变更辅料 / 内包材供应商或产地（材质与质量标准不变）",
                "生产批量变更（超出原批准范围，但在已验证范围内）",
                "中间体合成路线调整（不影响终产品质量）",
                "<b>收紧</b>质量标准限度 / <b>增加</b>质控项目",
                "基于完整稳定性数据延长有效期或放宽贮藏条件",
                "变更生产设备（原理不同但工艺参数与产品质量不变）",
                "变更检验方法（非安全性相关，经方法学验证等效或更优）"],
      opts: [
        { t: "命中上述任一情形", to: "RM", hit: "命中中等变更情形" },
        { t: "均未命中", to: "c4" }
      ]},
    c4: { q: "【微小变更确认】变更是否属于下列<b>低风险情形</b>？", tag: "第 3 层筛查",
      hitlist: ["文件性 / 文字性修订（不改变技术要求）",
                "变更责任人、联系方式、企业名称（主体不变）",
                "同一供应商同一产地内产线 / 批次调整",
                "增设备用设备（同型号、同原理）",
                "收紧企业内控标准（不改变注册标准）"],
      opts: [
        { t: "是，属低风险情形", to: "RN", hit: "属微小变更低风险情形" },
        { t: "否 / 仍不确定", to: "RX" }
      ]},
    c5: { q: "【内部变更分级】该项内部变更影响范围是？", tag: "企业内部变更",
      opts: [
        { t: "涉及 GMP 关键系统（HVAC、制药用水、灭菌设备、计算机化系统、无菌工艺），或需再验证 / 稳定性考察", to: "RI" },
        { t: "涉及 SOP / 质量标准 / 验证方案等受控文件的技术性修订，或影响已验证状态", to: "RII" },
        { t: "仅为行政性、格式性或文字性变更，不影响已验证状态", to: "RIII" }
      ]},

    /* ---- 结果节点 ---- */
    RC: { result:1, level:"重大变更", en:"Major Change · PAS",
      verdict:"须报<b>国家药品监督管理局审批（补充申请）</b>，<b>取得批准后方可实施</b>。",
      actions:["开展全面的<b>变更前后质量对比研究</b>，必要时补充非临床或临床桥接研究",
               "完成 <b>3 批商业规模验证批</b>生产与检验，结果符合标准",
               "开展<b>长期 + 加速稳定性考察</b>（通常 6 个月加速 + 6 个月长期数据，并承诺继续考察）",
               "涉及检验方法变更的，完成<b>方法学验证</b>",
               "完成<b>注册影响评估</b>，确认是否影响其他已批准品种",
               "变更实施前完成相关<b>文件修订与人员培训</b>",
               "按补充申请要求提交资料；批准的变更须在<b>年度报告</b>中体现"],
      warn:"在实施前先行生产或销售，属<b>未经批准的变更</b>，是飞行检查的重点打击对象。",
      refs:["药品上市后变更管理办法（试行）","已上市化学药品药学变更研究技术指导原则（试行）","GMP(2010) 第二百四十条","ICH Q12"] },
    RM: { result:2, level:"中等变更", en:"Moderate Change · 备案",
      verdict:"须报<b>省级药品监督管理局备案</b>，<b>备案完成（取得备案号）后方可实施</b>。",
      actions:["开展变更前后<b>质量对比研究</b>与必要的工艺验证或确认",
               "提供<b>稳定性数据或稳定性承诺</b>（通常 3～6 个月数据 + 承诺继续考察）",
               "涉及检验方法变更的，完成方法学验证或确认",
               "通过<b>国家药品业务应用系统</b>提交备案资料，取得备案号",
               "备案后按规定的时间节点完成实施并留存完整记录",
               "在<b>年度报告</b>中报告该变更及实施情况"],
      warn:"备案不等于免于研究。备案资料须真实、完整、可追溯；备案后药监可要求补充研究或撤销备案。",
      refs:["药品上市后变更管理办法（试行）","已上市化学药品药学变更研究技术指导原则（试行）","GMP(2010) 第二百四十二条"] },
    RN: { result:3, level:"微小变更", en:"Minor Change · 年报",
      verdict:"无需事前申报，企业完成<b>变更控制评估</b>后即可实施，在<b>年度报告</b>中报告。",
      actions:["在企业变更控制系统中登记，进行<b>影响评估</b>并记录评估依据",
               "评估须说明为何判定为微小变更，并<b>引用指导原则对应条款</b>",
               "必要时进行确认性检验或对比",
               "完成相关文件修订与培训",
               "纳入<b>年度报告</b>，接受药监监督检查"],
      warn:"微小变更≠免评估。若实际影响超出微小变更范围，将被认定为<b>未按规定申报变更</b>。",
      refs:["药品上市后变更管理办法（试行）","ICH Q12（Annual Report 类变更）"] },
    RX: { result:4, level:"等级存疑 · 建议升级申报", en:"Escalate",
      verdict:"无法明确归入微小变更。<b>存疑从重</b>：建议按<b>中等变更</b>申报备案，或向省级药监局 / 药审中心沟通咨询后确定。",
      actions:["整理变更的技术背景与研究数据，形成<b>书面评估资料</b>",
               "对照相应品种的变更技术指导原则逐条核对",
               "通过<b>沟通交流渠道</b>（省局、药审中心）确认分级",
               "在确认前<b>不得实施</b>该变更",
               "将沟通结论与依据一并归档"],
      warn:"严禁将本应一次申报的变更<b>拆解为多个微小变更</b>规避监管——这是注册核查与飞检的重点关注项。",
      refs:["药品上市后变更管理办法（试行）","ICH Q9(R1) 质量风险管理"] },
    RI: { result:1, level:"内部 I 级变更", en:"Internal Level I",
      verdict:"重大内部变更：须<b>再验证 / 再确认</b>，由<b>质量负责人 + 变更控制委员会</b>批准。",
      actions:["开展<b>影响评估</b>，明确对已验证状态、产品质量与注册文件的影响",
               "制定并实施<b>再验证 / 再确认方案</b>（IQ/OQ/PQ 或工艺验证、计算机化系统验证）",
               "评估是否需要进行<b>稳定性考察</b>或额外检验",
               "评估对<b>已放行产品</b>与在产品的追溯影响",
               "同步评估是否触发<b>注册变更</b>（若触发，走 RC / RM / RN 路径）",
               "完成文件修订、培训，QA 批准后方可实施"],
      refs:["GMP(2010) 第二百四十～二百四十三条","2023版GMP指南·质量管理体系","ICH Q10"] },
    RII: { result:2, level:"内部 II 级变更", en:"Internal Level II",
      verdict:"中等内部变更：由<b>质量管理部门</b>审核批准，完成必要的确认后实施。",
      actions:["开展影响评估，说明对产品质量与已验证状态的影响",
               "完成必要的<b>确认或比对</b>工作",
               "完成受控文件修订、发放旧版回收与<b>培训</b>",
               "QA 批准后实施，实施情况留档"],
      refs:["GMP(2010) 第二百四十一～二百四十三条"] },
    RIII: { result:3, level:"内部 III 级变更", en:"Internal Level III",
      verdict:"微小内部变更：<b>部门负责人批准 + QA 备案</b>，记录即可。",
      actions:["在变更控制系统中登记变更内容与理由",
               "完成文件修订与发放（如适用）",
               "必要时进行简短培训或告知",
               "归档记录，纳入定期回顾"],
      refs:["GMP(2010) 第二百四十三条"] }
  }
},

/* ------------------ 偏差分级树 ------------------ */
deviation: {
  start: "d1",
  nodes: {
    d1: { q: "该偏差是否已影响（或极可能影响）产品的<b>安全性、有效性或质量可控性</b>，或已导致/可能导致<b>召回、拒收、停药、放行受阻</b>？",
      opts:[ { t:"是", to:"DK", hit:"影响产品质量/患者安全或导致召回拒收" }, { t:"否", to:"d2" } ]},
    d2: { q: "该偏差是否涉及<b>数据可靠性</b>问题？", tag:"关键红线",
      hitlist:["伪造、篡改、删除或覆盖数据","关闭或无审计追踪（Audit Trail）",
               "同步记录、事后补记、倒签日期","共用账号 / 共享密码","未经授权修改数据或系统时间",
               "重复进样后选择性报告结果","原始记录缺失或无法提供"],
      opts:[ { t:"是，涉及数据可靠性", to:"DK", hit:"涉及数据可靠性缺陷" }, { t:"否", to:"d3" } ]},
    d3: { q: "该偏差是否<b>偏离已批准的注册工艺、注册标准、处方或申报资料载明内容</b>？",
      tip:"注册符合性是定级硬门槛：偏离注册文件即属高风险，与是否检出不合格无关。",
      opts:[ { t:"是，偏离注册文件", to:"DK", hit:"偏离已批准的注册工艺/标准/处方" }, { t:"否", to:"d4" } ]},
    d4: { q: "该偏差是否涉及<b>无菌保证、交叉污染、混淆或差错</b>？", tag:"关键红线",
      hitlist:["无菌检查阳性 / 培养基模拟灌装失败","灭菌工艺参数偏离或灭菌设备故障",
               "洁净区环境监控（悬浮粒子 / 微生物）超标","细菌内毒素或微粒超标",
               "清场不彻底导致交叉污染风险","物料 / 产品混淆或标识差错"],
      opts:[ { t:"是", to:"DK", hit:"涉及无菌保证/交叉污染/混淆差错" }, { t:"否", to:"d5" } ]},
    d5: { q: "该偏差是否导致<b>关键质量属性（CQA）或关键工艺参数（CPP）</b>超出已验证 / 已批准范围？",
      opts:[ { t:"是，CQA 或 CPP 超范围", to:"DM", hit:"CQA/CPP 超出已验证范围" }, { t:"否", to:"d6" } ]},
    d6: { q: "该偏差是否为<b>系统性或重复性</b>缺陷？", tag:"升级规则",
      tip:"判定标准：同一或同类偏差在 <b>12 个月内出现 ≥2 次</b>，或内/外部审计中被重复发现。",
      opts:[ { t:"是，12 个月内重复发生或审计重复发现", to:"DM", hit:"系统性/重复性缺陷（12个月内≥2次）" }, { t:"否，属首次孤立事件", to:"d7" } ]},
    d7: { q: "该偏差是否影响<b>非关键质量属性 / 非关键工艺参数</b>，或虽偏离 SOP 但产品经评估可放行？",
      opts:[ { t:"是", to:"DM", hit:"影响非CQA/非CPP或偏离SOP但可评估放行" }, { t:"否", to:"d8" } ]},
    d8: { q: "该偏差是否<b>仅为程序性 / 文档性</b>偏离，且不影响产品质量、患者安全与数据可靠性？",
      hitlist:["记录填写不规范（涂改方式、空白未划线）","签字遗漏或日期填写不全",
               "非关键时限轻微超期（未影响质量）","文件版本引用错误（内容一致）",
               "非关键区域的标识/SOP 摆放问题"],
      opts:[ { t:"是，属孤立的程序性/文档性偏离", to:"DN", hit:"仅程序性/文档性偏离，无质量影响" },
             { t:"否 / 仍不确定", to:"DM", hit:"存疑从重，按主要偏差处理" } ]},

    DK: { result:1, level:"关键偏差", en:"Critical Deviation",
      verdict:"必须<b>立即启动调查</b>，由质量管理部门<b>会同相关部门彻底调查</b>，查明根本原因；涉及批次<b>不得放行</b>。",
      actions:["<b>立即（发现后 24 小时内）</b>报告质量负责人 / 质量受权人",
               "对受影响批次及<b>相邻批次、同品种其他批次</b>实施控制（隔离、暂停放行、暂停生产）",
               "成立跨部门调查组（QA 牵头，生产 / 工程 / QC / 注册参与）",
               "<b>7 日内</b>完成初步调查，<b>30 日内</b>完成根本原因分析并关闭",
               "评估对<b>已放行产品</b>的影响，必要时启动<b>召回</b>或向药监报告",
               "制定并实施 <b>CAPA</b>，后续做<b>有效性检查</b>",
               "涉及数据可靠性的，启动<b>数据可靠性专项调查</b>"],
      warn:"关键偏差是飞行检查与注册核查的必查项。调查不充分、根本原因未查明即关闭，会被直接开具缺陷项。",
      refs:["GMP(2010) 第二百四十四～二百四十七条","ICH Q10","ICH Q9(R1)","2023版GMP指南·质量管理体系"] },
    DM: { result:2, level:"主要偏差", en:"Major Deviation",
      verdict:"须在<b>3 个工作日内启动调查</b>，查明根本原因，<b>30 日内关闭</b>，并制定 CAPA。",
      actions:["3 个工作日内启动调查，QA 会同责任部门开展",
               "评估对产品质量的影响，形成<b>放行影响评估结论</b>",
               "查明根本原因（5Why / 鱼骨图 / FMEA 等工具）",
               "制定并实施 <b>CAPA</b>，明确责任人与完成期限",
               "30 日内关闭；确需延期的须书面说明并获 QA 批准",
               "纳入<b>季度/年度偏差趋势分析</b>"],
      warn:"若属 12 个月内重复发生，须<b>升级为系统性缺陷</b>处理：重新评估原 CAPA 的有效性，必要时重新设计控制策略。",
      refs:["GMP(2010) 第二百四十四～二百四十九条","ICH Q10","ICH Q9(R1)"] },
    DN: { result:3, level:"次要偏差", en:"Minor Deviation",
      verdict:"<b>即时纠正 + 完整记录</b>，无需单独展开调查；纳入月度 / 季度趋势分析。",
      actions:["当场或短期内完成<b>纠正</b>（如补签、更正记录、补充标识）",
               "在偏差记录中清楚描述事实、纠正措施与<b>不影响的判断依据</b>",
               "部门负责人确认，QA 备案",
               "纳入月度偏差台账与<b>趋势分析</b>",
               "同类问题若呈上升趋势，须<b>升级为主要偏差</b>并启动 CAPA"],
      warn:"即使定级为次要，也<b>不得</b>因频次高而降低记录质量；高频次要偏差本身就是体系信号。",
      refs:["GMP(2010) 第二百四十四条","ICH Q10"] }
  }
},

/* ------------------ 实验室异常结果树 ------------------ */
oos: {
  start: "o1",
  nodes: {
    o1: { q: "本次异常结果属于哪一类？", tag:"类型辨析",
      opts:[
        { t:"OOS —— 检验结果<b>超出</b>质量标准限度", to:"o2" },
        { t:"OOT / OOE —— 符合标准但<b>偏离历史趋势或预期</b>", to:"o6" },
        { t:"系统适用性（SST）不合格 / 仪器故障导致结果不可用", to:"o7" }
      ]},

    /* OOS 分支 */
    o2: { q:"【Phase I 前置】是否已<b>立即</b>停止后续处理，并保留原始溶液、样品与原始数据？", tag:"Phase I",
      tip:"OOS 一经发现，检验人员须<b>立即</b>停止计算与报告，保留<b>原始供试品溶液、对照品溶液、剩余样品、色谱原始数据与仪器日志</b>，并于当日报告实验室主管与 QA。",
      opts:[
        { t:"是，已按规定保留并报告", to:"o3" },
        { t:"否，尚未保留或已继续处理", to:"RP", hit:"未按规定保留原始溶液/样品/数据" }
      ]},
    o3: { q:"【Phase I 实验室调查】是否检出<b>明确且可归因的实验室错误</b>？", tag:"Phase I",
      tip:"须按核查清单逐项核对（计算、称量、稀释、仪器、SST、标准品、试剂、色谱柱、样品混淆、方法偏离、器皿、环境、数据录入等）。<b>「疑似」不等于「确认」</b>——必须有客观证据。",
      opts:[
        { t:"是，有明确证据的可归因实验室错误", to:"RL", hit:"Phase I 检出明确实验室错误" },
        { t:"否，未检出实验室错误（或仅为推测）", to:"o4" }
      ]},
    o4: { q:"【Phase II 前置】是否已启动<b>跨部门全面调查</b>？", tag:"Phase II",
      tip:"Phase I 未查出原因，<b>不得</b>直接以复测结果放行，必须进入 Phase II 全面调查。",
      opts:[
        { t:"是，已启动并完成既定调查内容", to:"o5" },
        { t:"否，尚未启动全面调查", to:"RP2", hit:"Phase I 未查出原因但直接进入复测" }
      ]},
    o5: { q:"【Phase II 结论】全面调查的结果是？", tag:"裁决",
      opts:[
        { t:"确认存在生产原因（工艺 / 物料 / 设备 / 操作），且影响产品质量", to:"RJ" },
        { t:"确认 OOS 成立，但<b>根本原因无法确定</b>", to:"RJ" },
        { t:"经充分调查证明<b>原样品不具代表性</b>或取样错误，重新取样结果合格", to:"RS" }
      ]},

    /* OOT 分支 */
    o6: { q:"OOT / OOE 的偏离形态是？", tag:"趋势评估",
      tip:"OOT <b>不自动判不合格</b>，但必须调查。常用触发规则：超出 3σ、连续 7 点位于均值同侧、连续 3 批单向漂移、超出历史最大值/最小值。",
      opts:[
        { t:"趋势性 / 连续性偏离（3σ 外、连续 7 点同侧、连续 3 批漂移）", to:"RT", hit:"趋势性/连续性偏离" },
        { t:"单次轻微偏离，无连续性", to:"RM2", hit:"单次轻微偏离" }
      ]},

    /* SST 分支 */
    o7: { q:"系统适用性失败或仪器故障的处理方式是？", tag:"无效结果",
      opts:[
        { t:"该次进样序列整序列作废，查明原因后重新分析", to:"RI2" },
        { t:"仅挑取合格的部分结果报告", to:"RB", hit:"选择性报告结果" }
      ]},

    /* ---- 结果节点 ---- */
    RP: { result:1, level:"程序违规 · 结果暂不可用", en:"Procedure Violation",
      verdict:"<b>先补正程序，再谈定级。</b>未保留原始溶液 / 样品 / 数据即继续处理，已违反 OOS 调查基本要求，该结果<b>不得用于放行</b>。",
      actions:["立即封存<b>现存的所有</b>样品、溶液、色谱数据与仪器日志",
               "书面说明未保留的原因、时间线与责任人，作为<b>数据可靠性缺陷</b>登记偏差",
               "按关键偏差处理该程序违规（数据可靠性类）",
               "对检验人员进行 OOS 程序的<b>再培训</b>并评估其历史检验数据",
               "评估该批次是否需<b>重新取样</b>检验（须 QA 批准并论证）"],
      warn:"销毁或丢弃原始溶液与数据，在检查中会被认定为<b>数据可靠性造假嫌疑</b>，后果远重于 OOS 本身。",
      refs:["FDA OOS Guidance (2022 Rev.1)","GMP(2010) 质量控制实验室管理","2023版GMP指南·质量控制实验室与物料系统"] },
    RL: { result:3, level:"实验室错误 · 原结果无效", en:"Invalidated — Lab Error",
      verdict:"已确认存在可归因的实验室错误，原 OOS 结果判为<b>无效（Invalid）</b>，可按规定<b>复测</b>。",
      actions:["将实验室错误的<b>客观证据</b>书面固化（记录、色谱图、维修单、环境监测数据等）",
               "填写 OOS 调查报告，明确<b>「无效结果」结论及依据</b>，经实验室主管与 QA 审核",
               "在 SOP 规定的次数范围内<b>复测</b>（次数须事先规定，不得临机增加）",
               "原 OOS 数据<b>必须保留</b>并一并归档，不得删除或覆盖",
               "针对该实验室错误启动 <b>CAPA</b>（如天平校准、方法培训、SST 强化）",
               "统计该实验室错误类型，纳入<b>实验室质量量度</b>与趋势分析"],
      warn:"「无效」必须有<b>证据</b>，不能靠推测。检查员会重点质疑：为什么恰好在 OOS 时才「发现」这个错误？实验室错误<b>高频出现</b>本身就是体系缺陷。",
      refs:["FDA OOS Guidance (2022 Rev.1)","MHRA OOS Guidance","ICH Q7 §11"] },
    RP2: { result:2, level:"必须进入 Phase II", en:"Phase II Required",
      verdict:"Phase I 未查出实验室原因，<b>不得直接复测放行</b>，必须启动 <b>Phase II 跨部门全面调查</b>。",
      actions:["由 <b>QA 牵头</b>，组织生产 / 工程 / QC / 注册成立调查组",
               "回顾<b>批生产记录</b>与全部工艺参数，核查是否偏离既定范围",
               "追溯<b>物料与供应商</b>：原辅料批号、检验放行、储存与发运",
               "核查<b>设备与公用系统</b>历史：维护、校准、偏差、变更",
               "调阅<b>留样与稳定性数据</b>，评估是否存在趋势性变化",
               "排查<b>同品种相邻批次</b>及共用设备生产的其他产品",
               "复测次数与条件<b>严格按 SOP 执行</b>，禁止「复测至合格」「用平均值报告」",
               "通常 <b>20～30 日内</b>完成调查并裁决"],
      warn:"在完成 Phase II 之前，任何「复测合格即放行」的做法都属于 <b>testing into compliance</b>，是 FDA 483 / 警告信的高频缺陷。",
      refs:["FDA OOS Guidance (2022 Rev.1)","ICH Q7 §11","EU GMP Chapter 6"] },
    RJ: { result:1, level:"确认 OOS · 批次不合格", en:"Confirmed OOS — Batch Reject",
      verdict:"OOS 结果成立，该批次<b>判定不合格</b>，不得放行；须关联<b>生产偏差</b>并评估相邻批次与已放行产品。",
      actions:["质量受权人 / 质量负责人作出<b>不合格裁决</b>并签署",
               "不合格批次按程序<b>隔离、标识并按批准方式处理</b>（返工须经批准且不得影响质量；否则销毁）",
               "关联并启动<b>生产偏差</b>调查，查明根本原因",
               "开展<b>影响范围评估</b>：同品种相邻批次、共用设备/物料的其他批、已放行批次",
               "如已放行批次存在风险，启动<b>召回程序</b>并按法规向药监报告",
               "制定并跟踪 <b>CAPA</b>，做有效性确认",
               "将 OOS 率纳入<b>质量量度与年度产品质量回顾</b>（APQR）"],
      warn:"「原因不明」不等于「可以放行」。FDA 明确规定：<b>无法确定原因时，须按最保守原则判定批次不合格</b>。",
      refs:["FDA OOS Guidance (2022 Rev.1)","ICH Q7 §11","EU GMP Chapter 6","GMP(2010) 质量控制实验室管理"] },
    RS: { result:4, level:"重新取样 · 须严格论证", en:"Resampling — Conditional",
      verdict:"仅在<b>证明原样品不具代表性或取样错误</b>，且经 QA 批准后，方可重新取样检验。",
      actions:["提供<b>客观证据</b>证明原样品不具代表性（如取样器具污染、取样点错误、样品运输/储存失控）",
               "在 OOS 调查报告中<b>书面论证</b>重新取样的科学必要性与取样方案",
               "经<b>质量管理部门书面批准</b>后方可重新取样",
               "原 OOS 结果与全部调查资料<b>一并归档</b>，不得销毁",
               "重新取样检验仍不合格的，<b>直接判批次不合格</b>",
               "取样环节若为根本原因，须对<b>取样 SOP 与人员</b>启动 CAPA"],
      warn:"重新取样<b>不得</b>成为规避 OOS 的通道。FDA 明确：仅因 OOS 而重新取样是不被接受的，必须先证明<b>取样本身</b>有问题。",
      refs:["FDA OOS Guidance (2022 Rev.1)","MHRA OOS Guidance","WHO TRS 1025 Annex 4"] },
    RT: { result:2, level:"OOT 趋势调查", en:"OOT Investigation",
      verdict:"结果<b>符合标准，不判不合格</b>，但必须启动<b>趋势调查</b>，评估工艺与标准的合理性。",
      actions:["启动 <b>OOT 调查</b>，记录调查过程与结论（与 OOS 分台账管理）",
               "核查<b>工艺稳定性</b>：CPP 是否有漂移、设备是否异常、物料批次是否变化",
               "核查<b>方法性能</b>：方法精密度、标准品、仪器状态、人员操作一致性",
               "评估<b>质量标准限度</b>与工艺能力（Cpk / Ppk）是否仍适用",
               "纳入<b>年度产品质量回顾（APQR）</b>与持续工艺确认（CPV）",
               "必要时<b>收紧内控警戒限/行动限</b>，加强后续批次监测",
               "若预测后续批次可能超出标准，须<b>提前采取纠正措施</b>"],
      warn:"OOT 常被当作「合格就没事」而忽略。实际上 OOT 是 OOS 的<b>预警信号</b>，忽视趋势漂移会直接导致后续 OOS 与监管质疑。",
      refs:["WHO TRS 1025 Annex 4","FDA OOS Guidance (2022 Rev.1)","ICH Q10（CPV）","2023版GMP指南·质量控制实验室与物料系统"] },
    RM2: { result:3, level:"记录并加强监测", en:"Monitor & Document",
      verdict:"单次轻微偏离，不构成 OOS。记录并纳入趋势跟踪即可。",
      actions:["在检验记录或 OOT 台账中<b>记录该偏离及初步判断</b>",
               "将该批次数据纳入<b>趋势图</b>持续跟踪",
               "下批检验时<b>重点关注</b>该指标",
               "若连续出现，按<b>趋势性偏离</b>升级处理"],
      refs:["WHO TRS 1025 Annex 4","ICH Q10"] },
    RI2: { result:3, level:"无效序列 · 重新分析", en:"SST Failure — Re-analysis",
      verdict:"系统适用性不合格 → 该进样序列<b>整序列无效</b>，查明原因后可<b>重新分析</b>。",
      actions:["记录 SST 失败的具体项目与实测值（分离度、拖尾因子、理论塔板数、RSD 等）",
               "查明原因：色谱柱、流动相、仪器、方法或操作",
               "采取纠正措施后<b>重新进行系统适用性试验</b>，合格后方可进样",
               "<b>整序列重新分析</b>，包括对照品与供试品",
               "原失败序列数据<b>保留归档</b>，并登记偏差或实验室事件",
               "SST 失败频繁须评估<b>方法的适用性</b>与色谱柱/仪器维护策略"],
      warn:"SST 不合格意味着<b>此前所有进样结果均不可信</b>，必须对整序列（含标准品与已测供试品）重新分析，不得只重测 OOS 样品。",
      refs:["FDA OOS Guidance (2022 Rev.1)","ICH Q2(R2)/Q14","药典通则 系统适用性"] },
    RB: { result:1, level:"严重违规 · 选择性报告", en:"Selective Reporting — Violation",
      verdict:"<b>禁止</b>在 SST 失败或仪器故障后挑取合格结果报告。此做法属<b>数据可靠性违规</b>。",
      actions:["立即停止该做法，已报告的结果<b>撤回并作废</b>",
               "按<b>关键偏差</b>（数据可靠性类）登记并启动专项调查",
               "整序列<b>重新分析</b>（含标准品与全部供试品）",
               "追溯评估该做法的<b>历史范围</b>：涉及哪些批次、哪些产品、多长时间",
               "已放行批次须重新评估，风险不可排除的启动召回",
               "对相关人员进行<b>数据可靠性专项培训</b>与资质再确认",
               "评估是否需向药监<b>主动报告</b>"],
      warn:"选择性报告结果是 FDA 483 与警告信的<b>典型缺陷</b>，一经发现即质疑全部历史数据的可靠性，后果极其严重。",
      refs:["FDA Data Integrity Guidance (2018)","MHRA GxP Data Integrity (2018)","ICH E6(R2)","GMP(2010) 数据可靠性要求"] }
  }
},

/* ------------------ 根本原因分析工具选择树 ------------------ */
capa: {
  start: "r1",
  nodes: {
    r1: { q:"当前分析任务的性质是什么？", tag:"任务定性",
      tip:"先分清是<b>事后归因</b>（问题已经发生）、<b>事前预防</b>（问题还没发生）、还是<b>趋势分析</b>（问题反复发生）——这决定了完全不同的工具。",
      opts:[
        { t:"事后归因 —— 问题已发生，需要找根本原因", to:"r2", hit:"事后归因" },
        { t:"事前预防 —— 识别潜在失效、评估变更或设计风险", to:"RF", hit:"事前预防" },
        { t:"趋势分析 —— 问题高频重复出现，需识别主要贡献因素", to:"RP", hit:"趋势性高频问题" }
      ]},
    r2: { q:"问题是否<b>在某个变更之后出现</b>，或可明确追溯到某个变化时点？", tag:"时点判断",
      tip:"变更包括：工艺参数、设备、物料/供应商、人员、SOP、场地、公用系统、软件升级等。若台账完整，变更分析往往是最快的路径。",
      opts:[
        { t:"是，问题紧随某个变更出现，且能界定变更前后的状态", to:"RA", hit:"问题紧随变更后出现" },
        { t:"否 / 不确定，无法锁定变化时点", to:"r3" }
      ]},
    r3: { q:"问题的<b>因果关系形态</b>更接近哪一种？", tag:"复杂度判断",
      hitlist:["<b>单一线性</b>：一步接一步，像一条链子（如某一步操作遗漏导致后续偏差）",
               "<b>多因素交织</b>：多个可能原因并存，需要团队一起穷举（如含量波动、可见异物、收率偏低）",
               "<b>系统性多层耦合</b>：涉及多个逻辑层次与公用系统（如无菌保证失效、交叉污染、数据可靠性缺失）"],
      opts:[
        { t:"单一线性 —— 因果链清晰，一步接一步", to:"R5", hit:"因果关系单一线性" },
        { t:"多因素交织 —— 需要团队穷举可能原因", to:"r4" },
        { t:"系统性多层耦合 —— 涉及多个逻辑层次或公用系统", to:"RT", hit:"系统性多层逻辑耦合" }
      ]},
    r4: { q:"团队当前更需要做的是哪一件？", tag:"方法选择",
      tip:"两者可以<b>组合使用</b>：先用鱼骨图穷举出候选原因池，再对高风险候选用 KT 精确界定。复杂问题通常都需要组合。",
      opts:[
        { t:"穷举并归类所有可能原因（头脑风暴，先不评判）", to:"RH", hit:"需穷举多因素" },
        { t:"精确界定「是什么 / 不是什么」，通过差异点锁定原因", to:"RK", hit:"需精确界定范围" }
      ]},

    /* ---- 结果节点：工具 ---- */
    R5: { result:3, level:"5 Why 五个为什么", en:"5 Whys",
      verdict:"适合<b>单一线性</b>的因果链。1～2 人即可开展，最快出结论，但多因素场景容易分叉失控。",
      actions:["用一句话客观描述<b>问题现象</b>（只写事实，不写原因）",
               "追问「为什么会发生」，答案<b>必须基于事实与证据</b>，不能是推测",
               "对上一层的答案继续追问「为什么」，逐层深入，通常 5 层",
               "每一层都要做<b>反向验证</b>：因为 X 所以 Y，反过来成立吗？证据在哪？",
               "持续深入，直到答案指向<b>可改变的系统要素</b>（流程 / 设计 / 标准 / 资源配置）",
               "记录完整因果链，每一层标注支撑证据"],
      warn:"两个高频错误：① <b>停在「人员疏忽」「培训不到位」</b>——这不是根因，必须继续追问为什么会疏忽（SOP 不清楚？操作设计易错？工作量过大？）；② <b>多条因果链混着问</b>——多因素场景应改用鱼骨图，5Why 会分叉失控。",
      refs:["ICH Q9(R1)","2023版GMP指南·质量管理体系"] },
    RH: { result:2, level:"鱼骨图（石川图 / 6M）", en:"Ishikawa / Fishbone",
      verdict:"适合<b>多因素交织</b>的场景。跨部门小组 4～8 人头脑风暴，穷举可能原因后<b>逐条验证</b>。",
      actions:["在鱼头位置明确<b>定义问题</b>（具体、可测量，如「A 产品含量低于内控限」）",
               "确定 6 大类主骨：<b>人 Man / 机 Machine / 料 Material / 法 Method / 环 Environment / 测 Measurement</b>",
               "团队头脑风暴，每类下穷举所有可能原因，此阶段<b>不评判、不反驳</b>",
               "对每个候选原因标注状态：<b>已验证 / 待验证 / 已排除</b>",
               "对「待验证」的逐条<b>取证验证</b>——这是最关键也最常被跳过的一步",
               "收敛到根本原因，并在报告中写清<b>每条被排除的原因及其排除依据</b>",
               "输出：鱼骨图 + 候选原因验证状态表"],
      warn:"<b>鱼骨图最大的陷阱是「画完就当分析完了」。</b>它只负责<b>归类与穷举</b>，不负责验证。画完不逐条取证，等于什么都没做——这正是检查员最常质疑的缺陷。",
      refs:["ICH Q9(R1)","ICH Q10","2023版GMP指南·质量管理体系"] },
    RK: { result:4, level:"KT 理性思考法", en:"Kepner-Tregoe Problem Analysis",
      verdict:"适合需要<b>精确界定范围</b>、通过差异点锁定原因的场景。严谨但门槛较高，需专门培训。",
      actions:["撰写<b>偏差陈述</b>：明确对象与缺陷（如「哪一批、哪个项目、偏离多少」）",
               "构建 <b>IS / IS NOT 矩阵</b>：从<b>何物、何处、何时、程度</b>四个维度，分别列出「是什么」与「不是什么」",
               "对比 IS 与 IS NOT，列出所有的<b>区别点</b>（Distinctions）",
               "列出与该问题相关的所有<b>变化</b>（Changes）",
               "将「变化」与「区别点」匹配，推导出<b>最可能原因</b>",
               "<b>验证</b>：确认该原因能<b>同时解释 IS 与 IS NOT</b>——这是 KT 的核心检验",
               "确认根本原因，进入 CAPA"],
      warn:"<b>致命检验：</b>如果你的「最可能原因」只能解释 IS（为什么发生了），却解释不了 IS NOT（为什么其他批次没发生），那它就不是根因。信息不全（构建不出 IS NOT）时不宜硬套 KT。",
      refs:["ICH Q9(R1)","ICH Q10"] },
    RT: { result:1, level:"故障树分析 FTA", en:"Fault Tree Analysis",
      verdict:"适合<b>系统性、多层逻辑耦合</b>的严重失效（无菌保证失效、交叉污染、公用系统故障、数据可靠性缺失）。",
      actions:["明确定义<b>顶事件</b>（不希望发生的失效，须具体可界定）",
               "自上而下逐层分解，用 <b>AND / OR 逻辑门</b>连接各层原因",
               "持续分解至<b>基本事件</b>（不可再分、可独立验证）",
               "<b>定性分析</b>：求解最小割集（能导致顶事件的最小原因组合）",
               "<b>定量分析</b>（有数据时）：计算顶事件发生概率与重要度",
               "针对最小割集逐一制定<b>控制措施与屏障</b>",
               "输出故障树图 + 最小割集清单 + 措施表"],
      warn:"FTA 耗时长且需要精确的失效机理知识，应由专业工程师主导。<b>不要用它分析简单问题</b>——杀鸡用牛刀反而拖慢响应。若分析的是「控制措施为何没拦住」，建议叠加<b>屏障分析</b>。",
      refs:["ICH Q9(R1)","2023版GMP指南·质量管理体系"] },
    RA: { result:2, level:"变更分析", en:"Change Analysis",
      verdict:"问题<b>紧随某个变更出现</b>时，这是最快的路径。对比变更前后差异，直接锁定嫌疑。",
      actions:["明确<b>问题出现的时点</b>，向前回溯合理的时间窗口",
               "列出该窗口内的<b>全部变更</b>：工艺参数、设备、物料/供应商、人员、SOP、场地、公用系统、软件升级",
               "逐项对比<b>变更前 / 变更后</b>的状态差异",
               "评估每项差异与问题的<b>关联性</b>（强 / 中 / 弱）",
               "对高关联项<b>验证因果关系</b>（暂停或回退该变更，看问题是否消失）",
               "确认后<b>回溯评估</b>：当初的变更控制为何没能识别出这个风险？",
               "同步更新变更影响评估的方法，防止同类漏评"],
      warn:"<b>前提是变更台账完整。</b>台账不全（漏登记、事后补记）时此方法直接失效——而这本身就是一个<b>体系缺陷</b>，须一并记录与整改。",
      refs:["GMP(2010) 第二百四十～二百四十三条","ICH Q10","ICH Q12"] },
    RF: { result:4, level:"FMEA 失效模式与效应分析", en:"Failure Mode & Effects Analysis",
      verdict:"<b>事前预防</b>工具：用于识别潜在失效、评估变更或设计风险、量化改进优先级。<b>不擅长事后归因。</b>",
      actions:["界定<b>分析范围</b>（具体工序 / 产品 / 系统），组建跨职能小组",
               "列出该范围内所有<b>潜在失效模式</b>（可能怎么失效）",
               "对每个失效模式评估三参数（通常 1～10 分）<br/>　· <b>S 严重度</b>（Severity）：失效后果有多严重<br/>　· <b>O 发生概率</b>（Occurrence）：发生的可能性<br/>　· <b>D 可探测度</b>（Detection）：能被发现的程度（分越高越难探测）",
               "计算 <b>RPN = S × O × D</b>，按 RPN 降序排序",
               "对高 RPN 项制定措施，<b>优先降 S，其次降 O，最后降 D</b>",
               "措施实施后<b>重新评分</b>，验证 RPN 是否下降",
               "定期回顾更新（工艺/产品/法规变化时须重评）"],
      warn:"评分<b>主观性强</b>，须由跨职能小组共同确定并保留评分依据，否则检查时难以自证。另注意：<b>FMEA 是预防工具，不应拿来做事后归因</b>——偏差已经发生了就别再算 RPN 了。",
      refs:["ICH Q9(R1)","ICH Q10","2023版GMP指南·质量管理体系"] },
    RP: { result:3, level:"帕累托分析（80/20）", en:"Pareto Analysis",
      verdict:"适合<b>趋势性、高频次</b>问题：用数据找出主要贡献因素，把资源投在刀刃上。",
      actions:["收集<b>足够时间段</b>的数据（偏差台账、OOS 记录、投诉记录等）",
               "按<b>原因 / 类别</b>分类统计频次或损失金额",
               "按降序排列，计算<b>累计百分比</b>",
               "绘制帕累托图（柱状 + 累计折线），识别累计约 80% 的<b>主要少数项</b>",
               "对主要少数项<b>优先投入资源</b>制定改进措施",
               "措施实施一段时间后<b>重新统计</b>，验证改善效果",
               "将结论纳入年度产品质量回顾（APQR）与质量量度"],
      warn:"需要<b>足够数据量</b>才有统计意义，不适合单次孤立事件。另外分类口径必须一致且不重叠，否则分析结论不可靠。",
      refs:["ICH Q10","ICH Q9(R1)","2023版GMP指南·质量管理体系"] }
  }
}

};

/* =========================================================
   渲染引擎
   ========================================================= */
const PREFIX = { change:"c", deviation:"d", oos:"o", capa:"rca" };
const KORDER = ["change","deviation","oos","capa"];
const state = { change:[], deviation:[], oos:[], capa:[] };   // 每棵树的历史节点栈

function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function render(key){
  const T = TREES[key], p = PREFIX[key], stack = state[key];
  const body = document.getElementById(p+"-body");
  const trail = document.getElementById(p+"-trail");
  const stepEl = document.getElementById(p+"-step");
  const node = T.nodes[stack[stack.length-1]];

  // 轨迹
  let th = "";
  for(let i=0;i<stack.length-1;i++){
    const qn = T.nodes[stack[i]];
    const next = stack[i+1];
    let ansTxt = "";
    (qn.opts||[]).forEach(o=>{ if(o.to===next) ansTxt = o.t; });
    if(!ansTxt) ansTxt = "—";
    th += `<div class="trow"><span class="tn">${i+1}</span><span><span class="tq">${qn.q}</span> <span class="ta">→ ${ansTxt}</span></span></div>`;
  }
  trail.innerHTML = th;
  stepEl.textContent = stack.length===1 ? "第 1 步" : `第 ${stack.length} 步`;

  if(node.result){
    let h = `<div class="res r${node.result}">`;
    h += `<div class="res-badge">${node.level} <span style="font-size:12px;font-weight:400;opacity:.85">${node.en||""}</span></div>`;
    h += `<div class="verdict">${node.verdict}</div>`;
    h += `<h4>处置要求</h4><ul>` + node.actions.map(a=>`<li>${a}</li>`).join("") + `</ul>`;
    if(node.warn) h += `<div class="warn"><b>特别注意：</b>${node.warn}</div>`;
    if(node.refs) h += `<div class="refs"><b style="color:#445">法规依据：</b>` + node.refs.map(r=>`<span>${esc(r)}</span>`).join("") + `</div>`;
    h += `<div style="margin-top:14px"><button class="btn primary" data-act="reset" data-key="${key}">重新判定</button></div>`;
    h += `</div>`;
    body.innerHTML = h;
  } else {
    let h = `<div><span class="qtag">${esc(node.tag||"判定")}</span></div>`;
    h += `<div class="q">${node.q}</div>`;
    if(node.tip) h += `<div class="tip"><b>提示：</b>${node.tip}</div>`;
    if(node.hitlist) h += `<ul class="hitlist">` + node.hitlist.map(x=>`<li>${x}</li>`).join("") + `</ul>`;
    h += `<div class="opts">` + node.opts.map((o,i)=>
      `<button class="opt" data-act="pick" data-key="${key}" data-i="${i}"><span class="arrow">▸</span>${o.t}</button>`).join("") + `</div>`;
    body.innerHTML = h;
  }
  renderMap(key);
}

function pick(key, i){
  const T = TREES[key], stack = state[key];
  const node = T.nodes[stack[stack.length-1]];
  stack.push(node.opts[i].to);
  render(key);
  document.getElementById(PREFIX[key]+"-body").scrollIntoView({behavior:"smooth",block:"center"});
}

function backTree(key){
  const stack = state[key];
  if(stack.length>1){ stack.pop(); render(key); }
}
function resetTree(key){
  state[key] = [TREES[key].start];
  render(key);
}

/* 判定路径全图 */
function renderMap(key){
  const T = TREES[key], p = PREFIX[key], stack = state[key];
  const cur = stack[stack.length-1];
  const visited = new Set(stack);
  let h = "";
  Object.keys(T.nodes).forEach(id=>{
    const n = T.nodes[id];
    const isCur = (id===cur);
    if(n.result){
      h += `<div class="mnode res ${isCur?"cur":""}"><div class="mh" data-act="jump" data-key="${key}" data-id="${id}">
        <span class="mcode">${id}</span><span class="mtext"><span class="mlv r${n.result}">■ ${n.level}</span>
        <span style="color:#667;font-size:12px;margin-left:6px">${n.en||""}</span></span></div></div>`;
    } else {
      h += `<div class="mnode ${isCur?"cur":""}"><div class="mh" data-act="jump" data-key="${key}" data-id="${id}">
        <span class="mcode">${id}</span><span class="mtext">${n.q}</span></div><div class="mopts">` +
        n.opts.map(o=>{
          const tgt = T.nodes[o.to];
          const label = tgt && tgt.result ? `<span class="mlv r${tgt.result}">${tgt.level}</span>` : esc(o.t);
          return `<div class="mopt">· ${label} <span class="to">→ ${o.to}</span></div>`;
        }).join("") + `</div></div>`;
    }
  });
  document.getElementById(p+"-map").innerHTML = h;
}
function jump(key, id){
  const stack = state[key];
  const idx = stack.indexOf(id);
  if(idx>=0){ stack.length = idx+1; }
  else { stack.push(id); }
  render(key);
}

/* Tab 切换 */
document.querySelectorAll(".tab").forEach(t=>{
  t.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");
    document.getElementById("p-"+t.dataset.p).classList.add("active");
    if(location.hash.slice(1)!==t.dataset.p) history.replaceState(null,"","#"+t.dataset.p);
  });
});
KORDER.forEach(k=>{
  const p = PREFIX[k];
  document.getElementById(p+"-back").addEventListener("click",()=>backTree(k));
  document.getElementById(p+"-reset").addEventListener("click",()=>resetTree(k));
});


/* 事件委托：避免内联 onclick（CSP script-src 'self' 禁止 unsafe-inline） */
document.addEventListener("click", function(e){
  const el = e.target.closest("[data-act]");
  if(!el) return;
  const act = el.getAttribute("data-act");
  const key = el.getAttribute("data-key");
  if(act==="pick") pick(key, parseInt(el.getAttribute("data-i"),10));
  else if(act==="reset") resetTree(key);
  else if(act==="jump") jump(key, el.getAttribute("data-id"));
});

/* init */
KORDER.forEach(k=>{ state[k] = [TREES[k].start]; render(k); });
const _h = location.hash.slice(1);
if(KORDER.includes(_h)){
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active", x.dataset.p===_h));
  document.querySelectorAll(".panel").forEach(x=>x.classList.toggle("active", x.id==="p-"+_h));
}
