(() => {
  'use strict';

  const DB_NAME = 'ContactProject_GCP2_58114'; // retained for backward compatibility
  const DB_VERSION = 1;
  const STORE_SAMPLES = 'samples';
  const STORE_MARKERS = 'markers';
  const PANEL_ID = 'cp-gcp2-console-v0-4-2';
  const NODE_KEY = 'cp_gcp2_selected_node';
  const NOTE_PREFIX = 'cp_gcp2_intention_note_';
  const POLL_MS = 35000;
  const STALE_MS = 90000;
  const GAP_MS = 90000;
  const RANGE_KEY = 'cp_gcp2_chart_range_v41';

  if (!/(^|\.)gcp2\.net$/i.test(location.hostname)) {
    alert('Open the GCP2 Live Data page first, then click the extension.');
    return;
  }

  // Remove legacy panels if they were injected before this version on the same page.
  ['cp-gcp2-58114-console-v3', 'cp-gcp2-exp-console', 'cp-gcp2-v21', 'cp-gcp2-console-v4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.style.display = existing.style.display === 'none' ? 'block' : 'none';
    return;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SAMPLES)) {
          db.createObjectStore(STORE_SAMPLES, { keyPath: 'captured_at' });
        }
        if (!db.objectStoreNames.contains(STORE_MARKERS)) {
          db.createObjectStore(STORE_MARKERS, { keyPath: 'timestamp' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function getAll(db, storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function put(db, storeName, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  function deleteKey(db, storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  const palette = [
    ['Normal', [226, 0, 226]],
    ['Elevated', [0, 206, 247]],
    ['High', [247, 197, 58]],
    ['Very High', [255, 255, 0]],
    ['Extreme', [255, 255, 222]]
  ];

  function parseRgb(color) {
    const m = String(color || '').match(/(\d+)\D+(\d+)\D+(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  function levelFromColor(color) {
    const rgb = parseRgb(color);
    if (!rgb) return 'Unknown';
    return palette
      .map(([name, ref]) => [name,
        (rgb[0] - ref[0]) ** 2 + (rgb[1] - ref[1]) ** 2 + (rgb[2] - ref[2]) ** 2])
      .sort((a, b) => a[1] - b[1])[0][0];
  }

  function levelColor(level, sourceColor=null) {
    const parsed = parseRgb(sourceColor);
    if (parsed) return `rgb(${parsed[0]}, ${parsed[1]}, ${parsed[2]})`;
    const found = palette.find(([name]) => name === level);
    return found ? `rgb(${found[1][0]}, ${found[1][1]}, ${found[1][2]})` : 'rgb(127,138,168)';
  }

  function setLevelVisual(level, sourceColor=null) {
    const name = level || 'Unknown';
    const color = levelColor(name, sourceColor);
    const text = $('cpLevelText');
    const pill = $('cpLevel');
    const dot = $('cpLevelDot');
    const box = $('cpAcBox');
    if (!text || !pill || !dot || !box) return;
    text.textContent = name;
    dot.style.background = color;
    dot.style.boxShadow = `0 0 10px ${color}`;
    pill.style.border = `1px solid ${color}`;
    pill.style.background = `color-mix(in srgb, ${color} 18%, #18264f)`;
    // Yellow/near-white levels need dark text on the badge for legibility.
    pill.style.color = (name === 'Very High' || name === 'Extreme') ? '#101525' : '#f7f9ff';
    if (name === 'Very High' || name === 'Extreme') pill.style.background = color;
    box.style.borderLeftColor = color;
    box.style.boxShadow = `inset 8px 0 18px -16px ${color}`;
  }

  function descriptionToParts(description) {
    const raw = String(description || '');
    const text = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    const lines = text.split(/\n+/).map(x => x.trim()).filter(Boolean);
    const idMatch = (lines[0] || text).match(/\b(\d{2,})\b/);
    const id = idMatch ? idMatch[1] : null;
    const label = lines.length > 1 ? lines.slice(1).join(' · ') : (id ? text.replace(id, '').trim() : text);
    return { id, label: label || (id ? `Node ${id}` : 'Unknown node') };
  }

  function featureNodeId(feature) {
    const p = feature?.properties || {};
    if (p.id != null && String(p.id).trim()) return String(p.id).trim();
    return descriptionToParts(p.description).id;
  }

  function featureLabel(feature) {
    return descriptionToParts(feature?.properties?.description).label;
  }

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
  }

  function fmt(value, digits = 2) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : '—';
  }

  function mean(values) {
    return values.length ? values.reduce((a,b) => a + b, 0) / values.length : null;
  }

  function sd(values) {
    if (values.length < 2) return null;
    const m = mean(values);
    return Math.sqrt(values.reduce((s,x) => s + (x-m)**2, 0) / (values.length - 1));
  }

  function humanDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '—';
    const minutes = ms / 60000;
    if (minutes < 120) return `${minutes.toFixed(1)} min`;
    const hours = minutes / 60;
    if (hours < 48) return `${hours.toFixed(1)} h`;
    return `${(hours / 24).toFixed(1)} d`;
  }

  function hms(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
      .map(v => String(v).padStart(2, '0')).join(':');
  }

  function localClock(date = new Date()) {
    return date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  }

  function localAxisTime(date, showDate = false) {
    if (showDate) {
      const day = date.toLocaleDateString([], { day:'2-digit', month:'short' });
      const time = date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false });
      return `${day} ${time}`;
    }
    return date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false });
  }

  function csvCell(v) {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  }

  function download(name, mime, text) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  let bearerToken = null;

  async function loadBearer(force = false) {
    if (bearerToken && !force) return bearerToken;
    const url = `/js/data/api_token.js?_=${Date.now()}`;
    const text = await fetch(url, { cache:'no-store', credentials:'same-origin' }).then(r => {
      if (!r.ok) throw new Error(`Token HTTP ${r.status}`);
      return r.text();
    });
    const match = text.match(/Bearer\s+[A-Za-z0-9|._~+\-/=]+/i);
    if (!match) throw new Error('Could not find the GCP2 API bearer token.');
    bearerToken = match[0];
    return bearerToken;
  }

  async function apiJson(path, retry = true) {
    const token = await loadBearer(false);
    const sep = path.includes('?') ? '&' : '?';
    const response = await fetch(`${path}${sep}_=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Authorization: token }
    });
    if ((response.status === 401 || response.status === 403) && retry) {
      bearerToken = null;
      await loadBearer(true);
      return apiJson(path, false);
    }
    if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
    return response.json();
  }

  async function fetchLiveBundle() {
    try {
      const [acData, nvData] = await Promise.all([
        apiJson('/api/getgeogroupac'),
        apiJson('/api/getcurrentnetvar')
      ]);
      const nv = Number(nvData?.netvar?.[0]?.netvar);
      return {
        acData,
        netvar: Number.isFinite(nv) ? nv : null,
        method: 'direct GCP2 API'
      };
    } catch (directError) {
      // Fallback: the page itself keeps geoACData in the MAIN world.
      const acData = window.geoACData;
      if (acData?.features?.length) {
        let nv = null;
        try {
          const nvData = await apiJson('/api/getcurrentnetvar');
          const parsed = Number(nvData?.netvar?.[0]?.netvar);
          if (Number.isFinite(parsed)) nv = parsed;
        } catch (e) {}
        return { acData, netvar:nv, method:'page live-map fallback', warning:directError.message };
      }
      throw directError;
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    #${PANEL_ID}{
      position:fixed; right:8px; top:8px; z-index:2147483647;
      width:min(940px,calc(100vw - 16px));
      background:#081126; color:#eef3ff; border:1px solid #6678d8; border-radius:14px;
      box-shadow:0 18px 60px rgba(0,0,0,.55); font:12px/1.28 Arial,sans-serif; padding:10px;
      overflow:hidden;
    }
    #${PANEL_ID} *{box-sizing:border-box}
    #${PANEL_ID} h3{margin:0;font-size:16px}
    #${PANEL_ID} .header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
    #${PANEL_ID} .sub,#${PANEL_ID} .tiny{color:#aab7dc;font-size:10px}
    #${PANEL_ID} .clock{font:700 19px/1.05 Consolas,monospace;text-align:right}
    #${PANEL_ID} .topgrid{display:grid;grid-template-columns:1.25fr .85fr .9fr;gap:7px;margin-top:7px}
    #${PANEL_ID} .workspace{display:grid;grid-template-columns:330px 1fr;gap:7px;margin-top:7px;align-items:stretch}
    #${PANEL_ID} .leftstack{display:grid;grid-template-rows:auto 1fr auto;gap:7px;min-height:0}
    #${PANEL_ID} .k,#${PANEL_ID} .box{background:#111c3a;border-radius:8px;padding:8px;min-width:0}
    #${PANEL_ID} .v{font-size:25px;font-weight:800;line-height:1.0}
    #${PANEL_ID} .pill{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:99px;background:#263970;font-size:10px;font-weight:800;letter-spacing:.02em}
    #${PANEL_ID} .leveldot{width:9px;height:9px;border-radius:50%;display:inline-block;background:#7f8aa8;box-shadow:0 0 8px rgba(255,255,255,.18)}
    #${PANEL_ID} #cpAcBox{border-left:5px solid #7f8aa8;transition:border-color .25s ease,box-shadow .25s ease}
    #${PANEL_ID} .row{display:flex;justify-content:space-between;align-items:center;gap:8px}
    #${PANEL_ID} .nodebar{display:grid;grid-template-columns:auto 108px auto 1fr;gap:6px;align-items:center}
    #${PANEL_ID} input[type=text],#${PANEL_ID} textarea{background:#0a1532;color:#eef3ff;border:1px solid #425793;border-radius:6px;padding:6px}
    #${PANEL_ID} input[type=text]{width:100%}
    #${PANEL_ID} textarea{width:100%;height:92px;resize:none;font:11px/1.35 Consolas,monospace;margin-top:5px}
    #${PANEL_ID} button{border:0;border-radius:6px;padding:6px 8px;background:#2a438c;color:white;font-weight:700;cursor:pointer;font-size:11px;white-space:nowrap}
    #${PANEL_ID} button:hover{filter:brightness(1.12)}
    #${PANEL_ID} button.start-active{background:#15803d;box-shadow:0 0 0 2px #4ade80,0 0 14px rgba(74,222,128,.5)}
    #${PANEL_ID} button.end-ready{background:#8a3a22}
    #${PANEL_ID} button.warn{background:#702f49}
    #${PANEL_ID} button:disabled{opacity:.85;cursor:default}
    #${PANEL_ID} .timer{font:800 27px/1.0 Consolas,monospace}
    #${PANEL_ID} .actions{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:7px}
    #${PANEL_ID} .actions2{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:5px}
    #${PANEL_ID} .chartbox{height:244px}
    #${PANEL_ID} svg{display:block;width:100%;height:205px;background:#071020;border-radius:7px;margin-top:4px}
    #${PANEL_ID} .live{color:#6ee7a8;font-weight:800}
    #${PANEL_ID} .stale{color:#ff8c8c;font-weight:800}
    #${PANEL_ID} .statusline{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:3px}
    #${PANEL_ID} .legend{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
    #${PANEL_ID} .dot{display:inline-block;width:11px;height:3px;vertical-align:middle;margin-right:4px}
    #${PANEL_ID} .rangebar{display:flex;gap:4px;align-items:center}
    #${PANEL_ID} .rangebar button{padding:3px 7px;background:#182b59;color:#b9c6ea;font-size:10px}
    #${PANEL_ID} .rangebar button.active{background:#4668c7;color:#fff;box-shadow:0 0 0 1px #88a1ff inset}
    #${PANEL_ID} .summarybar{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-top:7px;background:#111c3a;border-radius:8px;padding:7px 8px}
    #${PANEL_ID} .summarytext{min-width:0}
    #${PANEL_ID} .summarytext div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #${PANEL_ID} .statuscompact{text-align:right;max-width:420px}
    @media (max-width:760px){
      #${PANEL_ID}{width:calc(100vw - 10px);right:5px;top:5px}
      #${PANEL_ID} .topgrid{grid-template-columns:1fr 1fr}
      #${PANEL_ID} .topgrid .nodebox{grid-column:1/-1}
      #${PANEL_ID} .workspace{grid-template-columns:1fr}
      #${PANEL_ID} .chartbox{height:210px}
      #${PANEL_ID} svg{height:172px}
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="header">
      <div><h3>Contact Project — GCP2 Experiment Console</h3><div class="sub">Multi-node live collector · v4.2 · wide compact layout</div></div>
      <div><div class="tiny" style="text-align:right">CURRENT LOCAL TIME</div><div id="cpClock" class="clock">--:--:--</div></div>
    </div>

    <div class="topgrid">
      <div class="box nodebox">
        <div class="nodebar">
          <b>Node</b>
          <input id="cpNodeInput" type="text" inputmode="numeric" list="cpNodeList" value="58114" aria-label="GCP2 node ID">
          <button id="cpLoadNode">Load node</button>
          <div><b id="cpNodeLabel">ContactProject.Org</b><div class="tiny" id="cpNodeStatus">selected node</div></div>
        </div>
        <datalist id="cpNodeList"></datalist>
      </div>

      <div class="k" id="cpAcBox">
        <div class="tiny">DEVICE COHERENCE (AC)</div>
        <div class="v" id="cpAc">—</div>
        <span class="pill" id="cpLevel"><span class="leveldot" id="cpLevelDot"></span><span id="cpLevelText">—</span></span>
      </div>

      <div class="k">
        <div class="tiny">GLOBAL NETWORK VARIANCE</div>
        <div class="v" id="cpNv">—</div>
        <div class="statusline"><span id="cpFeed" class="stale">WAITING</span><span class="tiny" id="cpLastCapture">no capture yet</span></div>
      </div>
    </div>

    <div class="workspace">
      <div class="leftstack">
        <div class="box">
          <div class="row"><b>Experiment timer</b><span class="tiny" id="cpTimerState">not running</span></div>
          <div id="cpTimer" class="timer">00:00:00</div>
        </div>

        <div class="box">
          <div class="row"><b>Intention / experiment description</b><span class="tiny" id="cpNoteSaved">autosaves for this node</span></div>
          <textarea id="cpNote" placeholder="Define the intended condition before START: hypothesis, AI prompt, focused intention, control condition, environmental notes, etc."></textarea>
          <div class="statusline"><span class="tiny">Copied into START / EVENT / END markers.</span><span class="tiny" id="cpNoteLen">0 chars</span></div>
        </div>

        <div class="box">
          <div class="row"><b>Current run</b><span class="tiny" id="cpCurrentRun">No active experiment</span></div>
          <div class="tiny" id="cpMiniStats">No stored samples for this node yet.</div>
        </div>
      </div>

      <div class="box chartbox">
        <div class="row">
          <div><b>Live trace</b><div class="legend tiny"><span><i class="dot" style="background:#eef3ff"></i>Node AC · left scale</span><span><i class="dot" style="background:#54d8ff"></i>Global netvar · right scale</span></div></div>
          <div class="rangebar" id="cpRangeBar">
            <button data-range="1h">1 h</button><button data-range="6h">6 h</button><button data-range="24h">24 h</button><button data-range="all">All</button>
          </div>
        </div>
        <svg id="cpChart" viewBox="0 0 580 205" preserveAspectRatio="none"></svg>
        <div class="tiny">Gaps indicate interrupted collection; START/EVENT/END are vertical markers. Times are local.</div>
      </div>
    </div>

    <div class="actions">
      <button id="cpStart">START</button><button id="cpEvent">EVENT</button><button id="cpEnd" class="end-ready">END</button>
      <button id="cpRefresh">Refresh now</button><button id="cpHide">Hide</button>
    </div>
    <div class="actions2">
      <button id="cpJson">Export JSONL</button><button id="cpCsv">Export CSV</button>
      <button id="cpBackup">Backup DB</button><button id="cpRestore">Restore DB</button><button id="cpClear" class="warn">Clear node</button>
    </div>
    <input id="cpRestoreFile" type="file" accept="application/json,.json" style="display:none">

    <div class="summarybar">
      <div class="summarytext">
        <div><b>Stored history:</b> <span id="cpCount">0 samples</span> · <span id="cpStats">No data yet.</span></div>
        <div class="tiny" id="cpStorage"></div>
      </div>
      <div class="statuscompact">
        <div id="cpStatus">Starting live collector…</div>
        <div class="tiny">GCP2-derived Device Coherence + Global Network Variance; not raw four-channel RNG bits.</div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  const $ = id => panel.querySelector('#' + id);

  let db;
  let selectedNode = localStorage.getItem(NODE_KEY) || '58114';
  let selectedLabel = selectedNode === '58114' ? 'ContactProject.Org' : `Node ${selectedNode}`;
  let latestFeatures = [];
  let lastCaptureAt = null;
  let lastMethod = null;
  let activeStart = null;
  let pollTimer = null;
  let captureBusy = false;
  let chartRange = localStorage.getItem(RANGE_KEY) || '1h';

  function noteKey(nodeId = selectedNode) { return NOTE_PREFIX + nodeId; }
  function saveCurrentNote() {
    localStorage.setItem(noteKey(), $('cpNote').value || '');
    $('cpNoteLen').textContent = `${($('cpNote').value || '').length} chars`;
    $('cpNoteSaved').textContent = 'saved locally';
    setTimeout(() => { if (document.getElementById(PANEL_ID)) $('cpNoteSaved').textContent = 'autosaves for this node'; }, 1000);
  }
  function loadCurrentNote() {
    const note = localStorage.getItem(noteKey()) || '';
    $('cpNote').value = note;
    $('cpNoteLen').textContent = `${note.length} chars`;
  }

  function updateClockAndFeed() {
    $('cpClock').textContent = localClock();
    if (!lastCaptureAt) {
      $('cpFeed').textContent = 'WAITING';
      $('cpFeed').className = 'stale';
      return;
    }
    const age = Date.now() - lastCaptureAt;
    $('cpLastCapture').textContent = `last capture ${localClock(new Date(lastCaptureAt))} · ${Math.floor(age/1000)} s ago`;
    if (age <= STALE_MS) {
      $('cpFeed').textContent = 'LIVE';
      $('cpFeed').className = 'live';
    } else {
      $('cpFeed').textContent = 'STALE';
      $('cpFeed').className = 'stale';
    }
  }

  function updateTimerButtons() {
    if (activeStart) {
      $('cpTimer').textContent = hms(Date.now() - activeStart);
      $('cpTimerState').textContent = `RUNNING · ${selectedNode}`;
      $('cpStart').textContent = '● STARTED';
      $('cpStart').classList.add('start-active');
      $('cpStart').disabled = true;
      $('cpCurrentRun').textContent = `RUNNING · node ${selectedNode}`;
    } else {
      $('cpTimer').textContent = '00:00:00';
      $('cpTimerState').textContent = 'not running';
      $('cpStart').textContent = 'START';
      $('cpStart').classList.remove('start-active');
      $('cpStart').disabled = false;
      if ($('cpCurrentRun')) $('cpCurrentRun').textContent = 'No active experiment';
    }
  }

  async function syncTimer() {
    const markers = (await getAll(db, STORE_MARKERS))
      .filter(m => String(m.node_id || '58114') === selectedNode)
      .sort((a,b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    let s = null, e = null;
    for (const m of markers) {
      if (m.marker === 'START') s = m;
      if (m.marker === 'END') e = m;
    }
    activeStart = s && (!e || s.timestamp > e.timestamp) ? Date.parse(s.timestamp) : null;
    updateTimerButtons();
  }

  function nodeRows(allRows) {
    return allRows.filter(r => String(r.node_id || '58114') === selectedNode);
  }

  function normalizeAc(row) {
    const v = row?.ac ?? row?.numeric_properties?.ac ?? row?.properties?.ac ?? row?.raw_feature?.properties?.ac;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeLevel(row) {
    return row?.device_level || levelFromColor(row?.fill_color || row?.properties?.['fill-color'] || row?.raw_feature?.properties?.['fill-color']);
  }

  function axisRange(values) {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) return [0, 1];
    let min = Math.min(...finite), max = Math.max(...finite);
    if (min === max) { const pad = Math.max(1, Math.abs(min) * .05); min -= pad; max += pad; }
    else { const pad = (max - min) * .08; min -= pad; max += pad; }
    return [min, max];
  }

  function rangeMs(range) {
    return range === '1h' ? 3600000 :
           range === '6h' ? 21600000 :
           range === '24h' ? 86400000 : null;
  }

  function updateRangeButtons() {
    panel.querySelectorAll('#cpRangeBar button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.range === chartRange);
    });
  }

  function splitSegments(data, valueFn) {
    const segments = [];
    let current = [];
    for (const row of data) {
      const t = Date.parse(row.captured_at);
      const v = valueFn(row);
      if (!Number.isFinite(t) || !Number.isFinite(v)) {
        if (current.length) segments.push(current);
        current = [];
        continue;
      }
      if (current.length) {
        const prevT = Date.parse(current[current.length - 1].captured_at);
        if (t - prevT > GAP_MS) {
          segments.push(current);
          current = [];
        }
      }
      current.push(row);
    }
    if (current.length) segments.push(current);
    return segments;
  }

  function drawChart(samples, markers) {
    const ordered = samples
      .filter(r => Number.isFinite(normalizeAc(r)) && r.captured_at)
      .sort((a,b) => String(a.captured_at).localeCompare(String(b.captured_at)));

    const svg = $('cpChart');
    updateRangeButtons();

    if (ordered.length < 2) {
      svg.innerHTML = '<text x="20" y="36" fill="#aab7dc" font-size="12">Waiting for at least two samples…</text>';
      return;
    }

    const latestT = Date.parse(ordered[ordered.length - 1].captured_at);
    const ms = rangeMs(chartRange);
    const windowStart = ms == null ? Date.parse(ordered[0].captured_at) : latestT - ms;
    const data = ordered.filter(r => Date.parse(r.captured_at) >= windowStart && Date.parse(r.captured_at) <= latestT);

    if (data.length < 2) {
      svg.innerHTML = `<text x="20" y="36" fill="#aab7dc" font-size="12">Not enough samples in the selected ${esc(chartRange)} window.</text>`;
      return;
    }

    const t0 = Date.parse(data[0].captured_at);
    const t1raw = Date.parse(data[data.length - 1].captured_at);
    const t1 = t1raw === t0 ? t0 + 1 : t1raw;

    const nodeVals = data.map(normalizeAc).filter(Number.isFinite);
    const netVals = data.map(r => Number(r.global_netvar)).filter(Number.isFinite);
    const [aMin,aMax] = axisRange(nodeVals);
    const [nMin,nMax] = axisRange(netVals.length ? netVals : [0,1]);

    const L=50,R=532,T=19,B=164,W=R-L,H=B-T;
    const x = t => L + (t - t0) / (t1 - t0) * W;
    const yA = v => B - (v-aMin)/(aMax-aMin)*H;
    const yN = v => B - (v-nMin)/(nMax-nMin)*H;

    const acSegments = splitSegments(data, normalizeAc);
    const nvSegments = splitSegments(data, r => Number(r.global_netvar));

    const acLines = acSegments.filter(seg => seg.length > 1).map(seg => {
      const pts = seg.map(r => `${x(Date.parse(r.captured_at)).toFixed(1)},${yA(normalizeAc(r)).toFixed(1)}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="#eef3ff" stroke-width="2.1"/>`;
    }).join('');

    const nvLines = nvSegments.filter(seg => seg.length > 1).map(seg => {
      const pts = seg.map(r => `${x(Date.parse(r.captured_at)).toFixed(1)},${yN(Number(r.global_netvar)).toFixed(1)}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="#54d8ff" stroke-width="1.9" opacity=".95"/>`;
    }).join('');

    const d0 = new Date(t0), d1 = new Date(t1);
    const crossesDate = d0.toDateString() !== d1.toDateString() || (t1 - t0) >= 86400000;

    const xTicks = [0,.25,.5,.75,1].map(fr => {
      const tx = L + fr*W, td = new Date(t0 + fr*(t1-t0));
      const label = localAxisTime(td, crossesDate);
      return `<line x1="${tx}" y1="${B}" x2="${tx}" y2="${B+4}" stroke="#51618c"/><text x="${tx}" y="${B+16}" fill="#aab7dc" font-size="8.5" text-anchor="middle">${label}</text>`;
    }).join('');

    const yTicks = [0,.25,.5,.75,1].map(fr => {
      const yy=B-fr*H, av=aMin+fr*(aMax-aMin), nv=nMin+fr*(nMax-nMin);
      return `<line x1="${L}" y1="${yy}" x2="${R}" y2="${yy}" stroke="#1d2b50" stroke-width="1"/><text x="${L-6}" y="${yy+3}" fill="#dfe6ff" font-size="8.5" text-anchor="end">${av.toFixed(1)}</text><text x="${R+6}" y="${yy+3}" fill="#54d8ff" font-size="8.5">${nv.toFixed(1)}</text>`;
    }).join('');

    const visibleMarkers = markers.filter(m => {
      const mt=Date.parse(m.timestamp);
      return Number.isFinite(mt) && mt>=t0 && mt<=t1;
    });

    const markerSvg = visibleMarkers.map(m => {
      const xx=x(Date.parse(m.timestamp));
      const label=esc(m.marker || 'EVENT');
      const color=m.marker==='START'?'#55e58b':m.marker==='END'?'#ff8b7c':'#ffd166';
      return `<line x1="${xx}" y1="${T}" x2="${xx}" y2="${B}" stroke="${color}" stroke-width="1.3" stroke-dasharray="4 4"/><text x="${Math.min(xx+3,R-34)}" y="${T+10}" fill="${color}" font-size="8">${label}</text>`;
    }).join('');

    svg.innerHTML = `
      ${yTicks}${xTicks}
      <line x1="${L}" y1="${T}" x2="${L}" y2="${B}" stroke="#65749d"/>
      <line x1="${R}" y1="${T}" x2="${R}" y2="${B}" stroke="#65749d"/>
      <line x1="${L}" y1="${B}" x2="${R}" y2="${B}" stroke="#65749d"/>
      ${markerSvg}
      ${nvLines}
      ${acLines}
      <text x="4" y="11" fill="#eef3ff" font-size="8.5">Node AC</text>
      <text x="${R+2}" y="11" fill="#54d8ff" font-size="8.5">Netvar</text>
    `;
  }

  async function refreshUiFromDb() {
    const allSamples = await getAll(db, STORE_SAMPLES);
    const allMarkers = await getAll(db, STORE_MARKERS);
    const samples = nodeRows(allSamples).sort((a,b) => String(a.captured_at).localeCompare(String(b.captured_at)));
    const markers = nodeRows(allMarkers).sort((a,b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    const vals = samples.map(normalizeAc).filter(Number.isFinite);
    $('cpCount').textContent = `${samples.length} samples`;

    if (vals.length) {
      const levels={};
      samples.forEach(r => {
        const l=normalizeLevel(r);
        levels[l]=(levels[l]||0)+1;
      });
      $('cpStats').textContent = `mean ${fmt(mean(vals),2)} · SD ${fmt(sd(vals),2)} · min ${fmt(Math.min(...vals),2)} · max ${fmt(Math.max(...vals),2)}`;
      $('cpMiniStats').textContent = `AC mean ${fmt(mean(vals),2)} · latest ${fmt(normalizeAc(samples[samples.length-1]),2)} · ${markers.length} markers`;
      const first = Date.parse(samples[0].captured_at), last = Date.parse(samples[samples.length-1].captured_at);
      const approxBytes = new Blob(samples.map(r => JSON.stringify(r))).size + new Blob(markers.map(r => JSON.stringify(r))).size;
      const levelText = Object.entries(levels).map(([k,v])=>`${k}:${v}`).join(' · ');
      $('cpStorage').textContent = `span ${humanDuration(last-first)} · ${(approxBytes/1024/1024).toFixed(2)} MB approx · ${markers.length} markers · ${levelText}`;

      const mostRecent=samples[samples.length-1];
      $('cpAc').textContent=fmt(normalizeAc(mostRecent),4);
      setLevelVisual(normalizeLevel(mostRecent), mostRecent.fill_color || mostRecent.properties?.['fill-color']);
      if (Number.isFinite(Number(mostRecent.global_netvar))) $('cpNv').textContent=fmt(Number(mostRecent.global_netvar),4);
    } else {
      $('cpStats').textContent='No data yet.';
      $('cpMiniStats').textContent='No stored samples for this node yet.';
      $('cpStorage').textContent='';
      setLevelVisual('Unknown', null);
    }

    drawChart(samples, markers);
  }

  function populateNodeSuggestions(features) {
    const dl=$('cpNodeList');
    dl.innerHTML='';
    const items=[];
    for (const f of features || []) {
      const id=featureNodeId(f); if (!id) continue;
      items.push({id,label:featureLabel(f)});
    }
    items.sort((a,b)=>Number(a.id)-Number(b.id));
    for (const it of items) {
      const o=document.createElement('option'); o.value=it.id; o.label=it.label; dl.appendChild(o);
    }
  }

  function findFeature(features, nodeId) {
    return (features || []).find(f => featureNodeId(f) === String(nodeId)) || null;
  }

  async function captureNow(reason='scheduled-poll') {
    if (captureBusy) return;
    captureBusy=true;
    $('cpStatus').textContent=`Refreshing node ${selectedNode}…`;
    try {
      const bundle=await fetchLiveBundle();
      latestFeatures=bundle.acData?.features || [];
      populateNodeSuggestions(latestFeatures);
      const feature=findFeature(latestFeatures, selectedNode);
      if (!feature) throw new Error(`Node ${selectedNode} is not present in the current GCP2 live device feed.`);
      const props=feature.properties || {};
      const coords=feature.geometry?.coordinates || [];
      const ac=Number(props.ac);
      const fill=props['fill-color'] ?? null;
      selectedLabel=featureLabel(feature);
      $('cpNodeLabel').textContent=selectedLabel;
      $('cpNodeStatus').textContent=`${latestFeatures.length} live devices available`;
      const sample={
        type:'sample', captured_at:new Date().toISOString(), source:`gcp2.net ${bundle.method}`,
        capture_reason:reason, node_id:selectedNode, node_label:selectedLabel,
        longitude:coords[0] ?? null, latitude:coords[1] ?? null,
        ac:Number.isFinite(ac)?ac:null, numeric_properties:{ac:Number.isFinite(ac)?ac:null},
        device_level:levelFromColor(fill), fill_color:fill, global_netvar:bundle.netvar,
        description:props.description ?? null, properties:props, raw_feature:feature
      };
      await put(db, STORE_SAMPLES, sample);
      lastCaptureAt=Date.now(); lastMethod=bundle.method;
      $('cpAc').textContent=fmt(sample.ac,4); setLevelVisual(sample.device_level, sample.fill_color);
      $('cpNv').textContent=fmt(sample.global_netvar,4);
      $('cpStatus').textContent=`Live capture OK · ${bundle.method}${bundle.warning?' · API fallback used':''}`;
      await refreshUiFromDb();
      updateClockAndFeed();
    } catch (e) {
      $('cpStatus').textContent=`Live update failed: ${e.message || e}`;
      updateClockAndFeed();
    } finally { captureBusy=false; }
  }

  async function selectNode(nodeId) {
    const wanted=String(nodeId || '').trim();
    if (!/^\d{2,}$/.test(wanted)) { $('cpStatus').textContent='Enter a numeric GCP2 node ID.'; return; }
    try {
      const bundle=await fetchLiveBundle();
      latestFeatures=bundle.acData?.features || [];
      populateNodeSuggestions(latestFeatures);
      const feature=findFeature(latestFeatures,wanted);
      if (!feature) { $('cpStatus').textContent=`Node ${wanted} was not found among ${latestFeatures.length} live devices.`; return; }
      saveCurrentNote();
      selectedNode=wanted; selectedLabel=featureLabel(feature);
      localStorage.setItem(NODE_KEY,selectedNode);
      $('cpNodeInput').value=selectedNode; $('cpNodeLabel').textContent=selectedLabel;
      loadCurrentNote();
      lastCaptureAt=null;
      await syncTimer(); await refreshUiFromDb(); await captureNow('node-selected');
    } catch (e) { $('cpStatus').textContent=`Could not change node: ${e.message || e}`; }
  }

  async function addMarker(kind) {
    if (kind==='START' && activeStart) { $('cpStatus').textContent='Experiment is already running. Press END before starting another.'; return; }
    const marker={type:'marker',timestamp:new Date().toISOString(),marker:kind,note:$('cpNote').value || '',node_id:selectedNode,node_label:selectedLabel};
    await put(db,STORE_MARKERS,marker);
    $('cpStatus').textContent=`${kind} marker saved for node ${selectedNode} with current intention text.`;
    await syncTimer(); await refreshUiFromDb();
  }

  async function exportCurrent(format) {
    const samples=nodeRows(await getAll(db,STORE_SAMPLES));
    const markers=nodeRows(await getAll(db,STORE_MARKERS));
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    if (format==='jsonl') {
      const rows=[...samples,...markers].sort((a,b)=>String(a.captured_at||a.timestamp).localeCompare(String(b.captured_at||b.timestamp)));
      download(`GCP2_${selectedNode}_experiment_${stamp}.jsonl`,'application/x-ndjson',rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
    } else {
      const rows=[
        ...samples.map(r=>({timestamp:r.captured_at,row_type:'sample',marker:'',note:'',node_id:r.node_id,node_label:r.node_label,ac:normalizeAc(r),device_level:normalizeLevel(r),global_netvar:r.global_netvar,longitude:r.longitude,latitude:r.latitude,source:r.source})),
        ...markers.map(r=>({timestamp:r.timestamp,row_type:'marker',marker:r.marker,note:r.note,node_id:r.node_id,node_label:r.node_label,ac:'',device_level:'',global_netvar:'',longitude:'',latitude:'',source:''}))
      ].sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp)));
      const headers=['timestamp','row_type','marker','note','node_id','node_label','ac','device_level','global_netvar','longitude','latitude','source'];
      const csv=[headers.join(','),...rows.map(r=>headers.map(h=>csvCell(r[h])).join(','))].join('\r\n')+'\r\n';
      download(`GCP2_${selectedNode}_experiment_${stamp}.csv`,'text/csv;charset=utf-8',csv);
    }
  }

  async function backupDb() {
    const samples=await getAll(db,STORE_SAMPLES), markers=await getAll(db,STORE_MARKERS);
    const notes={};
    for (let i=0;i<localStorage.length;i++) { const k=localStorage.key(i); if (k && k.startsWith(NOTE_PREFIX)) notes[k.slice(NOTE_PREFIX.length)]=localStorage.getItem(k); }
    const backup={format:'ContactProject-GCP2-IndexedDB-backup',format_version:1,exported_at:new Date().toISOString(),database:DB_NAME,selected_node:selectedNode,notes,samples,markers};
    download(`ContactProject_GCP2_DB_backup_${new Date().toISOString().replace(/[:.]/g,'-')}.json`,'application/json',JSON.stringify(backup,null,2));
    $('cpStatus').textContent=`Database backup exported: ${samples.length} samples, ${markers.length} markers.`;
  }

  async function restoreDb(file) {
    const text=await file.text(); const data=JSON.parse(text);
    if (data?.format!=='ContactProject-GCP2-IndexedDB-backup' || !Array.isArray(data.samples) || !Array.isArray(data.markers)) throw new Error('This is not a recognized Contact Project GCP2 database backup.');
    if (!confirm(`Merge ${data.samples.length} samples and ${data.markers.length} markers into the current database? Existing records with the same timestamps will be replaced.`)) return;
    for (const r of data.samples) await put(db,STORE_SAMPLES,r);
    for (const r of data.markers) await put(db,STORE_MARKERS,r);
    for (const [node,note] of Object.entries(data.notes || {})) localStorage.setItem(NOTE_PREFIX+node,String(note ?? ''));
    loadCurrentNote(); await syncTimer(); await refreshUiFromDb();
    $('cpStatus').textContent=`Restore complete: merged ${data.samples.length} samples and ${data.markers.length} markers.`;
  }

  async function clearSelectedNode() {
    if (!confirm(`Delete locally stored samples and markers for node ${selectedNode}? This cannot be undone unless you have a DB backup.`)) return;
    const samples=nodeRows(await getAll(db,STORE_SAMPLES)); const markers=nodeRows(await getAll(db,STORE_MARKERS));
    for (const r of samples) await deleteKey(db,STORE_SAMPLES,r.captured_at);
    for (const r of markers) await deleteKey(db,STORE_MARKERS,r.timestamp);
    activeStart=null; lastCaptureAt=null; updateTimerButtons(); await refreshUiFromDb(); updateClockAndFeed();
    $('cpStatus').textContent=`Cleared stored data for node ${selectedNode}.`;
  }

  async function init() {
    db=await openDb();
    $('cpNodeInput').value=selectedNode; $('cpNodeLabel').textContent=selectedLabel;
    loadCurrentNote();
    $('cpNote').addEventListener('input',saveCurrentNote);
    panel.querySelectorAll('#cpRangeBar button').forEach(btn => {
      btn.onclick = async () => {
        chartRange = btn.dataset.range;
        localStorage.setItem(RANGE_KEY, chartRange);
        updateRangeButtons();
        await refreshUiFromDb();
      };
    });
    updateRangeButtons();
    $('cpLoadNode').onclick=()=>selectNode($('cpNodeInput').value);
    $('cpNodeInput').addEventListener('keydown',e=>{if(e.key==='Enter')selectNode($('cpNodeInput').value)});
    $('cpStart').onclick=()=>addMarker('START'); $('cpEvent').onclick=()=>addMarker('EVENT'); $('cpEnd').onclick=()=>addMarker('END');
    $('cpJson').onclick=()=>exportCurrent('jsonl'); $('cpCsv').onclick=()=>exportCurrent('csv');
    $('cpBackup').onclick=backupDb; $('cpRestore').onclick=()=>$('cpRestoreFile').click();
    $('cpRestoreFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{await restoreDb(f)}catch(err){$('cpStatus').textContent=`Restore failed: ${err.message||err}`}finally{e.target.value=''}});
    $('cpRefresh').onclick=()=>captureNow('manual-refresh'); $('cpHide').onclick=()=>panel.style.display='none'; $('cpClear').onclick=clearSelectedNode;

    await syncTimer(); await refreshUiFromDb();
    const uiTimer = setInterval(()=>{updateClockAndFeed();updateTimerButtons()},1000);
    updateClockAndFeed();
    await captureNow('console-start');
    pollTimer=setInterval(()=>captureNow('scheduled-poll'),POLL_MS);
    window.__cpGcp2Runtime = {
      version:'0.4.2',
      stop:()=>{ try{clearInterval(uiTimer)}catch(e){} try{clearInterval(pollTimer)}catch(e){} }
    };
  }

  init().catch(e => { console.error(e); alert(`GCP2 Console v0.4.2 error: ${e.message || e}`); });
})();
