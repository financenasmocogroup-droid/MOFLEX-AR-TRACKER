// ===================================================
// MOFLEX — Frontend API Connector
// Email/Password auth — no OAuth
// ===================================================

const BACKEND_URL = "https://script.google.com/macros/s/AKfycbyx_58SyQDTdYSIuF_-SFEkbLG4nHEopObcBlBIi6r1vviCZ3IhBABEMenM_F1hD8s1/exec";

// FIXED: native fetch() gak punya timeout default -- kalau Apps Script lagi
// "sibuk" (banyak eksekusi bersamaan, kena batas concurrent execution Google),
// request bisa nge-gantung TANPA BATAS WAKTU, gak pernah sukses ATAU gagal.
// User cuma liat "Sinkronisasi data..." nempel selamanya (pernah kejadian
// beneran ke user Admin GR Demak). Sekarang tiap request dikasih timeout, dan
// kalau gagal/timeout dicoba lagi otomatis beberapa kali dengan jeda.
async function fetchWithRetry(url, options = {}, { timeoutMs = 20000, retries = 2, retryDelayMs = 2000 } = {}) {
  let lastErr;
  for(let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch(err) {
      clearTimeout(timer);
      lastErr = err;
      if(attempt < retries) await new Promise(r => setTimeout(r, retryDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

const Api = {

  // ===== SESSION =====
  getToken() {
    return sessionStorage.getItem("moflex_token") || localStorage.getItem("moflex_token");
  },

  getUser() {
    try {
      const raw = sessionStorage.getItem("moflex_user") || localStorage.getItem("moflex_user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  isLoggedIn() { return !!this.getToken(); },

  requireAuth() {
    if(!this.isLoggedIn()) { window.location.href = "login.html"; return false; }
    return true;
  },

  _loggingOut: false,

  async logout() {
    if (this._loggingOut) return; // guard: cegah rekursi/panggilan bertumpuk
    this._loggingOut = true;

    // FIXED: sebelumnya manggil this.post({action:"logout"}), yang kalau
    // token udah expired bakal dapet 401 lagi -> post() manggil this.logout()
    // lagi -> infinite loop (post -> logout -> post -> logout -> ...).
    // Sekarang pakai fetch langsung, bypass logic retry-401 di post(),
    // dan hasilnya diabaikan total karena tujuannya cuma bersihin state lokal.
    try {
      await fetch(BACKEND_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain" },
        body:    JSON.stringify({ action: "logout", token: this.getToken() }),
      });
    } catch {}

    sessionStorage.removeItem("moflex_token");
    sessionStorage.removeItem("moflex_user");
    localStorage.removeItem("moflex_token");
    localStorage.removeItem("moflex_user");
    window.location.href = "login.html";
  },

  // ===== BASE FETCH =====
  async get(params = {}, retryOpts = {}) {
    const qs  = new URLSearchParams({ ...params, token: this.getToken() }).toString();
    const res = await fetchWithRetry(`${BACKEND_URL}?${qs}`, {}, retryOpts);
    const data = await res.json();
    if(data.code === 401) { await this.logout(); throw new Error("Sesi expired"); }
    if(!data.ok) throw new Error(data.error || "Request gagal");
    return data;
  },

  async post(body = {}) {
    const res = await fetchWithRetry(BACKEND_URL, {
      method:  "POST",
      headers: { "Content-Type": "text/plain" },
      body:    JSON.stringify({ ...body, token: this.getToken() }),
    });
    const data = await res.json();
    if(data.code === 401) { await this.logout(); throw new Error("Sesi expired"); }
    if(!data.ok) throw new Error(data.error || "Request gagal");
    return data;
  },

  // ===== AUTH =====
  async login(email, password, remember=false) {
    const res = await fetch(BACKEND_URL, {
      method:  "POST",
      headers: { "Content-Type": "text/plain" },
      body:    JSON.stringify({ action: "login", email, password }),
    });
    const data = await res.json();
    if(!data.ok) throw new Error(data.error);

    const storage = remember ? localStorage : sessionStorage;
    storage.setItem("moflex_token", data.token);
    storage.setItem("moflex_user",  JSON.stringify(data.user));
    return data.user;
  },

  async changePassword(oldPassword, newPassword) {
    return await this.post({ action: "changePassword", data: { oldPassword, newPassword } });
  },

  async checkSession() {
    const token = this.getToken();
    if(!token) return null;
    try {
      const data = await this.post({ action: "checkSession", token });
      return data.user;
    } catch { return null; }
  },

  // ===== INVOICES =====
  async getInvoices() {
    const data = await this.get({ action: "getInvoices" }, { timeoutMs: 30000 });
    return data.invoices || [];
  },

  async upsertInvoice(inv) {
    return await this.post({ action: "upsertInvoice", data: inv });
  },

  async batchUpsertInvoices(invList) {
  // Kirim semua sekaligus dalam satu request
  const result = await this.post({
    action: "batchUpsertInvoices",
    data: invList,
  });
  return result;
},

  async updateEnrichment(noInvoice, fields) {
    return await this.post({ action: "updateEnrichment", data: { noInvoice, ...fields } });
  },

  // ===== FOLLOW UPS =====
  async addFollowUp(data) {
    return await this.post({ action: "addFollowUp", data });
  },

  async getFollowUps(invoiceId) {
    const data = await this.get({ action: "getFollowUps", invoiceId: invoiceId||"" });
    return data.followUps || [];
  },

  // ===== HISTORY =====
  async logHistory(invoiceId, aksi) {
    // FIXED: sebelumnya .slice(0,10) buang jam, sekarang full ISO timestamp
    return await this.post({ action: "logHistory", data: {
      invoiceId, aksi, tgl: new Date().toISOString(),
    }});
  },

  async getHistory(invoiceId) {
    // NEW: sebelumnya endpoint ini ada di backend tapi gak pernah dipanggil dari frontend
    const data = await this.get({ action: "getHistory", invoiceId: invoiceId||"" });
    return data.history || [];
  },

  // ===== SETTINGS =====
  async getSettings() {
    const data = await this.get({ action: "getSettings" });
    return data.settings || {};
  },

  async saveSettings(settings) {
    return await this.post({ action: "saveSettings", data: settings });
  },

  // ===== USERS =====
  async getUsers() {
    const data = await this.get({ action: "getUsers" });
    return data.users || [];
  },

  async upsertUser(userData) {
    return await this.post({ action: "upsertUser", data: userData });
  },

  async deleteUser(email) {
    return await this.post({ action: "deleteUser", data: { email } });
  },

  // ===== CUSTOMER MAPPING =====
  async getCustomerMapping() {
    const data = await this.get({ action: "getCustomerMapping" });
    return data.mapping || {};
  },

  async saveCustomerMapping(mapping) {
    return await this.post({ action: "saveCustomerMapping", data: mapping });
  },

  // ===== MIGRATION =====
  async migrateFromLocalStorage(migrateToken) {
    const lsInvoices = JSON.parse(localStorage.getItem("moflex_invoices_v1") || localStorage.getItem("ar_monitoring_v5") || "[]");
    const lsSettings = JSON.parse(localStorage.getItem("moflex_settings_v1") || localStorage.getItem("ar_monitoring_settings_v2") || "{}");
    const lsMapping  = JSON.parse(localStorage.getItem("moflex_customer_mapping_v1") || localStorage.getItem("ar_customer_mapping_v1") || "{}");

    const res = await fetch(BACKEND_URL, {
      method:  "POST",
      headers: { "Content-Type": "text/plain" },
      body:    JSON.stringify({
        action: "migrateData",
        migrateToken,
        data: { invoices: lsInvoices, settings: lsSettings, customerMapping: lsMapping },
      }),
    });
    return await res.json();
  },
};

// ===== LOADING INDICATOR =====
function showApiLoader(msg="Memuat data...") {
  let el = document.getElementById("apiLoader");
  if(!el) {
    el = document.createElement("div");
    el.id = "apiLoader";
    document.body.appendChild(el);
  }
  // FIXED: sebelumnya struktur HTML cuma dibikin sekali (pas elemen belum ada).
  // Kalau showApiError() sempet jalan duluan (nimpa innerHTML jadi versi error+
  // tombol), showApiLoader() berikutnya nemu elemen ini UDAH ADA, jadi skip
  // bikin ulang strukturnya -- lanjut nulis ke #apiLoaderMsg yang udah gak ada
  // lagi di DOM -> error diem-diem -> proses retry keputus sebelum sempet
  // nyoba fetch ulang. Sekarang selalu di-reset ulang tiap dipanggil.
  el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;display:flex;align-items:center;gap:10px;box-shadow:0 4px 16px rgba(0,0,0,0.2);";
  el.innerHTML = `<div style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0;"></div><span id="apiLoaderMsg"></span>`;
  el.querySelector("#apiLoaderMsg").textContent = msg;
  el.style.display = "flex";
}

function hideApiLoader() {
  const el = document.getElementById("apiLoader");
  if(el) el.style.display = "none";
}

// NEW: dipanggil kalau sync ke backend gagal total (setelah retry habis) --
// sebelumnya cuma diem-diem fallback ke cache tanpa kasih tau user apa-apa,
// atau malah nge-gantung selamanya tanpa penjelasan sama sekali.
function showApiError(msg, retryFn) {
  let el = document.getElementById("apiLoader");
  if(!el) {
    el = document.createElement("div");
    el.id = "apiLoader";
    document.body.appendChild(el);
  }
  el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#7f1d1d;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;z-index:9999;display:flex;align-items:center;gap:12px;box-shadow:0 4px 16px rgba(0,0,0,0.2);";
  el.innerHTML = `<span>⚠️ ${msg}</span><button id="apiErrorRetryBtn" style="background:#fff;color:#7f1d1d;border:none;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;">Coba Lagi</button>`;
  document.getElementById("apiErrorRetryBtn").onclick = () => { hideApiLoader(); retryFn(); };
}
