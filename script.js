'use strict';

const STORAGE_KEY = 'timekeeper.calculations.v1';
const $ = selector => document.querySelector(selector);
const rowsEl = $('#rows');
let records = loadRecords();
let activeId = null;

function loadRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(r => r && typeof r.id === 'string' && Array.isArray(r.entries)) : [];
  } catch { return []; }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); $('#saved').textContent = 'Saved automatically'; }
  catch { $('#saved').textContent = 'Could not save: storage unavailable'; }
}
function clean(value) {
  if (value === '') return '';
  const number = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(number) ? String(number) : '';
}
function totalMinutes(entries) {
  return entries.reduce((sum, entry) => {
    const h = Number(entry.h || 0), m = Number(entry.m || 0);
    if (!Number.isSafeInteger(h) || !Number.isSafeInteger(m) || h < 0 || m < 0) return sum;
    return sum + h * 60 + m;
  }, 0);
}
function formatTotal(entries) {
  const minutes = totalMinutes(entries);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}
function displayTitle(record) {
  if (record.title.trim()) return record.title.trim();
  const first = record.entries.find(e => e.h !== '' || e.m !== '');
  return first ? `${first.h || 0}:${String(first.m || 0).padStart(2, '0')}` : 'Untitled calculation';
}
function getActive() { return records.find(record => record.id === activeId); }
function renderHome() {
  const history = $('#history'); history.replaceChildren();
  if (!records.length) {
    const empty = document.createElement('div'); empty.className = 'card empty';
    empty.innerHTML = '<div class="empty-icon">◷</div><h2>No calculations yet</h2><p>Start a calculation and it will appear here automatically.</p>';
    const button = document.createElement('button'); button.className = 'primary'; button.textContent = '+ New calculation'; button.addEventListener('click', createRecord); empty.append(button); history.append(empty); return;
  }
  [...records].sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0)).forEach(record => {
    const card = document.createElement('article'); card.className = 'card history-item';
    const link = document.createElement('a'); link.className = 'history-link'; link.href = `/${encodeURIComponent(record.id)}`;
    link.addEventListener('click', event => { event.preventDefault(); navigate(`/${record.id}`); });
    const info = document.createElement('div'); info.style.minWidth = '0';
    const title = document.createElement('div'); title.className = 'history-title'; title.textContent = displayTitle(record);
    const meta = document.createElement('div'); meta.className = 'history-meta'; meta.textContent = `${record.entries.length} time ${record.entries.length === 1 ? 'entry' : 'entries'}`;
    info.append(title, meta);
    const total = document.createElement('div'); total.className = 'history-total'; total.textContent = formatTotal(record.entries);
    link.append(info, total);
    const del = document.createElement('button'); del.className = 'delete'; del.textContent = '×'; del.title = 'Delete calculation'; del.setAttribute('aria-label', `Delete ${displayTitle(record)}`);
    del.addEventListener('click', () => { if (!confirm(`Delete “${displayTitle(record)}”?`)) return; records = records.filter(r => r.id !== record.id); persist(); renderHome(); });
    card.append(link, del); history.append(card);
  });
}
function renderRows() {
  const record = getActive(); if (!record) return;
  rowsEl.replaceChildren();
  record.entries.forEach((entry, index) => {
    const row = document.createElement('div'); row.className = 'time-row';
    for (const field of ['h','m']) {
      const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.step = '1'; input.inputMode = 'numeric'; input.placeholder = '0';
      input.setAttribute('aria-label', field === 'h' ? `Hours row ${index + 1}` : `Minutes row ${index + 1}`); input.value = entry[field];
      input.addEventListener('input', () => {
        const current = getActive(); if (!current) return;
        const raw = input.value; const valid = raw === '' || (/^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)));
        if (!valid) { input.setCustomValidity('Enter a non-negative whole number'); input.reportValidity(); return; }
        input.setCustomValidity(''); current.entries[index][field] = clean(raw);
        current.updatedAt = Date.now();
        if (current.entries.every(e => e.h !== '' || e.m !== '')) {
          current.entries.push({h:'',m:''});
          // Add the new row without replacing the focused input.
          appendBlankRow(current.entries.length - 1);
        }
        updateTotal(); persist();
      });
      row.append(input);
    }
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = '×'; remove.title = 'Remove row'; remove.setAttribute('aria-label', `Remove row ${index + 1}`);
    remove.disabled = entry.h === '' && entry.m === '';
    remove.addEventListener('click', () => {
      const current = getActive(); if (!current) return;
      current.entries.splice(index, 1); normalizeEntries(current); current.updatedAt = Date.now(); renderRows(); updateTotal(); persist();
    });
    row.append(remove); rowsEl.append(row);
  });
  updateRemoveButtons();
}
function appendBlankRow(index) {
  // Preserve focus by rendering only the newly added row.
  const current = getActive(); if (!current) return;
  const previous = [...rowsEl.children];
  const row = document.createElement('div'); row.className = 'time-row';
  for (const field of ['h','m']) {
    const input = document.createElement('input'); input.type='number'; input.min='0'; input.step='1'; input.inputMode='numeric'; input.placeholder='0';
    input.setAttribute('aria-label', field === 'h' ? `Hours row ${index+1}` : `Minutes row ${index+1}`);
    input.addEventListener('input', () => {
      const rec = getActive(); if (!rec) return;
      const raw = input.value;
      if (raw !== '' && (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))) { input.setCustomValidity('Enter a non-negative whole number'); input.reportValidity(); return; }
      input.setCustomValidity(''); rec.entries[index][field] = clean(raw); rec.updatedAt = Date.now();
      if (rec.entries.every(e => e.h !== '' || e.m !== '')) appendBlankRow(rec.entries.push({h:'',m:''}) - 1);
      updateRemoveButtons(); updateTotal(); persist();
    });
    row.append(input);
  }
  const remove = document.createElement('button'); remove.className='remove'; remove.type='button'; remove.textContent='×'; remove.title='Remove row'; remove.setAttribute('aria-label', `Remove row ${index+1}`); remove.disabled=true;
  remove.addEventListener('click', () => { const rec=getActive(); if(!rec)return; rec.entries.splice(index,1); normalizeEntries(rec); rec.updatedAt=Date.now(); renderRows(); updateTotal(); persist(); });
  row.append(remove); rowsEl.append(row); updateRemoveButtons();
}
function updateRemoveButtons() {
  const record = getActive(); if (!record) return;
  [...rowsEl.children].forEach((row,i) => { const entry = record.entries[i]; row.querySelector('button').disabled = !entry || (entry.h === '' && entry.m === ''); });
}
function normalizeEntries(record) {
  record.entries = record.entries.filter(e => e.h !== '' || e.m !== '');
  record.entries.push({h:'',m:''});
}
function updateTotal() { const record = getActive(); $('#total').textContent = record ? formatTotal(record.entries) : '0:00'; updateRemoveButtons(); }
function showRoute() {
  const id = decodeURIComponent(location.pathname.slice(1).replace(/\/$/, ''));
  const record = id ? records.find(r => r.id === id) : null;
  activeId = record ? record.id : null;
  $('#home').classList.toggle('hidden', !!record); $('#detail').classList.toggle('hidden', !record);
  if (record) { $('#title').value = record.title; $('#saved').textContent='Saved automatically'; renderRows(); updateTotal(); document.title = `${displayTitle(record)} · Timekeeper`; }
  else { renderHome(); document.title = 'Timekeeper · Time Calculator'; if (id) history.replaceState(null, '', '/'); }
}
function navigate(path) { history.pushState(null, '', path); showRoute(); window.scrollTo(0,0); }
function createRecord() {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  records.push({id,title:'',entries:[{h:'',m:''}],updatedAt:Date.now()}); persist(); navigate(`/${id}`);
}
$('#new-home').addEventListener('click', createRecord);
$('#back').addEventListener('click', () => navigate('/'));
$('#title').addEventListener('input', event => { const record=getActive(); if(!record)return; record.title=event.target.value; record.updatedAt=Date.now(); persist(); document.title=`${displayTitle(record)} · Timekeeper`; });
$('#clear').addEventListener('click', () => { const record=getActive(); if(!record)return; record.entries=[{h:'',m:''}]; record.updatedAt=Date.now(); renderRows(); updateTotal(); persist(); });
window.addEventListener('popstate', showRoute);
showRoute();
