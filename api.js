// ===================================================
// MOFLEX — Frontend API Connector
// Email/Password auth — no OAuth
// ===================================================

const BACKEND_URL = "https://script.google.com/macros/s/AKfycbyx_58SyQDTdYSIuF_-SFEkbLG4nHEopObcBlBIi6r1vviCZ3IhBABEMenM_F1hD8s1/exec";

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
  async get(params = {}) {
    const qs  = new URLSearchParams({ ...params, token: this.getToken() }).toString();
    const res = await fetch(`${BACKEND_URL}?${qs}`);
    const data = await res.json();
    if(data.code === 401) { await this.logout(); throw new Error("Sesi expired"); }
    if(!data.ok) throw new Error(data.error || "Request gagal");
    return data;
  },

  async post(body = {}) {
    const res = await fetch(BACKEND_URL, {
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
    const data = await this.get({ action: "getInvoices" });
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
    el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;display:flex;align-items:center;gap:10px;box-shadow:0 4px 16px rgba(0,0,0,0.2);";
    el.innerHTML = `<div style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0;"></div><span id="apiLoaderMsg"></span>`;
    document.body.appendChild(el);
  }
  el.querySelector("#apiLoaderMsg").textContent = msg;
  el.style.display = "flex";
}

function hideApiLoader() {
  const el = document.getElementById("apiLoader");
  if(el) el.style.display = "none";
}
