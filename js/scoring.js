// ===== SCORING ENGINE =====
// Adapted for unified app — data comes directly from invoices[], no EOM needed

const RISK_CATEGORIES = [
  {label:"Low Risk",  min:0,  max:19,  color:"#16a34a", bg:"#f0fdf4", border:"#bbf7d0", icon:"🟢"},
  {label:"Moderate",  min:20, max:39,  color:"#d97706", bg:"#fffbeb", border:"#fde68a", icon:"🟡"},
  {label:"Watch",     min:40, max:59,  color:"#ea580c", bg:"#fff7ed", border:"#fed7aa", icon:"🟠"},
  {label:"High Risk", min:60, max:79,  color:"#dc2626", bg:"#fef2f2", border:"#fecaca", icon:"🔴"},
  {label:"Critical",  min:80, max:100, color:"#111827", bg:"#f9fafb", border:"#374151", icon:"⚫"},
];

const SCORING_WEIGHTS = {payment:0.40, problem:0.25, volume:0.20, promise:0.15};
let scoringWeights = {...SCORING_WEIGHTS};

// Customer type keywords
const DEFAULT_CUST_TYPE_KEYWORDS = {
  "Asuransi": ["ASURANSI","INSURANCE","ZURICH","AXA","MSIG","ADIRA INS","SINARMAS","TUGU","TOKIO","JASINDO","BRINGIN","MEGA INSURANCE","KB INSURANCE","CENTRAL ASIA","MAG"],
  "Fleet":    ["FLEET","PT.","PT ","CV.","CV ","ADI SARANA","BLUE BIRD","TAXI","LOGISTIK","EKSPEDISI","ARMADA","TRANSPORT"],
  "Leasing":  ["LEASING","FINANCE","FIF","OTO","ACC","ADIRA FINANCE","WOM","MANDIRI TUNAS","CLIPAN","BAF","SINARMAS MULTIARTHA"],
  "Afiliasi": ["NASMOCO","NRM","NEW RATNA MOTOR","RATNA MOTOR","PEMUDA","MAJAPAHIT","DEMAK","KALIGAWE","SOLO","YOGYA","MAGELANG","PURWOKERTO"],
  "Personal": [],
};

let custTypeKeywords = {...DEFAULT_CUST_TYPE_KEYWORDS};

// ===== SUB-TIPE KEYWORDS (Opsi A — terpisah dari custType di atas) =====
// custType (di atas) dipake buat Credit Scoring, lintas semua divisi.
// subTipeKeywords ini KHUSUS buat nentuin subTipe invoice (Leasing/Cash utk Mobil,
// Fleet/NRM utk GRP) — yang muncul di badge "Mobil — Cash" dan nentuin checklist
// dokumen. Dua sistem ini sengaja dipisah, gak saling nimpa.
const EMPTY_SUBTIPE_KEYWORDS = {
  Mobil: { Leasing: [], Cash: [] },
  GRP:   { Fleet: [],   NRM: [] },
};
let subTipeKeywords = null; // di-init di loadSubTipeKeywords() — null = belum di-load

function loadSubTipeKeywords() {
  try {
    const r = localStorage.getItem(LS_SUBTIPE_KW_V1);
    if(r) {
      subTipeKeywords = JSON.parse(r);
      return;
    }
  } catch {}
  // First-run seed: copy keyword Leasing & Fleet yang UDAH ADA di custType keyword
  // (termasuk yang udah pernah diedit user, misal nambahin nama leasing tertentu)
  // biar gak mulai dari nol. Cash & NRM sengaja mulai kosong (gak ada padanan lama).
  subTipeKeywords = {
    Mobil: { Leasing: [...(custTypeKeywords.Leasing||[])], Cash: [] },
    GRP:   { Fleet:   [...(custTypeKeywords.Fleet||[])],   NRM: [] },
  };
}

function saveSubTipeKeywordsLocal(kw) {
  subTipeKeywords = {
    Mobil: { Leasing: kw?.Mobil?.Leasing||[], Cash: kw?.Mobil?.Cash||[] },
    GRP:   { Fleet:   kw?.GRP?.Fleet||[],     NRM:   kw?.GRP?.NRM||[] },
  };
  localStorage.setItem(LS_SUBTIPE_KW_V1, JSON.stringify(subTipeKeywords));
}

// Deteksi subTipe berdasar nama customer. BP gak punya subTipe -> selalu "".
// Mobil: cek keyword Leasing dulu, fallback Cash. GRP: cek keyword Fleet dulu, fallback NRM.
function detectSubTipe(divisi, namaCust) {
  if(divisi !== "Mobil" && divisi !== "GRP") return "";
  const groups = (subTipeKeywords || EMPTY_SUBTIPE_KEYWORDS)[divisi];
  const primary  = divisi === "Mobil" ? "Leasing" : "Fleet";
  const fallback = divisi === "Mobil" ? "Cash"    : "NRM";
  const upper = (namaCust||"").toUpperCase();
  const kwPrimary = groups?.[primary] || [];
  if(kwPrimary.some(kw => kw && upper.includes(kw.toUpperCase()))) return primary;
  const kwFallback = groups?.[fallback] || [];
  if(kwFallback.some(kw => kw && upper.includes(kw.toUpperCase()))) return fallback;
  return fallback; // default kalau gak match keyword manapun
}

// ===== SETTINGS =====
function loadScoringSettings() {
  try {
    const r = localStorage.getItem(LS_SCORING_V2);
    if(r) { const s = JSON.parse(r); if(s.weights) scoringWeights = {...SCORING_WEIGHTS, ...s.weights}; }
    const k = localStorage.getItem(LS_CUST_TYPE_V2);
    if(k) custTypeKeywords = {...DEFAULT_CUST_TYPE_KEYWORDS, ...JSON.parse(k)};
  } catch {}
}

function saveScoringSettings(weights) {
  scoringWeights = {...SCORING_WEIGHTS, ...weights};
  localStorage.setItem(LS_SCORING_V2, JSON.stringify({weights}));
}

function saveCustTypeKeywords(kw) {
  custTypeKeywords = {...DEFAULT_CUST_TYPE_KEYWORDS, ...kw};
  localStorage.setItem(LS_CUST_TYPE_V2, JSON.stringify(kw));
}

// ===== CUSTOMER TYPE DETECTION =====
function detectCustomerType(name) {
  const upper = (name||"").toUpperCase();
  const priority = ["Afiliasi","Asuransi","Leasing","Fleet"];
  for(const type of priority) {
    const keywords = custTypeKeywords[type] || [];
    if(keywords.some(kw => upper.includes(kw.toUpperCase()))) return type;
  }
  return "Personal";
}

// ===== CUSTOMER MAPPING =====
let customerMapping = {};
function loadMapping() {
  try { const r = localStorage.getItem(LS_MAPPING_V2); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}
function saveMapping(m) {
  localStorage.setItem(LS_MAPPING_V2, JSON.stringify(m));
  customerMapping = m;
}
function getMasterName(name) {
  return customerMapping[(name||"").trim().toUpperCase()] || (name||"").trim().toUpperCase();
}
function getEffectiveCustType(inv) {
  return inv.custTypeOverride || inv.custType || detectCustomerType(inv.namaCust);
}

// ===== SCORING ENGINE =====
// Now uses unified invoice fields directly (stage, tglTerima, nominalDiterima, promiseToPay, problemId)
function scoreCustomer(custInvoices) {
  if(!custInvoices || !custInvoices.length) return {total:0, breakdown:{}, category:RISK_CATEGORIES[0]};
  const now = new Date();

  // AUTO CRITICAL: P05 fraud
  const hasP05 = custInvoices.some(i => i.problemId && (i.problemId.includes("P05") || i.problemId.toUpperCase().includes("FRAUD")));
  if(hasP05) return buildResult(100, {A:100, B:100, C:0, D:0}, true);

  // ---- A. PAYMENT BEHAVIOR (40%) ----
  // Use tglTerima (from unified invoice) instead of tools1TglTerima
  const lunas = custInvoices.filter(i => i.stage === "Lunas" && i.tglJual && i.tglTerima);
  let avgDays = 0;
  if(lunas.length > 0) {
    avgDays = lunas.reduce((s,i) => s + Math.floor((new Date(i.tglTerima) - new Date(i.tglJual)) / 86400000), 0) / lunas.length;
  } else {
    const out = custInvoices.filter(i => i.tglJual);
    if(out.length > 0) avgDays = out.reduce((s,i) => s + Math.floor((now - new Date(i.tglJual)) / 86400000), 0) / out.length;
  }
  const sA1 = avgDays <= 30 ? 0 : avgDays <= 60 ? 25 : avgDays <= 90 ? 55 : avgDays <= 120 ? 75 : 100;

  const over60 = custInvoices.filter(i => i.aging61_90 > 0 || i.aging91_120 > 0 || i.aging121_150 > 0 || i.agingOver150 > 0).length;
  const over60Pct = custInvoices.length > 0 ? over60 / custInvoices.length * 100 : 0;
  const sA2 = over60Pct === 0 ? 0 : over60Pct < 10 ? 20 : over60Pct < 25 ? 50 : over60Pct < 50 ? 75 : 100;

  const sorted = [...custInvoices].filter(i => i.tglJual).sort((a,b) => new Date(a.tglJual) - new Date(b.tglJual));
  let sA3 = 50;
  if(sorted.length >= 4) {
    const half = Math.floor(sorted.length / 2);
    const earlyOver = sorted.slice(0,half).filter(i => i.aging61_90 > 0 || i.agingOver150 > 0).length / half;
    const recentOver = sorted.slice(half).filter(i => i.aging61_90 > 0 || i.agingOver150 > 0).length / (sorted.length - half);
    sA3 = recentOver < earlyOver - 0.1 ? 10 : recentOver > earlyOver + 0.1 ? 90 : 50;
  }

  // Use nominalDiterima from unified invoice
  const lunasAll = custInvoices.filter(i => i.stage === "Lunas");
  const kurangPct = lunasAll.length > 0
    ? lunasAll.filter(i => (i.nominalDiterima||0) > 0 && (i.nominalDiterima||0) < i.total).length / lunasAll.length * 100
    : 0;
  const sA4 = kurangPct === 0 ? 0 : kurangPct < 5 ? 20 : kurangPct < 15 ? 50 : 80;

  const scoreA = (sA1*0.375) + (sA2*0.375) + (sA3*0.175) + (sA4*0.075);

  // ---- B. PROBLEM PATTERN (25%) ----
  const problems = custInvoices.map(i => i.problemId).filter(Boolean);
  const p03p04 = problems.filter(p => p.includes("P03") || p.includes("P04")).length;
  const p01p02 = problems.filter(p => p.includes("P01") || p.includes("P02")).length;
  const p07    = problems.filter(p => p.includes("P07")).length;
  const sB1 = p01p02 === 0 ? 0 : p01p02 <= 2 ? 25 : p01p02 <= 5 ? 55 : 80;
  const sB2 = p03p04 === 0 ? 0 : p03p04 === 1 ? 50 : p03p04 === 2 ? 75 : 100;
  const sB3 = p07 === 0 ? 0 : p07 === 1 ? 60 : 100;
  const scoreB = Math.min(100, (sB1*0.35) + (sB2*0.45) + (sB3*0.20));

  // ---- C. VOLUME & KONSISTENSI (20%) ----
  const monthCounts = {};
  custInvoices.filter(i => i.tglJual).forEach(i => {
    const m = i.tglJual.slice(0,7);
    monthCounts[m] = (monthCounts[m]||0) + 1;
  });
  const months = Object.values(monthCounts);
  let sC1 = 50;
  if(months.length >= 3) {
    const avg = months.reduce((s,v) => s+v, 0) / months.length;
    const cv  = avg > 0 ? Math.sqrt(months.reduce((s,v) => s + Math.pow(v-avg,2), 0) / months.length) / avg : 0;
    sC1 = cv < 0.2 ? 10 : cv < 0.5 ? 30 : cv < 1 ? 60 : 85;
  }
  const totalVal = custInvoices.reduce((s,i) => s + i.total, 0);
  const sC2 = totalVal > 500000000 ? 5 : totalVal > 100000000 ? 15 : totalVal > 50000000 ? 30 : totalVal > 10000000 ? 50 : 70;
  const scoreC = (sC1*0.60) + (sC2*0.40);

  // ---- D. PROMISE TO PAY (15%) ----
  // Use promiseToPay from unified invoice field
  let scoreD = 50;
  const withPromise = custInvoices.filter(i => i.promiseToPay);
  if(withPromise.length > 0) {
    const honored = withPromise.filter(i => {
      const pd = new Date(i.promiseToPay);
      if(i.stage === "Lunas" && i.tglTerima) return new Date(i.tglTerima) <= pd;
      return pd >= now;
    }).length;
    const pct = honored / withPromise.length * 100;
    scoreD = pct >= 90 ? 5 : pct >= 70 ? 25 : pct >= 50 ? 55 : 80;
  }

  const final = Math.min(100, Math.max(0, Math.round(
    (scoreA * scoringWeights.payment) +
    (scoreB * scoringWeights.problem) +
    (scoreC * scoringWeights.volume)  +
    (scoreD * scoringWeights.promise)
  )));

  return buildResult(final, {
    A: Math.round(scoreA),
    B: Math.round(scoreB),
    C: Math.round(scoreC),
    D: Math.round(scoreD),
  });
}

function buildResult(total, breakdown, autoCritical=false) {
  const cat = autoCritical
    ? RISK_CATEGORIES[4]
    : RISK_CATEGORIES.find(c => total >= c.min && total <= c.max) || RISK_CATEGORIES[0];
  return {total, breakdown, category:cat, autoCritical};
}

// ===== GROUP BY CUSTOMER =====
// Now works directly from invoices[] — no EOM needed
function groupByCustomer(invList) {
  const map = new Map();
  (invList || invoices).forEach(inv => {
    const key = inv.masterName || getMasterName(inv.namaCust);
    if(!map.has(key)) map.set(key, {
      masterName: key,
      aliases: new Set(),
      invoices: [],
      custTypeOverride: "",
    });
    const g = map.get(key);
    g.aliases.add(inv.namaCust);
    g.invoices.push(inv);
    if(inv.custTypeOverride) g.custTypeOverride = inv.custTypeOverride;
  });

  return Array.from(map.values()).map(g => {
    const score = scoreCustomer(g.invoices);
    return {
      ...g,
      aliases: [...g.aliases],
      custType: g.custTypeOverride || detectCustomerType(g.invoices[0]?.namaCust || ""),
      score,
      totalAR: g.invoices.reduce((s,i) => s + i.total, 0),
      totalOutstanding: g.invoices.filter(i => i.stage !== "Lunas").reduce((s,i) => s + i.total, 0),
      invoiceCount: g.invoices.length,
      hasStuck: g.invoices.some(i => isStuck(i)),
      hasPromise: g.invoices.some(i => i.promiseToPay),
      hasProblem: g.invoices.some(i => i.problemId),
    };
  }).sort((a,b) => b.score.total - a.score.total);
}

function getRiskCategory(score) {
  return RISK_CATEGORIES.find(c => score >= c.min && score <= c.max) || RISK_CATEGORIES[0];
}

// ===== PROMISE TO PAY WEEKLY =====
// Now reads directly from invoices[]
function parsingTanggalExcel(val) {
    if (!val) return new Date(NaN);
    // Jika bentuknya angka serial Excel/Sheets (misal: 46205 atau "46205")
    if (!isNaN(val) && String(val).trim() !== "") {
        return new Date((Number(val) - 25569) * 24 * 3600 * 1000);
    }
    // Jika sudah berupa string tanggal normal atau objek Date
    return new Date(val);
}
function getWeeklyPromise() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  startOfWeek.setHours(0,0,0,0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23,59,59,999);

  const withPromise = invoices.filter(i => {
  if(!i.promiseToPay || i.promiseToPay === "" || i.promiseToPay === "0") return false;
  const d = new Date(i.promiseToPay);
  return !isNaN(d) && d.getFullYear() > 2000 && i.stage !== "Lunas";
  });

  const thisWeek = withPromise.filter(i => {
    const pd = parsingTanggalExcel(i.promiseToPay);
    return pd >= startOfWeek && pd <= endOfWeek;
  });
  const overdue = withPromise.filter(i => {
  const pd = parsingTanggalExcel(i.promiseToPay);
  const todayStart = new Date(now);
  todayStart.setHours(0,0,0,0);
  return pd < todayStart;
});
  const nextWeek = withPromise.filter(i => {
    const pd = parsingTanggalExcel(i.promiseToPay);
    return pd > endOfWeek && pd <= new Date(endOfWeek.getTime() + 7*86400000);
  });

  return {
    thisWeek, thisWeekTotal: thisWeek.reduce((s,i) => s + i.total, 0),
    overdue,  overdueTotal:  overdue.reduce((s,i)  => s + i.total, 0),
    nextWeek, nextWeekTotal: nextWeek.reduce((s,i) => s + i.total, 0),
    startOfWeek, endOfWeek,
  };
}

// ===== CREDIT SUMMARY STATS =====
// Used by Executive Summary dashboard
function getCreditSummary() {
  const invoices = visibleInvoices();
  const customers = groupByCustomer(invoices);

  // Default: donut/rata-rata skor cuma dari customer AKTIF (masih ada outstanding).
  // Toggle "Lihat Keseluruhan" (APP_STATE.creditDistIncludeArchived) include yang
  // udah lunas semua juga — buat lihat gambaran historis lengkap kalau dibutuhin.
  const distCustomers = APP_STATE.creditDistIncludeArchived
    ? customers
    : customers.filter(c => c.totalOutstanding > 0);

  const dist = {};
  RISK_CATEGORIES.forEach(c => dist[c.label] = {count:0, total:0});
  distCustomers.forEach(c => {
    const label = c.score.category.label;
    if(dist[label]) {
      dist[label].count++;
      dist[label].total += c.totalOutstanding;
    }
  });

  const avgScore = distCustomers.length > 0
    ? Math.round(distCustomers.reduce((s,c) => s + c.score.total, 0) / distCustomers.length)
    : 0;

  // Top Watchlist SELALU cuma dari customer aktif, gak ikut toggle — ini daftar
  // "perlu perhatian sekarang", customer yang udah lunas gak relevan di sini.
  const topRisk = customers.filter(c => c.score.total >= 40 && c.totalOutstanding > 0).slice(0,5);

  return { customers, distCustomers, dist, avgScore, topRisk };
}
