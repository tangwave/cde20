
/* ============ 基础工具 ============ */
const PREFIX='wb_qa_rd_qms_v1_';
const $=(s,r=document)=>r.querySelector(s);
function esc(s){if(s==null)return'';return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function today(){const d=new Date();return d.toISOString().slice(0,10);}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function getA(key){try{return JSON.parse(localStorage.getItem(PREFIX+key)||'[]');}catch(e){return[];}}
function setA(key,arr){localStorage.setItem(PREFIX+key,JSON.stringify(arr));}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800);}
const BASIS=['NMPA GMP(2010修订)','NMPA GLP','ICH Q8','ICH Q9(R1)','ICH Q10','ICH Q11','ICH Q12','ICH Q14','ICH M4','FDA 21CFR','EMA','OECD GLP','中国药典','药品注册核查要点','GMP指南2023'];
/* 核查原则：供「文件审阅」「记录/申报资料核查」的核查方法选择，使核查有据可依 */
const VERIFY_PRINCIPLES_DOC=[
 '法规符合性（对照NMPA/GMP/ICH等适用性）','文件间冲突检查（编号/版本/数据互不一致）',
 '格式规范性（体例/签章/日期/页码）','数据准确性（数值/单位/小数点/范围）',
 '内容完整性（章节齐全/无缺失）','版本一致性（正文与附件同源）','签署与审批完整性'];
const VERIFY_PRINCIPLES_CHK=[
 '数据可靠性 ALCOA+（可追溯/原始/同步/准确/完整/一致/持久/可用）','注册核查要点（NMPA 注册核查实施原则）',
 'CTD模块间一致性（M2摘要与M3/M4/M5对应）','申报资料与实验记录一致性',
 '数值/单位/日期三核对','纸质与电子记录一致','原始数据可溯（原始图谱/台账）',
 '结论合理性（与数据支撑匹配）','ICH E6(R2/R3) 临床试验数据','药典/标准符合性'];
/* AI 核查后端地址：留空=同源 /api/verify（部署在知识库网页后端时即用） */
const AI_URL_KEY=PREFIX+'aiurl';
function getAiUrl(){try{return (localStorage.getItem(AI_URL_KEY)||'').trim();}catch(e){return'';}}
function setAiUrl(v){try{localStorage.setItem(AI_URL_KEY,v.trim());}catch(e){}}
function aiVerifyUrl(){const u=getAiUrl();if(u)return u.replace(/\/+$/,'').replace(/\/api\/verify\/?$/,'')+'/api/verify';return (location.origin||'')+'/api/verify';}
/* 文件选择临时缓冲（每次打开表单时初始化） */
let _fileBuf=[];let _fileBufKey='';

/* ============ 云端同步层（多端实时同步 · FastAPI后端）============ */
const CLOUD_KEY='wb_qa_rd_qms_cloud_';
let CLOUD={enabled:false,url:'',token:'',workspace:'',lastSync:'0'};
let _syncTimer=null;
function loadCloud(){try{const o=JSON.parse(localStorage.getItem(CLOUD_KEY)||'{}');CLOUD=Object.assign(CLOUD,o);}catch(e){}}
function saveCloud(){try{localStorage.setItem(CLOUD_KEY,JSON.stringify(CLOUD));}catch(e){}}
function stripMeta(rec){const c=Object.assign({},rec);delete c._v;delete c._uat;return c;}
async function api(method,path,body){
  let base=(CLOUD.url||'').trim();
  if(!base||base==='/')base=''; else base=base.replace(/\/+$/,'');
  try{
    const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(CLOUD.token||'')},body:(body!==undefined)?JSON.stringify(body):undefined});
    const t=await r.text();
    return[r.status,t?JSON.parse(t):{}];
  }catch(e){return[0,{}];}
}
async function cloudBootstrap(){
  const [st,res]=await api('GET','/api/bootstrap');
  if(st!==200){toast('拉取云端数据失败');return false;}
  (res.records||[]).forEach(rec=>{
    const key=rec.module;const obj=JSON.parse(rec.data);obj._v=rec.version;obj._uat=rec.updated_at;
    const a=getA(key);const i=a.findIndex(r=>r.id===obj.id);
    if(i<0)a.push(obj);else if(rec.version>(a[i]._v||0))a[i]=obj;
    setA(key,a);
  });
  CLOUD.lastSync=res.server_time;saveCloud();renderCloudBadge();
  return true;
}
async function pullSync(){
  if(!CLOUD.enabled||!CLOUD.token)return;
  const [st,res]=await api('GET','/api/sync?since='+encodeURIComponent(CLOUD.lastSync||'0'));
  if(st!==200)return;
  let changed=false;
  (res.changes||[]).forEach(ch=>{
    const key=ch.module;const obj=JSON.parse(ch.data);obj._v=ch.version;obj._uat=ch.updated_at;
    const a=getA(key);const i=a.findIndex(r=>r.id===ch.id);
    if(ch.deleted){if(i>=0){a.splice(i,1);changed=true;}}
    else{if(i<0){a.push(obj);changed=true;}else if(ch.version>(a[i]._v||0)){a[i]=obj;changed=true;}}
    setA(key,a);
  });
  if((res.changes||[]).length)CLOUD.lastSync=res.server_time;saveCloud();
  if(changed){renderNav();if(!curMod||curMod==='__home')renderHome();else renderModule();}
}
function startSync(){if(_syncTimer)clearInterval(_syncTimer);_syncTimer=setInterval(pullSync,15000);pullSync();}
function stopSync(){if(_syncTimer){clearInterval(_syncTimer);_syncTimer=null;}}
async function apiPersist(mod,rec){
  if(!CLOUD.enabled||!CLOUD.token)return;
  const isNew=!rec._v;
  const body={record:stripMeta(rec),baseVersion:rec._v||null};
  let st,res;
  if(isNew){[st,res]=await api('POST','/api/'+mod+'/records',body);}
  else{[st,res]=await api('PUT','/api/'+mod+'/records/'+rec.id,body);}
  if(st===404&&!isNew){[st,res]=await api('POST','/api/'+mod+'/records',body);}
  if(st===409){toast('⚠ 该记录已被他人修改，已自动刷新为最新');pullSync();return;}
  if(st!==200){toast('⚠ 云端保存失败，已保留本地副本');return;}
  rec._v=res.version;rec._uat=res.updated_at;
  const a=getA(mod);const i=a.findIndex(r=>r.id===rec.id);if(i>=0){a[i]=rec;setA(mod,a);}
}
async function cloudDelete(mod,id){
  if(!CLOUD.enabled||!CLOUD.token)return;
  const [st]=await api('DELETE','/api/'+mod+'/records/'+id);
  if(st!==200)toast('⚠ 云端删除失败，本地已删除');
}
function renderCloudBadge(){
  const b=$('#cloudBadge');if(!b)return;
  if(CLOUD.enabled&&CLOUD.token){
    b.className='cloud-badge on';
    b.innerHTML='<span class="dot"></span>☁ 云端已连接 · '+esc(CLOUD.workspace||'')+'<span class="sync">↻15s</span>';
  }else{
    b.className='cloud-badge';
    b.innerHTML='<span class="dot"></span>☁ 本地模式（点此连接云端）';
  }
}
function openCloudModal(){
  $('#modalTitle').textContent='☁ 云端同步设置';
  let h=`<div class="form-grid">
    <div class="field full"><label>后端服务地址</label><input type="text" id="cUrl" placeholder="同域部署填 / 或留空（如知识库网页自带后端）；独立后端填 https://... 或 http://IP:8000" value="${esc(CLOUD.url||'')}"></div>
    <div class="field"><label>工作区名称</label><input type="text" id="cWs" placeholder="自定义工作区名" value="${esc(CLOUD.workspace||'')}"></div>
    <div class="field"><label>密码</label><input type="password" id="cPw" placeholder="工作区密码（≥4位）"></div>
    <div class="field full"><label>AI 核查后端地址（可选）</label><input type="text" id="cAi" placeholder="留空=同源 /api/verify；独立部署填 https://你的后端（需提供 /api/verify）" value="${esc(getAiUrl())}"></div>
    <div class="field full" style="font-size:12px;color:var(--muted);line-height:1.7">说明：<b>工作区</b>是一个共享空间。多人/多设备使用<b>相同的工作区名称+密码</b>即可访问同一份数据，实现实时同步。密码不可找回，请牢记。后端服务需自行部署（见随附的部署文档）。<b>AI 核查</b>调用后端 LLM（需配置 API Key），未配置时可用「复制提示词」在外部 AI 执行。</div>
  </div>`;
  $('#modalBody').innerHTML=h;
  $('#modalFoot').innerHTML=
    `<button class="btn" data-act="closeModal">取消</button>`+
    (CLOUD.enabled?`<button class="btn btn-danger" data-act="cloudDisconnect">断开并切回本地</button>`:'')+
    (CLOUD.enabled?`<button class="btn" data-act="cloudUploadLocal">⬆ 上传本地数据到云端</button>`:'')+
    `<button class="btn" data-act="cloudLogin">登录</button>`+
    `<button class="btn btn-primary" data-act="cloudRegister">注册并连接</button>`;
  showMask();
}
async function cloudAuth(mode){
  const url=$('#cUrl').value.trim(),ws=$('#cWs').value.trim(),pw=$('#cPw').value,ai=$('#cAi').value.trim();
  if(!url||!ws||pw.length<4){toast('请填写地址、工作区名，密码≥4位');return;}
  CLOUD.url=url;CLOUD.workspace=ws;if(ai)setAiUrl(ai);saveCloud();
  $('#modalFoot').innerHTML='<span class="sub">连接中…</span>';
  const [st,res]=await api('POST','/'+(mode==='register'?'api/register':'api/login'),{name:ws,password:pw});
  if(st!==200){toast(mode==='register'?'注册失败（可能已存在，请改用登录）':'登录失败：名称或密码错误');return;}
  CLOUD.token=res.token;CLOUD.enabled=true;CLOUD.lastSync='0';saveCloud();
  const ok=await cloudBootstrap();
  closeModal();
  if(ok){toast('☁ 已连接云端，开始同步');startSync();}
  else{CLOUD.enabled=false;CLOUD.token='';saveCloud();toast('云端连接失败，请检查地址');}
  renderCloudBadge();renderNav();renderHome();
}
function cloudDisconnect(){
  stopSync();CLOUD.enabled=false;CLOUD.token='';saveCloud();
  closeModal();renderCloudBadge();toast('已断开，切回本地模式');
}
async function cloudUploadLocal(){
  if(!CLOUD.enabled||!CLOUD.token){toast('请先连接云端');return;}
  let n=0;
  for(const m of ORDER){getA(m).forEach(r=>{const c=Object.assign({},r);if(!c.id)c.id=uid();apiPersist(m,c);n++;});}
  toast('已提交 '+n+' 条本地数据到云端（后台同步中）');
}

/* ============ 模块配置（22个，对标GMP指南2023研发体系 + ICH Q8~Q14 / FDA OOS / MHRA DI）============ */
/* 导航分组按 GMP(2010年修订) 章节顺序组织，便于按体系主线定位：
   质量体系 → 人员 → 设备/数据 → 物料/供应商 → 确认与验证 → 文件记录
   → 生产/放行/实验室 → 变更·偏差·CAPA → 投诉/自检（共 22 个模块）
   【v5 优化】① 表单按业务流程分节（section）；② 补齐 GMP/ICH 受控词表；
   ③ 统一术语：风险等级=高/中/低，发现项分级=关键/主要/次要；④ 补齐闭环字段（有效性评价、整改追踪）。 */
const GROUPS=[
 {g:'① 质量体系与风险 · GMP 第二章',mods:['qrm','mgmt_review']},
 {g:'② 机构与人员 · GMP 第三章',mods:['training','knowledge']},
 {g:'③ 设备与数据 · GMP 第五·八章',mods:['equip','di']},
 {g:'④ 物料·供应商·委托 · 第六·十·十一章',mods:['supplier','audit','outsourcing']},
 {g:'⑤ 确认与验证 · GMP 第七章',mods:['pv','tech_transfer']},
 {g:'⑥ 文件与记录核查 · GMP 第八章',mods:['doc_review','record_check']},
 {g:'⑦ 生产·放行·实验室 · 第九·十章',mods:['release','oos','method','stability']},
 {g:'⑧ 变更·偏差·CAPA · GMP 第十章',mods:['change','deviation','capa']},
 {g:'⑨ 投诉·自检 · 第十·十三章',mods:['complaint','self_inspect']},
];
const M={};
/* 字段构造器：F(键, 标签, 类型, 选项/提示) — 类型：text / textarea / select / multiselect / date / number / files */
function F(k,l,t,o,h){const f={key:k,label:l,type:t||'text'};if(o)f.options=o;if(h)f.hint=h;return f;}
/* 表单分节标题：S(序号, 标题, 右侧提示) */
function S(n,t,h){return {key:'__s'+n,label:t,type:'section',no:n,hint:h||''};}
/* 受控词表：发现项分级（GMP 审计/偏差通用 Critical/Major/Minor） */
const GRADE=['关键','主要','次要','观察项'];
const RISK3=['高','中','低'];
const PHASE_RD=['临床前','I期','II期','III期','申报/NDA','上市后'];

/* ---------- ⑥ 文件与记录核查 ---------- */
M.doc_review={name:'文件审阅',ic:'📋',done:['已完成','已作废'],
 fields:[S(1,'文件信息'),
  F('code','文件编号','text'),F('name','文件名称','text'),F('version','版本号','text'),
  F('type','文件类型','select',['SOP/管理制度','方案/计划','研究报告','验证/确认报告','质量标准','分析方法','工艺规程','批记录','申报资料(CTD模块)','URS/技术文件','图纸/布局','其他']),
  F('drafter','起草人/部门','text'),F('attach','文件/附件','files'),
  S(2,'审阅实施'),
  F('reviewType','审阅类型','multiselect',['格式与编号','内容与逻辑','数据一致性','法规符合性','GLP/GCP符合性','交叉引用与可追溯','术语与单位','签名与日期','附件完整性']),
  F('basis','法规/标准依据','multiselect',BASIS),F('principles','核查原则','multiselect',VERIFY_PRINCIPLES_DOC),
  F('reviewer','审阅人','text'),F('reviewDate','审阅日期','date'),
  S(3,'结论与整改'),
  F('conflict','是否发现冲突/不一致','select',['无','有']),F('conflictDesc','冲突/不一致描述','textarea'),
  F('conclusion','审阅结论','select',['通过','有条件通过','不通过','退回修改']),F('rectify','整改要求','textarea'),
  F('owner','跟踪人','text'),F('dueDate','完成期限','date'),
  F('status','状态','select',['待审阅','审阅中','已退回','已完成','已作废']),F('remark','备注','textarea')],
 stats:[['总数','count'],['待审阅','where',{status:'待审阅'}],['审阅中','where',{status:'审阅中'}],['有冲突','where',{conflict:'有'}],['逾期','overdue']],
 cols:['code','name','version','type','conflict','conclusion','status','dueDate']};

M.record_check={name:'记录/申报资料核查',ic:'🔍',done:['已完成'],
 fields:[S(1,'核查对象'),
  F('code','核查编号','text'),F('name','核查名称','text'),F('project','所属项目/品种','text'),
  F('targetDoc','目标文档','text'),F('attach','源记录/附件','files'),
  S(2,'核查策划'),
  F('basis','核查依据','multiselect',['药品管理法/GMP','GLP规范','GCP规范','ICH指导原则','药典/质量标准','研究方案','企业SOP','申报资料要求(M4/CTD)','注册申报技术要求','委托方/合同要求']),
  F('principles','核查原则','multiselect',VERIFY_PRINCIPLES_CHK),
  F('scope','核查范围/抽样','textarea'),F('method','核查方法','select',['人工比对','工具辅助','人工+工具','AI智能核查']),
  F('risk','风险等级','select',RISK3),
  S(3,'核查发现'),
  F('itemCount','不一致项数量','number'),F('items','不一致项清单','textarea'),
  F('diCheck','数据可靠性(ALCOA++)核查','multiselect',['可归属','清晰可读','同步记录','原始性','准确性','完整性','一致性','持久性','可获取','可追溯']),
  F('consistency','一致性结论','select',['一致','部分一致','不一致','待核查']),
  S(4,'整改闭环'),
  F('rectify','整改要求','textarea'),F('rectifyStatus','整改跟进','select',['未启动','整改中','已整改','无法整改','不适用']),
  F('owner','核查人','text'),F('dueDate','完成期限','date'),
  F('status','状态','select',['待核查','进行中','已完成']),F('remark','备注','textarea')],
 stats:[['总数','count'],['待核查','where',{status:'待核查'}],['高风险','where',{risk:'高'}],['不一致','where',{consistency:'不一致'}],['逾期','overdue']],
 cols:['code','name','project','risk','consistency','rectifyStatus','status','dueDate']};

/* ---------- ⑧ 变更·偏差·CAPA ---------- */
M.change={name:'变更管理',ic:'🔄',done:['已关闭','已否决'],
 fields:[S(1,'变更申请','谁提、改什么、为什么改'),
  F('code','变更编号','text'),F('title','变更事项','text'),
  F('type','变更类型','select',['原辅料/物料','处方/工艺','分析方法','质量标准','设备/设施','计算机化系统','生产场地/生产线','包装材料/标签','文件/SOP','人员/组织','供应商','批量/规模','有效期/贮存条件','其他']),
  F('source','变更来源','select',['偏差/CAPA','内部审计/自检','监管要求','研发推进','供应商变更','质量回顾','技术进步','注册/客户要求']),
  F('phase','研发阶段','select',PHASE_RD),
  F('applicant','申请人/部门','text'),F('applyDate','申请日期','date'),
  F('desc','变更内容与理由','textarea'),
  S(2,'影响评估与分级','改了会影响到什么、是否触及注册'),
  F('impact','影响评估维度','multiselect',['产品质量/CQA','患者安全性','有效性','法规/注册申报','验证状态','分析方法','稳定性研究','清洁验证','文件与记录','培训需求','供应商/物料','计算机化系统','EHS/职业健康']),
  F('risk','风险等级','select',RISK3),
  F('regImpact','注册影响','select',['无影响','年度报告/备案','需补充申请','需重大变更申报','需沟通交流会议','需更新IND/CTA','需更新DMF']),
  F('level','变更级别','select',['重大','中等','微小']),
  S(3,'审批与实施','CCB/质量转受人批准后方可实施'),
  F('ccb','CCB/评审意见','textarea'),F('approver','批准人','text'),F('approveDate','批准日期','date'),
  F('impl','实施计划/行动项','textarea'),F('relatedSys','关联文件/系统','text'),
  F('effCheck','实施后有效性评价','textarea'),
  F('owner','负责人','text'),F('dueDate','计划完成','date'),
  F('status','状态','select',['待评估','待审批','已批准','实施中','已关闭','已否决']),F('remark','备注','textarea')],
 stats:[['总数','count'],['待审批','where',{status:'待审批'}],['重大变更','where',{level:'重大'}],['实施中','where',{status:'实施中'}],['逾期','overdue']],
 cols:['code','title','type','level','regImpact','status','dueDate']};

M.deviation={name:'偏差管理',ic:'⚠️',done:['已关闭','已作废'],
 fields:[S(1,'发现与报告','24h内报告，先遏制再调查'),
  F('code','偏差编号','text'),F('title','偏差事实描述','text'),
  F('foundDate','发现日期','date'),F('finder','发现人/部门','text'),
  F('related','关联产品/项目/批次/系统','text'),F('project','所属项目','text'),
  F('category','偏差分类','select',['人员/操作','设备/设施','物料/原辅料','方法/检验','环境/洁净','文件/SOP','计算机化系统/数据','公用系统','生产/工艺','包装/标签','仓储/运输','其他']),
  F('gmpRef','违反条款/文件依据','text'),
  S(2,'分级与即时处置','分级：关键(Critical)/主要(Major)/次要(Minor)'),
  F('severity','严重程度','select',['关键','主要','次要']),
  F('immediate','即时措施/遏制措施','textarea'),F('impact','影响评估(质量/安全/数据/注册)','textarea'),
  F('trend','发生频次属性','select',['首次发生','重复发生','趋势性(≥3次)']),
  S(3,'根本原因分析','5Why/鱼骨图/FTA，区分「表象原因」与「根本原因」'),
  F('method','调查方法','select',['5Why','鱼骨图(4M1E)','故障树FTA','FMEA','流程图','头脑风暴','对比实验','其他']),
  F('rootCause','根本原因','textarea'),F('evidence','支持证据/附件','files'),
  S(4,'CAPA 与关闭','原则上 30 个工作日内关闭'),
  F('ca','纠正措施CA','textarea'),F('pa','预防措施PA','textarea'),F('capaRef','关联CAPA编号','text'),
  F('effCheck','CAPA有效性评价','textarea'),
  F('owner','调查人','text'),F('dueDate','关闭期限','date'),
  F('status','状态','select',['待分级','待调查','调查中','待CAPA关闭','已关闭','已作废']),F('remark','备注','textarea')],
 stats:[['总数','count'],['调查中','where',{status:['待调查','调查中']}],['关键偏差','where',{severity:'关键'}],['重复发生','where',{trend:['重复发生','趋势性(≥3次)']}],['逾期','overdue']],
 cols:['code','title','category','severity','trend','status','dueDate']};

M.capa={name:'CAPA台账',ic:'🛠',done:['已关闭'],
 fields:[S(1,'来源与问题描述'),
  F('code','CAPA编号','text'),
  F('source','来源','select',['偏差','OOS/OOT','审计/自检','投诉','变更','管理评审','产品质量回顾','工艺/数据趋势','监管检查','风险评审']),
  F('ref','关联编号','text'),F('desc','问题/不符合描述','textarea'),F('project','所属项目','text'),
  S(2,'措施策划','纠正、纠正措施、预防措施要分清'),
  F('type','类型','select',['纠正(Correction)','纠正措施CA','预防措施PA','综合CAPA']),
  F('action','具体措施内容','textarea'),
  F('responsible','责任人','text'),F('dept','责任部门','text'),F('planDate','计划完成日期','date'),
  S(3,'执行与有效性确认','无有效性评价不得关闭'),
  F('execDate','实际完成日期','date'),
  F('effMethod','有效性评价方式','select',['指标对比','趋势分析','复核/抽查','审计确认','管理评审','现场确认','待定']),
  F('effect','有效性评价结论','textarea'),F('effDate','评价日期','date'),F('closeDate','关闭日期','date'),
  F('owner','跟踪人','text'),F('dueDate','跟踪日期','date'),
  F('status','状态','select',['待策划','进行中','已延期','待有效性确认','已关闭']),F('remark','备注','textarea')],
 stats:[['总数','count'],['进行中','where',{status:'进行中'}],['已延期','where',{status:'已延期'}],['待有效性确认','where',{status:'待有效性确认'}],['逾期','overdue']],
 cols:['code','source','type','responsible','status','dueDate']};

/* ---------- ① 质量体系与风险 ---------- */
M.qrm={name:'质量风险管理',ic:'🎯',done:['已完成','已关闭'],
 fields:[S(1,'评估策划','ICH Q9(R1)：危害识别→风险分析→风险评价'),
  F('code','评估编号','text'),F('subject','评估对象/流程','text'),F('project','项目/产品','text'),
  F('trigger','启动时机','select',['新项目/新产品','变更前评估','偏差/OOS','审计发现','定期回顾','工艺/方法开发','供应商','监管要求','技术转移','其他']),
  F('method','评估方法','select',['FMEA/FMECA','HACCP','故障树FTA','初步危害分析PHA','风险排序与过滤','鱼骨图','5Why','流程图','德尔菲法','专家经验']),
  F('team','评估小组/参与部门','text'),
  S(2,'评估实施','注意 Q9(R1)：控制主观性、基于科学知识'),
  F('scope','评估范围','textarea'),F('hazard','危害/失效模式识别','textarea'),
  F('rpn','RPN/风险评分','number'),F('risk','风险等级','select',RISK3),
  F('accept','风险可接受性','select',['可接受','需降低措施','不可接受','待评审']),
  S(3,'控制与回顾'),
  F('control','风险控制措施','textarea'),F('residual','剩余风险等级','select',RISK3),
  F('result','评估结论','textarea'),
  F('reviewCycle','回顾周期','select',['6个月','12个月','24个月','事件触发','不适用']),F('reviewDate','下次回顾日期','date'),
  F('owner','负责人','text'),F('dueDate','计划完成日期','date'),
  F('status','状态','select',['计划中','进行中','待批准','已完成','已关闭']),F('remark','备注','textarea')],
 stats:[['总数','count'],['进行中','where',{status:'进行中'}],['高风险','where',{risk:'高'}],['不可接受','where',{accept:'不可接受'}],['逾期','overdue']],
 cols:['code','subject','method','risk','accept','status','dueDate']};

M.mgmt_review={name:'管理评审',ic:'📊',done:['已完成','已关闭'],
 fields:[S(1,'评审策划','ICH Q10：由高层主持，定期评审体系适宜性/充分性/有效性'),
  F('code','评审编号','text'),F('period','评审周期','select',['年度','半年度','季度','专项/临时']),
  F('date','评审日期','date'),F('host','主持人','text'),F('attendees','参会人员/部门','text'),
  S(2,'评审输入'),
  F('inputs','评审输入','multiselect',['上次决议落实情况','质量目标达成情况','变更情况','偏差/CAPA趋势','OOS/OOT趋势','审计与自检结果','监管检查情况','投诉与召回','供应商表现','产品质量回顾/稳定性','风险管理状态','培训与人员','资源需求','法规/指南更新','知识管理']),
  F('data','关键数据与趋势分析','textarea'),
  S(3,'评审输出'),
  F('outputs','评审结论与建议','textarea'),F('decision','决议事项与资源需求','textarea'),
  F('action','行动项/跟踪编号','text'),F('nextDate','下次评审日期','date'),
  F('owner','组织人','text'),F('dueDate','计划完成日期','date'),
  F('status','状态','select',['计划中','资料准备中','已召开','已完成','已关闭']),F('remark','备注','textarea')],
 stats:[['总数','count'],['计划中','where',{status:'计划中'}],['已完成','where',{status:'已完成'}],['未闭环','open'],['逾期','overdue']],
 cols:['code','period','date','host','status','dueDate']};

/* ---------- ② 机构与人员 ---------- */
M.training={name:'培训管理',ic:'🎓',done:['已评估','已取消'],
 fields:[S(1,'培训策划'),
  F('code','培训编号','text'),F('subject','培训主题','text'),
  F('type','培训类型','select',['上岗前/资质培训','SOP/文件培训','GMP/法规培训','专业技能','安全/EHS','计算机化系统','数据可靠性','继续教育','外部培训','转岗培训']),
  F('content','培训内容/要点','textarea'),F('target','培训对象/岗位','text'),
  F('trainer','讲师/来源','select',['内训师','部门主管','QA','外部专家','外部机构','自学/线上']),
  F('owner','组织人','text'),F('planDate','计划日期','date'),
  S(2,'实施与评估','培训效果必须评估，不能只签到'),
  F('trainDate','培训日期','date'),F('duration','学时','text'),F('attendees','应到/实到','text'),
  F('check','考核方式','select',['笔试','实操/演示','口头提问','签到+观察','在线考试','免考/自学']),
  F('passRate','合格率/考核结果','text'),F('qualified','是否取得资质/授权','select',['是','否','待评估','不适用']),
  S(3,'档案与闭环'),
  F('cert','培训档案/证书编号','text'),F('reTrain','需再培训','select',['是','否']),
  F('dueDate','计划完成日期','date'),F('status','状态','select',['计划中','已完成','已评估','已取消']),F('remark','备注','textarea')],
 stats:[['总数','count'],['计划中','where',{status:'计划中'}],['待评估','where',{status:'已完成'}],['需再培训','where',{reTrain:'是'}],['逾期','overdue']],
 cols:['code','subject','type','target','trainDate','status','dueDate']};

M.knowledge={name:'知识管理',ic:'📚',done:['已归档','已应用','已失效'],
 fields:[S(1,'知识点','ICH Q10 知识管理：从研发到商业化全生命周期沉淀'),
  F('code','编号','text'),F('title','知识点/主题','text'),
  F('category','知识类别','select',['QTPP','CQA','CPP','设计空间/控制策略','工艺知识','产品知识','分析方法知识','物料/供应商知识','设备/系统知识','法规更新','经验教训','典型案例']),
  F('project','所属项目/产品','text'),F('phase','研发阶段','select',['早期开发','临床前','I期','II期','III期','申报','上市后']),
  F('source','来源','select',['偏差/OOS','变更','审计/自检','研发试验','文献/指南','法规更新','培训','外部交流','管理评审']),
  F('content','内容/要点','textarea'),F('attach','附件/出处','files'),
  S(2,'价值与应用'),
  F('value','价值等级','select',RISK3),F('usage','应用建议/落地方式','textarea'),
  F('owner','维护人','text'),F('dueDate','回顾/更新日期','date'),
  F('status','状态','select',['采集中','已归档','已应用','已失效']),F('remark','备注','textarea')],
 stats:[['总数','count'],['采集中','where',{status:'采集中'}],['已归档','where',{status:'已归档'}],['高价值','where',{value:'高'}],['逾期','overdue']],
 cols:['code','title','category','project','value','status','dueDate']};

/* ---------- ③ 设备与数据 ---------- */
M.equip={name:'设备设施与CSV',ic:'⚙️',done:['已停用','已报废'],
 fields:[S(1,'设备/系统档案'),
  F('code','设备编号','text'),F('name','设备/系统名称','text'),
  F('category','类别','select',['生产设备','检验仪器','公用系统/HVAC','洁净厂房设施','计算机化系统','仓储/温控','称量/计量','工艺气体/水系统','其他']),
  F('model','型号/规格','text'),F('serial','出厂编号/资产号','text'),F('location','安装位置/房间','text'),
  F('gamp','GAMP5分类','select',['1类-基础设施','3类-不可配置','4类-可配置','5类-定制开发','不适用']),
  S(2,'确认与校准','URS→DQ→FAT/SAT→IQ→OQ→PQ'),
  F('confirm','已完成的确认活动','multiselect',['URS','DQ','FAT','SAT','IQ','OQ','PQ','校准/计量检定','清洁验证','方法确认']),
  F('confirmRef','确认方案/报告编号','text'),
  F('cycle','校准/确认周期','select',['3个月','6个月','12个月','24个月','按使用频次','首次/一次性','不适用']),
  F('lastCal','上次校准/确认','date'),F('nextCal','下次校准/确认','date'),
  S(3,'CSV 与数据可靠性','计算机化系统：权限、审计追踪、备份恢复'),
  F('csv','CSV验证状态','select',['不适用','未验证','方案编制中','进行中','已验证','需再验证']),
  F('access','权限与账号管理','select',['已建立','部分建立','未建立','不适用']),
  F('auditTrail','审计追踪','select',['已启用','未启用','待评估','不适用']),
  F('backup','备份与恢复验证','select',['已验证','未验证','不适用']),
  S(4,'状态'),
  F('owner','责任人','text'),F('dueDate','到期日期','date'),
  F('status','状态','select',['正常/可用','待校准','待确认','维修中','已停用','偏差/停用待查','已报废']),F('remark','备注','textarea')],
 stats:[['总数','count'],['待校准','where',{status:'待校准'}],['待确认','where',{status:'待确认'}],['CSV未完成','where',{csv:['未验证','方案编制中','进行中']}],['逾期','overdue']],
 cols:['code','name','category','nextCal','csv','status','dueDate']};

M.di={name:'数据可靠性',ic:'🔐',done:['已关闭'],
 fields:[S(1,'评估对象','MHRA GxP DI 2018 / FDA DI 2018 / PIC-S PI 041'),
  F('code','编号','text'),F('system','系统/流程名称','text'),
  F('area','业务区域','select',['QC实验室','研发/中试车间','生产','仓储/物流','计算机化系统','临床试验','药物警戒','注册申报','其他']),
  F('scope','评估范围','textarea'),
  S(2,'ALCOA++ 评估'),
  F('principle','涉及要素','multiselect',['可归属(Attributable)','清晰可读(Legible)','同步记录(Contemporaneous)','原始(Original)','准确(Accurate)','完整(Complete)','一致(Consistent)','持久(Enduring)','可获取(Available)','可追溯(Traceable)']),
  F('finding','发现项/不符合描述','textarea'),F('grade','发现项分级','select',GRADE),F('risk','风险等级','select',RISK3),
  F('rootCause','根本原因类别','select',['流程缺失','SOP不完善','培训不足','系统设计缺陷','权限管理不当','人员违规/造假','资源不足','管理缺失','其他']),
  S(3,'整改闭环'),
  F('measure','纠正/预防措施','textarea'),F('capaRef','关联CAPA编号','text'),F('evidence','证据材料','files'),
  F('owner','责任人','text'),F('dueDate','整改期限','date'),
  F('status','状态','select',['评估中','整改中','待有效性确认','已关闭']),F('remark','备注','textarea')],
 stats:[['总数','count'],['整改中','where',{status:'整改中'}],['关键发现项','where',{grade:'关键'}],['未闭环','open'],['逾期','overdue']],
 cols:['code','area','system','grade','risk','status','dueDate']};

/* ---------- ④ 物料·供应商·委托 ---------- */
M.supplier={name:'供应商管理',ic:'🏭',done:['淘汰'],
 fields:[S(1,'基本信息'),
  F('code','供应商编码','text'),F('name','供应商名称','text'),F('material','供应物料/服务','text'),
  F('type','供应商类型','select',['原料药API','辅料','内包材','印刷包装材料','试剂/对照品','关键耗材','设备/仪器','CRO','CMO/CDMO','检验/检测机构','物流/仓储','其他']),
  F('level','供应商分级','select',['A类-关键/战略','B类-重要','C类-一般']),F('risk','风险等级','select',RISK3),
  S(2,'资质确认与审计','先评估/审计，后批准，再采购'),
  F('license','证照/资质情况','text'),
  F('qualify','质量评估方式','select',['问卷评估','书面/资料评估','现场审计','第三方审计','委托审计','豁免(需论证)']),
  F('auditRef','最近审计编号/日期','text'),
  F('result','评估结论','select',['合格','有条件合格','不合格','待评估']),
  F('approveDate','批准日期','date'),F('agreement','质量协议编号','text'),
  S(3,'持续管理'),
  F('reevalCycle','再评估周期','select',['6个月','12个月','24个月','36个月','事件触发']),
  F('reevalDate','下次再评估日期','date'),F('perf','供货质量表现/年度评价','textarea'),
  F('owner','管理人','text'),F('dueDate','跟踪日期','date'),
  F('status','状态','select',['候选','已批准','有条件批准','暂停','淘汰']),F('remark','备注','textarea')],
 stats:[['总数','count'],['已批准','where',{status:['已批准','有条件批准']}],['待再评估','open'],['高风险','where',{risk:'高'}],['逾期','overdue']],
 cols:['code','name','type','level','result','status','dueDate']};

M.audit={name:'审计管理',ic:'🧾',done:['已关闭'],
 fields:[S(1,'审计策划'),
  F('code','审计编号','text'),F('name','审计名称/主题','text'),
  F('auditType','审计类型','select',['内部审计(自检)','供应商审计','受托方/委托方审计','第三方审计','监管部门检查','飞行检查','客户/MAH审计','模拟检查/差距分析','GLP/GCP核查']),
  F('target','被审计方/区域','text'),F('scope','审计范围','textarea'),
  F('checklist','检查依据/清单','multiselect',['GMP(2010)及附录','GMP指南(2023)','ICH Q7/Q9/Q10','GLP规范','GCP规范','药典','数据可靠性指南','企业SOP','合同/质量协议','上年度整改项']),
  F('planDate','计划日期','date'),F('team','审计组/检查组成员','text'),
  S(2,'实施与发现','发现项分级：关键/主要/次要/观察项'),
  F('execDate','实施日期','date'),
  F('findings','发现项总数','number'),F('critical','关键项','number'),F('major','主要项','number'),F('minor','次要项','number'),
  F('reportRef','审计报告编号','text'),
  S(3,'整改闭环'),
  F('capaRef','整改/CAPA编号','text'),F('track','整改追踪与有效性','textarea'),F('closeDate','关闭日期','date'),
  F('owner','审计组长','text'),F('dueDate','报告/关闭期限','date'),
  F('status','状态','select',['计划中','进行中','报告编制中','已完成','已关闭']),F('remark','备注','textarea')],
 stats:[['总数','count'],['计划中','where',{status:'计划中'}],['进行中','where',{status:['进行中','报告编制中']}],['未闭环','open'],['逾期','overdue']],
 cols:['code','name','auditType','target','findings','status','dueDate']};

M.outsourcing={name:'委托生产/检验',ic:'🤝',done:['已结束'],
 fields:[S(1,'委托概况','GMP第十一章：委托方对受托方产品质量负责'),
  F('code','委托编号','text'),F('partner','受托方名称','text'),
  F('service','委托类型','select',['委托生产','委托检验','委托研发','委托储存/运输','CMO/CDMO','CRO','校准/验证服务','其他']),
  F('project','涉及产品/项目','text'),F('phase','研发阶段','select',PHASE_RD),
  S(2,'合规前提','资质确认 + 质量协议 + 审计，三者缺一不可'),
  F('agreement','质量协议编号/签署日期','text'),F('auditRef','受托方审计编号','text'),
  F('qualified','受托方资质确认','select',['已确认','待确认','不适用']),
  F('responsibility','双方职责划分','textarea'),
  S(3,'过程监督与回顾'),
  F('oversight','监督方式','multiselect',['驻厂/现场监督','定期审计','批记录审核','年度质量回顾','放行审核','远程/文件审核','关键节点见证']),
  F('reviewCycle','回顾周期','select',['6个月','12个月','每批','项目结束','不适用']),
  F('changeNotify','变更通知义务已约定','select',['已约定','未约定','不适用']),
  F('owner','负责人','text'),F('dueDate','下次回顾/结束日期','date'),
  F('status','状态','select',['待审计','进行中','已暂停','已结束']),F('remark','备注','textarea')],
 stats:[['总数','count'],['进行中','where',{status:'进行中'}],['待审计','where',{status:'待审计'}],['未闭环','open'],['逾期','overdue']],
 cols:['code','partner','service','project','qualified','status','dueDate']};

/* ---------- ⑤ 确认与验证 ---------- */
M.pv={name:'工艺验证',ic:'🏗',done:['已批准'],
 fields:[S(1,'验证策划','FDA 2011 三阶段 / GMP附录：前验证、同步验证、回顾性验证'),
  F('code','验证编号','text'),F('product','产品/工艺名称','text'),F('project','所属项目','text'),
  F('stage','验证阶段','select',['Stage1 工艺设计','Stage2 工艺确认(PPQ)','Stage3 持续工艺确认','前验证','同步验证','回顾性验证','再验证']),
  F('vtype','验证对象','select',['工艺','清洁','灭菌/无菌工艺模拟(APS)','包装','运输','混合均匀度','其他']),
  F('protocol','验证方案编号','text'),
  S(2,'关键属性与接受标准'),
  F('cqa','CQA/CPP清单','textarea'),F('batch','验证批号/批数','text'),F('acceptance','可接受标准','textarea'),
  S(3,'结果与结论'),
  F('result','验证结果/偏差情况','textarea'),F('reportRef','验证报告编号','text'),
  F('conclusion','验证结论','select',['符合预期','有条件通过','不符合','待补充数据']),
  F('revalidate','再验证/持续确认要求','text'),
  F('owner','负责人','text'),F('dueDate','计划完成日期','date'),
  F('status','状态','select',['计划中','方案编制中','进行中','已完成','已批准']),F('remark','备注','textarea')],
 stats:[['总数','count'],['进行中','where',{status:['方案编制中','进行中']}],['已完成','where',{status:'已完成'}],['有条件通过','where',{conclusion:'有条件通过'}],['逾期','overdue']],
 cols:['code','product','stage','vtype','conclusion','status','dueDate']};

M.tech_transfer={name:'技术转移',ic:'🔁',done:['已完成'],
 fields:[S(1,'转移概况','WHO TRS 961 Annex7：转移方案→接收准则→转移报告'),
  F('code','转移编号','text'),F('project','转移项目/产品','text'),
  F('from','转出方','text'),F('to','接收方','text'),
  F('direction','转移方向','select',['研发→中试','研发→生产','中试→商业化','场地间转移','方法转移(实验室间)','委托→自产','外购→自产']),
  F('content','转移内容','multiselect',['处方与工艺','分析方法','清洁方法','原辅料/供应商','设备与设施','包装','质量标准','文件/SOP','培训','EHS','计算机化系统']),
  S(2,'策划与差距分析'),
  F('risk','风险评估/差距分析','textarea'),F('gap','差距项与关闭情况','textarea'),
  F('protocol','转移方案编号','text'),F('criteria','接收准则/可接受标准','textarea'),
  S(3,'执行与结论'),
  F('report','转移报告编号','text'),F('training','培训完成情况','select',['已完成','进行中','未开始','不适用']),
  F('conclusion','转移结论','select',['成功','有条件成功','失败','进行中']),
  F('owner','负责人','text'),F('dueDate','计划完成日期','date'),
  F('status','状态','select',['计划中','进行中','已完成','已暂停']),F('remark','备注','textarea')],
 stats:[['总数','count'],['进行中','where',{status:'进行中'}],['已完成','where',{status:'已完成'}],['未闭环','open'],['逾期','overdue']],
 cols:['code','project','from','to','direction','status','dueDate']};

/* ---------- ⑦ 生产·放行·实验室 ---------- */
M.release={name:'放行管理',ic:'✅',done:['已放行','不放行'],
 fields:[S(1,'批次信息'),
  F('code','放行编号','text'),F('batch','批号','text'),F('product','产品/中间体名称','text'),F('spec','规格/剂量','text'),
  F('type','样品/批次类型','select',['原辅料','中间体','成品','临床样品','毒理批','申报/注册批','稳定性批','对照品/参考批','包装材料']),
  F('batchSize','批量','text'),
  S(2,'放行审核项','批记录 + 检验结果 + 偏差/OOS + 变更 + 验证状态，逐项确认'),
  F('recordCheck','批记录/检验记录审核','select',['已审核','审核中','未审核','不适用']),
  F('devStatus','偏差/OOS 状态','select',['无','已关闭','未关闭','不适用']),
  F('changeStatus','变更状态','select',['无','已完成','未完成','不适用']),
  F('validStatus','验证/确认状态','select',['符合','部分符合','不符合','不适用']),
  F('storage','贮存/运输条件符合性','select',['符合','不符合','不适用']),
  F('qaReview','QA审核要点与意见','textarea'),
  S(3,'放行决定','质量受权人/指定放行责任人签署'),
  F('decision','放行结论','select',['同意放行','有条件放行','暂缓放行','不放行']),
  F('releasePerson','放行责任人','text'),F('releaseDate','放行日期','date'),
  F('owner','跟踪人','text'),F('dueDate','计划放行日期','date'),
  F('status','状态','select',['待审核','审核中','已放行','暂缓','不放行']),F('remark','备注','textarea')],
 stats:[['总数','count'],['待审核','where',{status:'待审核'}],['已放行','where',{status:'已放行'}],['不放行','where',{status:'不放行'}],['逾期','overdue']],
 cols:['code','batch','product','type','decision','status','dueDate']};

M.oos={name:'实验室异常结果调查',ic:'🧪',done:['已关闭'],
 fields:[S(1,'异常识别','OOS/OOT/AD 均需按 SOP 及时报告并启动调查'),
  F('code','调查编号','text'),F('product','产品/物料名称','text'),F('sample','样品/批号','text'),F('item','检验项目','text'),
  F('rtype','结果类型','select',['OOS(超标)','OOT(超趋势)','AD(异常数据)','无效结果','趋势异常']),
  F('initial','初始结果/标准规定','text'),F('foundDate','发现日期','date'),F('analyst','检验人','text'),
  S(2,'阶段I 实验室调查','查人机料法环；复测须有预定义方案，禁止「测到合格为止」'),
  F('phase1','阶段I调查内容','textarea'),
  F('labCause','实验室原因判定','select',['无明显实验室错误','已确认实验室错误','疑似实验室错误']),
  F('retest','复测/重新取样情况及结果','textarea'),
  F('retestRule','复测合规性(是否按SOP/预定义)','select',['符合','有偏差','不适用']),
  S(3,'阶段II 全面调查','延伸至生产/工艺/物料/方法'),
  F('phase2','阶段II调查内容','textarea'),F('hypothesis','假设检验/补充试验','textarea'),F('rootCause','根本原因/最可能原因','textarea'),
  S(4,'结论与处置','原则上 30 日内完成调查'),
  F('conclusion','调查结论','select',['确证OOS(实验室错误)','确证OOS(生产/工艺原因)','无效OOS(检验无效)','原因未确定','确证OOT','AD确认','不适用(研发探索性)']),
  F('batchDecision','批次处置','select',['放行','不放行/拒收','返工/再加工','销毁','待定','不适用(研发样品)']),
  F('capaRef','关联CAPA编号','text'),
  F('owner','调查负责人/QA','text'),F('dueDate','完成期限','date'),
  F('status','状态','select',['阶段I调查中','阶段II调查中','待关闭','已关闭']),F('remark','备注','textarea')],
 stats:[['总数','count'],['调查中','open'],['确证OOS','where',{conclusion:['确证OOS(实验室错误)','确证OOS(生产/工艺原因)']}],['不放行','where',{batchDecision:['不放行/拒收','销毁']}],['逾期','overdue']],
 cols:['code','sample','item','rtype','conclusion','status','dueDate']};

M.method={name:'分析方法管理',ic:'📈',done:['已批准','已作废'],
 fields:[S(1,'方法信息'),
  F('code','方法编号','text'),F('name','方法名称','text'),F('project','品种/项目','text'),
  F('type','方法类型','select',['含量/效价','有关物质/杂质','溶出度/释放度','鉴别','含量均匀度','微生物限度','无菌/内毒素','生物活性/效价','残留溶剂','元素杂质','基因毒性杂质','水分','粒度/晶型','其他']),
  F('technique','检测技术','select',['HPLC/UPLC','GC','LC-MS/MS','UV-Vis','IR/NIR','滴定','溶出仪','PCR/qPCR','ELISA','细胞活性','微生物法','其他']),
  S(2,'生命周期阶段','ICH Q2(R2)/Q14：ATP → 开发 → 验证 → 转移 → 持续确认'),
  F('stage','生命周期阶段','select',['开发','预验证','验证','确认','转移','再验证','持续确认']),
  F('atp','ATP/分析目标概况','textarea'),
  F('params','验证参数','multiselect',['专属性/选择性','准确度/回收率','精密度-重复性','精密度-中间精密度','精密度-重现性','线性','范围','检测限LOD','定量限LOQ','耐用性','溶液稳定性','系统适用性']),
  F('equip','仪器设备/色谱柱','text'),F('refStd','对照品/标准品','text'),
  S(3,'验证与文件'),
  F('protocol','验证方案编号','text'),F('reportRef','验证报告编号','text'),
  F('validation','验证状态','select',['未验证','方案编制中','进行中','已验证','验证失败','不适用']),
  F('owner','负责人','text'),F('dueDate','计划日期','date'),
  F('status','状态','select',['开发中','验证中','已批准','使用中','已转移','已作废']),F('remark','备注','textarea')],
 stats:[['总数','count'],['进行中','open'],['已验证','where',{validation:'已验证'}],['已批准','where',{status:'已批准'}],['逾期','overdue']],
 cols:['code','name','type','technique','stage','status','dueDate']};

M.stability={name:'稳定性研究管理',ic:'⏳',done:['已完成','已终止'],
 fields:[S(1,'研究设计','ICH Q1A(R2)/Q1B/Q5C'),
  F('code','研究编号','text'),F('product','产品/批号','text'),F('project','项目名称','text'),
  F('batchScale','批规模/批类型','select',['小试批','中试批','临床批','注册批/承诺批','生产批','年度批']),
  F('condition','考察条件','select',['长期(25℃/60%RH)','长期(30℃/65%RH)','长期(2~8℃)','中间(30℃/65%RH)','加速(40℃/75%RH)','加速(25℃/60%RH,半透容器)','强降解/影响因素','光照(Q1B)','使用中/开启后','运输/短期偏离','冻融循环']),
  F('packaging','包装形式/容器密封系统','text'),
  F('timePoint','时间点计划','text','','如 0/3/6/9/12/18/24/36 月'),
  F('spec','考察项目与质量标准','textarea'),
  S(2,'执行与结果'),
  F('donePoint','已完成时间点','text'),F('nextPoint','下一时间点','date'),
  F('trend','趋势/显著变化评估','textarea'),F('oosRef','关联OOS/OOT编号','text'),
  S(3,'结论'),
  F('conclusion','稳定性结论/外推说明','textarea'),F('shelfLife','拟定有效期/复检期','text'),
  F('exception','异常/偏离情况','select',['无','有(已记录并闭环)','有(未闭环)']),
  F('owner','负责人','text'),F('dueDate','下次取样日期','date'),
  F('status','状态','select',['计划中','进行中','已完成','已暂停','已终止']),F('remark','备注','textarea')],
 stats:[['总数','count'],['进行中','where',{status:'进行中'}],['已完成','where',{status:'已完成'}],['异常未闭环','where',{exception:'有(未闭环)'}],['逾期','overdue']],
 cols:['code','product','condition','donePoint','status','dueDate']};

/* ---------- ⑨ 投诉·自检 ---------- */
M.complaint={name:'投诉与召回',ic:'📞',done:['已关闭'],
 fields:[S(1,'投诉受理','所有投诉须登记并调查，涉及 ADR 的须同步转药物警戒'),
  F('code','编号','text'),F('receiveDate','受理日期','date'),
  F('source','投诉来源','select',['客户/经销商','医疗机构','研究者/受试者','患者/消费者','监管转办','内部发现','MAH/合作方','其他']),
  F('reporter','投诉人/单位','text'),F('product','产品/批号','text'),F('project','品种','text'),
  F('type','投诉类型','select',['质量缺陷','包装/标签','疗效质疑','疑似污染/混淆','数量/破损','疑似假劣','服务/物流','其他']),
  F('content','投诉内容','textarea'),
  S(2,'调查与分级'),
  F('severity','严重程度','select',['严重','一般','轻微']),F('risk','风险等级','select',RISK3),
  F('investigate','调查情况与结论','textarea'),
  F('relateDev','是否关联偏差/CAPA','select',['是','否','待定']),
  F('adr','是否涉及不良反应(转PV)','select',['是','否','待评价']),
  S(3,'处置与召回','《药品召回管理办法》：一级/二级/三级'),
  F('action','处理措施','select',['答复/解释','退换货','补发','返工','召回','销毁','转药物警戒','无需处理']),
  F('recallLevel','召回级别','select',['无','一级召回','二级召回','三级召回']),F('recallScope','召回范围/数量','text'),
  F('report2Auth','监管报告/备案','select',['不适用','已报告','待报告']),
  F('closeDate','关闭日期','date'),
  F('owner','处理人','text'),F('dueDate','处理期限','date'),
  F('status','状态','select',['受理中','调查中','待答复','已关闭']),F('remark','备注','textarea')],
 stats:[['总数','count'],['未闭环','open'],['需召回','where',{recallLevel:['一级召回','二级召回','三级召回']}],['涉及ADR','where',{adr:'是'}],['逾期','overdue']],
 cols:['code','product','type','severity','recallLevel','status','dueDate']};

M.self_inspect={name:'自检',ic:'🔎',done:['已完成','已关闭'],
 fields:[S(1,'自检策划','GMP第十三章：有计划、按规程、有记录、有报告'),
  F('code','自检编号','text'),F('plan','年度自检计划/编号','text'),F('scope','自检范围/区域','textarea'),
  F('auditType','自检形式','select',['全面自检','专项自检','部门自检','交叉检查','模拟检查','突击/夜查']),
  F('checklist','检查依据/清单','multiselect',['GMP(2010)及附录','GMP指南(2023)','ICH Q7/Q9/Q10','GLP/GCP','药典','企业SOP','上年度整改项','监管检查缺陷项']),
  F('team','检查组成员','text'),F('planDate','计划日期','date'),
  S(2,'实施与发现'),
  F('date','实施日期','date'),
  F('findings','发现项总数','number'),F('critical','关键项','number'),F('major','主要项','number'),F('minor','次要项','number'),
  F('reportRef','自检报告编号','text'),
  S(3,'整改闭环'),
  F('capaRef','整改/CAPA编号','text'),F('track','整改追踪与有效性','textarea'),F('closeDate','关闭日期','date'),
  F('owner','负责人','text'),F('dueDate','完成期限','date'),
  F('status','状态','select',['计划中','进行中','报告编制中','已完成','已关闭']),F('remark','备注','textarea')],
 stats:[['总数','count'],['计划中','where',{status:'计划中'}],['进行中','where',{status:['进行中','报告编制中']}],['未闭环','open'],['逾期','overdue']],
 cols:['code','plan','auditType','date','findings','status','dueDate']};

/* 需要占满整行的短文本字段（长文本已用 textarea 自动占满两列） */
const WIDE_KEYS=['name','title','subject','desc','action','targetDoc','plan','related','material','partner',
 'product','team','host','attendees','criteria','responsibility','usage','recallScope','shelfLife','revalidate',
 'gmpRef','batch','cqa','packaging','spec','timePoint','donePoint','license','relatedSys','model','serial','location','cert'];

const ORDER=[];GROUPS.forEach(g=>g.mods.forEach(m=>ORDER.push(m)));

/* ============ 状态判断 ============ */
function isOpen(mod,rec){const d=M[mod].done;return !d.includes(rec.status);}
function isOverdue(mod,rec){return isOpen(mod,rec)&&rec.dueDate&&rec.dueDate<today();}
function isDueToday(mod,rec){return isOpen(mod,rec)&&rec.dueDate===today();}
function isUpcoming(mod,rec){if(!isOpen(mod,rec)||!rec.dueDate)return false;const t=today();return rec.dueDate>t&&rec.dueDate<=addDays(t,7);}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);}

/* ============ 导航 ============ */
function renderNav(){
  let h='<div class="nav-item" data-mod="__home"><span class="ic">🏠</span>工作台首页</div>';
  GROUPS.forEach(g=>{
    h+=`<div class="nav-group">${g.g}</div>`;
    g.mods.forEach(m=>{
      const arr=getA(m);let open=0,ov=0;
      arr.forEach(r=>{if(isOpen(m,r))open++;if(isOverdue(m,r))ov++;});
      h+=`<div class="nav-item" data-mod="${m}"><span class="ic">${M[m].ic}</span>${M[m].name}`+
         `<span class="cnt ${ov?'alert':''}">${open}${ov?'·'+ov:''}</span></div>`;
    });
  });
  $('#nav').innerHTML=h;
  document.querySelectorAll('.nav-item').forEach(el=>el.onclick=()=>openMod(el.dataset.mod));
}

/* ============ 首页 ============ */
function renderHome(){
  $('#pageTitle').textContent='工作台首页';
  $('#pageSub').textContent='研发全生命周期质量管理系统 · 对标《药品GMP指南（2023版）》第七章';
  let total=0,open=0,ov=0,due=0,up=0;
  const modStats={};
  ORDER.forEach(m=>{const a=getA(m);let o=0,vo=0,du=0,upc=0;
    a.forEach(r=>{if(isOpen(m,r))o++;if(isOverdue(m,r))vo++;if(isDueToday(m,r))du++;if(isUpcoming(m,r))upc++;});
    total+=a.length;open+=o;ov+=vo;due+=du;up+=upc;modStats[m]={t:a.length,o,vo,du,upc};});

  let h='';
  if(total===0){
    h+=`<div class="section"><div class="empty-guide">
      <div class="eg-ic">🧭</div>
      <div class="eg-t">工作台暂无数据</div>
      <div class="eg-d">这是<strong>纯本地</strong>质量管理台：22 个模块的记录只保存在当前浏览器本机，不会上传服务器。可先载入一套演示示例快速了解用法，或导入此前导出的备份继续工作。</div>
      <div class="eg-btns">
        <button class="btn btn-primary" data-act="loadSamples">✨ 载入示例数据</button>
        <button class="btn" data-act="importAll">⬆ 导入备份</button>
      </div>
      <div class="eg-tip">提示：更换浏览器 / 清理缓存 / 换设备后本地数据会丢失，建议定期用右上角「⬇ 导出备份」保存。</div>
    </div></div>`;
  }
  h+=`<div class="grid cards">
    <div class="stat"><div class="k">记录总数</div><div class="v">${total}</div></div>
    <div class="stat"><div class="k">进行中/未关闭</div><div class="v">${open}</div></div>
    <div class="stat"><div class="k">今日到期</div><div class="v warn">${due}</div></div>
    <div class="stat"><div class="k">逾期未处理</div><div class="v ${ov?'danger':''}">${ov}</div></div>
    <div class="stat"><div class="k">7日内到期</div><div class="v warn">${up}</div></div>
  </div>`;

  h+=`<div class="section"><h3>📌 今天要处理 <span class="badge">逾期 + 今日到期 + 7日内</span></h3><div id="todayList"></div></div>`;

  h+=`<div class="section"><h3>🧩 全部模块 <span class="badge">22个 · 点击进入</span></h3><div class="grid cards" style="margin-top:6px">`;
  ORDER.forEach(m=>{const s=modStats[m];
    h+=`<div class="mod-card" data-act="openMod" data-arg="${m}">
      <span class="mopen ${s.vo?'alert':''}">${s.o} 进行中${s.vo?' / '+s.vo+'逾期':''}</span>
      <div class="mic">${M[m].ic}</div><div class="mname">${M[m].name}</div>
      <div class="mstat">共 ${s.t} 条 · 今日 ${s.du} · 7日内 ${s.upc}</div></div>`;});
  h+=`</div></div>`;
  $('#content').innerHTML=h;
  renderToday();
}

function renderToday(){
  const items=[];
  ORDER.forEach(m=>{getA(m).forEach(r=>{
    if(!isOpen(m,r)||!r.dueDate)return;
    const ov=isOverdue(m,r),du=isDueToday(m,r);
    if(ov||du||isUpcoming(m,r))items.push({mod:m,ov,du,rec:r});
  });});
  items.sort((a,b)=>{
    if(a.ov!==b.ov)return a.ov?-1:1;
    return a.rec.dueDate.localeCompare(b.rec.dueDate);
  });
  const box=$('#todayList');
  if(!items.length){box.innerHTML='<div class="empty">暂无需要处理的事项 🎉</div>';return;}
  box.innerHTML=items.map(it=>{
    const t=it.ov?'逾期':(it.du?'今日到期':'即将到期');
    return `<div class="today-item ${it.ov?'alert':''}">
      <div class="dot"></div>
      <div class="tc">
        <div class="tt">${M[it.mod].ic} ${esc(it.rec.code||'')} ${esc(it.rec.name||it.rec.title||it.rec.subject||'')}</div>
        <div class="tm">${M[it.mod].name} · ${t} · 截止 ${it.rec.dueDate} · 责任人 ${esc(it.rec.owner||'-')}</div>
      </div>
      <button class="btn btn-sm btn-primary" data-act="openMod" data-arg="${it.mod}">查看</button>
    </div>`;}).join('');
}

/* ============ 模块视图 ============ */
let curMod=null,curFilter='';
function openMod(mod){
  document.querySelectorAll('.nav-item').forEach(e=>e.classList.toggle('active',e.dataset.mod===mod));
  if(mod==='__home'){renderHome();return;}
  curMod=mod;curFilter='';
  const m=M[mod];
  $('#pageTitle').textContent=m.ic+' '+m.name;
  $('#pageSub').textContent='研发质量管理体系模块';
  renderModule();
}

function renderModule(){
  const m=M[curMod];const arr=getA(curMod);
  // stats
  function cnt(kind,where){
    if(kind==='count')return arr.length;
    if(kind==='open')return arr.filter(r=>isOpen(curMod,r)).length;
    if(kind==='overdue')return arr.filter(r=>isOverdue(curMod,r)).length;
    if(kind==='where'){return arr.filter(r=>{
      return Object.entries(where).every(([k,v])=>Array.isArray(v)?v.includes(r[k]):r[k]===v);}).length;}
    return 0;
  }
  let statHtml='<div class="grid cards" style="margin-bottom:4px">';
  m.stats.forEach(s=>{const v=cnt(s[1],s[2]);const cls=(s[1]==='overdue'&&v)?'danger':(s[1]==='overdue'||s[0].includes('逾期')?'':'');
    statHtml+=`<div class="stat"><div class="k">${s[0]}</div><div class="v ${cls}">${v}</div></div>`;});
  statHtml+='</div>';

  // toolbar
  let tb=`<div class="toolbar">
    <button class="btn btn-primary" data-act="openForm">＋ 新增</button>
    <input id="flt" placeholder="搜索编号/名称…" value="${esc(curFilter)}" style="min-width:200px">
    <select id="fltStatus">
      <option value="">全部状态</option>${m.fields.find(f=>f.key==='status')?.options.map(o=>`<option ${curFilter===o?'selected':''}>${o}</option>`).join('')||''}</select>
    <div class="spacer"></div>
    <span class="sub" style="color:var(--muted)">共 ${arr.length} 条</span>
  </div>`;

  $('#content').innerHTML=`<div class="section" style="margin-top:0">${statHtml}${tb}<div id="tblBox"></div></div>`;
  // 绑定搜索/筛选输入（替代内联 oninput/onchange，兼容严格 CSP）
  const flt=document.getElementById('flt'), st=document.getElementById('fltStatus');
  if(flt)flt.addEventListener('input',e=>{curFilter=e.target.value;renderTable();});
  if(st)st.addEventListener('change',e=>{curFilter=e.target.value;renderTable();});
  renderTable();
}

function renderTable(){
  const m=M[curMod];let arr=getA(curMod);
  if(curFilter){const q=curFilter.toLowerCase();
    arr=arr.filter(r=>JSON.stringify(Object.values(r)).toLowerCase().includes(q));}
  const cols=m.cols;
  const fmap={};m.fields.forEach(f=>fmap[f.key]=f);
  let h=`<table><thead><tr><th>操作</th>`;
  cols.forEach(c=>{const f=fmap[c];h+=`<th>${f?f.label:c}</th>`;});
  h+=`</tr></thead><tbody>`;
  if(!arr.length){h+=`<tr><td colspan="${cols.length+1}" class="empty">暂无记录，点击"新增"开始</td></tr>`;}
  arr.forEach(r=>{
    h+=`<tr><td><button class="btn btn-sm" data-act="openForm" data-arg="${r.id}">编辑</button> <button class="btn btn-sm" data-act="showDetail" data-arg="${r.id}">详情</button> <button class="btn btn-sm btn-danger" data-act="delRec" data-arg="${r.id}">删</button></td>`;
    cols.forEach(c=>{const f=fmap[c];let v=r[c];
      if(f&&f.type==='multiselect')v=Array.isArray(v)?v.map(x=>`<span class="tag">${esc(x)}</span>`).join(''):esc(v);
      else if(f&&f.type==='files')v=fmtFilesHtml(v);
      else if(f&&f.options){const cls=(c==='status'||c==='severity'||c==='risk'||c==='level'||c==='conclusion'||c==='consistency')?(v==='严重'||v==='高'||v==='重大'||v==='不通过'||v==='不一致'||v==='不放行'?'r':(v==='已关闭'||v==='已放行'||v==='合格'||v==='通过'||v==='一致'?'g':(v==='有条件通过'||v==='中等'||v==='中'||v==='次要'||v==='微小'?'o':''))):'';
        v=`<span class="tag ${cls}">${esc(v)}</span>`;}
      else v=esc(v);
      h+=`<td>${v||'<span style="color:var(--muted)">-</span>'}</td>`;});
    h+=`</tr>`;
  });
  h+=`</tbody></table>`;
  $('#tblBox').innerHTML=h;
}

/* ============ 表单 ============ */
function openForm(id){
  const m=M[curMod];const rec=id?getA(curMod).find(r=>r.id===id):null;
  $('#modalTitle').textContent=(rec?'编辑':'新增')+' · '+m.name;
  let h=`<div class="form-grid">`;
  m.fields.forEach(f=>{
    // 分节标题：仅作视觉分组，不参与数据读写
    if(f.type==='section'){
      h+=`<div class="field sec" data-sec="${esc(f.key)}"><span class="sec-n">${esc(f.no||'')}</span>`+
         `<span class="sec-t">${esc(f.label)}</span>${f.hint?`<span class="sec-h">${esc(f.hint)}</span>`:''}</div>`;
      return;
    }
    const val=rec?rec[f.key]:'';const full=(f.type==='textarea'||f.type==='files'||f.key==='remark'||WIDE_KEYS.includes(f.key));
    h+=`<div class="field ${full?'full':''}"><label>${esc(f.label)}${f.hint?`<span class="hint"> · ${esc(f.hint)}</span>`:''}</label>`;
    if(f.type==='textarea'){h+=`<textarea data-k="${f.key}">${esc(val)}</textarea>`;}
    else if(f.type==='files'){
      _fileBufKey=f.key;_fileBuf=parseFiles(val);
      h+=`<div class="file-pick-bar">
        <button type="button" class="btn btn-sm" data-act="pickLocalFiles">📁 本机文件</button>
        <button type="button" class="btn btn-sm" data-act="pickLocalFolder">📂 文件夹</button>
        <button type="button" class="btn btn-sm" data-act="toggleKbPanel">🔎 知识库检索</button>
        <input id="txtRef" class="file-txt" placeholder="或输入文本引用后回车">
      </div>
      <div id="kbPanel" class="kb-panel" style="display:none">
        <input id="kbQ" class="kb-input" placeholder="输入法规/指导原则/资料关键词检索知识库（需后端在线）…">
        <div id="kbRes" class="kb-res"></div>
      </div>
      <div id="fileList" class="file-list"></div>`;
    }
    else if(f.type==='select'){h+=`<select data-k="${f.key}"><option value="">—请选择—</option>${f.options.map(o=>`<option ${val===o?'selected':''}>${o}</option>`).join('')}</select>`;}
    else if(f.type==='multiselect'){const arr=Array.isArray(val)?val:[];
      h+=`<div class="checks">${f.options.map(o=>`<label><input type="checkbox" data-m="${f.key}" value="${esc(o)}" ${arr.includes(o)?'checked':''}>${esc(o)}</label>`).join('')}</div>`;}
    else if(f.type==='date'){h+=`<input type="date" data-k="${f.key}" value="${esc(val)}">`;}
    else if(f.type==='number'){h+=`<input type="number" min="0" step="1" data-k="${f.key}" value="${esc(val)}">`;}
    else{h+=`<input type="text" data-k="${f.key}" value="${esc(val)}">`;}
    h+=`</div>`;
  });
  h+=`</div>`;
  $('#modalBody').innerHTML=h;
  if(_fileBufKey)renderFileList();
  // 绑定文件引用输入（替代内联 onkeydown/oninput）
  const txtRef=document.getElementById('txtRef');
  if(txtRef)txtRef.addEventListener('keydown',e=>{if(e.key==='Enter'){addTextRef(e.target.value);e.target.value='';}});
  const kbQ=document.getElementById('kbQ');
  if(kbQ)kbQ.addEventListener('input',e=>kbSearchDo(e.target.value));
  $('#modalFoot').innerHTML=`<button class="btn" data-act="closeModal">取消</button><button class="btn btn-primary" data-act="saveForm" data-arg="${id||''}">保存</button>`;
  showMask();
}
function saveForm(id){
  const m=M[curMod];const rec={};let ok=true;
  m.fields.forEach(f=>{
    if(f.type==='section')return;                 // 分节标题不落库
    if(f.type==='multiselect'){rec[f.key]=[...document.querySelectorAll(`input[data-m="${f.key}"]:checked`)].map(x=>x.value);}
    else if(f.type==='files'){rec[f.key]=Array.isArray(_fileBuf)?_fileBuf:[];}
    else{const el=document.querySelector(`[data-k="${f.key}"]`);rec[f.key]=el?el.value.trim():'';}
  });
  if(!rec.code){toast('请填写编号');return;}
  rec.id=id||uid();
  const arr=getA(curMod);
  if(id){const i=arr.findIndex(r=>r.id===id);if(i>=0)arr[i]=rec;else arr.push(rec);}
  else arr.push(rec);
  setA(curMod,arr);
  apiPersist(curMod,rec);
  closeModal();renderNav();renderModule();toast('已保存');
}

/* ============ 详情 ============ */
function showDetail(id){
  const m=M[curMod];const rec=getA(curMod).find(r=>r.id===id);if(!rec)return;
  $('#modalTitle').textContent=m.name+' · 详情';
  let h='<div class="detail"><dl>';
  m.fields.forEach(f=>{
    if(f.type==='section'){h+=`<dt class="dsec">${esc(f.label)}</dt>`;return;}
    let v=rec[f.key];
    if(f.type==='multiselect')v=Array.isArray(v)?v.join('、'):(v||'');
    else if(f.type==='files')v=fmtFilesText(v);
    h+=`<dt>${esc(f.label)}</dt><dd>${esc(v)||'-'}</dd>`;});
  h+='</dl></div>';
  $('#modalBody').innerHTML=h;
  const aiBtn=(curMod==='doc_review'||curMod==='record_check')?`<button class="btn" data-act="openAiVerify" data-arg="${id}">🤖 AI 核查</button>`:'';
  $('#modalFoot').innerHTML=`<button class="btn" data-act="closeModal">关闭</button>${aiBtn}<button class="btn btn-primary" data-act="openForm" data-arg="${id}">编辑</button>`;
  showMask();
}
function delRec(id){
  if(!confirm('确认删除该记录？'))return;
  let arr=getA(curMod);arr=arr.filter(r=>r.id!==id);setA(curMod,arr);
  cloudDelete(curMod,id);
  renderNav();renderModule();toast('已删除');
}

/* ============ 文件/资料选择（本机文件 / 文件夹 / 知识库检索）============ */
function parseFiles(v){
  if(Array.isArray(v))return v.map(x=>({src:x.src||'text',name:x.name||x.path||'',path:x.path||'',size:x.size||0}));
  if(typeof v==='string'&&v.trim())return [{src:'text',name:v.trim(),path:'',size:0}];
  return [];
}
function fmtSize(n){if(!n)return'';if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB';}
function fmtFilesHtml(v){
  const a=parseFiles(v);
  if(!a.length)return '<span style="color:var(--muted)">-</span>';
  const names=a.map(x=>x.name).join('、');
  return `<span class="tag" title="${esc(names)}">${a.length} 个文件/资料</span>`;
}
function fmtFilesText(v){
  const a=parseFiles(v);
  if(!a.length)return '';
  return a.map(x=>`[${x.src==='kb'?'库':(x.src==='local'?'本':'文')}] ${x.name}`).join('；');
}
function renderFileList(){
  const box=$('#fileList');if(!box)return;
  if(!_fileBuf.length){box.innerHTML='<div class="file-empty">尚未选择文件/资料（本机 / 文件夹 / 知识库均可）</div>';return;}
  box.innerHTML=_fileBuf.map((f,i)=>{
    const badge=f.src==='kb'?'<span class="fb kb">库</span>':(f.src==='local'?'<span class="fb lo">本</span>':'<span class="fb tx">文</span>');
    const meta=f.src==='kb'?(f.path||''):(f.size?fmtSize(f.size):(f.path||''));
    return `<div class="file-row"><span class="fb-w">${badge}</span><span class="fn" title="${esc(f.path||f.name)}">${esc(f.name)}</span><span class="fm">${esc(meta)}</span><button type="button" class="btn btn-sm btn-danger" data-act="removeFile" data-arg="${i}">×</button></div>`;
  }).join('');
}
function removeFile(i){_fileBuf.splice(i,1);renderFileList();}
function addTextRef(t){t=(t||'').trim();if(!t)return;_fileBuf.push({src:'text',name:t,path:'',size:0});renderFileList();}
function pickLocalFiles(){const inp=document.createElement('input');inp.type='file';inp.multiple=true;inp.onchange=e=>{[...e.target.files].forEach(f=>_fileBuf.push({src:'local',name:f.name,path:f.name,size:f.size||0}));renderFileList();};inp.click();}
function pickLocalFolder(){const inp=document.createElement('input');inp.type='file';inp.setAttribute('webkitdirectory','');inp.setAttribute('multiple','');inp.multiple=true;inp.onchange=e=>{[...e.target.files].forEach(f=>_fileBuf.push({src:'local',name:f.name,path:(f.webkitRelativePath||f.name),size:f.size||0}));renderFileList();};inp.click();}
function toggleKbPanel(){const p=$('#kbPanel');if(!p)return;p.style.display=(p.style.display==='none'?'block':'none');if(p.style.display==='block')kbSearchDo($('#kbQ')?$('#kbQ').value:'');}
let _kbRows=[];
async function kbSearchDo(q){
  const box=$('#kbRes');if(!box)return;
  q=(q||'').trim();_kbRows=[];
  if(!q){box.innerHTML='<div class="file-empty">输入关键词检索知识库（需后端在线）</div>';return;}
  box.innerHTML='<div class="file-empty">检索中…</div>';
  try{
    const r=await fetch(aiBase()+'/api/kb-search?q='+encodeURIComponent(q)+'&n=20',{headers:{'Authorization':'Bearer '+(CLOUD.token||'')}});
    const j=await r.json();
    const rows=j.results||[];_kbRows=rows;
    if(!rows.length){box.innerHTML='<div class="file-empty">未检索到相关文档</div>';return;}
    box.innerHTML=rows.map((x,i)=>`<div class="kb-row" data-act="addKbFile" data-arg="${i}"><div class="kb-t">${esc(x.title)}</div><div class="kb-m">${esc(x.category||'')} · ${esc(x.issuer||'')} · ${esc(x.publish_date||'')}</div></div>`).join('');
  }catch(e){box.innerHTML='<div class="file-empty">检索失败（后端未连接？）</div>';}
}
function addKbFile(i){const x=_kbRows[i];if(!x)return;if(_fileBuf.some(f=>f.src==='kb'&&f.path===x.path)){toast('已添加');return;}_fileBuf.push({src:'kb',name:x.title,path:x.path,size:0});renderFileList();}
function aiBase(){const u=getAiUrl();if(u)return u.replace(/\/api\/verify\/?$/,'');return (location.origin||'');}
function aiVerifyUrl(){return aiBase()+'/api/verify';}
let _aiPayload=null;
function openAiVerify(id){
  const m=M[curMod];const rec=getA(curMod).find(r=>r.id===id);if(!rec)return;
  const filesKey=curMod==='doc_review'?'relatedFiles':'attach';
  const files=parseFiles(rec[filesKey]);
  const target=curMod==='record_check'?(rec.targetDoc||''):(rec.name||'');
  const principles=Array.isArray(rec.principles)?rec.principles:[];
  const findings=curMod==='record_check'?(rec.items||''):(rec.conflictDesc||'');
  const attLines=files.map(f=>`· [${f.src==='kb'?'知识库':(f.src==='local'?'本机':'文本')}] ${f.name}${f.path&&f.src!=='text'?('（'+f.path+'）'):''}`).join('\n')||'（无）';
  const prinLines=principles.map(p=>'· '+p).join('\n')||'（无）';
  const prompt=`任务类型：${m.name}\n目标文档：${target||'（未填写）'}\n\n相关文件/资料：\n${attLines}\n\n所选核查原则：\n${prinLines}\n\n${findings?('已知不一致项/冲突：\n'+findings+'\n\n'):''}请基于上述材料，按核查要点（结论概要 / 逐条核对 / 风险研判 / 整改建议）给出结构化核查意见。`;
  $('#modalTitle').textContent='🤖 AI 核查 · '+m.name;
  $('#modalBody').innerHTML=`<div class="ai-verify">
    <div class="ai-row"><b>目标文档</b>：${esc(target||'（未填写）')}</div>
    <div class="ai-row"><b>相关文件</b>：${esc(files.length+' 个')}</div>
    <div class="ai-row"><b>核查原则</b>：${esc(principles.join('、')||'（未选）')}</div>
    <label class="ai-lab">发送给 AI 的核查提示词（可编辑）</label>
    <textarea id="aiPrompt" class="ai-prompt">${esc(prompt)}</textarea>
    <div id="aiResult" class="ai-result" style="display:none"></div>
  </div>`;
  $('#modalFoot').innerHTML=`<button class="btn" data-act="closeModal">关闭</button><button class="btn" data-act="copyAiPrompt">📋 复制提示词</button><button class="btn btn-primary" data-act="runAiVerify">🤖 运行 AI 核查</button>`;
  showMask();
  _aiPayload={target_doc:target,attachments:files.map(f=>({src:f.src,name:f.name,path:f.path})),principles:principles,findings:findings,doc_type:m.name};
}
async function runAiVerify(){
  const box=$('#aiResult');const pr=$('#aiPrompt');if(!box)return;
  const prompt=pr?pr.value:'';
  box.style.display='block';box.innerHTML='<div class="file-empty">AI 核查中…（通常 10~40 秒）</div>';
  const payload=Object.assign({},_aiPayload,{prompt:prompt});
  try{
    const r=await fetch(aiVerifyUrl(),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(CLOUD.token||'')},body:JSON.stringify(payload)});
    const j=await r.json();
    if(j.ok&&j.result){box.innerHTML='<div class="ai-out">'+fmtAiResult(j.result)+'</div>';}
    else{box.innerHTML='<div class="ai-warn">'+esc(j.message||j.error||'AI 核查未返回结果')+'<br>请改用「复制提示词」在外部 AI 中执行。</div>';}
  }catch(e){box.innerHTML='<div class="ai-warn">调用失败：'+esc(e&&e.message?e.message:e)+'<br>请改用「复制提示词」在外部 AI 中执行。</div>';}
}
function copyAiPrompt(){const pr=$('#aiPrompt');if(!pr)return;const v=pr.value;
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(v).then(()=>toast('已复制核查提示词')).catch(()=>fallbackCopy(v));}
  else fallbackCopy(v);
}
function fallbackCopy(v){const ta=document.createElement('textarea');ta.value=v;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('已复制核查提示词');}catch(e){toast('复制失败，请手动选择');}document.body.removeChild(ta);}
/* 把 AI 返回（JSON 或纯文本）渲染为可读结构 */
function fmtAiResult(raw){
  let s=(raw||'').trim();
  if(s.startsWith('```')){s=s.replace(/^```[a-zA-Z]*\n?/,'').replace(/\n?```$/,'')}
  let obj=null;
  try{obj=JSON.parse(s);}catch(e){}
  if(obj && typeof obj==='object')return renderAiObj(obj);
  return esc(raw).replace(/\n/g,'<br>');
}
function renderAiObj(o){
  if(Array.isArray(o))return '<ul class="ai-ul">'+o.map(x=>'<li>'+renderAiVal(x)+'</li>').join('')+'</ul>';
  if(o && typeof o==='object')return Object.entries(o).map(([k,v])=>`<div class="ai-sec"><div class="ai-k">${esc(k)}</div>${renderAiVal(v)}</div>`).join('');
  return esc(String(o));
}
function renderAiVal(v){
  if(v && typeof v==='object')return renderAiObj(v);
  return '<div class="ai-v">'+esc(String(v)).replace(/\n/g,'<br>')+'</div>';
}

/* ============ 备份 ============ */
function exportAll(){
  const data={};ORDER.forEach(m=>data[m]=getA(m));
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='研发QA工作台备份_'+today()+'.json';a.click();toast('已导出备份');
}
function importAll(){ $('#fileInput').click(); }
function doImport(e){
  const f=e.target.files[0];if(!f)return;const rd=new FileReader();
  rd.onload=ev=>{try{const d=JSON.parse(ev.target.result);
    ORDER.forEach(m=>{if(d[m]){d[m].forEach(r=>{if(!r.id)r.id=uid();});setA(m,d[m]);}});
    if(CLOUD.enabled&&CLOUD.token){
      ORDER.forEach(m=>{(d[m]||[]).forEach(r=>apiPersist(m,r));});
      renderNav();renderHome();toast('导入成功，正在同步云端');
    }else{
      renderNav();renderHome();toast('导入成功');
    }
  }catch(err){toast('导入失败：文件格式错误');}};
  rd.readAsText(f);e.target.value='';
}
function clearAll(){
  if(!confirm('将清空全部 22 个模块的所有数据，且不可恢复！确认？'))return;
  ORDER.forEach(m=>localStorage.removeItem(PREFIX+m));
  renderNav();renderHome();toast('已清空全部数据');
}
function loadSamples(){
  if(!confirm('将载入演示示例数据（不影响已有数据，仅追加）。继续？'))return;
  const S={
   doc_review:[{code:'DR-001',name:'XZB-2026 IND申报资料V2.0审阅',version:'V2.0',type:'申报资料(CTD模块)',drafter:'注册部/李工',attach:'',
     reviewType:['数据一致性','交叉引用与可追溯','法规符合性'],basis:['NMPA GMP(2010修订)','ICH M4','药品注册核查要点'],
     principles:['数据准确性（数值/单位/小数点/范围）','文件间冲突检查（编号/版本/数据互不一致）','版本一致性（正文与附件同源）'],
     reviewer:'唐海云',reviewDate:today(),
     conflict:'有',conflictDesc:'3.2.S.4.2 质量标准与 EXP-003 检测方法不一致（有关物质限度表述差异）',
     conclusion:'有条件通过',rectify:'① 修订质量标准中有关物质限度；② 补充 EXP-003 方法编号引用',
     owner:'唐海云',dueDate:addDays(today(),2),status:'审阅中',remark:''}],
   record_check:[{code:'RC-001',name:'IND申报资料与实验记录一致性核查',project:'XZB-2026',targetDoc:'IND申报资料（数据校准版）.docx',attach:'EXP-001~006 实验记录与数据报表',
     basis:['企业SOP','申报资料要求(M4/CTD)','ICH指导原则'],
     principles:['申报资料与实验记录一致性','数值/单位/日期三核对','原始数据可溯（原始图谱/台账）','CTD模块间一致性（M2摘要与M3/M4/M5对应）'],
     scope:'模块3.2.S：批号 XZB-2026-01~03 的含量、有关物质、溶出度',method:'人工+工具',risk:'高',
     itemCount:'2',items:'① 含量：申报99.8% vs 记录99.6%；② 有关物质总量：申报0.42% vs 记录0.48%',
     diCheck:['原始性','可追溯','准确性'],consistency:'不一致',rectify:'按实验记录修订申报资料并出具偏差说明',rectifyStatus:'整改中',
     owner:'唐海云',dueDate:addDays(today(),1),status:'进行中',remark:''}],
   change:[{code:'CH-2026-001',title:'有关物质 HPLC 色谱条件优化（流动相比例调整）',type:'分析方法',source:'研发推进',phase:'III期',
     applicant:'分析部/赵工',applyDate:today(),desc:'原方法主峰与相邻杂质分离度1.3，不满足≥1.5，拟调整流动相有机相比例由 45%→40%',
     impact:['分析方法','产品质量/CQA','验证状态','法规/注册申报','文件与记录'],risk:'中',
     regImpact:'需补充申请',level:'中等',
     ccb:'同意实施，需完成方法验证并同步更新IND申报资料',approver:'质量受权人/王总',approveDate:today(),
     impl:'① 方法验证（8/30前）② 更新SOP与质量标准 ③ 注册补充申请',relatedSys:'Empower CDS、分析方法SOP-AN-012',effCheck:'',
     owner:'赵工',dueDate:addDays(today(),5),status:'已批准',remark:''}],
   deviation:[{code:'DV-2026-014',title:'稳定性 6 月加速样品未按方案规定日期取样（延迟3天）',project:'XZB-2026',
     foundDate:addDays(today(),-2),finder:'QC/钱工',related:'批号 XZB-2026-01（加速40℃/75%RH）',
     category:'人员/操作',gmpRef:'GMP(2010) 第二百二十三条；SOP-QC-021 稳定性管理',
     severity:'主要',immediate:'① 立即补取样并注明实际取样时间；② 评估延迟对数据的影响',
     impact:'延迟3天（窗口±7天内），对6月时间点数据代表性无实质影响；需评估是否影响有效期外推',
     trend:'首次发生',
     method:'5Why',rootCause:'稳定性取样提醒仅依赖人工台账，未设置系统自动提醒且当月责任人交接未明确',
     evidence:'',ca:'补充取样并出具数据说明；更新取样台账',pa:'① 在LIMS设置稳定性时间点自动提醒；② 修订SOP增加交接清单',
     capaRef:'CA-2026-008',effCheck:'',
     owner:'钱工',dueDate:addDays(today(),26),status:'调查中',remark:''}],
   capa:[{code:'CA-2026-008',source:'偏差',ref:'DV-2026-014',project:'XZB-2026',
     desc:'稳定性取样缺少自动提醒机制，存在遗漏/延迟风险',
     type:'预防措施PA',action:'① LIMS 增加稳定性时间点提前7天提醒；② SOP-QC-021 增加人员交接清单',
     responsible:'钱工',dept:'QC',planDate:addDays(today(),20),
     execDate:'',effMethod:'复核/抽查',effect:'',effDate:'',closeDate:'',
     owner:'唐海云',dueDate:addDays(today(),20),status:'进行中',remark:''}],
   qrm:[{code:'QR-2026-003',subject:'临床试验样品与中试批共线生产交叉污染风险',project:'XZB-2026',
     trigger:'新项目/新产品',method:'FMEA/FMECA',team:'QA、生产、工艺、QC',
     scope:'中试车间共用制粒/压片线，产品A(高活性)与XZB-2026交替生产',
     hazard:'清洁不彻底导致残留交叉污染；共线产品日剂量与清洁限度计算不充分',
     rpn:'12',risk:'高',accept:'需降低措施',
     control:'① 阶段性生产+专用设备；② 按 PDE/ADE 计算清洁限度；③ 清洁验证三批；④ 更换品种前清洁确认',
     residual:'中',result:'在落实上述措施后风险降至可接受水平，需每年回顾',
     reviewCycle:'12个月',reviewDate:addDays(today(),300),
     owner:'唐海云',dueDate:addDays(today(),3),status:'进行中',remark:''}],
   supplier:[{code:'SP-018',name:'XX药业（原料药）股份有限公司',material:'XZB-2026 原料药（API）',
     type:'原料药API',level:'A类-关键/战略',risk:'中',
     license:'药品生产许可证、GMP符合性证明、DMF登记（A状态）',
     qualify:'现场审计',auditRef:'AU-2026-004 / '+addDays(today(),-120),result:'合格',
     approveDate:addDays(today(),-110),agreement:'QA-2026-018',
     reevalCycle:'12个月',reevalDate:addDays(today(),245),perf:'近12个月供货6批，检验合格率100%，无重大偏差',
     owner:'王工',dueDate:addDays(today(),245),status:'已批准',remark:''}],
   audit:[{code:'AU-2026-007',name:'2026年度 QC 实验室数据可靠性专项审计',auditType:'内部审计(自检)',
     target:'质量控制部（QC实验室 / 稳定性留样室）',scope:'数据可靠性、审计追踪、OOS调查、对照品管理、人员培训',
     checklist:['GMP(2010)及附录','数据可靠性指南','企业SOP','上年度整改项'],
     planDate:addDays(today(),10),team:'唐海云（组长）、李工、QA-张',
     execDate:'',findings:'',critical:'',major:'',minor:'',reportRef:'',
     capaRef:'',track:'',closeDate:'',
     owner:'唐海云',dueDate:addDays(today(),10),status:'计划中',remark:''}],
   oos:[{code:'OOS-2026-005',product:'XZB-2026片',sample:'XZB-2026-03',item:'含量（HPLC）',
     rtype:'OOS(超标)',initial:'88.2%（标准：95.0%~105.0%）',foundDate:addDays(today(),-3),analyst:'QC/孙工',
     phase1:'核对仪器状态、色谱系统适用性、对照品称量与配制、样品称量记录；复查积分参数',
     labCause:'已确认实验室错误',retest:'按SOP预定义复测方案：原样复测2份，结果 99.1%、99.4%',
     retestRule:'符合',
     phase2:'',hypothesis:'',rootCause:'初次检验样品研磨不充分、称样量转移损失导致含量偏低',
     conclusion:'确证OOS(实验室错误)',batchDecision:'放行',capaRef:'CA-2026-009',
     owner:'赵工',dueDate:addDays(today(),4),status:'阶段I调查中',remark:''}],
   method:[{code:'AN-012',name:'XZB-2026 有关物质测定法（HPLC）',project:'XZB-2026',
     type:'有关物质/杂质',technique:'HPLC/UPLC',stage:'验证',
     atp:'能准确定量≥0.05%的已知杂质及未知杂质，主峰与相邻杂质分离度≥1.5',
     params:['专属性/选择性','准确度/回收率','精密度-重复性','线性','范围','定量限LOQ','耐用性','溶液稳定性'],
     equip:'HPLC-01 / Agilent 1260，C18 250×4.6mm 5μm',refStd:'XZB-2026 对照品（批号 RS-2026-01）',
     protocol:'VP-2026-012',reportRef:'',validation:'进行中',
     owner:'赵工',dueDate:addDays(today(),6),status:'验证中',remark:''}],
   stability:[{code:'ST-2026-002',product:'XZB-2026片 / 批号 XZB-2026-01',project:'XZB-2026',
     batchScale:'中试批',condition:'加速(40℃/75%RH)',packaging:'铝塑泡罩 + 铝箔袋（含干燥剂）',
     timePoint:'0/1/2/3/6 月',spec:'按草案质量标准：含量95.0-105.0%、总杂≤1.0%、溶出度Q=80%',
     donePoint:'0/1/2 月',nextPoint:addDays(today(),14),
     trend:'0~2月数据平稳，有关物质总量缓慢上升（0.21%→0.28%），无显著变化',oosRef:'',
     conclusion:'',shelfLife:'',exception:'无',
     owner:'钱工',dueDate:addDays(today(),14),status:'进行中',remark:''}],
   equip:[{code:'EQ-QC-001',name:'高效液相色谱仪 HPLC-01（Empower 3 工作站）',category:'检验仪器',
     model:'Agilent 1260 Infinity II',serial:'CN2024-0128',location:'QC 液相室 A-203',
     gamp:'4类-可配置',
     confirm:['URS','DQ','IQ','OQ','PQ','校准/计量检定'],confirmRef:'CQ-2024-012',
     cycle:'12个月',lastCal:addDays(today(),-340),nextCal:addDays(today(),25),
     csv:'已验证',access:'已建立',auditTrail:'已启用',backup:'已验证',
     owner:'赵工',dueDate:addDays(today(),25),status:'正常/可用',remark:''}],
   di:[{code:'DI-2026-004',system:'QC 实验室 HPLC 手工积分与纸质记录',area:'QC实验室',
     scope:'2026Q2 数据可靠性专项自查：色谱数据审计追踪复核、手工积分审批、纸质记录管理',
     principle:['同步记录(Contemporaneous)','可归属(Attributable)','完整(Complete)','可追溯(Traceable)'],
     finding:'① 部分纸质仪器使用记录未同步签注时间；② 2 份手工积分未经第二人复核即出具报告',
     grade:'主要',risk:'中',rootCause:'SOP不完善',
     measure:'① 修订SOP明确同步记录要求；② 手工积分纳入双人复核清单；③ 开展DI专项培训',
     capaRef:'CA-2026-006',evidence:'',
     owner:'唐海云',dueDate:addDays(today(),7),status:'整改中',remark:''}],
   training:[{code:'TR-2026-021',subject:'数据可靠性（ALCOA++）与审计追踪复核专项培训',
     type:'数据可靠性',content:'ALCOA++原则、MHRA/FDA DI 指南要点、典型缺陷案例、本企业审计追踪复核操作',
     target:'QC 全员 + QA（共 24 人）',trainer:'QA',owner:'唐海云',planDate:addDays(today(),-12),
     trainDate:addDays(today(),-5),duration:'3 学时',attendees:'24/24',check:'笔试',
     passRate:'100%（平均分 92）',qualified:'是',cert:'TR-2026-021',reTrain:'否',
     dueDate:addDays(today(),10),status:'已完成',remark:'待完成培训效果评估（3个月后行为层评估）'}],
   knowledge:[{code:'KM-2026-011',title:'XZB-2026 关键质量属性(CQA)与控制策略确立',
     category:'CQA',project:'XZB-2026',phase:'I期',source:'研发试验',
     content:'CQA：含量、有关物质（单个/总量）、溶出度、含量均匀度。CPP：制粒终点扭矩、压片主压力、包衣增重。控制策略：中控+放行双控。',
     attach:'',value:'高',usage:'作为工艺验证方案与质量标准制定的输入，纳入CTD 3.2.P.2 研发章节',
     owner:'唐海云',dueDate:addDays(today(),90),status:'已归档',remark:''}],
   pv:[{code:'VP-2026-004',product:'XZB-2026片 工艺验证',project:'XZB-2026',
     stage:'Stage2 工艺确认(PPQ)',vtype:'工艺',protocol:'VP-2026-004-P',
     cqa:'含量、含量均匀度、溶出度、有关物质',batch:'XZB-2026-01/02/03（3批）',
     acceptance:'含量 95.0~105.0%；含量均匀度 AV≤15；溶出度 Q=80%；有关物质总杂≤1.0%；三批批内/批间RSD≤5%',
     result:'',reportRef:'',conclusion:'',revalidate:'',
     owner:'孙工',dueDate:addDays(today(),40),status:'方案编制中',remark:''}],
   tech_transfer:[{code:'TT-2026-002',project:'XZB-2026 有关物质分析方法转移（研发→QC）',
     from:'研发分析部',to:'质量控制部(QC)',direction:'方法转移(实验室间)',
     content:['分析方法','文件/SOP','培训'],
     risk:'方法为色谱法，主要风险：仪器品牌差异、色谱柱批间差异、分析人员操作差异',
     gap:'QC 现有 C18 柱批次与研发不同 → 需进行柱耐用性确认',protocol:'TT-2026-002-P',
     criteria:'转移接收准则：两名QC人员各测6份，中间精密度 RSD≤3.0%；与方法原实验室均值偏差≤2.0%',
     report:'',training:'进行中',conclusion:'进行中',
     owner:'赵工',dueDate:addDays(today(),12),status:'进行中',remark:''}],
   release:[{code:'RL-2026-018',batch:'XZB-2026-03',product:'XZB-2026片 10mg',spec:'10mg × 14片/板',
     type:'临床样品',batchSize:'5 万片',
     recordCheck:'已审核',devStatus:'无',changeStatus:'无',validStatus:'符合',storage:'符合',
     qaReview:'批生产记录、批检验记录齐全；检验结果符合质量标准；OOS-2026-005 已按实验室错误关闭；无未闭环偏差/变更',
     decision:'同意放行',releasePerson:'质量转受人/唐海云',releaseDate:'',
     owner:'唐海云',dueDate:addDays(today(),1),status:'待审核',remark:'待 OOS-2026-005 关闭后正式放行'}],
   complaint:[{code:'CP-2026-003',receiveDate:addDays(today(),-4),source:'研究者/受试者',
     reporter:'XX医院 I期临床研究室 / 刘医生',product:'XZB-2026-02',project:'XZB-2026',
     type:'包装/标签',content:'反馈部分受试者包装盒标签批号印刷模糊，难以辨认',
     severity:'一般',risk:'中',investigate:'留样复核：同批次标签 20 份中 3 份存在印刷不清，属打码机色带磨损',
     relateDev:'是',adr:'否',action:'退换货',recallLevel:'无',recallScope:'同批次 120 盒，已发往3家中心，退换 68 盒',
     report2Auth:'不适用',closeDate:'',
     owner:'唐海云',dueDate:addDays(today(),6),status:'调查中',remark:''}],
   self_inspect:[{code:'SI-2026-Q3-01',plan:'2026年度自检计划 / 第三季度·物料与仓储专项',scope:'原辅料与成品库房、留样室、物料放行与追溯、温湿度监控',
     auditType:'专项自检',checklist:['GMP(2010)及附录','企业SOP','上年度整改项'],
     team:'唐海云（组长）、QA-张、仓储-周',planDate:addDays(today(),18),
     date:'',findings:'',critical:'',major:'',minor:'',reportRef:'',
     capaRef:'',track:'',closeDate:'',
     owner:'唐海云',dueDate:addDays(today(),18),status:'计划中',remark:''}],
   mgmt_review:[{code:'MR-2026-Q3',period:'季度',date:addDays(today(),25),host:'质量负责人/王总',
     attendees:'研发、QA、QC、生产、注册、采购负责人',
     inputs:['上次决议落实情况','质量目标达成情况','偏差/CAPA趋势','OOS/OOT趋势','变更情况','审计与自检结果','培训与人员','资源需求'],
     data:'',outputs:'',decision:'',action:'',nextDate:addDays(today(),115),
     owner:'唐海云',dueDate:addDays(today(),25),status:'计划中',remark:''}],
   outsourcing:[{code:'OS-2026-002',partner:'XX 医药科技（CDMO）有限公司',service:'CMO/CDMO',
     project:'XZB-2026 临床样品生产',phase:'I期',
     agreement:'QA-2026-031 / '+addDays(today(),-200),auditRef:'AU-2026-004',qualified:'已确认',
     responsibility:'委托方：工艺、质量标准、放行；受托方：按工艺规程生产、批记录、偏差与变更及时通报',
     oversight:['批记录审核','放行审核','定期审计','关键节点见证'],reviewCycle:'12个月',changeNotify:'已约定',
     owner:'周工',dueDate:addDays(today(),60),status:'进行中',remark:''}],
  };
  ORDER.forEach(m=>{if(S[m]){const a=getA(m);S[m].forEach(r=>{r.id=r.id||uid();if(!a.find(x=>x.code===r.code))a.push(r);});setA(m,a);}});
  renderNav();renderHome();toast('已载入示例数据');
}

/* ============ 弹窗 ============ */
function showMask(){$('#mask').classList.add('show');}
function closeModal(){$('#mask').classList.remove('show');}
$('#mask').onclick=e=>{if(e.target.id==='mask')closeModal();};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

/* ============ 事件委托（替代内联 onclick，兼容严格 CSP script-src 'self'）============ */
/* 所有可点击元素改用 data-act 属性，由本处统一委托分发，避免被 CSP 拦截内联事件处理器 */
const ACT={
  openMod:openMod, openForm:openForm, showDetail:showDetail, delRec:delRec,
  closeModal:closeModal, saveForm:saveForm, loadSamples:loadSamples, importAll:importAll,
  exportAll:exportAll, clearAll:clearAll, openCloudModal:openCloudModal,
  cloudDisconnect:cloudDisconnect, cloudUploadLocal:cloudUploadLocal,
  cloudLogin:()=>cloudAuth('login'), cloudRegister:()=>cloudAuth('register'),
  pickLocalFiles:pickLocalFiles, pickLocalFolder:pickLocalFolder, toggleKbPanel:toggleKbPanel,
  addKbFile:addKbFile, removeFile:removeFile, openAiVerify:openAiVerify,
  copyAiPrompt:copyAiPrompt, runAiVerify:runAiVerify
};
document.addEventListener('click',function(e){
  const t=e.target.closest('[data-act]'); if(!t)return;
  const fn=ACT[t.dataset.act]; if(!fn)return;
  let arg=t.dataset.arg;
  // 数值型参数（removeFile / addKbFile 的索引）转为 Number
  if(t.dataset.act==='removeFile'||t.dataset.act==='addKbFile')arg=Number(arg);
  fn(arg);
});

/* ============ 启动 ============ */
loadCloud();renderCloudBadge();
// 文件导入 input 的 change 事件改为 addEventListener 绑定（替代内联 onchange）
const _fileInputEl=document.getElementById('fileInput');
if(_fileInputEl)_fileInputEl.addEventListener('change',doImport);
try{renderNav();}catch(e){
  const _n=$('#nav');if(_n)_n.innerHTML='<div class="nav-item" style="color:#c0392b">⚠ 导航加载失败：'+esc(e&&e.message||e)+'</div>';
  console.error('[qa-workbench] renderNav error:',e);
}
try{renderHome();}catch(e){
  const _c=$('#content');if(_c)_c.innerHTML='<div class="section" style="border:1px solid #c0392b;background:#fde8e4"><h3 style="color:#c0392b;margin:0 0 8px">⚠ 工作台首页加载失败</h3><div style="font-size:12px;color:#1f2a44;margin-bottom:8px">可能是浏览器版本过旧、扩展拦截、或脚本执行被中断。请按 F12 打开控制台查看完整错误。</div><pre style="white-space:pre-wrap;font-size:12px;background:#fff;padding:10px;border-radius:6px;margin:0">'+esc((e&&e.stack)||String(e))+'</pre></div>';
  console.error('[qa-workbench] renderHome error:',e);
}
if(CLOUD.enabled&&CLOUD.token){
  (async()=>{const ok=await cloudBootstrap();if(ok){toast('☁ 已自动同步云端数据');startSync();}else{CLOUD.enabled=false;CLOUD.token='';saveCloud();renderCloudBadge();}})();
}
