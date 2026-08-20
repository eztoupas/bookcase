/* ═══════════════════════════════════════════════════════════════
   Βιβλιοθήκη — app.js
   Φορτώνει PDF βιβλία από GitHub και εμφανίζει το εξώφυλλο
   χρησιμοποιώντας PDF.js
═══════════════════════════════════════════════════════════════ */

// ─── PDF.js Setup ───────────────────────────────────────────────
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ─── Collections ────────────────────────────────────────────────
const COLLECTIONS = [
  { id: 'A_Gymnasiou', label: "Α' Γυμνασίου" },
  { id: 'B_Gymnasiou', label: "Β' Γυμνασίου" },
  { id: 'C_Gymnasiou', label: "Γ' Γυμνασίου" },
  { id: 'A_Lykeiou',   label: "Α' Λυκείου"   },
  { id: 'B_Lykeiou',   label: "Β' Λυκείου"   },
  { id: 'C_Lykeiou',   label: "Γ' Λυκείου"   },
];

const LABEL = Object.fromEntries([
  ['all', 'Αρχική'],
  ...COLLECTIONS.map(c => [c.id, c.label])
]);

// ─── State ──────────────────────────────────────────────────────
let currentCol  = 'all';
let searchQuery = '';
const coverCache = {};   // pdfUrl → dataURL (runtime cache)

// ─── Config validation ──────────────────────────────────────────
function isConfigured() {
  return (
    typeof CONFIG !== 'undefined' &&
    CONFIG.githubUser &&
    CONFIG.githubUser !== 'YOUR_GITHUB_USERNAME' &&
    CONFIG.githubRepo &&
    CONFIG.githubRepo !== 'YOUR_REPOSITORY_NAME'
  );
}

// ─── GitHub API ─────────────────────────────────────────────────
async function fetchPDFs(collectionId) {
  const { githubUser, githubRepo, githubBranch, githubToken } = CONFIG;
  const url = `https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${collectionId}?ref=${githubBranch}`;

  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (githubToken) headers['Authorization'] = `token ${githubToken}`;

  const resp = await fetch(url, { headers });

  if (resp.status === 404) return [];   // empty folder
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw Object.assign(new Error(err.message || `GitHub API ${resp.status}`), { status: resp.status });
  }

  const items = await resp.json();
  return items
    .filter(f => f.type === 'file' && /\.pdf$/i.test(f.name))
    .map(f => ({
      name:       f.name,
      displayName: prettify(f.name),
      collection: collectionId,
      pdfUrl:     rawURL(githubUser, githubRepo, githubBranch, collectionId, f.name),
    }));
}

function rawURL(user, repo, branch, folder, file) {
  // GitHub Pages URL — ανοίγει το PDF στον browser αντί να το κατεβάζει
  return `https://${user}.github.io/${repo}/${folder}/${encodeURIComponent(file)}`;
}

function prettify(filename) {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[_\-]+/g, ' ')
    .trim();
}

// ─── Cover rendering ────────────────────────────────────────────
async function renderCover(pdfUrl, wrapEl) {
  // Check runtime cache first
  if (coverCache[pdfUrl]) {
    insertCoverImg(coverCache[pdfUrl], wrapEl);
    return;
  }

  try {
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true,
      disableWorker: false,
    });

    const pdf  = await loadingTask.promise;
    const page = await pdf.getPage(1);

    // Scale to fit ~300px wide for a crisp cover thumbnail
    const naturalVP = page.getViewport({ scale: 1 });
    const scale     = 300 / naturalVP.width;
    const viewport  = page.getViewport({ scale });

    const canvas  = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    const dataURL = canvas.toDataURL('image/jpeg', 0.85);
    coverCache[pdfUrl] = dataURL;    // store in runtime cache
    insertCoverImg(dataURL, wrapEl);

  } catch (err) {
    console.warn('Cover render failed:', err);
    // Leave placeholder as-is (gradient with icon)
  }
}

function insertCoverImg(dataURL, wrapEl) {
  const placeholder = wrapEl.querySelector('.cover-placeholder');
  const img = document.createElement('img');
  img.src = dataURL;
  img.alt = '';
  if (placeholder) placeholder.remove();
  wrapEl.appendChild(img);
}

// ─── Book card ──────────────────────────────────────────────────
function createBookCard(book) {
  const card = document.createElement('div');
  card.className = 'book-card';
  card.setAttribute('data-col', book.collection);
  card.title = book.displayName;
  card.onclick = () => openPDF(book);

  const wrap = document.createElement('div');
  wrap.className = 'book-cover-wrap';

  const ph = document.createElement('div');
  ph.className = 'cover-placeholder';
  ph.innerHTML = '<span>📄</span>';
  wrap.appendChild(ph);

  const nameEl = document.createElement('p');
  nameEl.className = 'book-name';
  nameEl.textContent = book.displayName;

  card.appendChild(wrap);
  card.appendChild(nameEl);

  // Kick off cover render (non-blocking)
  renderCover(book.pdfUrl, wrap);

  return card;
}

// ─── PDF viewer ─────────────────────────────────────────────────
function openPDF(book) {
  const viewerUrl = 'https://docs.google.com/viewer?url=' + encodeURIComponent(book.pdfUrl);
  window.open(viewerUrl, '_blank');
}

function closePDF() {
  // (not used)
}

// ─── Render helpers ──────────────────────────────────────────────
function showLoader() {
  document.getElementById('contentArea').innerHTML =
    '<div class="loader"><div class="spinner"></div><p>Φόρτωση βιβλίων…</p></div>';
}

function showEmpty(col) {
  const label = LABEL[col] || col;
  document.getElementById('contentArea').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📂</div>
      <strong>Δεν υπάρχουν βιβλία</strong>
      <p>Ανέβασε PDF αρχεία στον φάκελο <code>${col}</code> του repository σου.</p>
    </div>`;
}

function showAPIError(err) {
  let msg = err.message || 'Άγνωστο σφάλμα';
  let hint = '';

  if (err.status === 403) {
    hint = 'Έφτασες το rate limit του GitHub API (60 req/h). Πρόσθεσε ένα <code>githubToken</code> στο <code>config.js</code> για 5000 req/h.';
  } else if (err.status === 404) {
    hint = 'Δεν βρέθηκε το repository. Έλεγξε το <code>config.js</code>.';
  } else {
    hint = 'Έλεγξε το <code>config.js</code> και βεβαιώσου ότι το repository είναι public.';
  }

  document.getElementById('contentArea').innerHTML = `
    <div class="error-state">
      <strong>⚠️ Σφάλμα φόρτωσης</strong>
      ${msg}<br><br>${hint}
    </div>`;
}

// ─── Load collection ─────────────────────────────────────────────
async function loadCollection(colId) {
  document.getElementById('pageTitle').textContent = LABEL[colId] || colId;
  showLoader();

  if (!isConfigured()) {
    document.getElementById('contentArea').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚙️</div>
        <strong>Απαιτείται ρύθμιση</strong>
        <p>Άνοιξε το <code>config.js</code> και συμπλήρωσε το GitHub username και repo name σου.</p>
      </div>`;
    return;
  }

  try {
    let books = [];

    if (colId === 'all') {
      const results = await Promise.allSettled(COLLECTIONS.map(c => fetchPDFs(c.id)));
      const allBooks = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') allBooks.push(...r.value);
        else console.warn(`Failed to load ${COLLECTIONS[i].id}:`, r.reason);
      });
      books = allBooks;
    } else {
      books = await fetchPDFs(colId);
    }

    // Apply search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      books = books.filter(b => b.displayName.toLowerCase().includes(q) || b.name.toLowerCase().includes(q));
    }

    if (books.length === 0) { showEmpty(colId); return; }

    const area = document.getElementById('contentArea');
    area.innerHTML = '';

    if (colId === 'all') {
      // Group by collection, show each as a section
      COLLECTIONS.forEach(col => {
        const colBooks = books.filter(b => b.collection === col.id);
        if (colBooks.length === 0) return;

        const section = document.createElement('div');
        section.className = 'col-section';

        const heading = document.createElement('h3');
        heading.className = 'col-section-title';
        heading.textContent = col.label;
        section.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'books-grid';
        colBooks.forEach(b => grid.appendChild(createBookCard(b)));
        section.appendChild(grid);
        area.appendChild(section);
      });
    } else {
      const grid = document.createElement('div');
      grid.className = 'books-grid';
      books.forEach(b => grid.appendChild(createBookCard(b)));
      area.appendChild(grid);
    }

  } catch (err) {
    console.error('Load error:', err);
    showAPIError(err);
  }
}

// ─── Navigation ──────────────────────────────────────────────────
function selectCollection(colId, btn) {
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
  currentCol = colId;
  loadCollection(colId);
}

// ─── Search ──────────────────────────────────────────────────────
function clearSearch() {
  document.getElementById('searchInput').value = '';
  searchQuery = '';
  document.getElementById('searchClear').classList.remove('visible');
  loadCollection(currentCol);
}

// ─── Setup overlay ───────────────────────────────────────────────
function dismissSetup() {
  document.getElementById('setupOverlay').classList.add('hidden');
}

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Show setup overlay if not configured
  if (!isConfigured()) {
    document.getElementById('setupOverlay').classList.remove('hidden');
  } else {
    document.getElementById('setupOverlay').classList.add('hidden');
  }

  // Search input
  const inp = document.getElementById('searchInput');
  let debounceTimer;
  inp.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    document.getElementById('searchClear').classList.toggle('visible', searchQuery.length > 0);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadCollection(currentCol), 350);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePDF();
    if (e.key === '/' && document.activeElement !== inp) {
      e.preventDefault();
      inp.focus();
    }
  });

  // Initial load
  loadCollection('all');
});
