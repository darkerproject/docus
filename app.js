/* =============================================================
   STATE
============================================================= */
const PRESETS = [
  {name:'Inulab', c1:'#0e7c8e', c2:'#1f3a5f', c3:'#e8f4f6'},
  {name:'Bosque', c1:'#1f6b3a', c2:'#2c2c2c', c3:'#eaf3ec'},
  {name:'Marino', c1:'#1d3557', c2:'#0a2540', c3:'#eef2f8'},
  {name:'Coral',  c1:'#c64b4b', c2:'#2c2c2c', c3:'#fbeeee'},
  {name:'Mostaza',c1:'#a37a1c', c2:'#3a2e1f', c3:'#f7f0dc'},
  {name:'Carbón', c1:'#1a1a1a', c2:'#525252', c3:'#f1f1f1'},
];

const CV_PRESETS = [
  {name:'Oscuro',  sideBg:'#2c2c2c', sideText:'#e8e8e8', mainBg:'#ffffff', mainText:'#2c2c2c', title:'#0e7c8e'},
  {name:'Marino',  sideBg:'#1d3557', sideText:'#f1faee', mainBg:'#ffffff', mainText:'#1d3557', title:'#e63946'},
  {name:'Pastel',  sideBg:'#f4d6cc', sideText:'#5a2a1f', mainBg:'#ffffff', mainText:'#3a2820', title:'#c2664a'},
  {name:'Bosque',  sideBg:'#2d4a3e', sideText:'#e8f1ec', mainBg:'#ffffff', mainText:'#2c2c2c', title:'#5a8f7a'},
  {name:'Carbón',  sideBg:'#1a1a1a', sideText:'#e8e8e8', mainBg:'#f5f5f5', mainText:'#1a1a1a', title:'#d4a017'},
  {name:'Lavanda', sideBg:'#5b4b8a', sideText:'#f0ecfa', mainBg:'#ffffff', mainText:'#2c2440', title:'#9b86c4'},
  {name:'Claro',   sideBg:'#f5f5f5', sideText:'#2c2c2c', mainBg:'#ffffff', mainText:'#2c2c2c', title:'#1a1a1a'},
];

const DEFAULT_SECTIONS_LAB = {
  patient_clinica:true,
  patient_tutor:true,
  patient_especie:true,
  patient_sexo:true,
  patient_peso:true,
  service_address:false,
  indications:true,
  observations:true
};
const DEFAULT_SECTIONS_GENERAL = {
  client_empresa:false,
  client_telefono:false,
  client_email:false,
  service_address:false,
  indications:false,
  observations:true
};
const DEFAULT_SECTIONS_CV = {
  cv_certificados:false,
  cv_pasatiempos:false,
  cv_referencias:false
};

const DEFAULTS = {
  settings:{
    logo:'',
    name:'',
    address:'',
    phone:'',
    currency:'S/',
    c1:'#0e7c8e',
    c2:'#1f3a5f',
    c3:'#e8f4f6',
    taxRate:18,
    taxLabel:'IGV',
    indDefaults:'',
    obsDefaults:'',
    sections:{},  // populated per template on load
    // CV-specific (only used when template === 'cv')
    cvSideBg:'#2c2c2c',
    cvSideText:'#e8e8e8',
    cvMainBg:'#ffffff',
    cvMainText:'#2c2c2c',
    cvTitleColor:'#0e7c8e',
    cvHabilidadesPos:'main'
  },
  catalog:[],
  cv:{
    name:'',
    role:'',
    perfil:'',
    photoData:'',
    photoShape:'circle',
    contacto:{email:'',phone:'',address:'',website:''},
    idiomas:[],
    experiencia:[],
    educacion:[],
    habilidades:[],
    certificados:[],
    pasatiempos:'',
    referencias:[]
  }
};

let state = {
  account: null,
  accountName: '',
  template: null,
  accounts: [],
  settings:{...DEFAULTS.settings},
  catalog:[],
  quote:{
    number:'',
    date:new Date().toISOString().slice(0,10),
    validity:30,
    paciente:'',clinica:'',tutor:'',especie:'',sexo:'',peso:'',
    clientNombre:'',clientEmpresa:'',clientTelefono:'',clientEmail:'',
    serviceAddress:'',
    exams:[],
    discount:{enabled:false, type:'amount', value:0},
    tax:{enabled:false},
    paid:{enabled:false, amount:0},
    indications:[],
    observations:''
  },
  cv:{
    name:'',
    role:'',
    perfil:'',
    photoData:'',
    photoShape:'circle',
    contacto:{email:'',phone:'',address:'',website:''},
    idiomas:[],
    experiencia:[],
    educacion:[],
    habilidades:[],
    certificados:[],
    pasatiempos:'',
    referencias:[]
  }
};

/* =============================================================
   STORAGE  (window.storage en Claude · localStorage en navegador · memoria si nada)
============================================================= */
const hasClaudeStorage = typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function';
let hasLocalStorage = false;
if(!hasClaudeStorage){
  try{
    if(typeof window !== 'undefined' && window.localStorage){
      const k = '__cot_test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      hasLocalStorage = true;
    }
  }catch(e){}
}
const STORAGE_PREFIX = 'cotizaciones:';

async function storageGet(key){
  if(hasClaudeStorage){
    try{
      const r = await window.storage.get(key);
      return r ? r.value : null;
    }catch(e){ return null; }
  }
  if(hasLocalStorage){
    try{ return window.localStorage.getItem(STORAGE_PREFIX + key); }
    catch(e){ return null; }
  }
  return null;
}
async function storageSet(key,value){
  if(hasClaudeStorage){
    try{ await window.storage.set(key, value); }catch(e){}
    return;
  }
  if(hasLocalStorage){
    try{ window.localStorage.setItem(STORAGE_PREFIX + key, value); }catch(e){}
  }
}

/* =============================================================
   ACCOUNT + SESSION + DATA SCOPING
============================================================= */
const slug = s => String(s||'').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'cuenta';

function dataKey(name){
  return `acc:${state.account}:${state.template}:${name}`;
}

async function loadAccounts(){
  const raw = await storageGet('accounts');
  try{ state.accounts = raw ? JSON.parse(raw) : []; }
  catch(e){ state.accounts = []; }
}
async function saveAccounts(){
  await storageSet('accounts', JSON.stringify(state.accounts));
}

async function loadSession(){
  const raw = await storageGet('session');
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch(e){ return null; }
}
async function saveSession(){
  await storageSet('session', JSON.stringify({
    account: state.account,
    accountName: state.accountName,
    template: state.template
  }));
}
async function clearSessionStorage(){
  await storageSet('session', '');
}

async function loadDataForSession(){
  const sRaw = await storageGet(dataKey('settings'));
  const loaded = sRaw ? (()=>{ try{return JSON.parse(sRaw);}catch(e){return {};} })() : {};
  state.settings = {...DEFAULTS.settings, ...loaded};

  // Apply default sections per template (merging with saved overrides)
  if(state.template === 'lab' || state.template === 'general'){
    const tmplDefaults = state.template === 'general' ? DEFAULT_SECTIONS_GENERAL : DEFAULT_SECTIONS_LAB;
    state.settings.sections = {...tmplDefaults, ...(loaded.sections || {})};
  }else if(state.template === 'cv'){
    state.settings.sections = {...DEFAULT_SECTIONS_CV, ...(loaded.sections || {})};
  }

  const cRaw = await storageGet(dataKey('catalog'));
  try{ state.catalog = cRaw ? JSON.parse(cRaw) : []; }
  catch(e){ state.catalog = []; }

  // Defaults for the quote (cotizations)
  const defaultQuote = {
    number:'',
    date:new Date().toISOString().slice(0,10),
    validity:30,
    paciente:'',clinica:'',tutor:'',especie:'',sexo:'',peso:'',
    clientNombre:'',clientEmpresa:'',clientTelefono:'',clientEmail:'',
    serviceAddress:'',
    exams:[],
    discount:{enabled:false, type:'amount', value:0},
    tax:{enabled:false},
    paid:{enabled:false, amount:0},
    indications: state.settings.indDefaults
      ? state.settings.indDefaults.split('\n').map(s=>s.trim()).filter(Boolean)
      : [],
    observations: state.settings.obsDefaults || ''
  };

  // Restore saved quote in-progress if exists (per account+template);
  // otherwise start fresh with defaults.
  const qRaw = await storageGet(dataKey('quote'));
  if(qRaw){
    try{
      const saved = JSON.parse(qRaw);
      state.quote = {...defaultQuote, ...saved};
    }catch(e){
      state.quote = defaultQuote;
    }
  }else{
    state.quote = defaultQuote;
  }

  // CV data (only used when template === 'cv')
  const defaultCV = {
    name:'',
    role:'',
    perfil:'',
    photoData:'',
    photoShape:'circle',
    contacto:{email:'',phone:'',address:'',website:''},
    idiomas:[],
    experiencia:[],
    educacion:[],
    habilidades:[],
    certificados:[],
    pasatiempos:'',
    referencias:[]
  };
  if(state.template === 'cv'){
    const cvRaw = await storageGet(dataKey('cv'));
    if(cvRaw){
      try{
        const saved = JSON.parse(cvRaw);
        state.cv = {...defaultCV, ...saved, contacto:{...defaultCV.contacto, ...(saved.contacto||{})}};
        // migrate legacy shape values that no longer exist
        if(state.cv.photoShape === 'rounded') state.cv.photoShape = 'square';
        if(!['circle','square','rectangle'].includes(state.cv.photoShape)) state.cv.photoShape = 'circle';
      }catch(e){
        state.cv = defaultCV;
      }
    }else{
      state.cv = defaultCV;
    }
  }else{
    state.cv = defaultCV;
  }
}

async function persistQuote(){
  if(!state.account || !state.template) return;
  try{
    if(state.template === 'cv'){
      await storageSet(dataKey('cv'), JSON.stringify(state.cv));
    }else{
      await storageSet(dataKey('quote'), JSON.stringify(state.quote));
    }
  }catch(e){
    // silent: storage may fail (quota, etc), but app keeps running with state in memory
  }
}

let _quoteSaveTimer = null;
function autoSaveQuote(){
  if(_quoteSaveTimer) clearTimeout(_quoteSaveTimer);
  _quoteSaveTimer = setTimeout(()=>{ persistQuote(); }, 600);
}

async function saveSettings(){
  if(!state.account || !state.template) return;
  await storageSet(dataKey('settings'), JSON.stringify(state.settings));
}
async function saveCatalog(){
  if(!state.account || !state.template) return;
  await storageSet(dataKey('catalog'), JSON.stringify(state.catalog));
}

/* =============================================================
   UTILS
============================================================= */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const escapeHTML = s => String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmt = n => Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2, maximumFractionDigits:2});
function uid(){ return Math.random().toString(36).slice(2,9); }

function getContrastText(hex){
  if(!hex) return '#fff';
  const c = hex.replace('#','');
  if(c.length!==6) return '#fff';
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  return lum > 0.6 ? '#1a1a1a' : '#ffffff';
}

function fmtDate(iso){
  if(!iso) return '';
  try{
    const [y,m,d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }catch(e){ return iso; }
}

function showToast(msg, isError){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>t.classList.remove('show'), 2400);
}

/* =============================================================
   FORM RENDER
============================================================= */
function fillFormFromState(){
  if(state.template === 'cv'){
    fillCVFormFromState();
    return;
  }
  $('#f-number').value = state.quote.number;
  $('#f-date').value = state.quote.date;
  $('#f-validity').value = state.quote.validity;
  $('#p-paciente').value = state.quote.paciente;
  $('#p-clinica').value = state.quote.clinica;
  $('#p-tutor').value = state.quote.tutor;
  $('#p-especie').value = state.quote.especie;
  $('#p-sexo').value = state.quote.sexo;
  $('#p-peso').value = state.quote.peso;
  $('#c-nombre').value = state.quote.clientNombre || '';
  $('#c-empresa').value = state.quote.clientEmpresa || '';
  $('#c-telefono').value = state.quote.clientTelefono || '';
  $('#c-email').value = state.quote.clientEmail || '';
  $('#p-service-address').value = state.quote.serviceAddress || '';
  $('#c-service-address').value = state.quote.serviceAddress || '';
  $('#obs').value = state.quote.observations;
  renderExams();
  renderIndications();
  renderCatalog();
  renderTotalsControls();
}

function renderExams(){
  if(state.template === 'general'){
    renderExamsGeneral();
  }else{
    renderExamsLab();
  }
}

function renderExamsLab(){
  const list = $('#exams-list');
  list.innerHTML = '';
  state.quote.exams.forEach((ex,i)=>{
    const el = document.createElement('div');
    el.className = 'exam-item';
    el.innerHTML = `
      <div class="exam-row">
        <input data-f="name" placeholder="Nombre del examen" value="${escapeHTML(ex.name)}">
        <input data-f="price" type="number" step="0.01" min="0" placeholder="0.00" value="${ex.price ?? ''}">
      </div>
      <div class="exam-row-2">
        <input data-f="sample" placeholder="Tipo de muestra" value="${escapeHTML(ex.sample)}">
        <input data-f="time" placeholder="Tiempo (ej. 1 hora)" value="${escapeHTML(ex.time)}">
      </div>
      <div class="actions-row">
        <button class="btn-link" data-act="save">Guardar en catálogo</button>
        <button class="icon-btn" data-act="del" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;
    el.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('input', e=>{
        const f = e.target.dataset.f;
        if(f==='price'){ state.quote.exams[i][f] = parseFloat(e.target.value)||0; }
        else state.quote.exams[i][f] = e.target.value;
        renderPreview();
      });
    });
    el.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      state.quote.exams.splice(i,1);
      renderExams(); renderPreview();
    });
    el.querySelector('[data-act="save"]').addEventListener('click', ()=>{
      const ex = state.quote.exams[i];
      if(!ex.name){ showToast('Pon un nombre antes de guardar', true); return; }
      const exists = state.catalog.find(c=>c.name.toLowerCase()===ex.name.toLowerCase());
      if(exists){
        Object.assign(exists, {time:ex.time, sample:ex.sample, price:ex.price});
      }else{
        state.catalog.push({id:uid(), name:ex.name, time:ex.time, sample:ex.sample, price:ex.price});
      }
      saveCatalog();
      renderCatalog();
      showToast('Guardado en catálogo');
    });
    list.appendChild(el);
  });
}

function renderExamsGeneral(){
  const list = $('#exams-list');
  list.innerHTML = '';
  const cur = state.settings.currency || '';
  state.quote.exams.forEach((ex,i)=>{
    const sub = getItemSubtotal(ex);
    const el = document.createElement('div');
    el.className = 'exam-item';
    el.innerHTML = `
      <input data-f="name" placeholder="Descripción / item" value="${escapeHTML(ex.name||'')}" style="padding:9px 10px;font-size:13px;background:var(--bg-2);border:1px solid var(--line);border-radius:7px;width:100%">
      <div class="exam-row" style="grid-template-columns:80px 1fr">
        <input data-f="qty" type="number" step="0.5" min="0" placeholder="Cant." value="${ex.qty ?? ''}">
        <input data-f="unitPrice" type="number" step="0.01" min="0" placeholder="Precio unitario" value="${ex.unitPrice ?? ''}">
      </div>
      <div class="item-subtotal-line">
        <span class="lbl">Subtotal</span>
        <span class="val">${escapeHTML(cur)} ${fmt(sub)}</span>
      </div>
      <div class="actions-row">
        <button class="btn-link" data-act="save">Guardar en catálogo</button>
        <button class="icon-btn" data-act="del" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;
    el.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('input', e=>{
        const f = e.target.dataset.f;
        if(f === 'qty' || f === 'unitPrice'){
          state.quote.exams[i][f] = parseFloat(e.target.value) || 0;
        }else{
          state.quote.exams[i][f] = e.target.value;
        }
        // Update inline subtotal without re-rendering all rows
        const subEl = el.querySelector('.item-subtotal-line .val');
        if(subEl) subEl.textContent = `${cur} ${fmt(getItemSubtotal(state.quote.exams[i]))}`;
        renderPreview();
      });
    });
    el.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      state.quote.exams.splice(i,1);
      renderExams(); renderPreview();
    });
    el.querySelector('[data-act="save"]').addEventListener('click', ()=>{
      const ex = state.quote.exams[i];
      if(!ex.name){ showToast('Pon una descripción antes de guardar', true); return; }
      const exists = state.catalog.find(c=>c.name.toLowerCase()===ex.name.toLowerCase());
      if(exists){
        Object.assign(exists, {qty:ex.qty, unitPrice:ex.unitPrice});
      }else{
        state.catalog.push({id:uid(), name:ex.name, qty:ex.qty, unitPrice:ex.unitPrice});
      }
      saveCatalog();
      renderCatalog();
      showToast('Guardado en catálogo');
    });
    list.appendChild(el);
  });
}

function renderIndications(){
  const list = $('#ind-list');
  list.innerHTML = '';
  state.quote.indications.forEach((txt,i)=>{
    const el = document.createElement('div');
    el.className = 'indication-item';
    el.innerHTML = `
      <div class="dot"></div>
      <input value="${escapeHTML(txt)}" placeholder="Indicación...">
      <button class="icon-btn" title="Eliminar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    const inp = el.querySelector('input');
    inp.addEventListener('input', e=>{
      state.quote.indications[i] = e.target.value;
      renderPreview();
    });
    el.querySelector('button').addEventListener('click', ()=>{
      state.quote.indications.splice(i,1);
      renderIndications(); renderPreview();
    });
    list.appendChild(el);
  });
}

function renderCatalog(){
  const list = $('#catalog-list');
  list.innerHTML = '';
  if(!state.catalog.length){
    const msg = state.template === 'general'
      ? 'Aún no has guardado items. Llena uno arriba y dale "Guardar en catálogo".'
      : 'Aún no has guardado exámenes. Llena uno arriba y dale "Guardar en catálogo".';
    list.innerHTML = `<div class="catalog-empty">${msg}</div>`;
    return;
  }
  state.catalog.forEach((ex,i)=>{
    const el = document.createElement('div');
    el.className = 'catalog-item';
    const cur = state.settings.currency || '';
    const priceLabel = state.template === 'general'
      ? `${cur} ${fmt(ex.unitPrice ?? ex.price ?? 0)}/u`
      : `${cur} ${fmt(ex.price ?? 0)}`;
    el.innerHTML = `
      <span class="name">${escapeHTML(ex.name)}</span>
      <span class="price">${priceLabel}</span>
      <button data-act="add">+ Añadir</button>
      <button data-act="del" title="Eliminar del catálogo" class="icon-btn" style="color:var(--ink-3)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    el.querySelector('[data-act="add"]').addEventListener('click', ()=>{
      if(state.template === 'general'){
        state.quote.exams.push({
          name: ex.name,
          qty: ex.qty || 1,
          unitPrice: ex.unitPrice ?? ex.price ?? 0
        });
      }else{
        state.quote.exams.push({
          name: ex.name,
          time: ex.time || '',
          sample: ex.sample || '',
          price: ex.price ?? ex.unitPrice ?? 0
        });
      }
      renderExams(); renderPreview();
      showToast(state.template === 'general' ? 'Item añadido' : 'Examen añadido');
    });
    el.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      state.catalog.splice(i,1);
      saveCatalog();
      renderCatalog();
    });
    list.appendChild(el);
  });
}

/* =============================================================
   CALCULATIONS
============================================================= */
function getItemSubtotal(item){
  if(state.template === 'general'){
    const q = parseFloat(item.qty);
    const p = parseFloat(item.unitPrice);
    return ((isNaN(q)?1:q) * (isNaN(p)?0:p)) || 0;
  }
  return parseFloat(item.price) || 0;
}

function calcTotals(){
  const q = state.quote;
  const subtotal = q.exams.reduce((a,b)=>a + getItemSubtotal(b), 0);
  let discountAmount = 0;
  if(q.discount.enabled){
    discountAmount = q.discount.type === 'percent'
      ? subtotal * ((parseFloat(q.discount.value)||0) / 100)
      : (parseFloat(q.discount.value) || 0);
    discountAmount = Math.min(Math.max(discountAmount,0), subtotal);
  }
  const base = subtotal - discountAmount;
  const taxRate = parseFloat(state.settings.taxRate) || 0;
  const taxAmount = q.tax.enabled ? base * (taxRate/100) : 0;
  const total = base + taxAmount;
  const paidAmount = q.paid.enabled ? Math.max(parseFloat(q.paid.amount)||0, 0) : 0;
  const balance = total - paidAmount;
  return {subtotal, discountAmount, taxRate, taxAmount, total, paidAmount, balance};
}

/* =============================================================
   TOTALS CONTROLS (form)
============================================================= */
function renderTotalsControls(){
  renderDiscountControl();
  renderTaxControl();
  renderPaidControl();
}

function renderDiscountControl(){
  const el = $('#ctrl-discount');
  const d = state.quote.discount;
  if(!d.enabled){
    el.className = 'totals-control';
    el.innerHTML = `<button class="add-btn" id="enable-discount">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Agregar descuento</button>`;
    $('#enable-discount').addEventListener('click', ()=>{
      state.quote.discount.enabled = true;
      renderDiscountControl(); renderPreview();
    });
  }else{
    el.className = 'totals-control active';
    el.innerHTML = `
      <label>Descuento</label>
      <div class="input-wrap">
        <select id="d-type">
          <option value="amount" ${d.type==='amount'?'selected':''}>${escapeHTML(state.settings.currency)}</option>
          <option value="percent" ${d.type==='percent'?'selected':''}>%</option>
        </select>
        <input type="number" id="d-value" min="0" step="0.01" placeholder="0" value="${d.value||''}">
      </div>
      <button class="icon-btn" id="remove-discount" title="Quitar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    $('#d-type').addEventListener('change', e=>{
      state.quote.discount.type = e.target.value;
      renderPreview();
    });
    $('#d-value').addEventListener('input', e=>{
      state.quote.discount.value = parseFloat(e.target.value) || 0;
      renderPreview();
    });
    $('#remove-discount').addEventListener('click', ()=>{
      state.quote.discount = {enabled:false, type:'amount', value:0};
      renderDiscountControl(); renderPreview();
    });
  }
}

function renderTaxControl(){
  const el = $('#ctrl-tax');
  const t = state.quote.tax;
  const label = state.settings.taxLabel || 'IGV';
  const rate = state.settings.taxRate || 18;
  if(!t.enabled){
    el.className = 'totals-control';
    el.innerHTML = `<button class="add-btn" id="enable-tax">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Agregar ${escapeHTML(label)} (${rate}%) <span style="color:var(--ink-3);font-weight:500;margin-left:4px">— Factura</span></button>`;
    $('#enable-tax').addEventListener('click', ()=>{
      state.quote.tax.enabled = true;
      renderTaxControl(); renderPreview();
    });
  }else{
    el.className = 'totals-control active';
    el.innerHTML = `
      <label>${escapeHTML(label)} (${rate}%)</label>
      <div class="input-wrap" style="background:var(--bg);border-style:dashed">
        <span style="flex:1;padding:9px 10px;font-size:12px;color:var(--ink-3)">Aplicado al subtotal automáticamente</span>
      </div>
      <button class="icon-btn" id="remove-tax" title="Quitar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    $('#remove-tax').addEventListener('click', ()=>{
      state.quote.tax = {enabled:false};
      renderTaxControl(); renderPreview();
    });
  }
}

function renderPaidControl(){
  const el = $('#ctrl-paid');
  const p = state.quote.paid;
  if(!p.enabled){
    el.className = 'totals-control';
    el.innerHTML = `<button class="add-btn" id="enable-paid">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Agregar adelanto / pagado</button>`;
    $('#enable-paid').addEventListener('click', ()=>{
      state.quote.paid.enabled = true;
      renderPaidControl(); renderPreview();
    });
  }else{
    el.className = 'totals-control active';
    el.innerHTML = `
      <label>Pagado</label>
      <div class="input-wrap">
        <span class="suffix" style="padding:0 4px 0 12px">${escapeHTML(state.settings.currency)}</span>
        <input type="number" id="p-amount" min="0" step="0.01" placeholder="0" value="${p.amount||''}">
      </div>
      <button class="icon-btn" id="remove-paid" title="Quitar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    $('#p-amount').addEventListener('input', e=>{
      state.quote.paid.amount = parseFloat(e.target.value) || 0;
      renderPreview();
    });
    $('#remove-paid').addEventListener('click', ()=>{
      state.quote.paid = {enabled:false, amount:0};
      renderPaidControl(); renderPreview();
    });
  }
}

/* =============================================================
   PREVIEW RENDER
============================================================= */
/* =============================================================
   CV — Form lists, preview and helpers
============================================================= */
function fillCVFormFromState(){
  const cv = state.cv;
  $('#cv-name').value = cv.name || '';
  $('#cv-role').value = cv.role || '';
  $('#cv-perfil').value = cv.perfil || '';
  $('#cv-email').value = cv.contacto.email || '';
  $('#cv-phone').value = cv.contacto.phone || '';
  $('#cv-address').value = cv.contacto.address || '';
  $('#cv-website').value = cv.contacto.website || '';
  $('#cv-pasatiempos').value = cv.pasatiempos || '';
  renderCVIdiomas();
  renderCVExperiencia();
  renderCVEducacion();
  renderCVHabilidades();
  renderCVCertificados();
  renderCVReferencias();
}

function renderCVIdiomas(){
  const list = $('#cv-idiomas-list');
  if(!list) return;
  list.innerHTML = '';
  state.cv.idiomas.forEach((it, i)=>{
    const el = document.createElement('div');
    el.className = 'exam-item';
    el.innerHTML = `
      <div class="exam-row">
        <input data-f="name" placeholder="Idioma (Español, Inglés…)" value="${escapeHTML(it.name||'')}">
        <select data-f="level">
          <option value="">Nivel</option>
          <option ${it.level==='Nativo'?'selected':''}>Nativo</option>
          <option ${it.level==='Avanzado'?'selected':''}>Avanzado</option>
          <option ${it.level==='Intermedio'?'selected':''}>Intermedio</option>
          <option ${it.level==='Básico'?'selected':''}>Básico</option>
        </select>
      </div>
      <div class="actions-row">
        <button class="icon-btn" data-act="del" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    el.querySelectorAll('input, select').forEach(inp=>{
      const handler = e=>{
        state.cv.idiomas[i][e.target.dataset.f] = e.target.value;
        renderPreview();
      };
      inp.addEventListener('input', handler);
      inp.addEventListener('change', handler);
    });
    el.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      state.cv.idiomas.splice(i,1);
      renderCVIdiomas(); renderPreview();
    });
    list.appendChild(el);
  });
}

function renderCVExperiencia(){
  const list = $('#cv-experiencia-list');
  if(!list) return;
  list.innerHTML = '';
  state.cv.experiencia.forEach((it, i)=>{
    const el = document.createElement('div');
    el.className = 'exam-item';
    el.innerHTML = `
      <input data-f="puesto" placeholder="Puesto / Cargo" value="${escapeHTML(it.puesto||'')}" style="padding:9px 10px;font-size:13px;background:var(--bg-2);border:1px solid var(--line);border-radius:7px;width:100%">
      <div class="exam-row">
        <input data-f="empresa" placeholder="Empresa" value="${escapeHTML(it.empresa||'')}">
        <input data-f="periodo" placeholder="Ene 2020 - Dic 2022" value="${escapeHTML(it.periodo||'')}">
      </div>
      <textarea data-f="descripcion" placeholder="Descripción de tu rol y logros" rows="3" style="padding:9px 10px;font-size:13px;background:var(--bg-2);border:1px solid var(--line);border-radius:7px;width:100%;font-family:inherit;resize:vertical">${escapeHTML(it.descripcion||'')}</textarea>
      <div class="actions-row">
        <button class="icon-btn" data-act="del" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    el.querySelectorAll('input, textarea').forEach(inp=>{
      inp.addEventListener('input', e=>{
        state.cv.experiencia[i][e.target.dataset.f] = e.target.value;
        renderPreview();
      });
    });
    el.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      state.cv.experiencia.splice(i,1);
      renderCVExperiencia(); renderPreview();
    });
    list.appendChild(el);
  });
}

function renderCVEducacion(){
  const list = $('#cv-educacion-list');
  if(!list) return;
  list.innerHTML = '';
  state.cv.educacion.forEach((it, i)=>{
    const el = document.createElement('div');
    el.className = 'exam-item';
    el.innerHTML = `
      <input data-f="titulo" placeholder="Título / grado" value="${escapeHTML(it.titulo||'')}" style="padding:9px 10px;font-size:13px;background:var(--bg-2);border:1px solid var(--line);border-radius:7px;width:100%">
      <div class="exam-row">
        <input data-f="institucion" placeholder="Institución" value="${escapeHTML(it.institucion||'')}">
        <input data-f="periodo" placeholder="2018 - 2022" value="${escapeHTML(it.periodo||'')}">
      </div>
      <textarea data-f="descripcion" placeholder="Detalles (opcional)" rows="2" style="padding:9px 10px;font-size:13px;background:var(--bg-2);border:1px solid var(--line);border-radius:7px;width:100%;font-family:inherit;resize:vertical">${escapeHTML(it.descripcion||'')}</textarea>
      <div class="actions-row">
        <button class="icon-btn" data-act="del" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    el.querySelectorAll('input, textarea').forEach(inp=>{
      inp.addEventListener('input', e=>{
        state.cv.educacion[i][e.target.dataset.f] = e.target.value;
        renderPreview();
      });
    });
    el.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      state.cv.educacion.splice(i,1);
      renderCVEducacion(); renderPreview();
    });
    list.appendChild(el);
  });
}

function renderCVHabilidades(){
  const list = $('#cv-habilidades-list');
  if(!list) return;
  list.innerHTML = '';
  state.cv.habilidades.forEach((it, i)=>{
    const el = document.createElement('div');
    el.className = 'exam-item';
    el.innerHTML = `
      <div class="exam-row" style="grid-template-columns:1fr 110px">
        <input data-f="nombre" placeholder="Habilidad (ej. Photoshop)" value="${escapeHTML(it.nombre||'')}">
        <select data-f="nivel">
          <option value="1" ${(it.nivel||3)==1?'selected':''}>Básico</option>
          <option value="2" ${(it.nivel||3)==2?'selected':''}>Inicial</option>
          <option value="3" ${(it.nivel||3)==3?'selected':''}>Intermedio</option>
          <option value="4" ${(it.nivel||3)==4?'selected':''}>Avanzado</option>
          <option value="5" ${(it.nivel||3)==5?'selected':''}>Experto</option>
        </select>
      </div>
      <div class="actions-row">
        <button class="icon-btn" data-act="del" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    el.querySelectorAll('input, select').forEach(inp=>{
      const handler = e=>{
        const f = e.target.dataset.f;
        state.cv.habilidades[i][f] = (f === 'nivel') ? parseInt(e.target.value, 10) : e.target.value;
        renderPreview();
      };
      inp.addEventListener('input', handler);
      inp.addEventListener('change', handler);
    });
    el.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      state.cv.habilidades.splice(i,1);
      renderCVHabilidades(); renderPreview();
    });
    list.appendChild(el);
  });
}

function renderCVCertificados(){
  const list = $('#cv-certificados-list');
  if(!list) return;
  list.innerHTML = '';
  state.cv.certificados.forEach((it, i)=>{
    const el = document.createElement('div');
    el.className = 'exam-item';
    el.innerHTML = `
      <input data-f="nombre" placeholder="Nombre del curso o certificado" value="${escapeHTML(it.nombre||'')}" style="padding:9px 10px;font-size:13px;background:var(--bg-2);border:1px solid var(--line);border-radius:7px;width:100%">
      <div class="exam-row">
        <input data-f="institucion" placeholder="Institución" value="${escapeHTML(it.institucion||'')}">
        <input data-f="fecha" placeholder="Fecha (ej. 2023)" value="${escapeHTML(it.fecha||'')}">
      </div>
      <textarea data-f="descripcion" placeholder="Detalles (opcional)" rows="2" style="padding:9px 10px;font-size:13px;background:var(--bg-2);border:1px solid var(--line);border-radius:7px;width:100%;font-family:inherit;resize:vertical">${escapeHTML(it.descripcion||'')}</textarea>
      <div class="actions-row">
        <button class="icon-btn" data-act="del" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    el.querySelectorAll('input, textarea').forEach(inp=>{
      inp.addEventListener('input', e=>{
        state.cv.certificados[i][e.target.dataset.f] = e.target.value;
        renderPreview();
      });
    });
    el.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      state.cv.certificados.splice(i,1);
      renderCVCertificados(); renderPreview();
    });
    list.appendChild(el);
  });
}

function renderCVReferencias(){
  const list = $('#cv-referencias-list');
  if(!list) return;
  list.innerHTML = '';
  state.cv.referencias.forEach((it, i)=>{
    const el = document.createElement('div');
    el.className = 'exam-item';
    el.innerHTML = `
      <input data-f="nombre" placeholder="Nombre" value="${escapeHTML(it.nombre||'')}" style="padding:9px 10px;font-size:13px;background:var(--bg-2);border:1px solid var(--line);border-radius:7px;width:100%">
      <div class="exam-row">
        <input data-f="empresa" placeholder="Empresa / cargo" value="${escapeHTML(it.empresa||'')}">
        <input data-f="contacto" placeholder="Email o teléfono" value="${escapeHTML(it.contacto||'')}">
      </div>
      <div class="actions-row">
        <button class="icon-btn" data-act="del" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    el.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('input', e=>{
        state.cv.referencias[i][e.target.dataset.f] = e.target.value;
        renderPreview();
      });
    });
    el.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      state.cv.referencias.splice(i,1);
      renderCVReferencias(); renderPreview();
    });
    list.appendChild(el);
  });
}

function renderCVPreview(){
  const cv = state.cv;
  const s = state.settings;
  const sections = s.sections || {};
  const habPos = s.cvHabilidadesPos || 'main';
  const doc = $('#preview-doc');

  // Apply color variables from settings
  doc.style.setProperty('--cv-side-bg', s.cvSideBg || '#2c2c2c');
  doc.style.setProperty('--cv-side-text', s.cvSideText || '#e8e8e8');
  doc.style.setProperty('--cv-main-bg', s.cvMainBg || '#ffffff');
  doc.style.setProperty('--cv-main-text', s.cvMainText || '#2c2c2c');
  doc.style.setProperty('--cv-title', s.cvTitleColor || '#0e7c8e');

  // Build sidebar parts
  const sidebarParts = [
    cv.photoData ? `<div class="cv-photo shape-${cv.photoShape||'circle'}"><img src="${cv.photoData}" alt="Foto"></div>` : '',
    renderCVPerfilHTML(cv),
    renderCVContactoHTML(cv),
    renderCVIdiomasHTML(cv),
    habPos === 'sidebar' ? renderCVHabilidadesHTML(cv) : '',
    sections.cv_referencias === true ? renderCVReferenciasHTML(cv) : ''
  ];

  // Build main parts
  const mainParts = [
    `<div class="cv-name">${escapeHTML(cv.name || 'Tu nombre')}</div>`,
    `<div class="cv-role">${escapeHTML(cv.role || 'Tu cargo / profesión')}</div>`,
    renderCVExperienciaHTML(cv),
    renderCVEducacionHTML(cv),
    habPos === 'main' ? renderCVHabilidadesHTML(cv) : '',
    sections.cv_certificados === true ? renderCVCertificadosHTML(cv) : '',
    sections.cv_pasatiempos === true ? renderCVPasatiemposHTML(cv) : ''
  ];

  doc.innerHTML = `
    <div class="cv-doc">
      <aside class="cv-sidebar">
        ${sidebarParts.filter(Boolean).join('')}
      </aside>
      <main class="cv-main">
        ${mainParts.filter(Boolean).join('')}
      </main>
    </div>
  `;
}

function renderCVPerfilHTML(cv){
  if(!cv.perfil) return '';
  return `
    <div class="cv-section">
      <div class="cv-section-title">Perfil</div>
      <div class="cv-perfil-text">${escapeHTML(cv.perfil).replace(/\n/g,'<br>')}</div>
    </div>
  `;
}

const CV_CONTACT_ICONS = {
  email: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  address: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  website: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
};

function renderCVContactoHTML(cv){
  const c = cv.contacto || {};
  const items = [];
  if(c.email)   items.push({key:'email',   value:c.email});
  if(c.phone)   items.push({key:'phone',   value:c.phone});
  if(c.address) items.push({key:'address', value:c.address});
  if(c.website) items.push({key:'website', value:c.website});
  if(!items.length) return '';
  return `
    <div class="cv-section">
      <div class="cv-section-title">Contacto</div>
      <div class="cv-contact-list">
        ${items.map(it=>`<div class="cv-contact-row"><span class="cv-contact-icon">${CV_CONTACT_ICONS[it.key]||''}</span><span class="cv-contact-value">${escapeHTML(it.value)}</span></div>`).join('')}
      </div>
    </div>
  `;
}

function renderCVIdiomasHTML(cv){
  const items = (cv.idiomas||[]).filter(i=>i.name);
  if(!items.length) return '';
  return `
    <div class="cv-section">
      <div class="cv-section-title">Idiomas</div>
      <div class="cv-list-stack">
        ${items.map(i=>`
          <div class="cv-idioma-row">
            <span class="cv-idioma-name">${escapeHTML(i.name)}</span>
            <span class="cv-idioma-level">${escapeHTML(i.level||'')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCVExperienciaHTML(cv){
  const items = (cv.experiencia||[]).filter(e=>e.puesto || e.empresa);
  if(!items.length) return '';
  return `
    <div class="cv-section">
      <div class="cv-section-title">Experiencia profesional</div>
      ${items.map(e=>`
        <div class="cv-exp-item">
          <div class="cv-exp-side">
            ${escapeHTML(e.empresa||'')}
            ${e.periodo ? `<span class="cv-period">${escapeHTML(e.periodo)}</span>` : ''}
          </div>
          <div class="cv-exp-body">
            <div class="cv-exp-title">${escapeHTML(e.puesto||'')}</div>
            ${e.descripcion ? `<div class="cv-exp-desc">${escapeHTML(e.descripcion).replace(/\n/g,'<br>')}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCVEducacionHTML(cv){
  const items = (cv.educacion||[]).filter(e=>e.titulo || e.institucion);
  if(!items.length) return '';
  return `
    <div class="cv-section">
      <div class="cv-section-title">Educación</div>
      ${items.map(e=>`
        <div class="cv-edu-item">
          <div class="cv-edu-side">
            ${escapeHTML(e.institucion||'')}
            ${e.periodo ? `<span class="cv-period">${escapeHTML(e.periodo)}</span>` : ''}
          </div>
          <div class="cv-edu-body">
            <div class="cv-edu-title">${escapeHTML(e.titulo||'')}</div>
            ${e.descripcion ? `<div class="cv-edu-desc">${escapeHTML(e.descripcion).replace(/\n/g,'<br>')}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCVHabilidadesHTML(cv){
  const items = (cv.habilidades||[]).filter(h=>h.nombre);
  if(!items.length) return '';
  return `
    <div class="cv-section">
      <div class="cv-section-title">Habilidades</div>
      <div class="cv-habilidades-grid">
        ${items.map(h=>{
          const pct = Math.min(100, Math.max(0, ((h.nivel||3)/5)*100));
          return `
            <div class="cv-habilidad-item">
              <div class="cv-habilidad-name">${escapeHTML(h.nombre)}</div>
              <div class="cv-habilidad-bar"><div class="cv-habilidad-fill" style="width:${pct}%"></div></div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderCVCertificadosHTML(cv){
  const items = (cv.certificados||[]).filter(c=>c.nombre || c.institucion);
  if(!items.length) return '';
  return `
    <div class="cv-section">
      <div class="cv-section-title">Certificados y Cursos</div>
      ${items.map(c=>`
        <div class="cv-cert-item">
          <div class="cv-cert-side">
            ${escapeHTML(c.institucion||'')}
            ${c.fecha ? `<span class="cv-cert-period">${escapeHTML(c.fecha)}</span>` : ''}
          </div>
          <div>
            <div class="cv-cert-title">${escapeHTML(c.nombre||'')}</div>
            ${c.descripcion ? `<div class="cv-cert-desc">${escapeHTML(c.descripcion).replace(/\n/g,'<br>')}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCVPasatiemposHTML(cv){
  if(!cv.pasatiempos) return '';
  return `
    <div class="cv-section">
      <div class="cv-section-title">Pasatiempos</div>
      <div class="cv-pasatiempos-text">${escapeHTML(cv.pasatiempos).replace(/\n/g,'<br>')}</div>
    </div>
  `;
}

function renderCVReferenciasHTML(cv){
  const items = (cv.referencias||[]).filter(r=>r.nombre || r.empresa || r.contacto);
  if(!items.length) return '';
  return `
    <div class="cv-section">
      <div class="cv-section-title">Referencias</div>
      <div class="cv-referencias-stack">
        ${items.map(r=>`
          <div class="cv-ref-item">
            ${r.nombre ? `<div class="cv-ref-name">${escapeHTML(r.nombre)}</div>` : ''}
            ${r.empresa ? `<div class="cv-ref-meta">${escapeHTML(r.empresa)}</div>` : ''}
            ${r.contacto ? `<div class="cv-ref-meta">${escapeHTML(r.contacto)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderPreview(){
  const doc = $('#preview-doc');
  // Branch CV: a completely different 2-column layout
  if(state.template === 'cv'){
    doc.classList.add('cv-mode');
    renderCVPreview();
    return;
  }
  doc.classList.remove('cv-mode');

  const s = state.settings, q = state.quote;

  // Set CSS vars on doc
  doc.style.setProperty('--c1', s.c1);
  doc.style.setProperty('--c2', s.c2);
  doc.style.setProperty('--c3', s.c3);
  doc.style.setProperty('--c1-text', getContrastText(s.c1));

  const cur = s.currency || '';
  const totals = calcTotals();
  const taxLabel = s.taxLabel || 'IGV';
  const sections = s.sections || {};
  const isGeneral = state.template === 'general';

  const logoHTML = s.logo
    ? `<div class="doc-logo"><img src="${s.logo}" alt="Logo"></div>`
    : `<div class="doc-logo empty">Logo</div>`;

  // ============ DATOS DEL PACIENTE / CLIENTE ============
  let dataSectionHTML = '';
  if(isGeneral){
    const cFields = [
      {label:'Nombre:', value:q.clientNombre, alwaysShow:true},
      {label:'Empresa:', value:q.clientEmpresa, key:'client_empresa'},
      {label:'Teléfono:', value:q.clientTelefono, key:'client_telefono'},
      {label:'Email:', value:q.clientEmail, key:'client_email'},
      {label:'Dirección:', value:q.serviceAddress, key:'service_address', wide:true},
    ].filter(f=>f.alwaysShow || sections[f.key] !== false);
    if(cFields.length){
      const rows = cFields.map(f=>{
        const style = f.wide ? ' style="grid-column:1/-1"' : '';
        return `<div class="pf"${style}><span class="pl">${escapeHTML(f.label)}</span><span class="pv">${escapeHTML(f.value||'—')}</span></div>`;
      }).join('');
      dataSectionHTML = `
        <div class="doc-section first">
          <div class="doc-section-title">DATOS DEL CLIENTE</div>
          <div class="doc-patient">${rows}</div>
        </div>
      `;
    }
  }else{
    const pFields = [
      {label:'Paciente:', value:q.paciente, alwaysShow:true},
      {label:'Clínica:', value:q.clinica, key:'patient_clinica'},
      {label:'Tutor:', value:q.tutor, key:'patient_tutor'},
      {label:'Especie:', value:q.especie, key:'patient_especie'},
      {label:'Sexo:', value:q.sexo, key:'patient_sexo'},
      {label:'Peso:', value:q.peso, key:'patient_peso'},
      {label:'Dirección:', value:q.serviceAddress, key:'service_address', wide:true},
    ].filter(f=>f.alwaysShow || sections[f.key] !== false);
    if(pFields.length){
      const rows = pFields.map(f=>{
        const style = f.wide ? ' style="grid-column:1/-1"' : '';
        return `<div class="pf"${style}><span class="pl">${escapeHTML(f.label)}</span><span class="pv">${escapeHTML(f.value||'—')}</span></div>`;
      }).join('');
      dataSectionHTML = `
        <div class="doc-section first">
          <div class="doc-section-title">DATOS DEL PACIENTE</div>
          <div class="doc-patient">${rows}</div>
        </div>
      `;
    }
  }

  // ============ EXÁMENES / ITEMS ============
  let itemsTableHTML = '';
  if(isGeneral){
    const rows = q.exams.length
      ? q.exams.map(ex=>{
          const sub = getItemSubtotal(ex);
          return `
            <tr>
              <td><div class="exam-name">${escapeHTML(ex.name||'—')}</div></td>
              <td>${ex.qty != null ? escapeHTML(String(ex.qty)) : ''}</td>
              <td>${cur} ${fmt(ex.unitPrice||0)}</td>
              <td>${cur} ${fmt(sub)}</td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="4" style="text-align:center;color:#aaa;padding:24px 12px">Aún no has agregado items</td></tr>`;
    itemsTableHTML = `
      <div class="doc-section">
        <div class="doc-section-title">ITEMS / SERVICIOS</div>
        <table class="doc-table">
          <thead>
            <tr>
              <th>Descripción</th>
              <th style="width:60px">Cant.</th>
              <th style="width:90px">P. Unit.</th>
              <th style="text-align:right;width:100px">Subtotal</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="doc-totals-wrap"><div class="doc-totals">${buildTotalsRows(totals, cur, taxLabel, q)}</div></div>
      </div>
    `;
  }else{
    const rows = q.exams.length
      ? q.exams.map(ex=>`
          <tr>
            <td>
              <div class="exam-name">${escapeHTML(ex.name||'—')}</div>
              ${ex.sample ? `<div class="exam-sub">${escapeHTML(ex.sample)}</div>`:''}
            </td>
            <td>${escapeHTML(ex.time||'')}</td>
            <td>${cur} ${fmt(ex.price||0)}</td>
          </tr>`).join('')
      : `<tr><td colspan="3" style="text-align:center;color:#aaa;padding:24px 12px">Aún no has agregado exámenes</td></tr>`;
    itemsTableHTML = `
      <div class="doc-section">
        <div class="doc-section-title">EXÁMENES SOLICITADOS</div>
        <table class="doc-table">
          <thead>
            <tr>
              <th>Examen</th>
              <th>Tiempo</th>
              <th style="text-align:right">Precio</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="doc-totals-wrap"><div class="doc-totals">${buildTotalsRows(totals, cur, taxLabel, q)}</div></div>
      </div>
    `;
  }

  // ============ INDICACIONES / TÉRMINOS ============
  let indicationsHTML = '';
  if(sections.indications !== false){
    const bullets = q.indications.filter(x=>x.trim()).map(x=>`<li>${escapeHTML(x)}</li>`).join('');
    if(bullets){
      const indTitle = isGeneral ? 'TÉRMINOS Y CONDICIONES' : 'INDICACIONES PREVIAS';
      indicationsHTML = `
        <div class="doc-section">
          <div class="doc-section-title">${indTitle}</div>
          <ul class="doc-bullets">${bullets}</ul>
        </div>
      `;
    }
  }

  // ============ OBSERVACIONES ============
  let observationsHTML = '';
  if(sections.observations !== false && q.observations){
    observationsHTML = `
      <div class="doc-section">
        <div class="doc-section-title">OBSERVACIONES</div>
        <div class="doc-observations">${escapeHTML(q.observations)}</div>
      </div>
    `;
  }

  // ============ FOOTER ============
  const numberHTML = q.number
    ? `<div class="doc-date"><strong>Nº:</strong> ${escapeHTML(q.number)}</div>`
    : '';

  doc.innerHTML = `
    <header class="doc-head">
      ${logoHTML}
      <div class="doc-company">
        <div class="doc-name">${escapeHTML(s.name||'NOMBRE DE LA EMPRESA')}</div>
        <div class="doc-meta">
          ${escapeHTML(s.address||'Dirección de la empresa')}${s.phone?` · Tel: ${escapeHTML(s.phone)}`:''}
        </div>
      </div>
      <div class="doc-titlecol">
        <div class="doc-badge">COTIZACIÓN</div>
        ${numberHTML}
        <div class="doc-date"><strong>Fecha:</strong> ${fmtDate(q.date)}</div>
      </div>
    </header>

    <div class="doc-divider"></div>

    ${dataSectionHTML}
    ${itemsTableHTML}
    ${indicationsHTML}
    ${observationsHTML}

    <footer class="doc-foot">
      ${escapeHTML(s.name||'')}${s.address?` &nbsp;|&nbsp; ${escapeHTML(s.address)}`:''}${s.phone?` &nbsp;|&nbsp; Tel: ${escapeHTML(s.phone)}`:''}
      <br>
      Esta cotización tiene una validez de ${q.validity||30} días a partir de la fecha de emisión.
    </footer>
  `;
}

function buildTotalsRows(totals, cur, taxLabel, q){
  const rows = [];
  rows.push(`<div class="lbl">Subtotal:</div><div class="val">${cur} ${fmt(totals.subtotal)}</div>`);
  if(q.discount.enabled){
    const dLabel = q.discount.type==='percent'
      ? `Descuento (${parseFloat(q.discount.value)||0}%):`
      : `Descuento:`;
    rows.push(`<div class="lbl">${dLabel}</div><div class="val">−${cur} ${fmt(totals.discountAmount)}</div>`);
  }
  if(q.tax.enabled){
    rows.push(`<div class="lbl">${escapeHTML(taxLabel)} (${totals.taxRate}%):</div><div class="val">${cur} ${fmt(totals.taxAmount)}</div>`);
  }
  rows.push(`<div class="lbl row-total">Total:</div><div class="val row-total">${cur} ${fmt(totals.total)}</div>`);
  if(q.paid.enabled){
    rows.push(`<div class="lbl">Pagado:</div><div class="val">−${cur} ${fmt(totals.paidAmount)}</div>`);
    rows.push(`<div class="lbl">Saldo:</div><div class="val">${cur} ${fmt(totals.balance)}</div>`);
  }
  return rows.join('');
}

function renderSectionToggles(){
  const wrap = $('#section-toggles');
  if(!wrap) return;
  const sections = state.settings.sections || {};
  const tmpl = state.template;

  let toggles;
  if(tmpl === 'general'){
    toggles = [
      {key:'client_empresa', label:'Empresa', sub:'Campo en datos del cliente'},
      {key:'client_telefono', label:'Teléfono', sub:'Campo en datos del cliente'},
      {key:'client_email', label:'Email', sub:'Campo en datos del cliente'},
      {key:'service_address', label:'Dirección del servicio', sub:'Lugar/dirección del evento o servicio'},
      {key:'indications', label:'Términos y condiciones', sub:'Sección con lista de bullets'},
      {key:'observations', label:'Observaciones', sub:'Texto libre al final'}
    ];
  }else{
    toggles = [
      {key:'patient_clinica', label:'Clínica', sub:'Campo en datos del paciente'},
      {key:'patient_tutor', label:'Tutor', sub:'Campo en datos del paciente'},
      {key:'patient_especie', label:'Especie', sub:'Campo en datos del paciente'},
      {key:'patient_sexo', label:'Sexo', sub:'Campo en datos del paciente'},
      {key:'patient_peso', label:'Peso', sub:'Campo en datos del paciente'},
      {key:'service_address', label:'Dirección del servicio', sub:'Toma de muestra a domicilio, etc.'},
      {key:'indications', label:'Indicaciones previas', sub:'Sección con lista de bullets'},
      {key:'observations', label:'Observaciones', sub:'Texto libre al final'}
    ];
  }

  wrap.innerHTML = toggles.map(t=>{
    const on = sections[t.key] !== false;
    return `
      <div class="toggle-row">
        <div>
          <div class="toggle-label">${escapeHTML(t.label)}</div>
          <div class="toggle-sub">${escapeHTML(t.sub)}</div>
        </div>
        <button class="toggle-switch ${on?'on':''}" data-toggle-key="${escapeHTML(t.key)}" type="button" aria-pressed="${on}"></button>
      </div>
    `;
  }).join('');

  // Wire toggles
  wrap.querySelectorAll('.toggle-switch').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.dataset.toggleKey;
      const cur = sections[key] !== false;
      sections[key] = !cur;
      btn.classList.toggle('on', !cur);
      btn.setAttribute('aria-pressed', String(!cur));
    });
  });
}

function renderCVSectionToggles(){
  const wrap = $('#cv-section-toggles');
  if(!wrap) return;
  const sections = state.settings.sections || (state.settings.sections = {});
  const toggles = [
    {key:'cv_certificados', label:'Certificados y Cursos', sub:'Sección con lista de certificados (área principal)'},
    {key:'cv_pasatiempos',  label:'Pasatiempos',           sub:'Texto libre con tus intereses (área principal)'},
    {key:'cv_referencias',  label:'Referencias',           sub:'Contactos profesionales (sidebar)'}
  ];

  wrap.innerHTML = toggles.map(t=>{
    const on = sections[t.key] === true;
    return `
      <div class="toggle-row">
        <div>
          <div class="toggle-label">${escapeHTML(t.label)}</div>
          <div class="toggle-sub">${escapeHTML(t.sub)}</div>
        </div>
        <button class="toggle-switch ${on?'on':''}" data-toggle-key="${escapeHTML(t.key)}" type="button" aria-pressed="${on}"></button>
      </div>
    `;
  }).join('');

  wrap.querySelectorAll('.toggle-switch').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.dataset.toggleKey;
      const cur = sections[key] === true;
      sections[key] = !cur;
      btn.classList.toggle('on', !cur);
      btn.setAttribute('aria-pressed', String(!cur));
    });
  });
}

function updateCVHabPosControl(){
  const cur = state.settings.cvHabilidadesPos || 'main';
  $$('#cv-hab-pos-control .seg-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.pos === cur);
  });
}

/* =============================================================
   SETTINGS MODAL
============================================================= */
function openSettings(){
  const s = state.settings;
  const cv = state.cv;
  // Lab/General fields (always populated; hidden by data-tmpl-only when not relevant)
  $('#s-name').value = s.name;
  $('#s-address').value = s.address;
  $('#s-phone').value = s.phone;
  $('#s-currency').value = s.currency;
  $('#s-c1').value = s.c1; $('#s-c1-hex').textContent = s.c1.toUpperCase();
  $('#s-c2').value = s.c2; $('#s-c2-hex').textContent = s.c2.toUpperCase();
  $('#s-c3').value = s.c3; $('#s-c3-hex').textContent = s.c3.toUpperCase();
  $('#s-tax-rate').value = s.taxRate;
  $('#s-tax-label').value = s.taxLabel;
  $('#s-ind').value = s.indDefaults;
  $('#s-obs').value = s.obsDefaults;
  updateLogoPreview();
  renderSectionToggles();

  // CV fields (populated regardless; hidden by data-tmpl-only when not in CV mode)
  $('#s-cv-side-bg').value = s.cvSideBg;   $('#s-cv-side-bg-hex').textContent   = s.cvSideBg.toUpperCase();
  $('#s-cv-side-text').value = s.cvSideText; $('#s-cv-side-text-hex').textContent = s.cvSideText.toUpperCase();
  $('#s-cv-main-bg').value = s.cvMainBg;    $('#s-cv-main-bg-hex').textContent   = s.cvMainBg.toUpperCase();
  $('#s-cv-main-text').value = s.cvMainText; $('#s-cv-main-text-hex').textContent = s.cvMainText.toUpperCase();
  $('#s-cv-title').value = s.cvTitleColor;   $('#s-cv-title-hex').textContent     = s.cvTitleColor.toUpperCase();
  updateCVPhotoPreview();
  updateCVShapeSelector();
  renderCVSectionToggles();
  updateCVHabPosControl();

  $('#settings-modal').classList.add('open');
}
function closeSettings(){
  $('#settings-modal').classList.remove('open');
}

function updateLogoPreview(){
  const p = $('#logo-preview');
  if(state.settings.logo){
    p.classList.add('has-logo');
    p.innerHTML = `<img src="${state.settings.logo}" alt="Logo">`;
  }else{
    p.classList.remove('has-logo');
    p.innerHTML = '<span class="ph">Logo</span>';
  }
}

function updateCVPhotoPreview(){
  const p = $('#cv-photo-preview');
  if(!p) return;
  // remove previous shape classes
  p.classList.remove('shape-circle','shape-rounded','shape-rectangle');
  const shape = state.cv.photoShape || 'circle';
  p.classList.add('shape-'+shape);
  if(state.cv.photoData){
    p.classList.add('has-logo');
    p.innerHTML = `<img src="${state.cv.photoData}" alt="Foto">`;
  }else{
    p.classList.remove('has-logo');
    p.innerHTML = '<span class="ph">Foto</span>';
  }
}

function updateCVShapeSelector(){
  const cur = state.cv.photoShape || 'circle';
  $$('#cv-shape-selector .shape-opt').forEach(b=>{
    b.classList.toggle('active', b.dataset.shape === cur);
  });
  // also update photo preview shape
  updateCVPhotoPreview();
}

function renderPresets(){
  const wrap = $('#presets');
  wrap.innerHTML = '';
  PRESETS.forEach(p=>{
    const b = document.createElement('button');
    b.className = 'preset';
    b.innerHTML = `
      <div class="preset-bars">
        <span style="background:${p.c1}"></span>
        <span style="background:${p.c2}"></span>
        <span style="background:${p.c3}"></span>
      </div>
      <span class="preset-name">${p.name}</span>
    `;
    b.addEventListener('click', ()=>{
      $('#s-c1').value = p.c1; $('#s-c1-hex').textContent = p.c1.toUpperCase();
      $('#s-c2').value = p.c2; $('#s-c2-hex').textContent = p.c2.toUpperCase();
      $('#s-c3').value = p.c3; $('#s-c3-hex').textContent = p.c3.toUpperCase();
    });
    wrap.appendChild(b);
  });
}

function renderCVPresets(){
  const wrap = $('#cv-presets');
  if(!wrap) return;
  wrap.innerHTML = '';
  CV_PRESETS.forEach(p=>{
    const b = document.createElement('button');
    b.className = 'preset';
    b.innerHTML = `
      <div class="preset-bars">
        <span style="background:${p.sideBg}"></span>
        <span style="background:${p.title}"></span>
        <span style="background:${p.mainBg};border:1px solid var(--line)"></span>
      </div>
      <span class="preset-name">${p.name}</span>
    `;
    b.addEventListener('click', ()=>{
      $('#s-cv-side-bg').value   = p.sideBg;   $('#s-cv-side-bg-hex').textContent   = p.sideBg.toUpperCase();
      $('#s-cv-side-text').value = p.sideText; $('#s-cv-side-text-hex').textContent = p.sideText.toUpperCase();
      $('#s-cv-main-bg').value   = p.mainBg;   $('#s-cv-main-bg-hex').textContent   = p.mainBg.toUpperCase();
      $('#s-cv-main-text').value = p.mainText; $('#s-cv-main-text-hex').textContent = p.mainText.toUpperCase();
      $('#s-cv-title').value     = p.title;    $('#s-cv-title-hex').textContent     = p.title.toUpperCase();
    });
    wrap.appendChild(b);
  });
}

/* =============================================================
   PDF DOWNLOAD
============================================================= */
async function downloadPDF(){
  const btn = $('#download-pdf');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span><span class="btn-text">Generando…</span>`;

  let clone = null;
  try{
    // Verify libraries loaded
    if(typeof html2canvas !== 'function'){
      throw new Error('html2canvas no cargó (revisa internet)');
    }
    if(!window.jspdf || !window.jspdf.jsPDF){
      throw new Error('jsPDF no cargó (revisa internet)');
    }

    // Wait for fonts to settle so html2canvas captures them
    if(document.fonts && document.fonts.ready){
      try{ await document.fonts.ready; }catch(_){}
    }

    const node = $('#preview-doc');
    if(!node) throw new Error('No se encontró la vista previa');

    // Create a hidden off-screen clone with forced desktop A4 styling.
    // This guarantees the PDF always renders at full desktop size with desktop
    // fonts/padding, regardless of the actual viewport (mobile media queries
    // would otherwise affect font-size, padding, etc).
    clone = node.cloneNode(true);
    clone.id = '';
    clone.classList.add('doc-pdf-mode');
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    document.body.appendChild(clone);

    // Two RAFs to let layout settle after DOM insertion
    await new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r)));

    let canvas;
    try{
      canvas = await html2canvas(clone, {
        scale:2,
        useCORS:true,
        backgroundColor:'#ffffff',
        logging:false,
        windowWidth: 1280,
      });
    }catch(hcErr){
      throw new Error('html2canvas: ' + (hcErr && hcErr.message ? hcErr.message : 'falló render'));
    }

    if(!canvas) throw new Error('No se generó el canvas');

    let imgData;
    try{
      imgData = canvas.toDataURL('image/jpeg', 0.95);
    }catch(tdErr){
      throw new Error('toDataURL: ' + (tdErr && tdErr.message ? tdErr.message : 'canvas tainted'));
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p','mm','a4');
    const pdfWidth = 210;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const pageHeight = 297;

    let position = 0;
    let heightLeft = pdfHeight;
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while(heightLeft > 0){
      position = position - pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    const customerName = state.template === 'cv'
      ? state.cv.name
      : (state.template === 'general' ? state.quote.clientNombre : state.quote.paciente);
    const cleaned = (customerName || '').trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    const safe = cleaned || 'noname';
    const docType = state.template === 'cv' ? 'cv' : 'cotizacion';
    const fname = `${docType}-${safe}-${new Date().toISOString().slice(0,10)}.pdf`;
    pdf.save(fname);
    showToast('PDF descargado');
  }catch(e){
    console.error('PDF generation failed:', e);
    const msg = (e && e.message) ? e.message : (typeof e === 'string' ? e : 'desconocido');
    showToast('Error: ' + msg.slice(0, 80), true);
  }finally{
    if(clone && clone.parentNode){
      clone.parentNode.removeChild(clone);
    }
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/* =============================================================
   EVENT WIRING
============================================================= */
function wire(){
  // Auto-save the quote (debounced) on any input/change in the form panel,
  // so progress is preserved across template switches and reloads.
  const formPanel = document.querySelector('.form-panel');
  if(formPanel){
    formPanel.addEventListener('input', autoSaveQuote);
    formPanel.addEventListener('change', autoSaveQuote);
  }

  // form quote inputs
  const qBind = [
    ['#f-number','number'],
    ['#f-date','date'],['#f-validity','validity'],
    ['#p-paciente','paciente'],['#p-clinica','clinica'],
    ['#p-tutor','tutor'],['#p-especie','especie'],
    ['#p-sexo','sexo'],['#p-peso','peso'],
    ['#c-nombre','clientNombre'],
    ['#c-empresa','clientEmpresa'],
    ['#c-telefono','clientTelefono'],
    ['#c-email','clientEmail'],
    ['#p-service-address','serviceAddress'],
    ['#c-service-address','serviceAddress'],
    ['#obs','observations']
  ];
  qBind.forEach(([sel,key])=>{
    $(sel).addEventListener('input', e=>{
      let v = e.target.value;
      if(key==='validity') v = parseInt(v,10) || 0;
      state.quote[key] = v;
      renderPreview();
    });
  });

  // add buttons
  $('#add-exam').addEventListener('click', ()=>{
    if(state.template === 'general'){
      state.quote.exams.push({name:'', qty:1, unitPrice:0});
    }else{
      state.quote.exams.push({name:'', time:'', sample:'', price:0});
    }
    renderExams(); renderPreview();
  });
  $('#add-ind').addEventListener('click', ()=>{
    state.quote.indications.push('');
    renderIndications(); renderPreview();
  });

  // ========== CV form bindings ==========
  // Simple fields
  const cvSimpleBind = [
    ['#cv-name','name'],
    ['#cv-role','role'],
    ['#cv-perfil','perfil']
  ];
  cvSimpleBind.forEach(([sel,key])=>{
    const el = $(sel);
    if(el){
      el.addEventListener('input', e=>{
        state.cv[key] = e.target.value;
        renderPreview();
      });
    }
  });
  // Contact fields (nested)
  const cvContactBind = [
    ['#cv-email','email'],
    ['#cv-phone','phone'],
    ['#cv-address','address'],
    ['#cv-website','website']
  ];
  cvContactBind.forEach(([sel,key])=>{
    const el = $(sel);
    if(el){
      el.addEventListener('input', e=>{
        state.cv.contacto[key] = e.target.value;
        renderPreview();
      });
    }
  });
  // Add buttons
  $('#cv-add-idioma').addEventListener('click', ()=>{
    state.cv.idiomas.push({name:'', level:''});
    renderCVIdiomas(); renderPreview();
  });
  $('#cv-add-experiencia').addEventListener('click', ()=>{
    state.cv.experiencia.push({puesto:'', empresa:'', periodo:'', descripcion:''});
    renderCVExperiencia(); renderPreview();
  });
  $('#cv-add-educacion').addEventListener('click', ()=>{
    state.cv.educacion.push({titulo:'', institucion:'', periodo:'', descripcion:''});
    renderCVEducacion(); renderPreview();
  });
  $('#cv-add-habilidad').addEventListener('click', ()=>{
    state.cv.habilidades.push({nombre:'', nivel:3});
    renderCVHabilidades(); renderPreview();
  });
  $('#cv-add-certificado').addEventListener('click', ()=>{
    state.cv.certificados.push({nombre:'', institucion:'', fecha:'', descripcion:''});
    renderCVCertificados(); renderPreview();
  });
  $('#cv-add-referencia').addEventListener('click', ()=>{
    state.cv.referencias.push({nombre:'', empresa:'', contacto:''});
    renderCVReferencias(); renderPreview();
  });

  // CV pasatiempos textarea
  const pasaInput = $('#cv-pasatiempos');
  if(pasaInput){
    pasaInput.addEventListener('input', e=>{
      state.cv.pasatiempos = e.target.value;
      renderPreview();
    });
  }

  // CV habilidades position selector (segmented control)
  $$('#cv-hab-pos-control .seg-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.settings.cvHabilidadesPos = b.dataset.pos;
      updateCVHabPosControl();
    });
  });

  // download
  $('#download-pdf').addEventListener('click', downloadPDF);

  // settings open / close
  $('#open-settings').addEventListener('click', openSettings);
  $('#close-settings').addEventListener('click', closeSettings);
  $('#cancel-settings').addEventListener('click', closeSettings);
  $('#settings-modal').addEventListener('click', e=>{
    if(e.target.id==='settings-modal') closeSettings();
  });

  // logo upload
  $('#logo-btn').addEventListener('click', ()=>$('#logo-input').click());
  $('#logo-input').addEventListener('change', e=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ev => {
      state.settings.logo = ev.target.result;
      updateLogoPreview();
    };
    r.readAsDataURL(f);
  });
  $('#logo-remove').addEventListener('click', ()=>{
    state.settings.logo = '';
    updateLogoPreview();
  });

  // CV photo upload
  $('#cv-photo-btn').addEventListener('click', ()=>$('#cv-photo-input').click());
  $('#cv-photo-input').addEventListener('change', e=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ev => {
      state.cv.photoData = ev.target.result;
      updateCVPhotoPreview();
    };
    r.readAsDataURL(f);
  });
  $('#cv-photo-remove').addEventListener('click', ()=>{
    state.cv.photoData = '';
    updateCVPhotoPreview();
  });

  // CV shape selector
  $$('#cv-shape-selector .shape-opt').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.cv.photoShape = b.dataset.shape;
      updateCVShapeSelector();
    });
  });

  // color picker live hex display
  ['c1','c2','c3'].forEach(k=>{
    $('#s-'+k).addEventListener('input', e=>{
      $('#s-'+k+'-hex').textContent = e.target.value.toUpperCase();
    });
  });
  // CV color pickers live hex display
  ['cv-side-bg','cv-side-text','cv-main-bg','cv-main-text','cv-title'].forEach(k=>{
    const el = $('#s-'+k);
    if(el){
      el.addEventListener('input', e=>{
        $('#s-'+k+'-hex').textContent = e.target.value.toUpperCase();
      });
    }
  });

  // save settings
  $('#save-settings').addEventListener('click', async ()=>{
    // Lab/General settings
    state.settings.name = $('#s-name').value.trim();
    state.settings.address = $('#s-address').value.trim();
    state.settings.phone = $('#s-phone').value.trim();
    state.settings.currency = $('#s-currency').value;
    state.settings.c1 = $('#s-c1').value;
    state.settings.c2 = $('#s-c2').value;
    state.settings.c3 = $('#s-c3').value;
    state.settings.taxRate = parseFloat($('#s-tax-rate').value) || 18;
    state.settings.taxLabel = ($('#s-tax-label').value || 'IGV').trim();
    state.settings.indDefaults = $('#s-ind').value;
    state.settings.obsDefaults = $('#s-obs').value;
    // CV settings
    state.settings.cvSideBg    = $('#s-cv-side-bg').value;
    state.settings.cvSideText  = $('#s-cv-side-text').value;
    state.settings.cvMainBg    = $('#s-cv-main-bg').value;
    state.settings.cvMainText  = $('#s-cv-main-text').value;
    state.settings.cvTitleColor= $('#s-cv-title').value;
    // cvHabilidadesPos already kept in state via seg-btn click; ensure it has a value
    if(!state.settings.cvHabilidadesPos) state.settings.cvHabilidadesPos = 'main';
    // sections were updated in-place by toggle clicks; nothing more needed
    await saveSettings();
    // CV photo/shape live in state.cv → persist via persistQuote when in CV
    if(state.template === 'cv'){ await persistQuote(); }
    applySectionVisibility();
    renderPreview();
    renderCatalog();
    renderTotalsControls();
    renderExams(); // re-render so subtotals etc reflect any changes
    closeSettings();
    showToast('Configuración guardada');
  });

  // mobile tabs
  $$('.mobile-tabs button').forEach(b=>{
    b.addEventListener('click', ()=>{
      const t = b.dataset.tab;
      $$('.mobile-tabs button').forEach(x=>x.classList.toggle('active', x===b));
      $$('[data-tab-panel]').forEach(p=>p.classList.toggle('active', p.dataset.tabPanel===t));
    });
  });

  // ========== AUTH WIRING ==========
  // Login: create account
  $('#create-account-btn').addEventListener('click', ()=>{
    createAccount($('#new-account-name').value, $('#new-account-pwd').value);
  });
  $('#new-account-name').addEventListener('keydown', e=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      $('#new-account-pwd').focus();
    }
  });
  $('#new-account-pwd').addEventListener('keydown', e=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      createAccount($('#new-account-name').value, $('#new-account-pwd').value);
    }
  });

  // Password prompt submit
  $('#login-submit-btn').addEventListener('click', ()=>{ attemptLogin(); });
  $('#login-password').addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ e.preventDefault(); attemptLogin(); }
  });
  $('#login-password').addEventListener('input', ()=>{
    $('#login-error').classList.remove('show');
    $('#login-password').classList.remove('error');
  });

  // Back to account list from password prompt
  $('#back-to-list').addEventListener('click', ()=>{
    showLoginStateList();
  });

  // Doctype selector: Cotización → template selector (Lab/General).
  // CV → directly into the CV editor (no sub-template).
  $$('#doctype-overlay .template-card').forEach(card=>{
    card.addEventListener('click', async ()=>{
      if(card.classList.contains('disabled')) return;
      const doctype = card.dataset.doctype;
      if(doctype === 'cotizacion'){
        showTemplateSelector();
      }else if(doctype === 'cv'){
        await selectTemplate('cv');
      }
    });
  });

  // Logout from doctype selector (back to login)
  $('#logout-from-doctype').addEventListener('click', async ()=>{
    state.account = null;
    state.accountName = '';
    state.template = null;
    await clearSessionStorage();
    showLogin();
  });

  // Template selector: pick a template
  $$('#template-overlay .template-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      if(card.classList.contains('disabled')) return;
      selectTemplate(card.dataset.template);
    });
  });

  // Back button in template selector → go to doctype selector
  $('#template-back').addEventListener('click', ()=>{
    showDocTypeSelector();
  });

  // Logout from template selector (back to login screen)
  $('#logout-from-template').addEventListener('click', async ()=>{
    state.account = null;
    state.accountName = '';
    state.template = null;
    await clearSessionStorage();
    showLogin();
  });

  // Session pill in header → back to selector.
  // In CV mode: back to doctype (since CV has no sub-template).
  // In Lab/General: back to template selector.
  // Persists current data first so it can be restored on return.
  $('#session-pill').addEventListener('click', async ()=>{
    if(!state.account) return;
    await persistQuote();
    if(state.template === 'cv'){
      showDocTypeSelector();
    }else{
      showTemplateSelector();
    }
  });

  // Logout button at the bottom of Configuración
  $('#logout-btn').addEventListener('click', async ()=>{
    if(!confirm('¿Cerrar sesión? Tus datos guardados se mantienen.')) return;
    await logout();
  });
}

/* =============================================================
   PASSWORD HASHING (SHA-256 + salt, vía Web Crypto)
============================================================= */
function newSalt(){
  const arr = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...arr));
}
async function hashPwd(pwd, saltB64){
  const enc = new TextEncoder();
  const data = enc.encode(String(pwd) + '|' + String(saltB64));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/* =============================================================
   AUTH UI FLOW
============================================================= */
function showLogin(){
  $('#login-overlay').classList.add('active');
  $('#doctype-overlay').classList.remove('active');
  $('#template-overlay').classList.remove('active');
  showLoginStateList();
  const inp = $('#new-account-name');
  if(inp){ inp.value = ''; }
  const pwdInp = $('#new-account-pwd');
  if(pwdInp){ pwdInp.value = ''; }
  renderAccountsList();
  setTimeout(()=>{ try{ $('#new-account-name').focus(); }catch(e){} }, 80);
}

function showLoginStateList(){
  $('#login-state-list').style.display = '';
  $('#login-state-password').style.display = 'none';
}

function showPasswordPrompt(acc){
  $('#login-state-list').style.display = 'none';
  $('#login-state-password').style.display = 'block';
  $('#pwd-prompt-name').textContent = acc.name;
  $('#pwd-prompt-avatar').textContent = (acc.name||'C').trim().slice(0,1).toUpperCase();
  const meta = acc.lastTemplate
    ? 'Última: ' + (acc.lastTemplate==='lab' ? 'Lab' : 'General')
    : 'Cuenta';
  $('#pwd-prompt-meta').textContent = meta;
  $('#login-error').classList.remove('show');
  const pwd = $('#login-password');
  pwd.value = '';
  pwd.classList.remove('error');
  pwd.dataset.slug = acc.slug;
  setTimeout(()=>{ try{ pwd.focus(); }catch(e){} }, 80);
}

async function attemptLogin(){
  const pwdInput = $('#login-password');
  const slugVal = pwdInput.dataset.slug;
  const pwd = pwdInput.value;
  const acc = state.accounts.find(a=>a.slug===slugVal);
  if(!acc) return;

  // Legacy account without hash → just enter
  if(!acc.hash){
    await doLogin(acc);
    return;
  }
  if(!pwd){
    showLoginError('Ingresa la contraseña');
    return;
  }
  const tryHash = await hashPwd(pwd, acc.salt);
  if(tryHash !== acc.hash){
    showLoginError('Contraseña incorrecta');
    return;
  }
  await doLogin(acc);
}

function showLoginError(msg){
  const err = $('#login-error');
  err.textContent = msg;
  err.classList.add('show');
  const pwd = $('#login-password');
  pwd.classList.add('error');
  const card = pwd.closest('.auth-card');
  if(card){
    card.classList.remove('auth-shake');
    void card.offsetWidth; // restart animation
    card.classList.add('auth-shake');
  }
}

function renderAccountsList(){
  const el = $('#account-list');
  const divider = $('#auth-divider');
  if(!el) return;
  if(!state.accounts.length){
    el.style.display = 'none';
    if(divider){
      divider.innerHTML = '<span>crea tu primera cuenta</span>';
    }
    return;
  }
  el.style.display = 'flex';
  if(divider){
    divider.innerHTML = '<span>nueva cuenta</span>';
  }
  el.innerHTML = state.accounts.map(a=>{
    const initial = (a.name||'C').trim().slice(0,1).toUpperCase();
    const meta = a.lastTemplate
      ? 'Última: ' + (a.lastTemplate==='lab' ? 'Lab' : 'General')
      : 'Cuenta nueva';
    return `
      <div class="account-row" data-slug="${escapeHTML(a.slug)}">
        <div class="acc-avatar">${escapeHTML(initial)}</div>
        <div class="acc-info">
          <div class="acc-name">${escapeHTML(a.name)}</div>
          <div class="acc-meta">${escapeHTML(meta)}</div>
        </div>
        <button class="acc-del" data-slug="${escapeHTML(a.slug)}" title="Eliminar cuenta y datos">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.account-row').forEach(row=>{
    row.addEventListener('click', e=>{
      if(e.target.closest('.acc-del')) return;
      const sl = row.dataset.slug;
      const acc = state.accounts.find(a=>a.slug===sl);
      if(!acc) return;
      if(!acc.hash){
        // Legacy account (sin contraseña)
        doLogin(acc);
      }else{
        showPasswordPrompt(acc);
      }
    });
  });
  el.querySelectorAll('.acc-del').forEach(btn=>{
    btn.addEventListener('click', async e=>{
      e.stopPropagation();
      const sl = btn.dataset.slug;
      const acc = state.accounts.find(a=>a.slug===sl);
      if(!acc) return;
      if(!confirm(`¿Eliminar la cuenta "${acc.name}" y todos sus datos guardados?`)) return;
      await deleteAccount(sl);
    });
  });
}

async function doLogin(acc){
  state.account = acc.slug;
  state.accountName = acc.name;
  if(acc.lastTemplate){
    await selectTemplate(acc.lastTemplate);
  }else{
    showDocTypeSelector();
  }
}

async function createAccount(name, password){
  const trimmed = String(name||'').trim();
  if(!trimmed){ showToast('Pon un nombre para tu cuenta', true); return; }
  if(trimmed.length > 32){ showToast('Máximo 32 caracteres', true); return; }
  const pwd = String(password||'');
  if(pwd.length < 4){ showToast('La contraseña debe tener al menos 4 caracteres', true); return; }
  const accSlug = slug(trimmed);
  if(state.accounts.find(a=>a.slug===accSlug)){
    showToast('Ya existe una cuenta con ese nombre', true); return;
  }
  const salt = newSalt();
  const hash = await hashPwd(pwd, salt);
  const acc = {slug:accSlug, name:trimmed, salt, hash, lastTemplate:null, updated:Date.now()};
  state.accounts.push(acc);
  await saveAccounts();
  await doLogin(acc);
}

async function deleteAccount(accSlug){
  state.accounts = state.accounts.filter(a=>a.slug!==accSlug);
  await saveAccounts();
  // Remove their data keys (best effort)
  if(hasLocalStorage){
    try{
      const toRemove = [];
      for(let i=0;i<window.localStorage.length;i++){
        const k = window.localStorage.key(i);
        if(k && k.startsWith(STORAGE_PREFIX + 'acc:' + accSlug + ':')) toRemove.push(k);
      }
      toRemove.forEach(k=>window.localStorage.removeItem(k));
    }catch(e){}
  }
  renderAccountsList();
}

function showDocTypeSelector(){
  $('#login-overlay').classList.remove('active');
  $('#template-overlay').classList.remove('active');
  $('#doctype-overlay').classList.add('active');
  $('#doctype-greeting-name').textContent = state.accountName;
}

function showTemplateSelector(){
  $('#login-overlay').classList.remove('active');
  $('#doctype-overlay').classList.remove('active');
  $('#template-overlay').classList.add('active');
  $('#greeting-name').textContent = state.accountName;
}

async function selectTemplate(tmpl){
  if(tmpl !== 'lab' && tmpl !== 'general' && tmpl !== 'cv'){ return; }
  state.template = tmpl;
  const acc = state.accounts.find(a=>a.slug===state.account);
  if(acc){
    acc.lastTemplate = tmpl;
    acc.updated = Date.now();
    await saveAccounts();
  }
  await saveSession();

  $('#login-overlay').classList.remove('active');
  $('#doctype-overlay').classList.remove('active');
  $('#template-overlay').classList.remove('active');

  await loadDataForSession();
  applyTemplateUI();
  fillFormFromState();
  renderPresets();
  renderCVPresets();
  renderPreview();
  updateSessionPill();
}

function applyTemplateUI(){
  const tmpl = state.template;
  // Show/hide form sections by template (form-only attribute, not the template cards in the selector)
  document.querySelectorAll('[data-tmpl-only]').forEach(el=>{
    const allowed = el.dataset.tmplOnly.split(/\s+/).filter(Boolean);
    el.style.display = allowed.includes(tmpl) ? '' : 'none';
  });
  // Update header brand suffix
  const brandTag = $('#brand-tmpl-tag');
  if(brandTag){
    brandTag.textContent = tmpl === 'general' ? '· General' : (tmpl === 'lab' ? '· Lab' : (tmpl === 'cv' ? '· CV' : ''));
  }
  // Update dynamic titles & button labels
  const itemsTitle = $('#items-title');
  const itemsLabel = $('#add-item-label');
  const indTitle = $('#indications-title');
  if(tmpl === 'general'){
    if(itemsTitle) itemsTitle.textContent = 'Items / Servicios';
    if(itemsLabel) itemsLabel.textContent = 'Agregar item';
    if(indTitle) indTitle.textContent = 'Términos y condiciones';
  }else{
    if(itemsTitle) itemsTitle.textContent = 'Exámenes solicitados';
    if(itemsLabel) itemsLabel.textContent = 'Agregar examen';
    if(indTitle) indTitle.textContent = 'Indicaciones previas';
  }
  // Apply per-section visibility based on toggles
  applySectionVisibility();
}

function applySectionVisibility(){
  const sections = state.settings.sections || {};
  document.querySelectorAll('[data-section]').forEach(el=>{
    // Respect data-tmpl-only first: don't show sections that don't belong to the current template
    const tmplOnly = el.dataset.tmplOnly;
    if(tmplOnly){
      const allowed = tmplOnly.split(/\s+/).filter(Boolean);
      if(!allowed.includes(state.template)){
        el.style.display = 'none';
        return;
      }
    }
    const key = el.dataset.section;
    const enabled = sections[key] !== false;
    el.style.display = enabled ? '' : 'none';
  });
}

function updateSessionPill(){
  const pill = $('#session-pill');
  if(!pill) return;
  if(!state.account){
    pill.classList.remove('show');
    return;
  }
  const tmplName = state.template === 'lab' ? 'Lab' : (state.template === 'general' ? 'General' : (state.template === 'cv' ? 'CV' : ''));
  pill.innerHTML = `
    <span class="sp-text">${escapeHTML(state.accountName)}</span>
    <span class="sp-sep">·</span>
    <span class="sp-text">${tmplName}</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
  `;
  pill.classList.add('show');
}

async function logout(){
  await clearSessionStorage();
  state.account = null;
  state.accountName = '';
  state.template = null;
  state.settings = {...DEFAULTS.settings};
  state.catalog = [];
  $('#session-pill').classList.remove('show');
  closeSettings();
  showLogin();
}

/* =============================================================
   INIT
============================================================= */
async function init(){
  await loadAccounts();
  wire();
  setupPreviewScale();
  setupLayoutMetrics();

  const session = await loadSession();
  if(session && session.account && session.template){
    state.account = session.account;
    state.accountName = session.accountName || session.account;
    state.template = session.template;
    await loadDataForSession();
    applyTemplateUI();
    fillFormFromState();
    renderPresets();
    renderCVPresets();
    renderPreview();
    updateSessionPill();
  }else{
    renderPreview(); // empty doc behind the overlay
    showLogin();
  }
}

/* Mobile preview scaling: render the desktop A4 (.doc 794x1123) and scale it
   down to fit the available width via CSS transform, instead of going fluid.
   This keeps the preview pixel-accurate to what the PDF will look like. */
function updatePreviewScale(){
  const scaler = document.querySelector('.preview-scaler');
  if(!scaler) return;
  if(window.matchMedia('(max-width: 1023px)').matches){
    const w = scaler.clientWidth;
    if(w === 0) return;            // hidden (preview tab not active) — wait for visibility
    const scale = Math.min(1, w / 794);  // never upscale
    scaler.style.setProperty('--preview-scale', scale);
    scaler.style.height = (1123 * scale) + 'px';
  }else{
    scaler.style.removeProperty('--preview-scale');
    scaler.style.height = '';
  }
}

function setupPreviewScale(){
  const scaler = document.querySelector('.preview-scaler');
  if(!scaler) return;
  if(typeof ResizeObserver !== 'undefined'){
    new ResizeObserver(()=>updatePreviewScale()).observe(scaler);
  }
  window.addEventListener('resize', updatePreviewScale);
  // Also fire when the preview tab becomes active (visibility change)
  const previewBtn = document.querySelector('.mobile-tabs button[data-tab="preview"]');
  if(previewBtn){
    previewBtn.addEventListener('click', ()=>setTimeout(updatePreviewScale, 0));
  }
  updatePreviewScale();
}

/* Measure the real heights of the fixed header and mobile tabs, exposing them
   as CSS variables. This keeps the modal panel, tabs, and body padding aligned
   regardless of safe-area insets — which differ between Safari and an installed
   standalone PWA (where there's no browser URL bar). */
function updateLayoutMetrics(){
  const header = document.querySelector('.app-header');
  const tabs = document.querySelector('.mobile-tabs');
  if(header){
    document.documentElement.style.setProperty('--app-header-h', header.offsetHeight + 'px');
  }
  if(tabs){
    const t = tabs.offsetHeight;       // 0 when display:none (desktop)
    if(t > 0) document.documentElement.style.setProperty('--mobile-tabs-h', t + 'px');
  }
}

function setupLayoutMetrics(){
  updateLayoutMetrics();
  if(typeof ResizeObserver !== 'undefined'){
    const ro = new ResizeObserver(()=>updateLayoutMetrics());
    const header = document.querySelector('.app-header');
    const tabs = document.querySelector('.mobile-tabs');
    if(header) ro.observe(header);
    if(tabs) ro.observe(tabs);
  }
  window.addEventListener('resize', updateLayoutMetrics);
  window.addEventListener('orientationchange', ()=>setTimeout(updateLayoutMetrics, 120));
}

/* Service worker registration — enables offline shell and "installable" PWA.
   Registered after load so it never blocks the initial render. */
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

init();
