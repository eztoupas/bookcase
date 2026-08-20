/* Βιβλιοθήκη — διαβάζει catalog.json, χωρίς API, χωρίς token */

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

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
const coverCache = {};

// ── Βάση URL (GitHub Pages) ──────────────────────────────────
const BASE = `https://${CONFIG.githubUser}.github.io/${CONFIG.githubRepo}`;

// ── Φόρτωση catalog.json ─────────────────────────────────────
async function fetchCatalog() {
  const r = await fetch(`${BASE}/catalog.json?_=${Date.now()}`);
  if (!r.ok) throw new Error('Δεν βρέθηκε το catalog.json');
  return r.json();
}

// ── Εξώφυλλο ─────────────────────────────────────────────────
async function loadCover(pdfUrl, wrapEl) {
  if (coverCache[pdfUrl]) { insertImg(coverCache[pdfUrl], wrapEl); return; }
  try {
    const r = await fetch(pdfUrl);
    if (!r.ok) return;
    const buf = await r.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    const pg  = await pdf.getPage(1);
    const vp  = pg.getViewport({ scale: 300 / pg.getViewport({scale:1}).width });
    const cv  = document.createElement('canvas');
    cv.width = vp.width; cv.height = vp.height;
    await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    const dataURL = cv.toDataURL('image/jpeg', 0.82);
    coverCache[pdfUrl] = dataURL;
    insertImg(dataURL, wrapEl);
  } catch {}
}

function insertImg(src, wrapEl) {
  const img = document.createElement('img');
  img.src = src;
  const ph = wrapEl.querySelector('.cover-ph');
  if (ph) ph.replaceWith(img); else wrapEl.appendChild(img);
}

// ── Book card ─────────────────────────────────────────────────
function makeCard(filename, colId) {
  const pdfUrl  = `${BASE}/${colId}/${encodeURIComponent(filename)}`;
  const display = filename.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').trim();

  const card = document.createElement('a');
  card.className = 'book-card';
  card.href = pdfUrl;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';
  card.setAttribute('data-col', colId);
  card.title = display;

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
  loadCover(pdfUrl, wrap);
  return card;
}

// ── Φόρτωση ──────────────────────────────────────────────────
async function load(colId) {
  document.getElementById('pageTitle').textContent = LABEL[colId];
  const area = document.getElementById('contentArea');
  area.innerHTML = '<div class="loader"><div class="spinner"></div><p>Φόρτωση…</p></div>';

  try {
    const catalog = await fetchCatalog();

    let entries = [];
    if (colId === 'all') {
      COLS.forEach(c => (catalog[c.id]||[]).forEach(f => entries.push({f, col:c.id})));
    } else {
      (catalog[colId]||[]).forEach(f => entries.push({f, col:colId}));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(e => e.f.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').toLowerCase().includes(q));
    }

    area.innerHTML = '';

    if (!entries.length) {
      area.innerHTML = `<div class="empty"><div class="empty-icon">📂</div>
        <strong>Δεν υπάρχουν βιβλία</strong>
        <p>Ανέβασε PDF στον φάκελο <code>${colId}</code> μέσα από το GitHub.</p></div>`;
      return;
    }

    if (colId === 'all') {
      COLS.forEach(col => {
        const ce = entries.filter(e => e.col === col.id);
        if (!ce.length) return;
        const sec = document.createElement('div');
        sec.className = 'col-section';
        const h = document.createElement('h3');
        h.className = 'col-title';
        h.textContent = col.label;
        sec.appendChild(h);
        const grid = document.createElement('div');
        grid.className = 'books-grid';
        ce.forEach(e => grid.appendChild(makeCard(e.f, e.col)));
        sec.appendChild(grid);
        area.appendChild(sec);
      });
    } else {
      const grid = document.createElement('div');
      grid.className = 'books-grid';
      entries.forEach(e => grid.appendChild(makeCard(e.f, e.col)));
      area.appendChild(grid);
    }
  } catch(err) {
    area.innerHTML = `<div class="error-box"><strong>⚠️ Σφάλμα</strong><p>${err.message}</p></div>`;
  }
}

// ── Navigation ────────────────────────────────────────────────
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

document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('searchInput');
  let timer;
  inp.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    document.getElementById('searchClear').classList.toggle('visible', !!searchQuery);
    clearTimeout(timer);
    timer = setTimeout(() => load(currentCol), 300);
  });
  load('all');
});
