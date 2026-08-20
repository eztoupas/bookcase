/* ═══════════════════════════════════════════════════════════
   Βιβλιοθήκη — app.js
   Λίστα βιβλίων: GitHub API (με token από localStorage)
   Εξώφυλλα: PDF.js από GitHub Pages URL
   Άνοιγμα: νέα καρτέλα → GitHub Pages URL
═══════════════════════════════════════════════════════════ */

// ── PDF.js ──────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// ── Συλλογές ────────────────────────────────────────────────
const COLS = [
  { id:'A_Gymnasiou', label:"Α' Γυμνασίου" },
  { id:'B_Gymnasiou', label:"Β' Γυμνασίου" },
  { id:'C_Gymnasiou', label:"Γ' Γυμνασίου" },
  { id:'A_Lykeiou',   label:"Α' Λυκείου"   },
  { id:'B_Lykeiou',   label:"Β' Λυκείου"   },
  { id:'C_Lykeiou',   label:"Γ' Λυκείου"   },
];
const LABEL = { all:'Αρχική', ...Object.fromEntries(COLS.map(c=>[c.id,c.label])) };

let currentCol  = 'all';
let searchQuery = '';

// ── Token ────────────────────────────────────────────────────
const TK = 'vivliothiki_token';
const getToken = () => localStorage.getItem(TK) || '';

function ghFetch(url) {
  const token = getToken();
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;
  return fetch(url, { headers });
}

// ── URLs ─────────────────────────────────────────────────────
const pagesURL = (col, file) =>
  `https://${CONFIG.githubUser}.github.io/${CONFIG.githubRepo}/${col}/${encodeURIComponent(file)}`;

const apiURL = (col) =>
  `https://api.github.com/repos/${CONFIG.githubUser}/${CONFIG.githubRepo}/contents/${col}`;

// ── Λήψη αρχείων από GitHub API ───────────────────────────
async function fetchPDFs(col) {
  const r = await ghFetch(apiURL(col));
  if (r.status === 404) return [];
  if (!r.ok) {
    const e = await r.json().catch(()=>({}));
    throw Object.assign(new Error(e.message||`GitHub API ${r.status}`), {status:r.status});
  }
  const files = await r.json();
  return files
    .filter(f => f.type==='file' && /\.pdf$/i.test(f.name))
    .map(f => ({ name: f.name, col }));
}

// ── Cover cache ───────────────────────────────────────────
const coverCache = {};

async function loadCover(pdfUrl, wrapEl) {
  if (coverCache[pdfUrl]) { insertImg(coverCache[pdfUrl], wrapEl); return; }
  try {
    const r   = await fetch(pdfUrl);
    if (!r.ok) return;
    const buf = await r.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    const pg  = await pdf.getPage(1);
    const vp  = pg.getViewport({ scale: 300 / pg.getViewport({scale:1}).width });
    const cv  = document.createElement('canvas');
    cv.width  = vp.width;
    cv.height = vp.height;
    await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    const dataURL = cv.toDataURL('image/jpeg', 0.82);
    coverCache[pdfUrl] = dataURL;
    insertImg(dataURL, wrapEl);
  } catch(e) { /* αφήνουμε το placeholder */ }
}

function insertImg(dataURL, wrapEl) {
  const ph = wrapEl.querySelector('.cover-ph');
  const img = document.createElement('img');
  img.src = dataURL;
  if (ph) ph.replaceWith(img); else wrapEl.appendChild(img);
}

// ── Book card ─────────────────────────────────────────────
function makeCard(file) {
  const pdfUrl  = pagesURL(file.col, file.name);
  const display = file.name.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').trim();

  const card = document.createElement('a');
  card.className = 'book-card';
  card.href      = pdfUrl;
  card.target    = '_blank';
  card.rel       = 'noopener noreferrer';
  card.setAttribute('data-col', file.col);
  card.title     = display;

  const wrap = document.createElement('div');
  wrap.className = 'book-cover-wrap';

  const ph = document.createElement('div');
  ph.className = 'cover-ph';
  ph.innerHTML = '<span>📄</span>';
  wrap.appendChild(ph);

  const name = document.createElement('p');
  name.className = 'book-name';
  name.textContent = display;

  card.appendChild(wrap);
  card.appendChild(name);

  loadCover(pdfUrl, wrap);   // ασύγχρονο — δεν μπλοκάρει
  return card;
}

// ── Φόρτωση ──────────────────────────────────────────────
async function load(colId) {
  document.getElementById('pageTitle').textContent = LABEL[colId];
  const area = document.getElementById('contentArea');
  area.innerHTML = '<div class="loader"><div class="spinner"></div><p>Φόρτωση…</p></div>';

  try {
    let files = [];

    if (colId === 'all') {
      const results = await Promise.allSettled(COLS.map(c => fetchPDFs(c.id)));
      results.forEach((r,i) => {
        if (r.status === 'fulfilled') files.push(...r.value);
        else console.warn(COLS[i].id, r.reason);
      });
    } else {
      files = await fetchPDFs(colId);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      files = files.filter(f =>
        f.name.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').toLowerCase().includes(q)
      );
    }

    area.innerHTML = '';

    if (!files.length) {
      area.innerHTML = `<div class="empty"><div class="empty-icon">📂</div>
        <strong>Δεν υπάρχουν βιβλία</strong>
        <p>Ανέβασε PDF αρχεία στον φάκελο <code>${colId}</code> του GitHub repo σου.</p></div>`;
      return;
    }

    if (colId === 'all') {
      COLS.forEach(col => {
        const cf = files.filter(f => f.col === col.id);
        if (!cf.length) return;
        const sec = document.createElement('div');
        sec.className = 'col-section';
        sec.innerHTML = `<h3 class="col-title">${col.label}</h3>`;
        const grid = document.createElement('div');
        grid.className = 'books-grid';
        cf.forEach(f => grid.appendChild(makeCard(f)));
        sec.appendChild(grid);
        area.appendChild(sec);
      });
    } else {
      const grid = document.createElement('div');
      grid.className = 'books-grid';
      files.forEach(f => grid.appendChild(makeCard(f)));
      area.appendChild(grid);
    }

  } catch(err) {
    const is403 = err.status === 403 || err.status === 429;
    area.innerHTML = `
      <div class="error-box">
        <strong>⚠️ ${is403 ? 'Rate limit — χρειάζεσαι token' : 'Σφάλμα φόρτωσης'}</strong>
        <p>${err.message}</p>
        ${is403 ? '<button class="open-settings-btn" onclick="openSettings()">⚙️ Άνοιγμα Ρυθμίσεων για token</button>' : ''}
      </div>`;
  }
}

// ── Navigation ────────────────────────────────────────────
function selectCollection(colId, btn) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentCol = colId;
  load(colId);
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  searchQuery = '';
  document.getElementById('searchClear').classList.remove('visible');
  load(currentCol);
}

// ── Settings ──────────────────────────────────────────────
function openSettings() {
  document.getElementById('tokenInput').value = getToken();
  refreshTokenStatus();
  document.getElementById('modalBg').classList.add('open');
  document.getElementById('settingsPanel').classList.add('open');
}
function closeSettings() {
  document.getElementById('modalBg').classList.remove('open');
  document.getElementById('settingsPanel').classList.remove('open');
}
function saveToken() {
  const val = document.getElementById('tokenInput').value.trim();
  if (val) localStorage.setItem(TK, val);
  else localStorage.removeItem(TK);
  refreshTokenStatus();
  closeSettings();
  load(currentCol);   // ξαναφόρτωσε με token
}
function refreshTokenStatus() {
  const t  = getToken();
  const el = document.getElementById('tokenStatus');
  el.textContent = t ? `✅ Token: ${t.slice(0,8)}…` : '⚠️ Δεν έχεις token — μόνο 60 req/h.';
  el.className   = 'token-status ' + (t ? 'ok' : 'warn');
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Αν δεν υπάρχει token, άνοιξε αυτόματα τις ρυθμίσεις
  if (!getToken()) openSettings();

  const inp = document.getElementById('searchInput');
  let timer;
  inp.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    document.getElementById('searchClear').classList.toggle('visible', !!searchQuery);
    clearTimeout(timer);
    timer = setTimeout(() => load(currentCol), 300);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSettings();
  });

  load('all');
});
