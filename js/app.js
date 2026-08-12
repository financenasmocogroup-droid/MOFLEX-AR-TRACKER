// ===== GLOBAL APP STATE =====
const APP_STATE = {
  currentPage:   "ar",       // exec | ar | credit | settings
  arTab:         "dashboard",// dashboard | monitoring | aging
  creditTab:     "dashboard",// dashboard | customers | input
  user:          null,
  filterStage:   "Semua",
  filterDivisi:  "Semua",
  filterAlert:   false,
  searchQ:       "",
  selectedIds:   new Set(),
  selectedId:    null,
  detailTab:     "detail",
  dashBreakdown: false,
  agingFilterKey:    null,
  agingFilterDivisi: null,
  activeFilterBanner: null,
  creditFilterTier:   null,
  custDetailName:     null,
  creditSearchQ:      "",
  creditPage:         1,
  CREDIT_PAGE_SIZE:   50,
  dealerFilter:       "Semua", // khusus SuperAdmin — "Semua" = lihat semua dealer
  creditArchiveView:  false, // false = Aktif (masih outstanding), true = Arsip (lunas semua)
  creditDistIncludeArchived: false, // toggle "Lihat Keseluruhan" di donut Credit Risk Distribution
  historyCache: {}, // NEW: cache hasil Api.getHistory per invoiceId, biar gak fetch ulang tiap render
  followUpCache: {}, // NEW: cache hasil Api.getFollowUps per invoiceId (lazy-load, gak di-embed lagi di getInvoices)
};

// ===== SETTINGS LOAD =====
function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_SETTINGS_V2)
             || localStorage.getItem(LS_SETTINGS); // fallback old key
    if(raw) {
      const s = JSON.parse(raw);
      if(s.stuckDays)  STUCK_DAYS   = {...DEFAULT_STUCK_DAYS,  ...s.stuckDays};
      if(s.docsConfig) DOCS_CONFIG  = {...DEFAULT_DOCS,        ...s.docsConfig};
      if(s.master)     Object.assign(MASTER, s.master);
    }
  } catch {}
}

async function saveSettings(stuckDays, docsConfig, master) {
  STUCK_DAYS  = {...DEFAULT_STUCK_DAYS,  ...stuckDays};
  DOCS_CONFIG = {...DEFAULT_DOCS,        ...docsConfig};
  if(master) Object.assign(MASTER, master);
  localStorage.setItem(LS_SETTINGS_V2, JSON.stringify({stuckDays, docsConfig, master:MASTER}));

  // FIXED: sebelumnya cuma kesimpen ke localStorage browser masing-masing, gak
  // pernah sync ke backend — beda device/user beda settingan. Sekarang di-push ke
  // Settings sheet juga. Backend cuma ngizinin role "head" (handleSaveSettings),
  // jadi form-nya juga udah di-disable buat role lain di renderSettings().
  if(Api.isLoggedIn() && APP_STATE.user?.role === "head") {
    const payload = {};
    Object.entries(STUCK_DAYS).forEach(([stage, days]) => { payload[`stuck_${stage}`] = days; });
    Object.entries(DOCS_CONFIG).forEach(([key, docs]) => { payload[`docs_${key}`] = docs; });
    payload.company_info = MASTER;
    try {
      await Api.saveSettings(payload);
    } catch(e) {
      console.warn("Settings sync error:", e);
      toast("Settings tersimpan lokal, tapi gagal sync ke server", "error");
    }
  }
}

// Sub-tipe keyword (Mobil Leasing/Cash, GRP Fleet/NRM) — head-only, konsisten
// sama Stuck Threshold/Docs Config/Info Perusahaan di atas.
async function saveSubTipeKeywords(kw) {
  saveSubTipeKeywordsLocal(kw);
  if(Api.isLoggedIn() && APP_STATE.user?.role === "head") {
    try {
      await Api.saveSettings({ subtipe_keywords: subTipeKeywords });
    } catch(e) {
      console.warn("Sync subtipe keywords error:", e);
      toast("Keyword sub-tipe tersimpan lokal, tapi gagal sync ke server", "error");
    }
  }
}

// ===== NAVIGATION =====
const PAGE_META = {
  exec:     { title:"Executive Summary",           subtitle:"Laporan real-time kondisi keuangan." },
  ar:       { title:"Accounts Receivable Tracker", subtitle:"Real-time outstanding monitoring dan pipeline analysis." },
  credit:   { title:"Credit Risk Assessment",      subtitle:"Profil risiko dan scoring customer Nasmoco Kaligawe." },
  users:    { title:"User & Role Management",      subtitle:"Kelola akun dan hak akses pengguna." },
  settings: { title:"Settings",                    subtitle:"Konfigurasi sistem dan preferensi." },
};

function navigateTo(page) {
  APP_STATE.currentPage = page;

  // Update sidebar active
  document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
  const navEl = document.getElementById(`nav-${page}`);
  if(navEl) navEl.classList.add("active");

  // Update topbar title
  const meta = PAGE_META[page] || {};
  document.getElementById("topbarTitle").textContent = meta.title || page;

  // Show/hide pages
  document.querySelectorAll(".page").forEach(el => el.style.display = "none");
  const pageEl = document.getElementById(`page-${page}`);
  if(pageEl) pageEl.style.display = "block";

  // Show/hide topbar actions
  const btnUpload = document.getElementById("btnUpload");
  const btnReport = document.getElementById("btnReport");
  const btnExport = document.getElementById("btnExport");
  if(btnUpload) btnUpload.style.display = (page === "ar") ? "" : "none";
  if(btnReport) btnReport.style.display = (page === "ar" || page === "exec") ? "" : "none";
  if(btnExport) btnExport.style.display = (page === "ar" || page === "credit") ? "" : "none";

  // Render
  renderCurrentPage();
}

function renderCurrentPage() {
  const p = APP_STATE.currentPage;
  if(p === "exec")     renderExec();
  else if(p === "ar")  renderARPage();
  else if(p === "credit") renderCreditPage();
  else if(p === "users") renderUsers();
  else if(p === "settings") renderSettings();

  // Update header count
  const hc = document.getElementById("headerCount");
  if(hc) hc.textContent = invoices.length > 0 ? `${invoices.length} invoice` : "";
}

// ===== AR TAB SWITCHING =====
function switchARTab(tab, btn) {
  APP_STATE.arTab = tab;
  document.querySelectorAll("#arSubtabs .subtab").forEach(b => b.classList.remove("active"));
  if(btn) btn.classList.add("active");

  ["dashboard","monitoring","aging"].forEach(t => {
    const el = document.getElementById(`ar-tab-${t}`);
    if(el) el.style.display = t === tab ? "" : "none";
  });

  if(tab === "dashboard")   renderARDashboard();
  else if(tab === "monitoring") renderMonitoring();
  else if(tab === "aging")  renderAging();
}

function renderARPage() {
  const tab = APP_STATE.arTab;
  ["dashboard","monitoring","aging"].forEach(t => {
    const el = document.getElementById(`ar-tab-${t}`);
    if(el) el.style.display = t === tab ? "" : "none";
  });
  if(tab === "dashboard")   renderARDashboard();
  else if(tab === "monitoring") renderMonitoring();
  else if(tab === "aging")  renderAging();
}

// ===== CREDIT TAB SWITCHING =====
function switchCreditTab(tab, btn) {
  APP_STATE.creditTab = tab;
  document.querySelectorAll("#creditSubtabs .subtab").forEach(b => b.classList.remove("active"));
  if(btn) btn.classList.add("active");

  ["dashboard","customers","input"].forEach(t => {
    const el = document.getElementById(`credit-tab-${t}`);
    if(el) el.style.display = t === tab ? "" : "none";
  });

  if(tab === "dashboard")   renderCreditDashboard();
  else if(tab === "customers") renderCreditCustomers();
  else if(tab === "input")  renderCreditInput();
}

function renderCreditPage() {
  const tab = APP_STATE.creditTab;
  ["dashboard","customers","input"].forEach(t => {
    const el = document.getElementById(`credit-tab-${t}`);
    if(el) el.style.display = t === tab ? "" : "none";
  });
  if(tab === "dashboard")   renderCreditDashboard();
  else if(tab === "customers") renderCreditCustomers();
  else if(tab === "input")  renderCreditInput();
}

// ===== FILTER HELPERS =====
const AGING_FIELD = {
  lancar:"lancar", "1_30":"aging1_30", "31_60":"aging31_60",
  "61_90":"aging61_90", "91_120":"aging91_120", "121_150":"aging121_150", over150:"agingOver150"
};
const AGING_LABEL = {
  lancar:"Lancar", "1_30":"1–30 Hari", "31_60":"31–60 Hari",
  "61_90":"61–90 Hari", "91_120":"91–120 Hari", "121_150":"121–150 Hari", over150:">150 Hari"
};

// ===== DEALER SCOPE (SuperAdmin) =====
// Non-SuperAdmin sudah otomatis di-scope oleh backend (per divisi+dealer).
// Untuk SuperAdmin ("head"), backend ngirim SEMUA data — filter dealer di sini,
// di sisi client, berdasarkan pilihan dropdown di topbar.
function visibleInvoices() {
  if(APP_STATE.user?.role === "head" && APP_STATE.dealerFilter !== "Semua") {
    return invoices.filter(i => i.dealer === APP_STATE.dealerFilter);
  }
  return invoices;
}

function changeDealerFilter(val) {
  APP_STATE.dealerFilter = val;
  invalidateCreditCache();
  renderCurrentPage();
}

function getFiltered() {
  return visibleInvoices().filter(inv => {
    if(APP_STATE.filterStage  !== "Semua" && inv.stage !== APP_STATE.filterStage)   return false;
    if(APP_STATE.filterDivisi !== "Semua" && inv.sbr   !== APP_STATE.filterDivisi)  return false;
    if(APP_STATE.agingFilterDivisi && inv.sbr !== APP_STATE.agingFilterDivisi)       return false;
    if(APP_STATE.agingFilterKey && (inv.stage === "Lunas" || !(inv[AGING_FIELD[APP_STATE.agingFilterKey]]))) return false;
    if(APP_STATE.filterAlert && !isStuck(inv))                                       return false;
    if(APP_STATE.searchQ) {
      const q = APP_STATE.searchQ.toLowerCase();
      if(!inv.noInvoice.toLowerCase().includes(q) && !inv.namaCust.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

// ===== JUMP NAVIGATION =====
function jumpToStage(stage, divisi="Semua") {
  APP_STATE.filterStage  = stage;
  APP_STATE.filterDivisi = divisi;
  APP_STATE.agingFilterKey    = null;
  APP_STATE.agingFilterDivisi = null;
  APP_STATE.activeFilterBanner = { label: divisi !== "Semua" ? `${divisi} · ${stage}` : stage };
  navigateTo("ar");
  switchARTab("monitoring", document.querySelectorAll("#arSubtabs .subtab")[1]);
}

function jumpToKurangBayar() {
  APP_STATE.filterStage  = "Lunas";
  APP_STATE.filterDivisi = "Semua";
  APP_STATE.agingFilterKey    = null;
  APP_STATE.agingFilterDivisi = null;
  APP_STATE.activeFilterBanner = { label:"Kurang Bayar" };
  navigateTo("ar");
  switchARTab("monitoring", document.querySelectorAll("#arSubtabs .subtab")[1]);
}

function jumpToAlert() {
  APP_STATE.filterAlert = true;
  APP_STATE.filterStage = "Semua";
  APP_STATE.activeFilterBanner = { label:"Perlu Perhatian (Stuck)" };
  navigateTo("ar");
  switchARTab("monitoring", document.querySelectorAll("#arSubtabs .subtab")[1]);
}

function jumpFromAging(agingKey, divisi=null) {
  APP_STATE.filterStage  = "Semua";
  APP_STATE.filterDivisi = "Semua";
  APP_STATE.agingFilterKey    = agingKey;
  APP_STATE.agingFilterDivisi = divisi;
  APP_STATE.activeFilterBanner = { label: divisi ? `${AGING_LABEL[agingKey]} · ${divisi}` : AGING_LABEL[agingKey] };
  navigateTo("ar");
  switchARTab("monitoring", document.querySelectorAll("#arSubtabs .subtab")[1]);
}

function clearActiveFilter() {
  APP_STATE.activeFilterBanner = null;
  APP_STATE.agingFilterKey     = null;
  APP_STATE.agingFilterDivisi  = null;
  APP_STATE.filterAlert        = false;
  APP_STATE.filterStage        = "Semua";
  APP_STATE.filterDivisi       = "Semua";
  renderMonitoring();
}

function openDetail(id) {
  APP_STATE.selectedId = id;
  APP_STATE.detailTab  = "detail";
  navigateTo("ar");
  switchARTab("monitoring", document.querySelectorAll("#arSubtabs .subtab")[1]);
}

function jumpToCreditTier(tierLabel) {
  APP_STATE.creditFilterTier = tierLabel;
  navigateTo("credit");
  switchCreditTab("customers", document.querySelectorAll("#creditSubtabs .subtab")[1]);
}

// ===== GLOBAL SEARCH =====
function showSearchDropdown() {
  const q = document.getElementById("globalSearch").value.trim();
  if(q.length < 1 && invoices.length === 0) return;
  handleGlobalSearch(q);
  document.getElementById("searchDropdown").style.display = "block";
}

function handleGlobalSearch(q) {
  const dd = document.getElementById("searchDropdown");
  if(!dd) return;

  if(!q || q.length < 2) {
    dd.style.display = "none";
    return;
  }

  const ql = q.toLowerCase();
  const results = [];

  // Search invoices
  const matchInv = invoices.filter(i =>
    i.noInvoice.toLowerCase().includes(ql) ||
    i.namaCust.toLowerCase().includes(ql)
  ).slice(0, 6);

  matchInv.forEach(i => {
    results.push({
      type:"Invoice", typeCls:"badge-blue",
      main: i.noInvoice,
      sub:  `${i.namaCust} · ${i.sbr} · ${fmtRp(i.total)}`,
      action: `openDetail('${i.id}')`,
    });
  });

  // Search customers (grouped)
  const custMap = new Map();
  invoices.forEach(i => {
    const mn = getMasterName(i.namaCust);
    if(mn.toLowerCase().includes(ql) && !custMap.has(mn)) {
      custMap.set(mn, i.namaCust);
    }
  });
  [...custMap.entries()].slice(0,3).forEach(([mn, rawName]) => {
    results.push({
      type:"Customer", typeCls:"badge-purple",
      main: mn,
      sub:  `Lihat profil risiko →`,
      action: `openCustDetail('${mn}')`,
    });
  });

  if(results.length === 0) {
    dd.innerHTML = `<div class="search-empty">Tidak ada hasil untuk "<strong>${q}</strong>"</div>`;
  } else {
    dd.innerHTML = results.map(r => `
      <div class="search-result-item" onclick="${r.action};document.getElementById('searchDropdown').style.display='none';">
        <div>
          <span class="search-result-type badge ${r.typeCls}">${r.type}</span>
        </div>
        <div>
          <div class="search-result-main">${r.main}</div>
          <div class="search-result-sub">${r.sub}</div>
        </div>
      </div>`).join("");
  }

  dd.style.display = "block";
}

function openCustDetail(masterName) {
  APP_STATE.custDetailName = masterName;
  navigateTo("credit");
  switchCreditTab("customers", document.querySelectorAll("#creditSubtabs .subtab")[1]);
  // Small delay to let render happen, then open modal
  setTimeout(() => showCustDetailModal(masterName), 100);
}

// ===== REPORT MODAL =====
function openReportModal() {
  const modal = document.getElementById("reportModal");
  modal.style.display = "flex";
  const now = new Date();
  document.getElementById("reportBulan").value = now.getMonth() + 1;
  document.getElementById("reportTahun").value = now.getFullYear();
}

// ===== USER DISPLAY =====
function setUserDisplay(user) {
  APP_STATE.user = user;
  const initials = (user?.nama || "U").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  document.getElementById("sbAvatar").textContent = initials;
  const menuName = document.getElementById("menuUserName");
  const menuRole = document.getElementById("menuUserRole");
  if(menuName) menuName.textContent = user?.nama || "User";
  if(menuRole) menuRole.textContent = user?.role || "—";
  document.getElementById("sbUserName").textContent = user?.nama || "User";
  document.getElementById("sbUserRole").textContent = user?.role || "—";
  document.getElementById("topbarAvatar").textContent = initials;

  const branchWrap = document.getElementById("branchBadgeWrap");
  if(branchWrap) {
    if(user?.role === "head") {
      branchWrap.innerHTML = `
        <span>🏢</span>
        <select id="dealerFilterSelect" onchange="changeDealerFilter(this.value)"
          style="border:none;background:transparent;font-weight:500;font-size:13px;cursor:pointer;outline:none;color:inherit;">
          <option value="Semua" ${APP_STATE.dealerFilter==="Semua"?"selected":""}>Semua Dealer</option>
          ${DEALER_LIST.map(d => `<option value="${d}" ${APP_STATE.dealerFilter===d?"selected":""}>${d}</option>`).join("")}
        </select>`;
    } else {
      branchWrap.innerHTML = `<span>🏢</span><span>${user?.dealer || "—"}</span>`;
    }
  }
}

// ===== INIT =====
async function appInit() {
  // Cek session — redirect ke login kalau belum login
  if(!Api.isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  // Set user display dari session
  const user = Api.getUser();
  if(user) setUserDisplay(user);

  // Hide settings & user management kalau bukan head
  if(user && user.role !== "head") {
    const navSettings = document.getElementById("nav-settings");
    if(navSettings) navSettings.style.display = "none";
    const navUsers = document.getElementById("nav-users");
    if(navUsers) navUsers.style.display = "none";
  }

  // Populate lunas dropdown dulu
  const lunasKetEl = document.getElementById("lunasKetSelect");
  if(lunasKetEl) {
    lunasKetEl.innerHTML = '<option value="">-- Pilih (opsional) --</option>';
    KETERANGAN_LUNAS.forEach(k => {
      const o = document.createElement("option");
      o.value = k; o.textContent = k;
      lunasKetEl.appendChild(o);
    });
  }

  // Load dari localStorage dulu biar app langsung bisa dipakai
  loadSettings();
  loadScoringSettings();
  loadSubTipeKeywords();
  customerMapping = loadMapping();
  invoices = loadStorage();

  // Render dulu dengan data cache
  navigateTo("ar");

  // Load dari backend di background
  try {
    showApiLoader("Sinkronisasi data...");

    // Load settings
    const settings = await Api.getSettings();
    if(settings && settings["stuck_AR Masuk"]) {
      STUCK_DAYS = {
        "AR Masuk":        parseInt(settings["stuck_AR Masuk"])        || 3,
        "Cek Kelengkapan": parseInt(settings["stuck_Cek Kelengkapan"]) || 3,
        "Plan & Kirim":    parseInt(settings["stuck_Plan & Kirim"])    || 2,
        "Follow Up":       parseInt(settings["stuck_Follow Up"])       || 5,
        "Lunas":           9999,
      };
    }
    // FIXED: sebelumnya cuma stuck days yang di-hydrate dari backend, docs config
    // & info perusahaan gak pernah ditarik ulang — jadi tiap device tetep beda.
    if(settings) {
      const docsFromBackend = {};
      Object.keys(DEFAULT_DOCS).forEach(key => {
        if(settings[`docs_${key}`] !== undefined) docsFromBackend[key] = settings[`docs_${key}`];
      });
      if(Object.keys(docsFromBackend).length > 0) DOCS_CONFIG = {...DEFAULT_DOCS, ...docsFromBackend};
      if(settings.company_info && typeof settings.company_info === "object") Object.assign(MASTER, settings.company_info);
      if(settings.subtipe_keywords && typeof settings.subtipe_keywords === "object") saveSubTipeKeywordsLocal(settings.subtipe_keywords);
    }

    // Load customer mapping
    const mapping = await Api.getCustomerMapping();
    if(mapping && Object.keys(mapping).length > 0) {
      customerMapping = mapping;
      saveMapping(mapping);
    }

    // Load invoices dari backend
    const backendInvoices = await Api.getInvoices();
    if(backendInvoices && backendInvoices.length >= 0) {
      invoices = sanitizeInvoiceNumbers(backendInvoices);
      saveStorage();
      renderCurrentPage();
    }

    hideApiLoader();
  } catch(e) {
    console.warn("Backend sync error, pakai cache:", e);
    hideApiLoader();
  }
}
function toggleAvatarMenu() {
  const menu = document.getElementById("avatarMenu");
  menu.style.display = menu.style.display === "none" ? "block" : "none";
}

// Close menu kalau klik di luar
document.addEventListener("click", e => {
  const menu = document.getElementById("avatarMenu");
  const avatar = document.getElementById("topbarAvatar");
  if(menu && avatar && !avatar.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = "none";
  }
});
