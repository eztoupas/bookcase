/* ═══════════════════════════════════════════════════════════════
   Βιβλιοθήκη — app.js
   Ανεβάζει PDF στο GitHub μέσω API.
   Token: αποθηκεύεται στο localStorage (ποτέ στον κώδικα).
   Εξώφυλλα: cache στο localStorage.
   Ανάγνωση: από GitHub Pages (χωρίς API, χωρίς rate limit).
═══════════════════════════════════════════════════════════════ */

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const COLLECTIONS = [
  { id: 'A_Gymnasiou', label: "Α' Γυμνασίου" },
  { id: 'B_Gymnasiou', label: "Β' Γυμνασίου" },
  { id: 'C_Gymnasiou', label: "Γ' Γυμνασίου" },
  { id: 'A_Lykeiou',   label: "Α' Λυκείου"   },
  { id: 'B_Lykeiou',   label: "Β' Λυκείου"   },
  { id: 'C_Lykeiou',   label: "Γ' Λυκείου"   },
];
const LABEL = Object.fromEntries([['all','Αρχική'],...COLLECTIONS.map(c=>[c.id,c.label])]);

let currentCol  = 'all';
let searchQuery = '';
let uploadTarget = null;

// ─── Token (localStorage) ────────────────────────────────────────
const TOKEN_KEY = 'vivliothiki_gh_token';
const getToken  = () => localStorage.getItem(TOKEN_KEY) || '';
const ghHeaders = () => ({
  'Authorization': `token ${getToken()}`,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
});

// ─── GitHub Pages base URL ───────────────────────────────────────
const pagesBase = () =>
  `https://${CONFIG.githubUser}.github.io/${CONFIG.githubRepo}`;

const apiBase = () =>
  `https://api.github.com/repos/${CONFIG.githubUser}/${CONFIG.githubRepo}`;

// ─── Catalog (catalog.json στο repo) ─────────────────────────────
async function fetchCatalog() {
  try {
    const url = `${pagesBase()}/catalog.json?v=${Date.now()}`;
    const r = await fetch(url);
    if (!r.ok) return emptyKatalog();
    return r.json();
  } catch { return emptyKatalog(); }
}

function emptyKatalog() {
  return Object.fromEntries(COLLECTIONS.map(c => [c.id, []]));
}

async function getCatalogWithSHA() {
  const url = `${apiBase()}/contents/catalog.json`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (r.status === 404) return { catalog: emptyKatalog(), sha: null };
  const data = await r.json();
  const catalog = JSON.parse(atob(data.content.replace(/\s/g,'')));
  return { catalog, sha: data.sha };
}

async function saveCatalog(catalog, sha, message) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(catalog, null, 2))));
  const body = { message, content, branch: CONFIG.githubBranch };
  if (sha) body.sha = sha;
  const r = await fetch(`${apiBase()}/contents/catalog.json`, {
    method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Σφάλμα αποθήκευσης catalog: ${r.status}`);
}

// ─── Upload PDF to GitHub ────────────────────────────────────────
async function fileToBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

async function uploadPDF(file, colId) {
  const path    = `${colId}/${file.name}`;
  const url     = `${apiBase()}/contents/${path}`;
  const content = await fileToBase64(file);

  // Έλεγχος αν υπάρχει ήδη (για να πάρουμε sha)
  let sha = null;
  const check = await fetch(url, { headers: ghHeaders() });
  if (check.ok) { sha = (await check.json()).sha; }

  const body = {
    message: `Add ${file.name}`,
    content,
    branch: CONFIG.githubBranch,
  };
  if (sha) body.sha = sha;

  const r = await fetch(url, {
    method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.json().catch(()=>({}));
    throw new Error(err.message || `GitHub API ${r.status}`);
  }
}

async function deletePDFFromGitHub(filename, colId) {
  const path = `${colId}/${filename}`;
  const url  = `${apiBase()}/contents/${path}`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (!r.ok) throw new Error('Δεν βρέθηκε το αρχείο');
  const { sha } = await r.json();
  const del = await fetch(url, {
    method: 'DELETE',
    headers: ghHeaders(),
    body: JSON.stringify({ message: `Remove ${filename}`, sha, branch: CONFIG.githubBranch })
  });
  if (!del.ok) throw new Error(`Σφάλμα διαγραφής: ${del.status}`);
}

// ─── Cover cache (localStorage) ──────────────────────────────────
const COVER_PREFIX = 'cover_';
function getCachedCover(pdfUrl) {
  try { return localStorage.getItem(COVER_PREFIX + pdfUrl); } catch { return null; }
}
function setCachedCover(pdfUrl, dataURL) {
  try { localStorage.setItem(COVER_PREFIX + pdfUrl, dataURL); } catch {}
}

async function generateCover(arrayBuffer) {
  const pdf  = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const page = await pdf.getPage(1);
  const vp   = page.getViewport({ scale: 300 / page.getViewport({scale:1}).width });
  const c = document.createElement('canvas');
  c.width = vp.width; c.height = vp.height;
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  return c.toDataURL('image/jpeg', 0.82);
}

// ─── Handle file selection ────────────────────────────────────────
async function handleFiles(files) {
  if (!files.length) return;
  if (!getToken()) { openSettings(); showToast('⚠️ Χρειάζεσαι token για ανέβασμα!', true); return; }

  const colId = uploadTarget;
  let success = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    showToast(`⬆️ Ανέβασμα ${i+1}/${files.length}: ${file.name}…`);
    try {
      // Ανέβασμα PDF
      await uploadPDF(file, colId);

      // Ενημέρωση catalog.json
      const { catalog, sha } = await getCatalogWithSHA();
      if (!catalog[colId]) catalog[colId] = [];
      if (!catalog[colId].includes(file.name)) catalog[colId].push(file.name);
      await saveCatalog(catalog, sha, `Add ${file.name} to catalog`);

      // Αποθήκευση εξωφύλλου
      const data = await file.arrayBuffer();
      const coverDataURL = await generateCover(data);
      const pdfUrl = `${pagesBase()}/${colId}/${encodeURIComponent(file.name)}`;
      setCachedCover(pdfUrl, coverDataURL);

      success++;
    } catch(e) {
      console.error(e);
      showToast(`❌ Σφάλμα: ${file.name} — ${e.message}`, true);
      await new Promise(r => setTimeout(r, 2500));
    }
  }

  if (success > 0) {
    showToast(`✓ ${success} βιβλί${success===1?'ο':'α'} ανέβηκαν στο GitHub!`);
    setTimeout(hideToast, 3000);
    // Μικρή αναμονή για να δει το GitHub Pages το νέο catalog
    setTimeout(() => loadCollection(currentCol), 1500);
  }
}

// ─── Delete ──────────────────────────────────────────────────────
async function deleteBook(filename, colId, e) {
  e.preventDefault(); e.stopPropagation();
  if (!getToken()) { openSettings(); return; }
  if (!confirm(`Διαγραφή του "${filename}" από το GitHub;`)) return;

  showToast('🗑️ Διαγραφή…');
  try {
    await deletePDFFromGitHub(filename, colId);
    const { catalog, sha } = await getCatalogWithSHA();
    catalog[colId] = (catalog[colId] || []).filter(f => f !== filename);
    await saveCatalog(catalog, sha, `Remove ${filename} from catalog`);
    showToast('✓ Διαγράφηκε!');
    setTimeout(hideToast, 2000);
    setTimeout(() => loadCollection(currentCol), 1500);
  } catch(err) {
    showToast(`❌ ${err.message}`, true);
    setTimeout(hideToast, 3000);
  }
}

// ─── Open PDF ─────────────────────────────────────────────────────
function openPDF(pdfUrl) {
  window.open(pdfUrl, '_blank');
}

// ─── Book card ───────────────────────────────────────────────────
function createBookCard(filename, colId) {
  const pdfUrl     = `${pagesBase()}/${colId}/${encodeURIComponent(filename)}`;
  const displayName = filename.replace(/\.pdf$/i,'').replace(/[_\-]+/g,' ').trim();
  const cover      = getCachedCover(pdfUrl);

  const card = document.createElement('div');
  card.className = 'book-card';
  card.setAttribute('data-col', colId);

  const wrap = document.createElement('div');
  wrap.className = 'book-cover-wrap';
  wrap.onclick = () => openPDF(pdfUrl);

  if (cover) {
    const img = document.createElement('img');
    img.src = cover; img.alt = '';
    wrap.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'cover-placeholder';
    ph.innerHTML = '<span>📄</span>';
    wrap.appendChild(ph);
    // Φόρτωσε εξώφυλλο ασύγχρονα
    loadCoverFromURL(pdfUrl, wrap);
  }

  const del = document.createElement('button');
  del.className = 'delete-btn'; del.title = 'Διαγραφή'; del.innerHTML = '×';
  del.onclick = e => deleteBook(filename, colId, e);
  wrap.appendChild(del);

  const nameEl = document.createElement('p');
  nameEl.className = 'book-name';
  nameEl.textContent = displayName;

  card.appendChild(wrap);
  card.appendChild(nameEl);
  return card;
}

async function loadCoverFromURL(pdfUrl, wrapEl) {
  try {
    const r = await fetch(pdfUrl);
    if (!r.ok) return;
    const buf = await r.arrayBuffer();
    const dataURL = await generateCover(buf);
    setCachedCover(pdfUrl, dataURL);
    const ph = wrapEl.querySelector('.cover-placeholder');
    const img = document.createElement('img');
    img.src = dataURL; img.alt = '';
    if (ph) ph.replaceWith(img); else wrapEl.appendChild(img);
  } catch {}
}

// ─── Add card ────────────────────────────────────────────────────
function createAddCard(colId) {
  const card = document.createElement('div');
  card.className = 'book-card add-card';
  card.onclick = () => { uploadTarget = colId; document.getElementById('fileInput').value=''; document.getElementById('fileInput').click(); };
  card.title = 'Προσθήκη βιβλίου';
  const wrap = document.createElement('div');
  wrap.className = 'book-cover-wrap add-wrap';
  wrap.innerHTML = `<div class="add-inner"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Προσθήκη</span></div>`;
  const nameEl = document.createElement('p');
  nameEl.className = 'book-name'; nameEl.innerHTML = '&nbsp;';
  card.appendChild(wrap); card.appendChild(nameEl);
  return card;
}

// ─── Load & display ──────────────────────────────────────────────
async function loadCollection(colId) {
  document.getElementById('pageTitle').textContent = LABEL[colId] || colId;
  document.getElementById('contentArea').innerHTML =
    '<div class="loader"><div class="spinner"></div><p>Φόρτωση…</p></div>';

  const catalog = await fetchCatalog();
  const area = document.getElementById('contentArea');
  area.innerHTML = '';

  if (colId === 'all') {
    let hasAny = false;
    COLLECTIONS.forEach(col => {
      let files = catalog[col.id] || [];
      if (searchQuery) files = files.filter(f => f.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').toLowerCase().includes(searchQuery.toLowerCase()));

      const section = document.createElement('div');
      section.className = 'col-section';

      const header = document.createElement('div');
      header.className = 'col-header';
      const title = document.createElement('h3');
      title.className = 'col-section-title';
      title.textContent = col.label;
      const addBtn = document.createElement('button');
      addBtn.className = 'add-btn'; addBtn.title = 'Προσθήκη'; addBtn.innerHTML = '+';
      addBtn.onclick = () => { uploadTarget = col.id; document.getElementById('fileInput').value=''; document.getElementById('fileInput').click(); };
      header.appendChild(title); header.appendChild(addBtn);
      section.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'books-grid';
      files.forEach(f => grid.appendChild(createBookCard(f, col.id)));
      grid.appendChild(createAddCard(col.id));
      section.appendChild(grid);
      area.appendChild(section);
      if (files.length) hasAny = true;
    });
  } else {
    let files = catalog[colId] || [];
    if (searchQuery) files = files.filter(f => f.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').toLowerCase().includes(searchQuery.toLowerCase()));
    const grid = document.createElement('div');
    grid.className = 'books-grid';
    files.forEach(f => grid.appendChild(createBookCard(f, colId)));
    grid.appendChild(createAddCard(colId));
    area.appendChild(grid);
  }
}

// ─── Settings ────────────────────────────────────────────────────
function openSettings() {
  document.getElementById('tokenInput').value = getToken();
  updateTokenStatus();
  document.getElementById('settingsBg').classList.add('open');
  document.getElementById('settingsPanel').classList.add('open');
}
function closeSettings() {
  document.getElementById('settingsBg').classList.remove('open');
  document.getElementById('settingsPanel').classList.remove('open');
}
function saveToken() {
  const val = document.getElementById('tokenInput').value.trim();
  if (val) localStorage.setItem(TOKEN_KEY, val);
  else localStorage.removeItem(TOKEN_KEY);
  updateTokenStatus();
  showToast('✓ Token αποθηκεύτηκε!');
  setTimeout(() => { hideToast(); closeSettings(); }, 1500);
}
function updateTokenStatus() {
  const el = document.getElementById('tokenStatus');
  const t  = getToken();
  el.textContent = t ? `✓ Token: ${t.substring(0,8)}…` : '⚠️ Δεν έχεις ορίσει token.';
  el.className   = 'token-status ' + (t ? 'ok' : 'warn');
}

// ─── Toast ───────────────────────────────────────────────────────
function showToast(msg, isError=false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError?' error':'');
}
function hideToast() { document.getElementById('toast').className='toast'; }

// ─── Navigation ──────────────────────────────────────────────────
function selectCollection(colId, btn) {
  document.querySelectorAll('.nav-btn').forEach(el=>el.classList.remove('active'));
  btn.classList.add('active');
  currentCol = colId;
  loadCollection(colId);
}
function clearSearch() {
  document.getElementById('searchInput').value='';
  searchQuery='';
  document.getElementById('searchClear').classList.remove('visible');
  loadCollection(currentCol);
}

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fileInput').addEventListener('change', e => {
    handleFiles(Array.from(e.target.files));
  });

  const inp = document.getElementById('searchInput');
  let timer;
  inp.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    document.getElementById('searchClear').classList.toggle('visible', searchQuery.length>0);
    clearTimeout(timer);
    timer = setTimeout(() => loadCollection(currentCol), 300);
  });

  document.addEventListener('keydown', e => {
    if (e.key==='Escape') closeSettings();
  });

  if (!getToken()) openSettings();

  loadCollection('all');
});
