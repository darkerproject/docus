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
    sections:{}  // populated per template on load
  },
  catalog:[]
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
  const tmplDefaults = state.template === 'general' ? DEFAULT_SECTIONS_GENERAL : DEFAULT_SECTIONS_LAB;
  state.settings.sections = {...tmplDefaults, ...(loaded.sections || {})};

  const cRaw = await storageGet(dataKey('catalog'));
  try{ state.catalog = cRaw ? JSON.parse(cRaw) : []; }
  catch(e){ state.catalog = []; }

  // Reset quote with defaults from settings
  state.quote = {
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
function renderPreview(){
  const s = state.settings, q = state.quote;
  const doc = $('#preview-doc');

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

/* =============================================================
   SETTINGS MODAL
============================================================= */
function openSettings(){
  const s = state.settings;
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

    const customerName = state.template === 'general'
      ? state.quote.clientNombre
      : state.quote.paciente;
    const cleaned = (customerName || '').trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    const safe = cleaned || 'noname';
    const fname = `cotizacion-${safe}-${state.quote.date}.pdf`;
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

  // color picker live hex display
  ['c1','c2','c3'].forEach(k=>{
    $('#s-'+k).addEventListener('input', e=>{
      $('#s-'+k+'-hex').textContent = e.target.value.toUpperCase();
    });
  });

  // save settings
  $('#save-settings').addEventListener('click', async ()=>{
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
    // sections were updated in-place by toggle clicks; nothing more needed
    await saveSettings();
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

  // Doctype selector: Cotización goes to template selector; CV is disabled
  $$('#doctype-overlay .template-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      if(card.classList.contains('disabled')) return;
      const doctype = card.dataset.doctype;
      if(doctype === 'cotizacion'){
        showTemplateSelector();
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

  // Logout from template selector (back to login screen)
  $('#logout-from-template').addEventListener('click', async ()=>{
    state.account = null;
    state.accountName = '';
    state.template = null;
    await clearSessionStorage();
    showLogin();
  });

  // Session pill in header → back to template selector
  $('#session-pill').addEventListener('click', ()=>{
    if(!state.account) return;
    showTemplateSelector();
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
  if(tmpl !== 'lab' && tmpl !== 'general'){ return; }
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
  renderPreview();
  updateSessionPill();
}

function applyTemplateUI(){
  const tmpl = state.template;
  // Show/hide form sections by template (form-only attribute, not the template cards in the selector)
  document.querySelectorAll('[data-tmpl-only]').forEach(el=>{
    el.style.display = (el.dataset.tmplOnly === tmpl) ? '' : 'none';
  });
  // Update header brand suffix
  const brandTag = $('#brand-tmpl-tag');
  if(brandTag){
    brandTag.textContent = tmpl === 'general' ? '· General' : (tmpl === 'lab' ? '· Lab' : '');
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
  const tmplName = state.template === 'lab' ? 'Lab' : 'General';
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

  const session = await loadSession();
  if(session && session.account && session.template){
    state.account = session.account;
    state.accountName = session.accountName || session.account;
    state.template = session.template;
    await loadDataForSession();
    applyTemplateUI();
    fillFormFromState();
    renderPresets();
    renderPreview();
    updateSessionPill();
  }else{
    renderPreview(); // empty doc behind the overlay
    showLogin();
  }
}
init();
