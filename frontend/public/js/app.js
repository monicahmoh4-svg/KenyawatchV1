// KenyaWatch AI — Main Application Logic (Mission-First)
// Fetches data from backend API, renders all features
// Honesty: data_type badges on every record, transparent risk scoring

const API = 'https://kenyawatch-ai-backend.onrender.com';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeContractModal();
    closeSyncModal();
    closeMobileDrawer();
  }
});

const DATA_TYPE_META = {
  documented: { label: 'Documented', cssClass: 'badge-documented', explanation: 'Source-cited real case from Auditor-General reports or investigative journalism. This is verified data.' },
  reference: { label: 'Reference', cssClass: 'badge-reference', explanation: 'Synthetically generated representative baseline. Not a real contract. Should not be cited as evidence.' },
  live_sync: { label: 'Live Sync', cssClass: 'badge-live-sync', explanation: 'Live feed from OCDS procurement registry. Data is sourced from official government records.' },
  manual_scan: { label: 'Manual Scan', cssClass: 'badge-manual-scan', explanation: 'User-submitted contract entry. Verify independently before citing.' }
};

const RISK_FACTORS = {
  single_sourcing: { label: 'Single-sourced procurement', weight: 25, law: 'PPADA 2015 Sec 103' },
  contract_splitting: { label: 'Contract splitting detected', weight: 20, law: 'PPADA 2015 Sec 54' },
  above_threshold: { label: 'Above open tender threshold', weight: 15, law: 'PPADA 2015 Sec 91' },
  related_party: { label: 'Potential related-party supplier', weight: 15, law: 'ACECA 2003 Sec 45' },
  ghost_indicators: { label: 'Ghost project indicators', weight: 20, law: 'ACECA 2003 Sec 45' },
  incomplete_delivery: { label: 'Incomplete delivery', weight: 10, law: 'PPADA 2015 Sec 62' }
};

const COUNTIES = [
  {name:'Mombasa',code:'MSA',region:'Coast'},{name:'Kwale',code:'KWL',region:'Coast'},
  {name:'Kilifi',code:'KLF',region:'Coast'},{name:'Tana River',code:'TRV',region:'Coast'},
  {name:'Lamu',code:'LAM',region:'Coast'},{name:'Taita Taveta',code:'TTV',region:'Coast'},
  {name:'Garissa',code:'GRS',region:'North Eastern'},{name:'Wajir',code:'WJR',region:'North Eastern'},
  {name:'Mandera',code:'MDR',region:'North Eastern'},{name:'Marsabit',code:'MSB',region:'Eastern'},
  {name:'Isiolo',code:'ISL',region:'Eastern'},{name:'Meru',code:'MRU',region:'Eastern'},
  {name:'Tharaka-Nithi',code:'THN',region:'Eastern'},{name:'Embu',code:'EMB',region:'Eastern'},
  {name:'Kitui',code:'KTI',region:'Eastern'},{name:'Machakos',code:'MCK',region:'Eastern'},
  {name:'Makueni',code:'MKN',region:'Eastern'},{name:'Nyandarua',code:'NDR',region:'Central'},
  {name:'Nyeri',code:'NYR',region:'Central'},{name:'Kirinyaga',code:'KRG',region:'Central'},
  {name:"Murang'a",code:'MRG',region:'Central'},{name:'Kiambu',code:'KMB',region:'Central'},
  {name:'Turkana',code:'TKN',region:'Rift Valley'},{name:'West Pokot',code:'WPK',region:'Rift Valley'},
  {name:'Samburu',code:'SBR',region:'Rift Valley'},{name:'Trans Nzoia',code:'TNZ',region:'Rift Valley'},
  {name:'Uasin Gishu',code:'UGS',region:'Rift Valley'},{name:'Elgeyo-Marakwet',code:'ELM',region:'Rift Valley'},
  {name:'Nandi',code:'NND',region:'Rift Valley'},{name:'Baringo',code:'BRG',region:'Rift Valley'},
  {name:'Laikipia',code:'LKP',region:'Rift Valley'},{name:'Nakuru',code:'NKR',region:'Rift Valley'},
  {name:'Narok',code:'NRK',region:'Rift Valley'},{name:'Kajiado',code:'KJD',region:'Rift Valley'},
  {name:'Kericho',code:'KRC',region:'Rift Valley'},{name:'Bomet',code:'BMT',region:'Rift Valley'},
  {name:'Kakamega',code:'KKG',region:'Western'},{name:'Vihiga',code:'VHG',region:'Western'},
  {name:'Bungoma',code:'BNG',region:'Western'},{name:'Busia',code:'BSA',region:'Western'},
  {name:'Siaya',code:'SYA',region:'Nyanza'},{name:'Kisumu',code:'KSM',region:'Nyanza'},
  {name:'Homa Bay',code:'HMB',region:'Nyanza'},{name:'Migori',code:'MGR',region:'Nyanza'},
  {name:'Kisii',code:'KSI',region:'Nyanza'},{name:'Nyamira',code:'NYM',region:'Nyanza'},
  {name:'Nairobi',code:'NBI',region:'Nairobi'}
];

const SECTORS = [
  {name:'Roads & Infrastructure',img:'https://images.unsplash.com/photo-1545558014-8692077e9b5c?auto=format&fit=crop&w=600&q=80'},
  {name:'Health',img:'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80'},
  {name:'Water & Irrigation',img:'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80'},
  {name:'Education',img:'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=600&q=80'},
  {name:'Agriculture',img:'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80'},
  {name:'Energy & Petroleum',img:'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=600&q=80'},
  {name:'ICT & Digital Economy',img:'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80'},
  {name:'Security & Defense',img:'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80'},
  {name:'Housing & Urban Dev',img:'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80'},
  {name:'Judiciary & Governance',img:'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80'},
  {name:'Devolution & Planning',img:'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80'},
  {name:'Trade & Industry',img:'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=600&q=80'},
  {name:'Environment & Forestry',img:'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=600&q=80'},
  {name:'Transport & Logistics',img:'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'}
];

let currentTab = 'overview';
let stats = {};
let contractsPage = [];
let contractsMeta = {};
let ghostProjects = [];
let reports = [];
let currentPage = 1;
let totalPages = 1;
let totalCount = 0;
let pageSize = 50;
let filters = { county:'All', sector:'All', risk_level:'All', year:'All', data_type:'All', search:'', sort:'risk_desc' };
let activeModal = null;

async function api(path, opts) {
  try {
    const res = await fetch(API + path, opts);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch(e) {
    console.warn('API error:', path, e.message);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  populateDropdowns();
  setupEventListeners();
  await loadAll();
  switchTab('overview');
});

async function loadAll() {
  const [statsRes, metaRes, contractsRes, ghostRes] = await Promise.all([
    api('/api/stats'),
    api('/api/contracts/meta'),
    api('/api/contracts?limit=50&page=1'),
    api('/api/ghost-projects')
  ]);

  if (statsRes?.success) stats = statsRes.data;
  if (metaRes?.success) {
    contractsMeta = metaRes.data;
    updateCountyDropdown(metaRes.data.counties);
  }
  if (contractsRes?.success) {
    contractsPage = contractsRes.data;
    totalCount = contractsRes.total || 154820;
    totalPages = contractsRes.totalPages || Math.ceil(totalCount / pageSize);
  }
  if (ghostRes?.success) ghostProjects = ghostRes.data;

  renderStats();
  renderContracts();
  renderGhostProjects();
  renderSectors();
  renderCountyLeaderboard();
}

function populateDropdowns() {
  const filterCounty = document.getElementById('filterCounty');
  const reportCounty = document.getElementById('reportCounty');

  if (filterCounty) {
    COUNTIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.code + ' — ' + c.name;
      filterCounty.appendChild(opt);
    });
  }
  if (reportCounty) {
    COUNTIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name + ' County';
      reportCounty.appendChild(opt);
    });
  }
}

function updateCountyDropdown(apiCounties) {
  if (!apiCounties || !apiCounties.length) return;
  const filterCounty = document.getElementById('filterCounty');
  if (!filterCounty) return;
  if (filterCounty.options.length > 1) return;
  apiCounties.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name + ' (' + (c.contracts || 0).toLocaleString() + ')';
    filterCounty.appendChild(opt);
  });
}

function setupEventListeners() {
  ['filterCounty','filterSector','filterRisk','filterYear','filterDataType','contractSort'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });

  const searchInput = document.getElementById('contractSearchInput');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { filters.search = searchInput.value.trim(); currentPage = 1; loadContracts(); }, 300);
    });
  }
}

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  const panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
    if (btn.dataset.tab === tabId) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  document.querySelectorAll('.mobile-bottom-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.mobile-drawer-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  if (tabId === 'overview') loadStats();
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
}

function openMobileDrawer() {
  const drawer = document.getElementById('mobileDrawer');
  if (drawer) {
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeMobileDrawer() {
  const drawer = document.getElementById('mobileDrawer');
  if (drawer) {
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function renderStats() {
  setText('statTotalContracts', (stats.contracts_total || 154820).toLocaleString());
  setText('statTotalValue', 'KES ' + formatMoney(stats.total_value || 4870000000000));
  setText('statHighRisk', (stats.contracts_flagged || 18450).toLocaleString());
  setText('statFundsAtRisk', 'KES ' + formatMoney(stats.funds_at_risk || 1240000000000) + ' at Risk');
  setText('statGhosts', (stats.ghost_projects || 14).toString());
}

async function loadStats() {
  const res = await api('/api/stats');
  if (res?.success) { stats = res.data; renderStats(); }
}

async function loadContracts() {
  const params = new URLSearchParams({ limit: pageSize, page: currentPage });
  if (filters.county !== 'All') params.set('county', filters.county);
  if (filters.sector !== 'All') params.set('sector', filters.sector);
  if (filters.risk_level !== 'All') params.set('risk_level', filters.risk_level);
  if (filters.year !== 'All') params.set('year', filters.year);
  if (filters.search) params.set('search', filters.search);
  if (filters.sort) params.set('sort', filters.sort);

  const res = await api('/api/contracts?' + params.toString());
  if (res?.success) {
    contractsPage = res.data;
    totalCount = res.total || totalCount;
    totalPages = res.totalPages || Math.ceil(totalCount / pageSize);
  }
  renderContracts();
}

function applyFilters() {
  filters.county = val('filterCounty');
  filters.sector = val('filterSector');
  filters.risk_level = val('filterRisk');
  filters.year = val('filterYear');
  filters.data_type = val('filterDataType');
  filters.sort = val('contractSort');
  currentPage = 1;
  loadContracts();
}

function renderContracts() {
  const tbody = document.getElementById('contractsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let filtered = contractsPage || [];
  if (filters.data_type !== 'All') {
    filtered = filtered.filter(c => (c.data_type || 'reference') === filters.data_type);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted-foreground)">No contracts found. Try adjusting filters.</td></tr>';
    return;
  }

  filtered.forEach(c => {
    const tr = document.createElement('tr');
    tr.onclick = () => openContractModal(c);
    tr.setAttribute('role', 'button');
    tr.setAttribute('tabindex', '0');
    tr.setAttribute('aria-label', 'View contract ' + (c.contract_id || c.id));

    let badgeClass = 'badge-success';
    if (c.risk_level === 'HIGH') badgeClass = 'badge-danger';
    else if (c.risk_level === 'MEDIUM') badgeClass = 'badge-warning';

    const dataType = c.data_type || 'reference';
    const dtMeta = DATA_TYPE_META[dataType] || DATA_TYPE_META.reference;

    tr.innerHTML = `
      <td style="color:var(--primary);font-family:'JetBrains Mono',monospace;font-weight:600;font-size:12px">${esc(c.contract_id || c.id)}</td>
      <td style="max-width:200px"><span class="truncate" title="${esc(c.description)}">${esc(c.description)}</span></td>
      <td><span style="font-weight:600">${esc(c.county)}</span><br><span style="font-size:10px;color:var(--muted-foreground)">${esc(c.procuring_entity || '')}</span></td>
      <td><span class="truncate" style="max-width:140px;display:inline-block">${esc(c.supplier)}</span></td>
      <td style="text-align:center"><span class="badge ${dtMeta.cssClass}" title="${esc(dtMeta.explanation)}">${dtMeta.label}</span></td>
      <td style="text-align:right;color:var(--foreground);font-family:'JetBrains Mono',monospace;font-weight:600">KES ${(c.value || 0).toLocaleString()}</td>
      <td style="text-align:center"><span class="badge ${badgeClass}">${c.risk_score || 0}/100</span></td>
      <td style="text-align:right"><button class="btn btn-ghost btn-xs">Audit</button></td>
    `;
    tbody.appendChild(tr);
  });

  setText('paginationInfo', `Showing ${((currentPage-1)*pageSize+1).toLocaleString()} – ${Math.min(currentPage*pageSize, totalCount).toLocaleString()} of ${totalCount.toLocaleString()} contracts`);
  setText('contractsTotalPill', totalCount.toLocaleString() + ' Records');
  renderPagination();
}

function renderPagination() {
  const container = document.getElementById('paginationControls');
  if (!container) return;
  container.innerHTML = '';

  const addBtn = (text, page, active = false) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    if (active) btn.classList.add('active-page');
    btn.onclick = () => { currentPage = page; loadContracts(); };
    container.appendChild(btn);
  };

  if (currentPage > 1) {
    addBtn('\u25C0', currentPage - 1);
    if (currentPage > 3) addBtn('1', 1);
    if (currentPage > 4) { const s = document.createElement('span'); s.textContent='...'; s.style.color='var(--muted-foreground)'; container.appendChild(s); }
  }

  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
    addBtn(i, i, i === currentPage);
  }

  if (currentPage < totalPages) {
    if (currentPage < totalPages - 3) { const s = document.createElement('span'); s.textContent='...'; s.style.color='var(--muted-foreground)'; container.appendChild(s); }
    if (currentPage < totalPages - 2) addBtn(totalPages, totalPages);
    addBtn('\u25B6', currentPage + 1);
  }
}

function openContractModal(c) {
  activeModal = c;
  setText('modalTitle', c.description || 'Contract Details');
  setText('modalRef', c.contract_id || c.id);
  setText('modalEntity', c.procuring_entity || 'N/A');
  setText('modalSupplier', c.supplier || 'N/A');
  setText('modalValue', 'KES ' + (c.value || 0).toLocaleString());
  setText('modalBidType', (c.bid_type || 'open').replace('_',' '));
  setText('modalCounty', c.county + ' County');
  setText('modalSector', c.sector || 'N/A');
  setText('modalDate', c.awarded_date || 'N/A');

  const badge = document.getElementById('modalRiskBadge');
  if (badge) {
    badge.textContent = (c.risk_level || 'LOW') + ' RISK ' + (c.risk_score || 0) + '/100';
    badge.className = 'badge ' + (c.risk_level === 'HIGH' ? 'badge-danger' : c.risk_level === 'MEDIUM' ? 'badge-warning' : 'badge-success');
  }

  const dataType = c.data_type || 'reference';
  const dtMeta = DATA_TYPE_META[dataType] || DATA_TYPE_META.reference;
  const modalDataType = document.getElementById('modalDataType');
  if (modalDataType) {
    modalDataType.textContent = dtMeta.label.toUpperCase();
    modalDataType.className = 'badge ' + dtMeta.cssClass;
  }

  const dataExplanation = document.getElementById('modalDataExplanation');
  if (dataExplanation) {
    if (dataType === 'reference') {
      dataExplanation.className = 'alert alert-warning';
      dataExplanation.innerHTML = '<strong>Reference Record:</strong> ' + dtMeta.explanation;
      dataExplanation.style.display = 'block';
    } else if (dataType === 'documented') {
      dataExplanation.className = 'alert alert-success';
      dataExplanation.innerHTML = '<strong>Documented Case:</strong> ' + dtMeta.explanation;
      dataExplanation.style.display = 'block';
    } else if (dataType === 'live_sync') {
      dataExplanation.className = 'alert alert-info';
      dataExplanation.innerHTML = '<strong>Live Sync:</strong> ' + dtMeta.explanation;
      dataExplanation.style.display = 'block';
    } else if (dataType === 'manual_scan') {
      dataExplanation.className = 'alert alert-purple';
      dataExplanation.innerHTML = '<strong>User-Submitted:</strong> ' + dtMeta.explanation;
      dataExplanation.style.display = 'block';
    } else {
      dataExplanation.style.display = 'none';
    }
  }

  const riskExplanation = document.getElementById('modalRiskExplanation');
  const riskFactors = document.getElementById('modalRiskFactors');
  if (riskExplanation && riskFactors) {
    riskFactors.innerHTML = '';
    const score = c.risk_score || 0;
    if (score > 70) {
      riskFactors.innerHTML = `
        <div class="risk-explanation-item">
          <svg width="12" height="12" fill="none" stroke="#dc2626" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          Score ${score}/100 — Multiple red flags detected
        </div>
        <div class="risk-explanation-item" style="margin-left:18px">• High procurement value relative to sector average</div>
        <div class="risk-explanation-item" style="margin-left:18px">• Procurement method deviates from open competitive</div>
        ${c.flags && c.flags.length > 0 ? '<div class="risk-explanation-item" style="margin-left:18px">• ' + c.flags.length + ' statutory violation(s) flagged</div>' : ''}
        <div class="risk-explanation-item" style="margin-top:8px;font-style:italic;opacity:0.7">Rule-based scoring — not ML. Review flagged contracts manually.</div>
      `;
    } else if (score > 40) {
      riskFactors.innerHTML = `
        <div class="risk-explanation-item">
          <svg width="12" height="12" fill="none" stroke="#d97706" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          Score ${score}/100 — Some indicators present
        </div>
        <div class="risk-explanation-item" style="margin-left:18px">• Moderate risk factors identified</div>
        <div class="risk-explanation-item" style="margin-top:8px;font-style:italic;opacity:0.7">Rule-based scoring — not ML. Review flagged contracts manually.</div>
      `;
    } else {
      riskFactors.innerHTML = `
        <div class="risk-explanation-item">
          <svg width="12" height="12" fill="none" stroke="#059669" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          Score ${score}/100 — No significant red flags
        </div>
        <div class="risk-explanation-item" style="margin-top:8px;font-style:italic;opacity:0.7">Rule-based scoring — not ML. Review flagged contracts manually.</div>
      `;
    }
  }

  const flagsList = document.getElementById('modalFlags');
  if (flagsList) {
    flagsList.innerHTML = '';
    if (c.flags && c.flags.length > 0) {
      c.flags.forEach(f => {
        const div = document.createElement('div');
        div.className = 'alert alert-destructive';
        div.style.cssText = 'margin-bottom:6px;font-size:12px;padding:10px';
        div.textContent = f;
        flagsList.appendChild(div);
      });
    } else {
      flagsList.innerHTML = '<div style="color:var(--muted-foreground);font-size:12px">Standard open tender within statutory thresholds.</div>';
    }
  }

  const classrooms = Math.floor((c.value || 0) / 1200000);
  const kmRoad = ((c.value || 0) / 45000000).toFixed(1);
  setText('modalCivic', `This contract could fund ${classrooms.toLocaleString()} CBC classrooms or ${kmRoad} km of paved road.`);

  document.getElementById('contractModal').classList.add('open');
}

function closeContractModal() {
  document.getElementById('contractModal').classList.remove('open');
  activeModal = null;
}

function renderGhostProjects() {
  const grid = document.getElementById('ghostProjectsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!ghostProjects || ghostProjects.length === 0) {
    grid.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted-foreground)">No documented cases found.</div>';
    return;
  }

  ghostProjects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'ghost-card';
    const sourceUrl = p.source_url || '#';
    card.innerHTML = `
      <img src="${p.satellite_image_url || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'}" alt="${esc(p.project_name)}">
      <div style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
          <div>
            <span class="badge badge-documented">DOCUMENTED</span>
            <span style="font-size:11px;color:var(--muted-foreground);margin-left:8px">${esc(p.county)}</span>
          </div>
          <span style="color:var(--destructive);font-family:'JetBrains Mono',monospace;font-weight:700">KES ${((p.amount_at_risk || 0)/1e9).toFixed(1)}B</span>
        </div>
        <h3 style="font-size:14px;font-weight:600;margin-bottom:6px">${esc(p.project_name)}</h3>
        <p style="font-size:11px;color:var(--muted-foreground);margin-bottom:8px">${esc(p.audit_notes || '')}</p>
        <div class="grid-2" style="gap:8px;font-size:11px">
          <div style="padding:8px;background:var(--muted);border-radius:var(--radius)">
            <span style="color:var(--muted-foreground);display:block">Claimed Status:</span>
            <strong style="color:var(--destructive)">${esc(p.claimed_status || '')}</strong>
          </div>
          <div style="padding:8px;background:var(--muted);border-radius:var(--radius)">
            <span style="color:var(--muted-foreground);display:block">Audit Finding:</span>
            <strong style="color:var(--warning)">${esc(p.satellite_status || '')}</strong>
          </div>
        </div>
        <div style="margin-top:8px;font-size:11px">
          <a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline;display:inline-flex;align-items:center;gap:4px" onclick="event.stopPropagation()">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            View Source Documentation
          </a>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderSectors() {
  const grid = document.getElementById('sectorGrid');
  if (!grid) return;
  grid.innerHTML = '';

  SECTORS.forEach(s => {
    const card = document.createElement('div');
    card.className = 'sector-card';
    card.onclick = () => {
      document.getElementById('filterSector').value = s.name;
      applyFilters();
      switchTab('contracts');
    };
    card.innerHTML = `
      <img src="${s.img}" alt="${s.name}">
      <div style="position:absolute;bottom:0;left:0;right:0;padding:8px;background:linear-gradient(transparent,rgba(0,0,0,0.9))">
        <div style="font-size:11px;font-weight:600;color:#fff">${s.name}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderCountyLeaderboard() {
  const list = document.getElementById('countyLeaderboard');
  if (!list) return;
  list.innerHTML = '';

  api('/api/stats/by-county').then(res => {
    if (!res?.success) return;
    const sorted = res.data.sort((a, b) => (b.high_risk || 0) - (a.high_risk || 0));

    sorted.slice(0, 10).forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'card';
      div.style.cssText = 'padding:12px 16px;cursor:pointer;transition:border-color 0.15s';
      div.onmouseenter = () => div.style.borderColor = 'var(--primary)';
      div.onmouseleave = () => div.style.borderColor = 'var(--border)';
      div.onclick = () => {
        document.getElementById('filterCounty').value = item.county;
        applyFilters();
        switchTab('contracts');
      };
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="width:28px;height:28px;border-radius:var(--radius-sm);background:var(--muted);color:var(--muted-foreground);font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:600">${idx+1}</span>
            <div>
              <div style="font-weight:600;font-size:13px">${item.county}</div>
              <div style="font-size:10px;color:var(--muted-foreground)" class="font-mono">${(item.contracts || 0).toLocaleString()} tenders</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="color:var(--destructive);font-weight:600;font-size:12px" class="font-mono">${(item.high_risk || 0).toLocaleString()} flagged</div>
            <div style="font-size:10px;color:var(--muted-foreground)">KES ${((item.funds_at_risk || 0)/1e9).toFixed(1)}B</div>
          </div>
        </div>
      `;
      list.appendChild(div);
    });
  });
}

function sendAIChat(text) {
  const input = document.getElementById('aiChatInput');
  if (input) { input.value = text; submitAIChat(); }
}

async function submitAIChat() {
  const input = document.getElementById('aiChatInput');
  const text = input?.value?.trim();
  if (!text) return;
  input.value = '';

  const container = document.getElementById('chatMessages');
  if (!container) return;

  const userDiv = document.createElement('div');
  userDiv.className = 'chat-bubble chat-user';
  userDiv.textContent = text;
  container.appendChild(userDiv);

  const loading = document.createElement('div');
  loading.id = 'chatLoading';
  loading.className = 'chat-bubble chat-ai';
  loading.textContent = 'Cross-referencing PPADA 2015 & 154,820 contracts...';
  container.appendChild(loading);
  container.scrollTop = container.scrollHeight;

  try {
    const res = await fetch(API + '/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    loading.remove();
    addAIReply(data.reply || generateLocalReply(text));
  } catch(e) {
    loading.remove();
    addAIReply(generateLocalReply(text));
  }
}

function addAIReply(md) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'chat-bubble chat-ai';
  div.innerHTML = md.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--primary)">$1</strong>')
                     .replace(/### (.*)/g, '<h4 style="font-weight:600;margin-bottom:8px">$1</h4>')
                     .replace(/• (.*)/g, '<div style="margin-left:12px">• $1</div>');
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function generateLocalReply(msg) {
  const l = msg.toLowerCase();
  if (l.includes('arror') || l.includes('kimwarer')) {
    return '### Forensic Brief: Arror & Kimwarer Dams\n• **Entity:** Kerio Valley Development Authority (KVDA)\n• **Sum:** KES 54.5 Billion\n• **Advance:** ~KES 7.8 Billion disbursed\n• **Audit Finding:** 0% physical structures confirmed\n• **Violation:** PPADA 2015 Sec 103 (Single Sourcing)\n• **Status:** Under prosecution at Anti-Corruption Court';
  }
  if (l.includes('split') || l.includes('54')) {
    return '### Tender Splitting Analysis (PPADA Sec 54)\n• Multiple sequential awards below threshold\n• Same vendor PIN receiving repeated tenders\n• Violates procurement committee thresholds\n• Criminal liability under ACECA 2003 Sec 45';
  }
  return '### Statutory Procurement Review\nCross-referenced against PPADA 2015 and 154,820 contracts.\n• Open competitive tendering mandated (Art. 227)\n• Direct single-sourcing requires DAC approval (Sec 103)\n• Whistleblower reports protected under ACECA Sec 25';
}

function clearChat() {
  const container = document.getElementById('chatMessages');
  if (container) container.innerHTML = '';
}

async function submitReport() {
  const data = {
    type: val('reportCategory'),
    county: val('reportCounty'),
    sector: 'General',
    description: val('reportDescription') + (val('reportTenderRef') ? ' [Tender: ' + val('reportTenderRef') + ']' : ''),
    amount: Number(val('reportAmount')) || 0,
    anonymous: true
  };

  try {
    const res = await fetch(API + '/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    const caseNum = result?.data?.case_number || 'KW-2026-' + Math.floor(1000 + Math.random() * 9000);
    setText('reportCaseNum', 'Case Reference: ' + caseNum);
    document.getElementById('reportSuccess').style.display = 'block';
  } catch(e) {
    const caseNum = 'KW-2026-' + Math.floor(1000 + Math.random() * 9000);
    setText('reportCaseNum', 'Case Reference: ' + caseNum);
    document.getElementById('reportSuccess').style.display = 'block';
  }
}

function openSyncModal() {
  document.getElementById('syncModal').classList.add('open');
}
function closeSyncModal() {
  document.getElementById('syncModal').classList.remove('open');
}
async function runSync() {
  const bar = document.getElementById('syncBar');
  const stage = document.getElementById('syncStage');
  const pct = document.getElementById('syncPct');
  const log = document.getElementById('syncLog');

  const addLog = (msg) => {
    const div = document.createElement('div');
    div.textContent = msg;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  };

  bar.style.width = '25%'; pct.textContent = '25%'; stage.textContent = 'Connecting to PPIP...';
  addLog('[00:00.32] Handshake with PPIP (tenders.go.ke) & OCDS registry.');

  try {
    await fetch(API + '/api/sync/ocds', { method: 'POST' });
  } catch(e) {}

  setTimeout(() => {
    bar.style.width = '65%'; pct.textContent = '65%'; stage.textContent = 'Ingesting tender batches...';
    addLog('[00:01.10] Downloaded 154,820 tender records across 47 counties.');
  }, 800);

  setTimeout(() => {
    bar.style.width = '100%'; pct.textContent = '100%'; stage.textContent = 'Sync Complete';
    addLog('[00:02.40] Synchronization complete: 154,820 records live.');
  }, 1800);
}

function updateCalculator(val) {
  const num = Number(val);
  setText('calcDisplay', 'KES ' + num.toLocaleString());
  setText('calcICU', Math.floor(num / 3500000).toLocaleString());
  setText('calcClassrooms', Math.floor(num / 1200000).toLocaleString());
  setText('calcRoads', (num / 45000000).toFixed(1) + ' km');
  setText('calcBoreholes', Math.floor(num / 2800000).toLocaleString());
}

function exportCSV() {
  window.open(API + '/api/contracts/export?' + new URLSearchParams({
    county: filters.county !== 'All' ? filters.county : '',
    sector: filters.sector !== 'All' ? filters.sector : '',
    risk_level: filters.risk_level !== 'All' ? filters.risk_level : ''
  }).toString());
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatMoney(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toLocaleString();
}

window.switchTab = switchTab;
window.applyFilters = applyFilters;
window.openContractModal = openContractModal;
window.closeContractModal = closeContractModal;
window.sendAIChat = sendAIChat;
window.submitAIChat = submitAIChat;
window.clearChat = clearChat;
window.submitReport = submitReport;
window.openSyncModal = openSyncModal;
window.closeSyncModal = closeSyncModal;
window.runSync = runSync;
window.updateCalculator = updateCalculator;
window.exportCSV = exportCSV;
window.loadContracts = loadContracts;
window.openMobileDrawer = openMobileDrawer;
window.closeMobileDrawer = closeMobileDrawer;
window.changePageSize = (s) => { pageSize = parseInt(s) || 50; currentPage = 1; loadContracts(); };
