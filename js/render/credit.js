// ===== CREDIT SCORING RENDER =====
// Data now comes directly from invoices[] — no EOM needed

const CUST_TYPES = ["Asuransi","Fleet","Leasing","Afiliasi","Personal"];
const CUST_TYPE_COLORS = {
  "Asuransi": {bg:"#dbeafe", text:"#1e40af"},
  "Fleet":    {bg:"#d1fae5", text:"#065f46"},
  "Leasing":  {bg:"#fef3c7", text:"#92400e"},
  "Afiliasi": {bg:"#ede9fe", text:"#6d28d9"},
  "Personal": {bg:"#f3f4f6", text:"#374151"},
};

let _creditCustomers = null;
let _creditSearchTimer = null;

function getCreditCustomers() {
  const invoices = visibleInvoices();
  return groupByCustomer(invoices);
}

function getFilteredCreditCustomers() {
  const customers = _creditCustomers || (_creditCustomers = getCreditCustomers());
  return customers.filter(c => {
    // Arsip = semua invoice customer ini udah Lunas (totalOutstanding 0). Skor tetap
    // tersimpan sebagai histori, cuma dipisah dari list "Aktif" biar gak nyampur.
    if(APP_STATE.creditArchiveView) { if(c.totalOutstanding > 0) return false; }
    else { if(c.totalOutstanding === 0) return false; }
    if(APP_STATE.creditFilterTier && APP_STATE.creditFilterTier !== "Semua" && c.score.category.label !== APP_STATE.creditFilterTier) return false;
    if(APP_STATE.creditFilterType && c.custType !== APP_STATE.creditFilterType) return false;
    if(APP_STATE.creditSearchQ && !c.masterName.toLowerCase().includes(APP_STATE.creditSearchQ.toLowerCase())) return false;
    return true;
  });
}

// Invalidate cache when invoices change
function invalidateCreditCache() { _creditCustomers = null; }

// ---- CREDIT DASHBOARD ----
function renderCreditDashboard() {
  const el = document.getElementById("creditDashContent");
  if(!el) return;
  const invoices = visibleInvoices();

  invalidateCreditCache();
  const customers = getCreditCustomers();
  const activeCustomers = customers.filter(c => c.totalOutstanding > 0);
  const distCustomers = APP_STATE.creditDistIncludeArchived ? customers : activeCustomers;
  const totalAR = customers.reduce((s,c) => s + c.totalOutstanding, 0);

  const dist = RISK_CATEGORIES.map(cat => ({
    ...cat,
    count: distCustomers.filter(c => c.score.category.label === cat.label).length,
    total: distCustomers.filter(c => c.score.category.label === cat.label).reduce((s,c) => s + c.totalOutstanding, 0),
  }));

  // Critical/riskFree/topWatch selalu dari customer AKTIF doang (gak ikut toggle) —
  // ini kartu "perlu perhatian sekarang", customer yang udah lunas gak relevan di sini.
  const critical  = activeCustomers.filter(c => c.score.total >= 80);
  const riskFree  = activeCustomers.filter(c => c.score.total < 20);
  const topWatch  = activeCustomers.filter(c => c.score.total >= 40).slice(0,5);
  const weekly    = getWeeklyPromise();

  // Bukpot stats from unified invoices
  const bukpotY   = invoices.filter(i => i.isBukpot === "Y" || i.isBukpot === "y");
  const bukpotN   = invoices.filter(i => i.total > 0 && i.stage !== "Lunas" && (!i.isBukpot || i.isBukpot === "N" || i.isBukpot === "n"));
  const pph23List = invoices.filter(i => i.pph23 && i.pph23 !== "");

  const fmtWeek = d => d ? new Date(d).toLocaleDateString("id-ID",{day:"2-digit",month:"short"}) : "-";

  el.innerHTML = `
    <!-- PAGE HEADER -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">AR Risk Assessment</div>
        <div class="page-subtitle">Global performance overview — ${APP_STATE.dealerFilter && APP_STATE.dealerFilter!=="Semua" ? APP_STATE.dealerFilter : "Seluruh Dealer"}.</div>
      </div>
      <div class="page-header-actions">
        <button class="btn-sm" onclick="openReportModal()">📋 Generate Report</button>
      </div>
    </div>

    ${invoices.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">🛡</div>
        <div class="empty-state-text">Belum ada data invoice</div>
        <div class="empty-state-sub">Upload XLS di AR Tracker untuk mulai analisis kredit</div>
      </div>` : `

    <!-- HERO CARD -->
    <div class="hero-card">
      <div>
        <div class="hero-label">Total AR Portfolio</div>
        <div class="hero-value">${fmtRp(totalAR)}</div>
        <div class="hero-sub">
          ${activeCustomers.length} active customers
          &nbsp;<span style="background:rgba(108,71,255,0.35);padding:2px 8px;border-radius:4px;font-size:11px;">
            ${activeCustomers.length > 0 ? `Avg Score: ${Math.round(activeCustomers.reduce((s,c)=>s+c.score.total,0)/activeCustomers.length)}` : "—"}
          </span>
        </div>
      </div>
      <div class="hero-pills">
        <div class="hero-pill">
          <div class="hero-pill-val" style="color:#f87171;">${critical.length}</div>
          <div class="hero-pill-label">Critical Cases</div>
        </div>
        <div class="hero-pill">
          <div class="hero-pill-val" style="color:#6ee7b7;">${riskFree.length}</div>
          <div class="hero-pill-label">Risk Free</div>
        </div>
      </div>
    </div>

    <!-- TIER DISTRIBUTION -->
    <div class="sec-hdr">
      <span class="sec-title">Distribusi Risiko Customer</span>
      <span class="sec-link" style="font-size:11px;" onclick="APP_STATE.creditDistIncludeArchived=!APP_STATE.creditDistIncludeArchived;renderCreditDashboard();">
        ${APP_STATE.creditDistIncludeArchived ? "↩ Cuma Aktif" : "📦 Lihat Keseluruhan"}
      </span>
    </div>
    <div class="tier-grid">
      ${dist.map(d => `
        <div class="tier-card" style="background:${d.bg};border-color:${d.border};"
          onclick="APP_STATE.creditFilterTier=APP_STATE.creditFilterTier===d.label?null:d.label;switchCreditTab('customers',document.querySelectorAll('#creditSubtabs .subtab')[1])">
          <div class="tier-icon">${d.icon}</div>
          <div class="tier-count" style="color:${d.color};">${d.count}</div>
          <div class="tier-label" style="color:${d.color};">${d.label}</div>
          <div class="tier-val" style="color:${d.color};">${fmtRpShort(d.total)}</div>
        </div>`).join("")}
    </div>

    <!-- TREND + WATCHLIST -->
    <div class="grid-2">
      <div class="card">
        <div class="sec-hdr"><span class="sec-title">Credit Risk Exposure Trend</span><span style="font-size:11px;color:var(--gray-400);">by Risk Tier</span></div>
        <div class="trend-bars">
          ${dist.map((d,i) => `
            <div class="trend-bar-wrap">
              <div class="trend-bar ${i===dist.length-1?"current":""}"
                style="height:${d.total>0?Math.max(Math.round(d.total/totalAR*100*0.8),4):4}px;background:${d.color};opacity:${d.count>0?1:0.2};"></div>
              <div class="trend-bar-label">${d.label.split(" ")[0]}</div>
            </div>`).join("")}
        </div>
      </div>

      <div class="card">
        <div class="sec-hdr">
          <span class="sec-title">Top Watchlist</span>
          <span class="sec-link" onclick="switchCreditTab('customers',document.querySelectorAll('#creditSubtabs .subtab')[1])">View all →</span>
        </div>
        ${topWatch.length > 0 ? topWatch.map(c => `
          <div class="watch-row" onclick="showCustDetailModal('${encodeURIComponent(c.masterName)}')">
            <div>
              <div class="watch-name">${c.masterName}</div>
              <div class="watch-sub">${fmtRpShort(c.totalOutstanding)} · Due ${c.invoices.filter(i=>i.jthTempo).length > 0 ? daysDiff(new Date().toISOString().slice(0,10), [...c.invoices].sort((a,b)=>new Date(a.jthTempo)-new Date(b.jthTempo))[0].jthTempo)+" days" : "—"}</div>
            </div>
            <span class="badge" style="background:${c.score.category.bg};color:${c.score.category.color};border:0.5px solid ${c.score.category.border};">${c.score.category.icon} ${c.score.category.label}</span>
          </div>`).join("") : `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">Tidak ada customer berisiko</div></div>`}
      </div>
    </div>

    <!-- BUKPOT & PPH -->
    <div class="card" style="margin-bottom:14px;">
      <div class="sec-hdr"><span class="sec-title">📄 PPh 23 & Bukti Potong Status</span></div>
      <div class="grid-3" style="margin-bottom:0;">
        <div style="padding:12px;background:var(--green-light);border-radius:var(--r-md);border:0.5px solid #bbf7d0;cursor:pointer;" onclick="switchCreditTab('customers',document.querySelectorAll('#creditSubtabs .subtab')[1])">
          <p style="font-size:11px;color:var(--gray-400);margin-bottom:4px;">Sudah Bukpot</p>
          <p style="font-size:18px;font-weight:600;color:var(--green);">${bukpotY.length}</p>
          <p style="font-size:11px;color:var(--green);">${fmtRpShort(bukpotY.reduce((s,i)=>s+i.total,0))}</p>
        </div>
        <div style="padding:12px;background:var(--red-light);border-radius:var(--r-md);border:0.5px solid #fecaca;cursor:pointer;">
          <p style="font-size:11px;color:var(--gray-400);margin-bottom:4px;">Belum Bukpot</p>
          <p style="font-size:18px;font-weight:600;color:var(--red);">${bukpotN.length}</p>
          <p style="font-size:11px;color:var(--red);">${fmtRpShort(bukpotN.reduce((s,i)=>s+i.total,0))}</p>
        </div>
        <div style="padding:12px;background:var(--amber-light);border-radius:var(--r-md);border:0.5px solid #fde68a;cursor:pointer;">
          <p style="font-size:11px;color:var(--gray-400);margin-bottom:4px;">Ada PPh 23</p>
          <p style="font-size:18px;font-weight:600;color:var(--amber);">${pph23List.length}</p>
          <p style="font-size:11px;color:var(--amber);">${fmtRpShort(pph23List.reduce((s,i)=>s+i.total,0))}</p>
        </div>
      </div>
    </div>

    <!-- PROMISE TO PAY WEEKLY -->
    <div class="card" style="margin-bottom:14px;">
      <div class="sec-hdr">
        <span class="sec-title">📅 Promise to Pay Weekly</span>
        <span style="font-size:11px;color:var(--gray-400);">Minggu ${fmtWeek(weekly.startOfWeek)} – ${fmtWeek(weekly.endOfWeek)}</span>
      </div>
      <div class="grid-3" style="margin-bottom:${weekly.overdue.length>0?"12px":"0"};">
        <div style="padding:12px;background:var(--blue-light);border-radius:var(--r-md);border:0.5px solid #bfdbfe;">
          <p style="font-size:11px;color:var(--gray-400);margin-bottom:4px;">Proyeksi Minggu Ini</p>
          <p style="font-size:18px;font-weight:600;color:var(--blue);">${fmtRpShort(weekly.thisWeekTotal)}</p>
          <p style="font-size:11px;color:var(--blue);">${weekly.thisWeek.length} invoice</p>
        </div>
        <div style="padding:12px;background:var(--red-light);border-radius:var(--r-md);border:0.5px solid #fecaca;">
          <p style="font-size:11px;color:var(--gray-400);margin-bottom:4px;">⚠️ Overdue Promise</p>
          <p style="font-size:18px;font-weight:600;color:var(--red);">${fmtRpShort(weekly.overdueTotal)}</p>
          <p style="font-size:11px;color:var(--red);">${weekly.overdue.length} invoice lewat janji</p>
        </div>
        <div style="padding:12px;background:var(--green-light);border-radius:var(--r-md);border:0.5px solid #bbf7d0;">
          <p style="font-size:11px;color:var(--gray-400);margin-bottom:4px;">Proyeksi Minggu Depan</p>
          <p style="font-size:18px;font-weight:600;color:var(--green);">${fmtRpShort(weekly.nextWeekTotal)}</p>
          <p style="font-size:11px;color:var(--green);">${weekly.nextWeek.length} invoice</p>
        </div>
      </div>
      ${weekly.overdue.length > 0 ? `
        <p style="font-size:12px;font-weight:600;color:var(--red);margin-bottom:8px;">Overdue Promise:</p>
        <div style="display:flex;flex-direction:column;gap:5px;max-height:160px;overflow-y:auto;">
          ${weekly.overdue.slice(0,8).map(i=>`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--red-light);border-radius:var(--r-sm);border:0.5px solid #fecaca;font-size:11px;">
              <div><strong>${i.noInvoice}</strong><span style="color:var(--gray-400);margin-left:6px;">${i.namaCust}</span></div>
              <div style="display:flex;gap:8px;align-items:center;">
                <span style="color:var(--red);">Janji: ${fmtDate(i.promiseToPay)}</span>
                <span style="font-weight:600;">${fmtRpShort(i.total)}</span>
              </div>
            </div>`).join("")}
          ${weekly.overdue.length>8?`<p style="font-size:11px;color:var(--gray-400);text-align:center;">+${weekly.overdue.length-8} lainnya</p>`:""}
        </div>` : ""}
    </div>

    ${critical.length > 0 ? `
      <div class="card" style="border-color:var(--gray-700);">
        <div class="sec-hdr"><span class="sec-title" style="color:var(--gray-900);">⚫ Critical — Tindakan Segera</span></div>
        ${critical.slice(0,5).map(c => `
          <div class="watch-row" onclick="showCustDetailModal('${encodeURIComponent(c.masterName)}')">
            <div>
              <div class="watch-name">${c.masterName}</div>
              <div class="watch-sub">${fmtRpShort(c.totalOutstanding)} · ${c.custType}${c.score.autoCritical?" · P05 FRAUD":""}</div>
            </div>
            <span style="font-size:14px;font-weight:700;color:var(--gray-900);">Skor ${c.score.total}</span>
          </div>`).join("")}
        ${critical.length>5?`<div class="attention-more" onclick="APP_STATE.creditFilterTier='Critical';switchCreditTab('customers',document.querySelectorAll('#creditSubtabs .subtab')[1])">+${critical.length-5} lainnya →</div>`:""}
      </div>` : ""}
    `}
  `;
}

// ---- CUSTOMER LIST ----
function renderCreditCustomers() {
  const el = document.getElementById("creditCustContent");
  if(!el) return;
  const invoices = visibleInvoices();

  invalidateCreditCache();
  const filtered = getFilteredCreditCustomers();
  const selectedName = APP_STATE.custDetailName;
  const allCustomers = getCreditCustomers();
  const archivedCount = allCustomers.filter(c => c.totalOutstanding === 0).length;
  const activeCount = allCustomers.length - archivedCount;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:${selectedName?"1fr 440px":"1fr"};gap:14px;height:calc(100vh - 175px);">

      <!-- LIST -->
      <div style="display:flex;flex-direction:column;overflow:hidden;">
        <div style="display:flex;gap:6px;margin-bottom:10px;">
          <button class="subtab ${!APP_STATE.creditArchiveView?"active":""}"
            onclick="APP_STATE.creditArchiveView=false;APP_STATE.creditPage=1;renderCreditCustomers()">
            Aktif (${activeCount})
          </button>
          <button class="subtab ${APP_STATE.creditArchiveView?"active":""}"
            onclick="APP_STATE.creditArchiveView=true;APP_STATE.creditPage=1;renderCreditCustomers()">
            📦 Arsip — Lunas Semua (${archivedCount})
          </button>
        </div>
        ${APP_STATE.creditArchiveView ? `
          <p style="font-size:11px;color:var(--gray-400);margin:-4px 0 10px;">
            Customer yang semua invoice-nya sudah lunas. Skor risiko tetap tersimpan sebagai histori, tidak masuk hitungan Top Watchlist.
          </p>` : ""}
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
          <input type="text" class="filter-search" placeholder="Cari customer..."
            value="${APP_STATE.creditSearchQ.replace(/"/g,'&quot;')}"
            oninput="APP_STATE.creditSearchQ=this.value;clearTimeout(_creditSearchTimer);_creditSearchTimer=setTimeout(()=>renderCreditCustomers(),250)"/>
          <select class="filter-select" onchange="APP_STATE.creditFilterTier=this.value==='Semua'?null:this.value;renderCreditCustomers()">
            <option value="Semua" ${!APP_STATE.creditFilterTier?"selected":""}>Semua Risk</option>
            ${RISK_CATEGORIES.map(r=>`<option value="${r.label}" ${APP_STATE.creditFilterTier===r.label?"selected":""}>${r.icon} ${r.label}</option>`).join("")}
          </select>
          <select class="filter-select" onchange="APP_STATE.creditFilterType=this.value;renderCreditCustomers()">
            <option value="">Semua Tipe</option>
            ${CUST_TYPES.map(t=>`<option value="${t}" ${APP_STATE.creditFilterType===t?"selected":""}>${t}</option>`).join("")}
          </select>
          <span style="margin-left:auto;font-size:12px;color:var(--gray-400);">${filtered.length} customer</span>
        </div>

        ${APP_STATE.creditFilterTier ? `
          <div style="background:var(--purple-light);border:0.5px solid #c4b5fd;border-radius:var(--r-md);padding:7px 12px;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:var(--purple-dark);">Filter: <strong>${APP_STATE.creditFilterTier}</strong></span>
            <button onclick="APP_STATE.creditFilterTier=null;renderCreditCustomers()" style="margin-left:auto;background:transparent;border:none;color:var(--purple);font-size:16px;cursor:pointer;">×</button>
          </div>` : ""}

        <div class="table-wrap" style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
          ${filtered.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon">👤</div>
              <div class="empty-state-text">${invoices.length===0?"Upload data invoice terlebih dahulu":"Tidak ada customer yang cocok"}</div>
            </div>` : `
            <div style="overflow:auto;flex:1;">
              <table style="min-width:700px;">
                <thead style="position:sticky;top:0;z-index:10;">
                  <tr>
                    <th>Customer</th><th>Tipe</th><th>Invoice</th>
                    <th style="text-align:right;">Outstanding</th>
                    <th>Risk Score</th><th>Kategori</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.slice(0, APP_STATE.CREDIT_PAGE_SIZE * APP_STATE.creditPage).map(c => `
                    <tr onclick="showCustDetailModal('${encodeURIComponent(c.masterName)}')" style="cursor:pointer;${selectedName===c.masterName?"background:var(--purple-light) !important;":""}">
                      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;">
                        <strong style="font-size:12px;">${c.masterName}</strong>
                        ${c.score.autoCritical?`<span class="badge badge-red" style="font-size:10px;margin-left:3px;">P05</span>`:""}
                        ${c.aliases.length>1?`<span style="font-size:10px;color:var(--gray-400);"> (${c.aliases.length})</span>`:""}
                      </td>
                      <td><span class="badge" style="background:${(CUST_TYPE_COLORS[c.custType]||CUST_TYPE_COLORS.Personal).bg};color:${(CUST_TYPE_COLORS[c.custType]||CUST_TYPE_COLORS.Personal).text};">${c.custType}</span></td>
                      <td style="text-align:center;font-size:12px;">${c.invoiceCount}</td>
                      <td style="text-align:right;font-size:12px;font-weight:500;">${fmtRpShort(c.totalOutstanding)}</td>
                      <td>
                        <div style="display:flex;align-items:center;gap:6px;">
                          <div style="width:50px;height:5px;background:var(--gray-100);border-radius:3px;overflow:hidden;">
                            <div style="width:${c.score.total}%;height:100%;background:${c.score.category.color};border-radius:3px;"></div>
                          </div>
                          <span style="font-weight:700;font-size:12px;color:${c.score.category.color};">${c.score.total}</span>
                        </div>
                      </td>
                      <td><span class="badge" style="background:${c.score.category.bg};color:${c.score.category.color};border:0.5px solid ${c.score.category.border};">${c.score.category.icon} ${c.score.category.label}</span></td>
                      <td style="color:var(--gray-300);font-size:14px;">›</td>
                    </tr>`).join("")}
                </tbody>
              </table>
              ${filtered.length > APP_STATE.CREDIT_PAGE_SIZE * APP_STATE.creditPage ? `
                <div style="padding:10px;text-align:center;">
                  <button class="btn-ghost" style="font-size:12px;" onclick="APP_STATE.creditPage++;renderCreditCustomers()">
                    Load more (${filtered.length - APP_STATE.CREDIT_PAGE_SIZE * APP_STATE.creditPage} lagi)
                  </button>
                </div>` : ""}
            </div>`}
        </div>
      </div>

      <!-- DETAIL PANEL -->
      ${selectedName ? `<div style="overflow-y:auto;height:100%;">${renderCustDetailPanel(selectedName)}</div>` : ""}
    </div>
  `;
}

function showCustDetailModal(encodedName) {
  const name = decodeURIComponent(encodedName);
  APP_STATE.custDetailName = name;
  APP_STATE.creditTab = "customers";
  renderCreditCustomers();
}

function renderCustDetailPanel(encodedName) {
  const name = decodeURIComponent(encodedName);
  const customers = _creditCustomers || getCreditCustomers();
  const cust = customers.find(c => c.masterName === name);
  if(!cust) return "";

  const {total, breakdown, category, autoCritical} = cust.score;
  const agingBuckets = [
    {label:"Lancar", val:cust.invoices.reduce((s,i)=>s+i.lancar,0),       color:"#16a34a"},
    {label:"1-30",   val:cust.invoices.reduce((s,i)=>s+i.aging1_30,0),    color:"#d97706"},
    {label:"31-60",  val:cust.invoices.reduce((s,i)=>s+i.aging31_60,0),   color:"#ea580c"},
    {label:"61-90",  val:cust.invoices.reduce((s,i)=>s+i.aging61_90,0),   color:"#dc2626"},
    {label:">90",    val:cust.invoices.reduce((s,i)=>s+(i.aging91_120||0)+i.aging121_150+i.agingOver150,0), color:"#7f1d1d"},
  ];
  const totalAging = agingBuckets.reduce((s,b) => s+b.val, 0);

  const probCounts = {};
  cust.invoices.forEach(i => { if(i.problemId) probCounts[i.problemId] = (probCounts[i.problemId]||0) + 1; });

  const promises = cust.invoices.filter(i => i.promiseToPay);
  const overdue = promises.filter(i => {
  if(!i.promiseToPay || i.promiseToPay === "" || i.promiseToPay === "0") return false;
  const d = new Date(i.promiseToPay);
  return !isNaN(d) && d.getFullYear() > 2000 && d < new Date() && i.stage !== "Lunas";
});

  const dimLabels = {A:"Payment Behavior", B:"Problem Pattern", C:"Volume & Konsistensi", D:"Promise to Pay"};
  const dimWeights = {A:"40%", B:"25%", C:"20%", D:"15%"};
  const dimColors  = {A:"#1e40af", B:"#dc2626", C:"#7c3aed", D:"#16a34a"};

  return `
    <div class="card" style="height:100%;overflow-y:auto;padding:0;">
      <div style="padding:12px 14px;border-bottom:0.5px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;position:sticky;top:0;background:#fff;z-index:5;">
        <div>
          <p style="font-weight:600;font-size:13px;max-width:260px;overflow:hidden;text-overflow:ellipsis;">${cust.masterName}</p>
          <div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap;">
            <span class="badge" style="background:${(CUST_TYPE_COLORS[cust.custType]||CUST_TYPE_COLORS.Personal).bg};color:${(CUST_TYPE_COLORS[cust.custType]||CUST_TYPE_COLORS.Personal).text};">${cust.custType}</span>
            ${autoCritical?`<span class="badge badge-red">P05 FRAUD</span>`:""}
          </div>
        </div>
        <button onclick="APP_STATE.custDetailName=null;renderCreditCustomers()" style="background:none;font-size:20px;color:var(--gray-300);border:none;cursor:pointer;line-height:1;">×</button>
      </div>

      <!-- RISK SCORE -->
      <div style="padding:14px;background:${category.bg};border-bottom:0.5px solid var(--border);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div>
            <p style="font-size:11px;color:var(--gray-400);">Risk Score</p>
            <p style="font-size:28px;font-weight:700;color:${category.color};">${total}</p>
          </div>
          <span style="font-size:13px;font-weight:600;padding:6px 12px;border-radius:var(--r-md);background:${category.color};color:#fff;">${category.icon} ${category.label}</span>
        </div>
        <div style="height:6px;background:rgba(0,0,0,0.1);border-radius:3px;overflow:hidden;">
          <div style="width:${total}%;height:100%;background:${category.color};border-radius:3px;"></div>
        </div>

        <!-- SCORE BREAKDOWN -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px;">
          ${Object.entries(breakdown).map(([dim,score]) => `
            <div style="text-align:center;padding:6px;background:rgba(255,255,255,0.6);border-radius:var(--r-sm);">
              <div style="font-size:14px;font-weight:700;color:${dimColors[dim]||"#374151"};">${score}</div>
              <div style="font-size:9px;color:var(--gray-400);">${dim}</div>
              <div style="font-size:9px;color:var(--gray-400);">${dimWeights[dim]||""}</div>
            </div>`).join("")}
        </div>
      </div>

      <div style="padding:14px;display:flex;flex-direction:column;gap:12px;">

        <!-- SCORE DIMENSIONS -->
        <div>
          <p style="font-size:12px;font-weight:600;margin-bottom:8px;">Score Breakdown</p>
          ${Object.entries(breakdown).map(([dim,score]) => `
            <div style="margin-bottom:6px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
                <span style="color:var(--gray-500);">${dim}. ${dimLabels[dim]||dim}</span>
                <span style="font-weight:600;color:${dimColors[dim]};">${score}</span>
              </div>
              <div style="height:4px;background:var(--gray-100);border-radius:2px;overflow:hidden;">
                <div style="width:${score}%;height:100%;background:${dimColors[dim]};border-radius:2px;"></div>
              </div>
            </div>`).join("")}
        </div>

        <!-- AGING -->
        <div style="border-top:0.5px solid var(--border);padding-top:10px;">
          <p style="font-size:12px;font-weight:600;margin-bottom:8px;">Aging Distribution</p>
          ${agingBuckets.map(b => {
            const pct = totalAging > 0 ? b.val/totalAging*100 : 0;
            return `
              <div class="aging-row">
                <div class="aging-label">${b.label}</div>
                <div class="aging-track"><div class="aging-fill" style="width:${Math.min(pct,100)}%;background:${b.color};"></div></div>
                <div class="aging-val" style="color:${b.color};">${fmtRpShort(b.val)}</div>
              </div>`;
          }).join("")}
        </div>

        <!-- INVOICE LIST -->
        <div style="border-top:0.5px solid var(--border);padding-top:10px;">
          <p style="font-size:12px;font-weight:600;margin-bottom:8px;">Invoice (${cust.invoiceCount})</p>
          <div style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">
            ${cust.invoices.map(i => `
              <div onclick="openDetail('${i.id}')"
                style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:0.5px solid var(--border);border-radius:var(--r-sm);cursor:pointer;font-size:11px;background:var(--gray-50);">
                <div>
                  <strong>${i.noInvoice}</strong>
                  ${i.problemId?`<span class="badge badge-red" style="font-size:9px;margin-left:3px;">${i.problemId}</span>`:""}
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                  <span class="badge" style="background:${STAGE_COLORS[i.stage]}22;color:${STAGE_COLORS[i.stage]};">${i.stage}</span>
                  <span style="font-weight:500;">${fmtRpShort(i.total)}</span>
                </div>
              </div>`).join("")}
          </div>
        </div>

        <!-- PROBLEM IDs -->
        ${Object.keys(probCounts).length > 0 ? `
          <div style="border-top:0.5px solid var(--border);padding-top:10px;">
            <p style="font-size:12px;font-weight:600;margin-bottom:8px;">Problem Identification</p>
            ${Object.entries(probCounts).map(([pid,cnt]) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--red-light);border-radius:var(--r-sm);margin-bottom:4px;font-size:11px;">
                <span style="font-weight:500;color:var(--red);">${pid}</span>
                <span style="color:var(--red);">${cnt}x</span>
              </div>`).join("")}
          </div>` : ""}

        <!-- PROMISES -->
        ${promises.length > 0 ? `
          <div style="border-top:0.5px solid var(--border);padding-top:10px;">
            <p style="font-size:12px;font-weight:600;margin-bottom:8px;">Promise to Pay (${promises.length})</p>
            ${promises.map(i => {
              const overdue = new Date(i.promiseToPay) < new Date() && i.stage !== "Lunas";
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:${overdue?"var(--red-light)":"var(--blue-light)"};border-radius:var(--r-sm);margin-bottom:4px;font-size:11px;">
                  <div><strong>${i.noInvoice}</strong><span style="color:var(--gray-400);margin-left:4px;">${fmtRpShort(i.total)}</span></div>
                  <span style="color:${overdue?"var(--red)":"var(--blue)"};font-weight:500;">${fmtDate(i.promiseToPay)}${overdue?" ⚠️":""}</span>
                </div>`;
            }).join("")}
          </div>` : ""}

        <!-- CUSTOMER TYPE OVERRIDE -->
        <div style="border-top:0.5px solid var(--border);padding-top:10px;">
          <label class="form-label">Override Tipe Customer</label>
          <select class="form-input" onchange="overrideCustType('${encodeURIComponent(cust.masterName)}',this.value)">
            <option value="">Auto: ${cust.custType}</option>
            ${CUST_TYPES.map(t=>`<option value="${t}" ${cust.custTypeOverride===t?"selected":""}>${t}</option>`).join("")}
          </select>
        </div>

        <!-- CUSTOMER MAPPING -->
        <div>
          <label class="form-label">Alias Names</label>
          <div style="display:flex;flex-direction:column;gap:3px;">
            ${cust.aliases.map(a => `<span style="font-size:11px;color:var(--gray-400);padding:3px 6px;background:var(--gray-50);border-radius:4px;">${a}</span>`).join("")}
          </div>
        </div>

      </div>
    </div>`;
}

function overrideCustType(encodedName, custType) {
  const name = decodeURIComponent(encodedName);
  // Update all invoices with this masterName
  invoices = invoices.map(i => {
    if(getMasterName(i.namaCust) === name) return {...i, custTypeOverride: custType};
    return i;
  });
  saveStorage();
  invalidateCreditCache();
  renderCreditCustomers();
  toast("Tipe customer diupdate", "success");
}

// ---- CREDIT INPUT ----
function renderCreditInput() {
  const el = document.getElementById("creditInputContent");
  if(!el) return;

  // Pending enrichment: invoices that still need problemId/bukpot/promise
  const needsEnrichment = invoices.filter(i =>
    i.stage !== "Lunas" && (!i.problemId && !i.isBukpot && !i.promiseToPay)
  );
  const hasEnrichment = invoices.filter(i => i.problemId || i.isBukpot || i.promiseToPay || i.lastRemark);

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">Input & Enrichment Data</div>
        <div class="page-subtitle">Isi Problem ID, Bukpot, Promise to Pay on the spot.</div>
      </div>
    </div>

    <!-- SUMMARY -->
    <div class="metric-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px;">
      <div class="metric-card ac-amber">
        <div class="metric-label">Perlu Enrichment</div>
        <div class="metric-value">${needsEnrichment.length}</div>
        <div class="metric-sub">invoice aktif tanpa data</div>
      </div>
      <div class="metric-card ac-green">
        <div class="metric-label">Sudah Enriched</div>
        <div class="metric-value">${hasEnrichment.length}</div>
        <div class="metric-sub">invoice dengan data</div>
      </div>
      <div class="metric-card ac-purple">
        <div class="metric-label">Total Invoice</div>
        <div class="metric-value">${invoices.length}</div>
        <div class="metric-sub">semua status</div>
      </div>
    </div>

    <!-- ENRICHMENT TABLE -->
    <div class="card">
      <div class="sec-hdr">
        <span class="sec-title">Invoice — Quick Enrichment</span>
        <span style="font-size:11px;color:var(--gray-400);">Edit langsung di tabel</span>
      </div>
      <div style="overflow-x:auto;">
        <table style="min-width:900px;">
          <thead>
            <tr>
              <th>No. Invoice</th><th>Customer</th><th>Divisi</th><th>Stage</th>
              <th>Problem ID</th><th>Bukpot</th><th>Promise to Pay</th><th>Last Remark</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.filter(i=>i.stage!=="Lunas").slice(0,200).map(i => `
              <tr>
                <td style="font-size:11px;font-weight:500;">${i.noInvoice}</td>
                <td style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;">${i.namaCust}</td>
                <td><span class="badge divisi-${i.sbr}">${i.sbr}</span></td>
                <td><span class="badge" style="background:${STAGE_COLORS[i.stage]}22;color:${STAGE_COLORS[i.stage]};font-size:10px;">${i.stage}</span></td>
                <td>
                  <select style="font-size:11px;padding:3px 6px;border:0.5px solid var(--border);border-radius:4px;background:#fff;min-width:90px;"
                    onchange="saveEnrichmentField('${i.id}','problemId',this.value);invalidateCreditCache()">
                    <option value="" ${!i.problemId?"selected":""}>—</option>
                    ${PROBLEM_IDS.map(p=>`<option value="${p.id}" ${i.problemId===p.id?"selected":""}>${p.id}</option>`).join("")}
                  </select>
                </td>
                <td>
                  <select style="font-size:11px;padding:3px 6px;border:0.5px solid var(--border);border-radius:4px;background:#fff;"
                    onchange="saveEnrichmentField('${i.id}','isBukpot',this.value);invalidateCreditCache()">
                    <option value="" ${!i.isBukpot?"selected":""}>—</option>
                    <option value="Y" ${i.isBukpot==="Y"?"selected":""}>Y</option>
                    <option value="N" ${i.isBukpot==="N"?"selected":""}>N</option>
                  </select>
                </td>
                <td>
                  <input type="date" style="font-size:11px;padding:3px 6px;border:0.5px solid var(--border);border-radius:4px;background:#fff;"
                    value="${i.promiseToPay||""}"
                    onchange="saveEnrichmentField('${i.id}','promiseToPay',this.value);invalidateCreditCache()"/>
                </td>
                <td>
                  <input type="text" style="font-size:11px;padding:3px 6px;border:0.5px solid var(--border);border-radius:4px;background:#fff;min-width:120px;"
                    value="${(i.lastRemark||"").replace(/"/g,'&quot;')}"
                    placeholder="Remark..."
                    onchange="saveEnrichmentField('${i.id}','lastRemark',this.value)"/>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
        ${invoices.filter(i=>i.stage!=="Lunas").length > 200 ? `<p style="padding:10px 12px;font-size:12px;color:var(--gray-400);">Menampilkan 200 dari ${invoices.filter(i=>i.stage!=="Lunas").length}. Gunakan filter di Monitoring Invoice.</p>` : ""}
      </div>
    </div>
  `;
}
