// ===== STAGES =====
// "Konfirmasi Terima" diganti "Follow Up & Things To Do"
// Tgl terima dipindah ke Plan & Kirim
const STAGES = ["AR Masuk","Cek Kelengkapan","Plan & Kirim","Follow Up","Lunas"];

const DIVISI = ["BP","GRP","Mobil"];
const SBR_MAP = {BP:"BP",SV:"GRP",MS:"Mobil"};

const STAGE_COLORS = {
  "AR Masuk":    "#64748b",
  "Cek Kelengkapan": "#d97706",
  "Plan & Kirim":"#2563eb",
  "Follow Up":   "#7c3aed",
  "Lunas":       "#16a34a"
};

const DIVISI_COLORS = {
  BP:    {bg:"#dbeafe",text:"#1e40af"},
  GRP:   {bg:"#d1fae5",text:"#065f46"},
  Mobil: {bg:"#fef3c7",text:"#92400e"}
};

const KETERANGAN_LUNAS = ["Kurang Bayar","PPh 23","Adm. Bank","Materai"];
const TIPE_SURAT = ["Asuransi","BP Afiliasi","NRM Program","Borong","Salah Transfer","Others"];

// Follow Up reasons
const FU_REASONS = [
  "Menunggu approval internal",
  "Dokumen belum lengkap dari customer",
  "Dispute nominal",
  "Sedang proses transfer",
  "Jadwal pembayaran mundur",
  "Tidak ada respon",
  "Lainnya"
];

// Sub-tipe per divisi
const SUBTIPE = {
  BP:    [""],
  GRP:   ["Fleet","NRM"],
  Mobil: ["Leasing","Cash"]
};

// Master list semua dokumen
const DOCS_MASTER = [
  "Faktur","Tagihan","SPK/PO","Merimen","Foto","Surat Puas","Salvage","Kwitansi","Lain-lain",
  "Invoice","WO","SPK","Surat Pengantar Tagihan","Buku Service","Lexus (Buku Service + STNK)",
  "Gesekan Noka","Kwitansi Pelunasan","Copy Kwitansi DP","Form Pengajuan Faktur",
  "Surat Pernyataan Penyerahan BPKB/Cover Note","Surat Permohonan Transfer","PO Leasing","BPK"
];

// Default dokumen per divisi/sub-tipe
const DEFAULT_DOCS = {
  "BP":            ["Faktur","Tagihan","SPK/PO","Merimen","Foto","Surat Puas","Salvage","Kwitansi","Lain-lain"],
  "GRP-Fleet":     ["Kwitansi","Invoice","WO","SPK","Faktur","Surat Pengantar Tagihan"],
  "GRP-NRM":       ["Invoice","Faktur","SPK","WO","Surat Pengantar Tagihan","Buku Service","Lexus (Buku Service + STNK)"],
  "Mobil-Leasing": ["Gesekan Noka","Kwitansi Pelunasan","Copy Kwitansi DP","Form Pengajuan Faktur","Surat Pernyataan Penyerahan BPKB/Cover Note","Surat Permohonan Transfer","PO Leasing","BPK"],
  "Mobil-Cash":    ["Gesekan Noka","Kwitansi Pelunasan","Copy Kwitansi DP","Form Pengajuan Faktur","Surat Pernyataan Penyerahan BPKB/Cover Note","Surat Permohonan Transfer","BPK"]
};

const MASTER = {
  perusahaan: "PT. NASMOCO",
  alamat: "Jl. Raya Kaligawe KM. 5, Semarang",
  bank1: {nama:"BANK CENTRAL ASIA",cabang:"Capem LIK II – Semarang",norek:"353-033445-6"},
  bank2: {nama:"BANK MANDIRI",cabang:"",norek:"135-000-999-0993"},
  ttd1:  {nama:"Nor Atikah",jabatan:"Adm Staff"},
  ttd2:  {nama:"Anton Dwi Kurniawan",jabatan:"Adm Section Head"},
  fax:   "024-6585206",
  email: "desi_x3w@yahoo.co.id",
};

const LS_KEY       = "ar_monitoring_v5";
const LS_SETTINGS  = "ar_monitoring_settings_v2";

const DEFAULT_STUCK_DAYS = {
  "AR Masuk":3,"Cek Kelengkapan":3,"Plan & Kirim":2,"Follow Up":5,"Lunas":9999
};
let STUCK_DAYS   = {...DEFAULT_STUCK_DAYS};
let DOCS_CONFIG  = {...DEFAULT_DOCS};

function getDocsForInvoice(inv){
  const key = inv.sbr==="BP" ? "BP" :
              inv.sbr==="GRP" ? `GRP-${inv.subTipe||"Fleet"}` :
              inv.sbr==="Mobil" ? `Mobil-${inv.subTipe||"Cash"}` : "BP";
  return DOCS_CONFIG[key]||DEFAULT_DOCS[key]||[];
}

function loadSettings(){
  try{
    const raw=localStorage.getItem(LS_SETTINGS);
    if(raw){
      const s=JSON.parse(raw);
      if(s.stuckDays) STUCK_DAYS={...DEFAULT_STUCK_DAYS,...s.stuckDays};
      if(s.docsConfig) DOCS_CONFIG={...DEFAULT_DOCS,...s.docsConfig};
    }
  }catch{}
}

function saveSettings(stuckDays,docsConfig){
  STUCK_DAYS={...DEFAULT_STUCK_DAYS,...stuckDays};
  DOCS_CONFIG={...DEFAULT_DOCS,...docsConfig};
  localStorage.setItem(LS_SETTINGS,JSON.stringify({stuckDays,docsConfig}));
}

// ===== NEW UNIFIED KEYS =====
const LS_KEY_V2         = "moflex_invoices_v1";
const LS_SETTINGS_V2    = "moflex_settings_v1";
const LS_MAPPING_V2     = "moflex_customer_mapping_v1";
const LS_CUST_TYPE_V2   = "moflex_cust_type_keywords_v1";
const LS_SCORING_V2     = "moflex_scoring_settings_v1";
const LS_SUBTIPE_KW_V1  = "moflex_subtipe_keywords_v1";

const DEALER_LIST = [
  "Nasmoco Bantul","Nasmoco Brebes","Nasmoco Cilacap","Nasmoco Demak","Nasmoco Gombel",
  "Nasmoco Janti","Nasmoco Kaligawe","Nasmoco Karanganyar","Nasmoco Karanjati","Nasmoco Klaten",
  "Nasmoco Magelang","Nasmoco Majapahit","Nasmoco Mlati","Nasmoco Pati","Nasmoco Pekalongan",
  "Nasmoco Pemuda","Nasmoco Purbalingga","Nasmoco Purwokerto","Nasmoco Salatiga","Nasmoco Siliwangi",
  "Nasmoco Slamet Riyadi","Nasmoco Solo Baru","Nasmoco Tegal","Nasmoco Wonosobo",
];

// Problem ID list
const PROBLEM_IDS = [
  {id:"P01", label:"P01 — Dokumen tidak lengkap"},
  {id:"P02", label:"P02 — Dokumen salah/perlu revisi"},
  {id:"P03", label:"P03 — Dispute nominal"},
  {id:"P04", label:"P04 — Masalah legal/kontrak"},
  {id:"P05", label:"P05 — Indikasi fraud"},
  {id:"P06", label:"P06 — Customer tidak responsif"},
  {id:"P07", label:"P07 — Jadwal pembayaran mundur"},
  {id:"P08", label:"P08 — PPh 23 / Bukpot issue"},
  {id:"P09", label:"P09 — Lainnya"},
];
