// ===== DATE & FORMAT HELPERS =====
const today    = () => new Date().toISOString().slice(0,10);
const nowTime  = () => new Date().toISOString(); // full timestamp (tanggal + jam), dipakai khusus untuk history
const daysDiff = (d1, d2=today()) => Math.floor((new Date(d2) - new Date(d1)) / 86400000);
const fmtDate  = d => d ? new Date(d).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "-";
const fmtDateLong = d => d ? new Date(d).toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"}) : "-";
const fmtDateTime = d => d ? new Date(d).toLocaleString("id-ID",{
  day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
}) : "-"; // NEW: dipakai buat render History tab biar nampilin jam
const fmtRp    = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(parseFloat(n)||0);
const fmtRpShort = n => {
  const v = parseFloat(n)||0;
  if(v >= 1e9)  return "Rp " + (v/1e9).toFixed(1)  + " M";
  if(v >= 1e6)  return "Rp " + (v/1e6).toFixed(1)  + " Jt";
  if(v >= 1e3)  return "Rp " + (v/1e3).toFixed(0)  + " Rb";
  return fmtRp(v);
};
const parseF   = v => parseFloat(String(v||"0").replace(/[^0-9.-]/g,"")) || 0;

// FIXED: field numerik invoice yang balik dari backend (Google Sheets) kadang bukan
// angka murni (cell ke-edit manual langsung di spreadsheet, blank, dsb). Kalau
// dibiarin, perbandingan >=/< di banyak tempat (Lunas Penuh, Kurang Bayar, dst)
// diam-diam gagal karena NaN gak pernah lebih besar/kecil dari apapun -- invoice-nya
// jadi "hilang" dari kedua kategori tanpa error apapun. Dibersihin sekali di sini,
// begitu data invoice pertama kali masuk dari backend, biar semua kalkulasi di
// hilir (exec summary, AR dashboard, credit scoring, dll) aman.
const NUMERIC_INVOICE_FIELDS = [
  "total","lancar","aging1_30","aging31_60","aging61_90","aging91_120",
  "aging121_150","agingOver150","nominalDiterima","selisih","subsequent","followUpCount",
];
function sanitizeInvoiceNumbers(list) {
  return (list||[]).map(inv => {
    const clean = {...inv};
    NUMERIC_INVOICE_FIELDS.forEach(f => { clean[f] = parseF(clean[f]); });
    return clean;
  });
}

// ===== STUCK DETECTION =====
const isStuck = inv => {
  if(inv.stage === "Lunas") return false;
  return daysDiff(inv.stageUpdatedAt || inv.tglMasuk) >= (STUCK_DAYS[inv.stage] || 3);
};

// ===== EXCEL DATE CONVERSION =====
function excelDate(v) {
  if(v === undefined || v === null || v === "") return today();
  if(typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0,10);
  }
  const s = String(v).trim();
  if(s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0,10);
  return today();
}

// ===== TERBILANG =====
function terbilang(n) {
  const sat = ["","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan","sepuluh","sebelas"];
  n = Math.abs(Math.floor(n));
  if(n < 12)        return sat[n];
  if(n < 20)        return sat[n-10] + " belas";
  if(n < 100)       return sat[Math.floor(n/10)] + " puluh" + (n%10 ? " "+sat[n%10] : "");
  if(n < 200)       return "seratus" + (n%100 ? " "+terbilang(n%100) : "");
  if(n < 1000)      return sat[Math.floor(n/100)] + " ratus" + (n%100 ? " "+terbilang(n%100) : "");
  if(n < 2000)      return "seribu" + (n%1000 ? " "+terbilang(n%1000) : "");
  if(n < 1000000)   return terbilang(Math.floor(n/1000)) + " ribu" + (n%1000 ? " "+terbilang(n%1000) : "");
  if(n < 1000000000) return terbilang(Math.floor(n/1000000)) + " juta" + (n%1000000 ? " "+terbilang(n%1000000) : "");
  return terbilang(Math.floor(n/1000000000)) + " miliar" + (n%1000000000 ? " "+terbilang(n%1000000000) : "");
}

// ===== TOAST =====
function toast(msg, type="") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = type; // "error" | "success" | ""
  t.style.display = "block";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.style.display = "none", 3000);
}

// ===== DOC HELPERS =====
const docPct = inv => {
  const docs = getDocsForInvoice(inv);
  const done = docs.filter(d => inv.dokumen && inv.dokumen[d]).length;
  return { done, total: docs.length, pct: docs.length > 0 ? Math.round(done/docs.length*100) : 0, docs };
};
const isDocComplete = inv => { const {done,total} = docPct(inv); return done === total && total > 0; };
const hasPlanKirim  = inv => !!inv.planKirim;
const hasTglTerima  = inv => !!inv.tglTerima;

// Gate check for stage transition
function checkGate(inv, toStage) {
  if(toStage === "Plan & Kirim") {
    if(!isDocComplete(inv)) {
      const {done,total} = docPct(inv);
      return { ok:false, reason:`Dokumen belum lengkap (${done}/${total})` };
    }
  }
  if(toStage === "Follow Up") {
    if(!hasPlanKirim(inv)) return { ok:false, reason:"Plan tanggal kirim belum diisi" };
    if(!hasTglTerima(inv)) return { ok:false, reason:"Tanggal terima belum diisi" };
  }
  if(toStage === "Lunas") {
    if(!inv.fuCleared) return { ok:false, reason:"Follow Up belum di-clear" };
  }
  return { ok:true };
}

// ===== STORAGE =====
let invoices = [];

function loadStorage() {
  try {
    // Try new key first, fallback to old key for migration
    const r = localStorage.getItem(LS_KEY_V2) || localStorage.getItem(LS_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

 function saveStorage() {
  // Data sekarang di backend — localStorage hanya untuk cache kecil
  // Skip save kalau data terlalu besar
  try {
    const data = JSON.stringify(invoices);
    if(data.length < 2000000) { // max 2MB
      localStorage.setItem(LS_KEY_V2, data);
    }
  } catch(e) {
    console.warn("localStorage penuh, skip cache:", e);
  }
}

function updateInvoice(id, patch) {
  let stageChanged = false, newStage = null;
  invoices = invoices.map(inv => {
    if(inv.id !== id) return inv;
    const updated = { ...inv, ...patch, updatedAt: today() };
    if(patch.stage && patch.stage !== inv.stage) {
      updated.stageUpdatedAt = today(); // tetap tanggal aja, dipakai buat hitung stuck days
      stageChanged = true; newStage = patch.stage;
    }
    return updated;
  });
  saveStorage();

  // History disimpen ke backend lewat addHistory() — sebelumnya perubahan stage cuma
  // ditulis ke state lokal (invoice.history[]) dan gak pernah kekirim ke server sama
  // sekali. Sekarang manggil addHistory() biar konsisten sama aksi lain (FU, enrichment, dll).
  if(stageChanged) addHistory(id, `Stage → ${newStage}`);

  // Sync ke backend
 const inv = getInv(id);
if(inv && Api.isLoggedIn()) {
  Api.upsertInvoice(inv).catch(e => console.warn("Sync error:", e));
  }
}

function getInv(id) { return invoices.find(i => i.id === id); }

// History sekarang murni disimpen di sheet History lewat Api.logHistory — gak lagi
// nempel di invoice.history[] lokal. Tab History di detail invoice narik langsung dari
// backend (Api.getHistory) tiap dibuka, jadi semua user liat riwayat yang sama.
function addHistory(id, aksi) {
  if(Api.isLoggedIn()) {
    Api.logHistory(id, aksi).catch(e => console.warn("History sync error:", e));
  }
}

// ===== FOLLOW UP HELPERS =====
// FIXED: sebelumnya ngitung promiseNo/followUpCount dari inv.followUps[] lokal yang
// di-embed penuh dari bulk fetch (salah satu penyebab payload getInvoices gede).
// Sekarang array itu gak di-embed lagi -- angka promiseNo/followUpCount yang bener
// dihitung DI SERVER (karena server tetep punya akses ke seluruh riwayat FU invoice
// ini) dan dikirim balik di response. Makanya fungsi ini jadi async, nunggu balesan
// server dulu baru update tampilan/history.
async function addFollowUp(id, data) {
  const inv = getInv(id);
  const entry = { ...data, tgl: data.tgl || today() };

  if(!Api.isLoggedIn()) {
    toast("Follow Up butuh koneksi ke server (belum login)", "error");
    return;
  }

  let res;
  try {
    res = await Api.addFollowUp({ invoiceId: id, ...entry });
  } catch(e) {
    console.warn("FU sync error:", e);
    toast("Gagal menyimpan Follow Up ke server", "error");
    return;
  }
  entry.promiseNo = res.promiseNo;

  // Update local state pakai angka yang udah dipastiin server
  invoices = invoices.map(i => {
    if(i.id !== id) return i;
    return {
      ...i,
      followUpCount: res.followUpCount,
      hasPromiseFollowUp: i.hasPromiseFollowUp || !!data.promiseToPay,
      lastPromiseToPay: data.promiseToPay || i.lastPromiseToPay,
      lastFU: today(), fuCleared: false,
    };
  });
  saveStorage();

  // Kalau tab Follow Up invoice ini lagi kebuka, langsung nempelin entry baru ke
  // cache-nya (biar keliatan instan, gak perlu nunggu fetch ulang)
  const fc = APP_STATE.followUpCache[id];
  if(fc && !fc.loading) fc.items = [...fc.items, entry];

  addHistory(id, `Follow Up #${res.followUpCount}${data.promiseToPay ? ` — Promise #${res.promiseNo} (${fmtDate(data.promiseToPay)})` : ""}`);
}

function clearFollowUp(id) {
  updateInvoice(id, { fuCleared:true });
  addHistory(id, "Follow Up di-clear — siap lunas");
}

// ===== ENRICHMENT UPDATE =====
// Update fields yang dulu diisi manual di EOM — sekarang langsung di sistem
function updateEnrichment(id, data) {
  // data: { problemId, lastRemark, pdcaRemark, updateRemarks, isBukpot, pph23, isRetur, promiseMining, subsequent }
  updateInvoice(id, { ...data });
  const aksi = data.problemId ? `Problem ID: ${data.problemId}` : "Enrichment updated";
  addHistory(id, aksi);
}

// ===== DIVISI DETECTION =====
function detectDivisi(filename, noInv, sbrVal) {
  if(SBR_MAP[sbrVal]) return SBR_MAP[sbrVal];
  const fname = (filename||"").toLowerCase();
  if(fname.includes("_bp_") || fname.includes("ar_bp")) return "BP";
  if(fname.includes("_grp_") || fname.includes("ar_grp") || fname.includes("_gr_")) return "GRP";
  if(fname.includes("_mobil_") || fname.includes("ar_mobil")) return "Mobil";
  const prefix = String(noInv||"").charAt(0).toUpperCase();
  if(prefix === "G" || prefix === "C") return "BP";
  if(prefix === "A" || prefix === "E") return "GRP";
  if(prefix === "N") return "Mobil";
  return "BP";
}

// ===== XLS PARSE =====
function parseRows(rows, filename) {
  let hr = -1;
  for(let i = 0; i < rows.length; i++) {
    if(rows[i] && rows[i].some(c => String(c||"").trim() === "Nomor Invoice")) { hr = i; break; }
  }
  if(hr === -1) return [];

  const rawH = rows[hr];
  const hMap = {};
  rawH.forEach((h,i) => { const k = String(h||"").trim(); if(k && hMap[k] === undefined) hMap[k] = i; });

  const col = (row, ...keys) => {
    for(const k of keys) {
      if(hMap[k] !== undefined) {
        const v = row[hMap[k]];
        if(v !== undefined && v !== null && String(v).trim() !== "") return v;
      }
    }
    return "";
  };

  const result = [];
  for(let i = hr+1; i < rows.length; i++) {
    const row = rows[i];
    if(!row || !row.length) continue;
    const noInv = String(col(row,"Nomor Invoice")||"").trim();
    if(!noInv) continue;
    if(noInv.startsWith("---") || noInv.toLowerCase().includes("overdue")) continue;

    const sbrVal  = String(col(row,"Sbr")||"").trim();
    const divisi  = detectDivisi(filename, noInv, sbrVal);
    const namaCust = String(col(row,"Nama Costumer","Nama Customer")||"");
    // FIXED: sebelumnya hardcode Cash/Fleet doang, gak pernah baca keyword sama
    // sekali. Sekarang pake detectSubTipe() (keyword per-divisi di Settings).
    const defaultSubTipe = detectSubTipe(divisi, namaCust);

    result.push({
      // Identity
      id: noInv, noInvoice: noInv,
      kodeCust:  String(col(row,"Kode Cust.","Kode Cust")||""),
      namaCust,
      masterName: getMasterName(namaCust),
      custType:   detectCustomerType(namaCust),

      // Financial
      tglJual:  excelDate(col(row,"Tgl Jual")),
      jthTempo: excelDate(col(row,"Jth Tmp","Jth Tempo")),
      total:    parseF(col(row,"Total")),
      lancar:   parseF(col(row,"Lancar")),
      aging1_30:    parseF(col(row,"1-30 Hr","1-30")),
      aging31_60:   parseF(col(row,"31-60 Hr","31-60")),
      aging61_90:   parseF(col(row,"61-90 Hr","61-90")),
      aging91_120:  parseF(col(row,"91-120 Hr","91-120")),
      aging121_150: parseF(col(row,"121-150 Hr","121-150")),
      agingOver150: parseF(col(row,"> 150 Hr","> 150",">150")),

      // Invoice info
      sbr: divisi, subTipe: defaultSubTipe,
      noWO:    String(col(row,"No. WO")||""),
      noPol:   String(col(row,"No. Pol / No. PO","No. Pol")||""),
      noSPK:   String(col(row,"No. SPK")||""),
      salesSA: String(col(row,"Sales / SA","Sales")||""),
      keterangan: String(col(row,"Keterangan")||""),

      // Pipeline
      stage: "AR Masuk", stageUpdatedAt: today(), tglMasuk: today(),

      // Dokumen
      dokumen: {},

      // Plan & Kirim
      planKirim: "", tglKirim: "", tglTerima: "", isBillSent: "",

      // Lunas
      tglLunas: "", nominalDiterima: 0, selisih: 0,
      keteranganLunas: "", keteranganLunasCustom: "",

      // ===== ENRICHMENT (ex-EOM) =====
      problemId:     "",
      lastRemark:    "",
      pdcaRemark:    "",
      updateRemarks: "",
      isBukpot:      "",
      pph23:         "",
      isRetur:       "",
      promiseToPay:  "",
      promiseMining: "",
      subsequent:    0,

      // Follow up
      catatanKendala: "",
      followUpCount: 0, hasPromiseFollowUp: false, lastPromiseToPay: "", lastFU: "", fuCleared: false,

      // Meta
      adjustSPK: [], isManual: false, cetakHistory: [],
      createdAt: today(), updatedAt: today(),
      createdBy: APP_STATE.user?.nama || "System",
    });
  }
  return result;
}

// ===== FILE READ =====
function readFile(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type:"array", cellDates:false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        res(XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:"" }));
      } catch(err) { rej(err); }
    };
    reader.onerror = () => rej(new Error("Gagal membaca file"));
    reader.readAsArrayBuffer(file);
  });
}

// ===== FILE UPLOAD HANDLER =====
async function handleFileUpload(e) {
  const files = Array.from(e.target.files);
  if(!files.length) return;
  let totalAdded = 0, totalUpdated = 0;
  // FIXED: sebelumnya sync ngirim SELURUH array `invoices` (bisa puluhan ribu,
  // termasuk yang gak ikut kesentuh sama sekali di upload ini) ke
  // batchUpsertInvoices() -- payload gede & bikin backend kerja jauh lebih berat
  // dari yang perlu. Sekarang cuma invoice yang beneran baru/berubah di batch ini
  // yang dikirim.
  const touched = [];

  for(const file of files) {
    try {
      const rows = await readFile(file);
      const parsed = parseRows(rows, file.name);
      if(parsed.length === 0) { toast(`⚠️ ${file.name}: tidak ada data terbaca`, "error"); continue; }

      const map = new Map(invoices.map(i => [i.noInvoice, i]));
      let added = 0, updated = 0;

      for(const inv of parsed) {
        if(map.has(inv.noInvoice)) {
          const ex = map.get(inv.noInvoice);
          // Update financial fields but preserve pipeline progress & enrichment
          const merged = { ...ex,
            total: inv.total, jthTempo: inv.jthTempo,
            lancar: inv.lancar, aging1_30: inv.aging1_30,
            aging31_60: inv.aging31_60, aging61_90: inv.aging61_90,
            aging91_120: inv.aging91_120, aging121_150: inv.aging121_150,
            agingOver150: inv.agingOver150,
            namaCust: inv.namaCust, kodeCust: inv.kodeCust,
            salesSA: inv.salesSA, noWO: inv.noWO,
            masterName: getMasterName(inv.namaCust),
            updatedAt: today(),
          };
          map.set(inv.noInvoice, merged);
          touched.push(merged);
          updated++;
        } else {
          map.set(inv.noInvoice, inv);
          touched.push(inv);
          added++;
        }
      }
      invoices = Array.from(map.values());
      totalAdded += added; totalUpdated += updated;

    } catch(err) { toast(`Error: ${err.message}`, "error"); }
  }

 saveStorage();
  e.target.value = "";
  toast(`Import selesai: +${totalAdded} baru, ~${totalUpdated} diperbarui`, "success");
  // Sync cuma yang berubah/baru ke backend
  if(Api.isLoggedIn() && touched.length > 0) {
    showApiLoader(`Mengirim ${touched.length} invoice ke server...`);
    Api.batchUpsertInvoices(touched)
      .then(r => {
        hideApiLoader();
        toast(`Sync selesai: +${r.added} baru, ~${r.updated} diperbarui`, "success");
        // Cuma 1 baris ringkasan ke History, bukan per-invoice (biar gak numpuk
        // ribuan entry tiap upload) — mirip pola logAutoImport_ di EmailIngestion.gs
        const fileNames = files.map(f => f.name).join(", ");
        Api.logHistory("SYSTEM", `Upload XLS manual (${fileNames}): +${r.added} baru, ~${r.updated} diperbarui`)
          .catch(e => console.warn("History sync error:", e));
        renderCurrentPage();
      })
      .catch(e => {
        hideApiLoader();
        console.warn("Sync error:", e);
      });
  } else {
    renderCurrentPage();
  }
}

// ===== RE-RUN AUTO-DETECT SUB-TIPE (dipanggil dari tombol di Settings) =====
// Cuma nyentuh invoice yang subTipe-nya BELUM pernah di-edit manual (subTipeManual
// falsy) — biar gak nimpa koreksi manual yang udah bener. Kirim cuma yang beneran
// berubah ke backend (bukan semua invoice), biar ringan.
async function recalculateAllSubTipe() {
  const changed = [];
  invoices = invoices.map(inv => {
    if(inv.sbr !== "Mobil" && inv.sbr !== "GRP") return inv;
    if(inv.subTipeManual) return inv;
    const detected = detectSubTipe(inv.sbr, inv.namaCust);
    if(detected === inv.subTipe) return inv;
    const updated = { ...inv, subTipe: detected, updatedAt: today() };
    changed.push(updated);
    return updated;
  });
  saveStorage();

  if(!changed.length) { toast("Tidak ada invoice yang perlu diperbarui.", ""); return; }

  if(Api.isLoggedIn()) {
    showApiLoader(`Sync ${changed.length} invoice...`);
    try {
      await Api.batchUpsertInvoices(changed);
      hideApiLoader();
      toast(`Auto-detect selesai: ${changed.length} invoice diperbarui`, "success");
      Api.logHistory("SYSTEM", `Re-run Keyword Auto-Detect Sub-Tipe: ${changed.length} invoice diperbarui`)
        .catch(e => console.warn("History sync error:", e));
    } catch(e) {
      hideApiLoader();
      console.warn("Sync error:", e);
      toast(`Update lokal berhasil (${changed.length} invoice), tapi gagal sync ke server`, "error");
    }
  } else {
    toast(`Auto-detect selesai (lokal): ${changed.length} invoice diperbarui`, "success");
  }
  renderCurrentPage();
}

// ===== MODAL HELPER =====
function closeModal(id) {
  const el = document.getElementById(id);
  if(el) el.style.display = "none";
}

// Close modal on overlay click
document.addEventListener("click", e => {
  if(e.target.classList.contains("modal-overlay")) {
    e.target.style.display = "none";
  }
});

// Close search dropdown on outside click
document.addEventListener("click", e => {
  const dd = document.getElementById("searchDropdown");
  const sw = document.querySelector(".search-wrap");
  if(dd && sw && !sw.contains(e.target)) {
    dd.style.display = "none";
  }
});
