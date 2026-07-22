// ===== EXPORT SYSTEM =====
// 3 layers: Summary AR, Summary Credit, Filtered Detail
// 2 formats: Excel, PDF
// 3 templates: Internal, External, Custom (global saved)

const LS_EXPORT_TEMPLATE = "moflex_export_template_v1";

// ---- ALL AVAILABLE COLUMNS ----
const EXPORT_COLUMNS = {
  // Basic — always available
  noInvoice:    { label:"No. Invoice",     group:"basic" },
  namaCust:     { label:"Nama Customer",   group:"basic" },
  masterName:   { label:"Master Name",     group:"basic" },
  sbr:          { label:"Divisi",          group:"basic" },
  subTipe:      { label:"Sub-tipe",        group:"basic" },
  custType:     { label:"Tipe Customer",   group:"basic" },
  total:        { label:"Total (Rp)",      group:"basic" },
  tglJual:      { label:"Tgl Jual",        group:"basic" },
  jthTempo:     { label:"Jth Tempo",       group:"basic" },
  tglMasuk:     { label:"Tgl Masuk",       group:"basic" },
  stage:        { label:"Stage",           group:"basic" },
  stageUpdatedAt:{ label:"Tgl Stage Update", group:"basic" },
  // Aging
  lancar:       { label:"Lancar",          group:"aging" },
  aging1_30:    { label:"1-30 Hr",         group:"aging" },
  aging31_60:   { label:"31-60 Hr",        group:"aging" },
  aging61_90:   { label:"61-90 Hr",        group:"aging" },
  aging91_120:  { label:"91-120 Hr",       group:"aging" },
  aging121_150: { label:"121-150 Hr",      group:"aging" },
  agingOver150: { label:">150 Hr",         group:"aging" },
  // Invoice detail
  kodeCust:     { label:"Kode Customer",   group:"detail" },
  noWO:         { label:"No. WO",          group:"detail" },
  noPol:        { label:"No. Pol/PO",      group:"detail" },
  noSPK:        { label:"No. SPK",         group:"detail" },
  salesSA:      { label:"Sales/SA",        group:"detail" },
  keterangan:   { label:"Keterangan",      group:"detail" },
  // Pipeline
  planKirim:    { label:"Plan Kirim",      group:"pipeline" },
  tglKirim:     { label:"Tgl Kirim",       group:"pipeline" },
  tglTerima:    { label:"Tgl Terima",      group:"pipeline" },
  isBillSent:   { label:"Bill Sent",       group:"pipeline" },
  tglLunas:     { label:"Tgl Lunas",       group:"pipeline" },
  nominalDiterima:{ label:"Nominal Diterima", group:"pipeline" },
  selisih:      { label:"Selisih",         group:"pipeline" },
  keteranganLunas:{ label:"Ket. Selisih",  group:"pipeline" },
  // Internal enrichment
  problemId:    { label:"Problem ID",      group:"internal" },
  lastRemark:   { label:"Last Remark",     group:"internal" },
  pdcaRemark:   { label:"PDCA Remark",     group:"internal" },
  updateRemarks:{ label:"Update Remarks",  group:"internal" },
  isBukpot:     { label:"Bukpot",          group:"internal" },
  pph23:        { label:"PPh 23",          group:"internal" },
  promiseToPay: { label:"Promise to Pay",  group:"internal" },
  promiseMining:{ label:"Promise Mining",  group:"internal" },
  catatanKendala:{ label:"Catatan Kendala", group:"internal" },
  fuCount:      { label:"Jumlah FU",       group:"internal" },
  lastFU:       { label:"Last FU",         group:"internal" },
};

// Preset templates
const TEMPLATE_INTERNAL = Object.keys(EXPORT_COLUMNS);
const TEMPLATE_EXTERNAL = ["noInvoice","namaCust","sbr","subTipe","total","tglJual","jthTempo","stage","lancar","aging1_30","aging31_60","aging61_90","aging91_120","aging121_150","agingOver150"];

// Load/save custom template
function loadCustomTemplate() {
  try { const r = localStorage.getItem(LS_EXPORT_TEMPLATE); return r ? JSON.parse(r) : [...TEMPLATE_EXTERNAL]; }
  catch { return [...TEMPLATE_EXTERNAL]; }
}
function saveCustomTemplate(cols) {
  localStorage.setItem(LS_EXPORT_TEMPLATE, JSON.stringify(cols));
}

// App state for export modal
let _exportState = {
  layer: "filtered",   // summary_ar | summary_credit | filtered
  format: "excel",     // excel | pdf
  template: "internal",// internal | external | custom
  customCols: loadCustomTemplate(),
  showCustomPicker: false,
};

// ---- OPEN EXPORT MODAL ----
function openExportModal() {
  _exportState.customCols = loadCustomTemplate();
  renderExportModal();
  document.getElementById("exportModal").style.display = "flex";
}

function renderExportModal() {
  const s = _exportState;
  const filtered = getFiltered();
  const colGroups = { basic:"Informasi Dasar", aging:"Aging Buckets", detail:"Detail Invoice", pipeline:"Pipeline & Pembayaran", internal:"Internal & Enrichment" };

  document.getElementById("exportModalInner").innerHTML = `
    <div class="modal" style="width:560px;max-height:90vh;overflow-y:auto;">
      <div class="modal-header">
        <strong>📤 Export Data</strong>
        <button class="modal-close" onclick="closeModal('exportModal')">×</button>
      </div>

      <!-- STEP 1: LAYER -->
      <div style="margin-bottom:16px;">
        <p style="font-size:12px;font-weight:600;color:var(--gray-500);margin-bottom:8px;">1. Pilih Data</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
          ${[
            {key:"filtered",    icon:"🔍", label:"Filtered Detail",  sub:`${filtered.length} invoice (filter aktif)`},
            {key:"summary_ar",  icon:"📊", label:"Summary AR",        sub:"Overview dashboard AR Tracker"},
            {key:"summary_credit",icon:"🛡", label:"Summary Credit",  sub:"Overview dashboard Credit Scoring"},
          ].map(opt => `
            <div onclick="_exportState.layer='${opt.key}';renderExportModal()"
              style="padding:10px;border-radius:var(--r-md);cursor:pointer;text-align:center;
              border:1.5px solid ${s.layer===opt.key?"var(--purple)":"var(--border)"};
              background:${s.layer===opt.key?"var(--purple-light)":"var(--gray-50)"};
              transition:all .15s;">
              <div style="font-size:18px;margin-bottom:4px;">${opt.icon}</div>
              <div style="font-size:12px;font-weight:500;color:${s.layer===opt.key?"var(--purple-dark)":"var(--gray-700)"};">${opt.label}</div>
              <div style="font-size:10px;color:var(--gray-400);margin-top:2px;">${opt.sub}</div>
            </div>`).join("")}
        </div>
      </div>

      <!-- ACTIVE FILTERS INFO (only for filtered) -->
      ${s.layer === "filtered" ? `
        <div style="background:var(--blue-light);border:0.5px solid #bfdbfe;border-radius:var(--r-md);padding:8px 12px;margin-bottom:14px;font-size:11px;color:var(--blue);">
          <strong>Filter aktif:</strong>
          Stage: ${APP_STATE.filterStage} ·
          Divisi: ${APP_STATE.filterDivisi} ·
          ${APP_STATE.filterAlert?"Perlu Perhatian · ":""}
          ${APP_STATE.searchQ?`Search: "${APP_STATE.searchQ}" · `:""}
          ${APP_STATE.agingFilterKey?`Aging: ${AGING_LABEL[APP_STATE.agingFilterKey]} · `:""}
          <strong>${filtered.length} invoice akan dieksport</strong>
        </div>` : ""}

      <!-- STEP 2: TEMPLATE (only for filtered) -->
      ${s.layer === "filtered" ? `
        <div style="margin-bottom:16px;">
          <p style="font-size:12px;font-weight:600;color:var(--gray-500);margin-bottom:8px;">2. Template Kolom</p>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            ${[
              {key:"internal", label:"🔒 Internal", sub:"Semua field"},
              {key:"external", label:"📤 Eksternal", sub:"Field transaksi saja"},
              {key:"custom",   label:"⚙️ Custom",   sub:"Pilih manual"},
            ].map(t => `
              <div onclick="_exportState.template='${t.key}';_exportState.showCustomPicker=${t.key==="custom"};renderExportModal()"
                style="flex:1;padding:8px;border-radius:var(--r-md);cursor:pointer;text-align:center;
                border:1.5px solid ${s.template===t.key?"var(--purple)":"var(--border)"};
                background:${s.template===t.key?"var(--purple-light)":"var(--gray-50)"};font-size:12px;">
                <div style="font-weight:500;color:${s.template===t.key?"var(--purple-dark)":"var(--gray-700)"};">${t.label}</div>
                <div style="font-size:10px;color:var(--gray-400);margin-top:2px;">${t.sub}</div>
              </div>`).join("")}
          </div>

          <!-- CUSTOM COLUMN PICKER -->
          ${s.template === "custom" ? `
            <div style="border:0.5px solid var(--border);border-radius:var(--r-md);padding:12px;max-height:280px;overflow-y:auto;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:11px;font-weight:600;color:var(--gray-700);">Pilih kolom yang dieksport</span>
                <span style="font-size:11px;color:var(--purple);cursor:pointer;" onclick="selectAllExportCols(true)">Pilih Semua</span>
              </div>
              ${Object.entries(colGroups).map(([grp, grpLabel]) => `
                <div style="margin-bottom:10px;">
                  <p style="font-size:10px;font-weight:600;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">${grpLabel}</p>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;">
                    ${Object.entries(EXPORT_COLUMNS).filter(([,c])=>c.group===grp).map(([key,col]) => `
                      <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;padding:4px 6px;border-radius:4px;
                        background:${s.customCols.includes(key)?"var(--green-light)":"transparent"};
                        border:0.5px solid ${s.customCols.includes(key)?"#bbf7d0":"transparent"};">
                        <input type="checkbox" ${s.customCols.includes(key)?"checked":""} onchange="toggleExportCol('${key}',this.checked)"/>
                        ${col.label}
                      </label>`).join("")}
                  </div>
                </div>`).join("")}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
              <span style="font-size:11px;color:var(--gray-400);">${s.customCols.length} kolom dipilih</span>
              <button onclick="saveCustomTemplate(_exportState.customCols);toast('Template custom disimpan!','success')"
                style="font-size:11px;padding:4px 12px;background:var(--purple);color:#fff;border:none;border-radius:var(--r-sm);cursor:pointer;">
                💾 Simpan Template
              </button>
            </div>` : ""}
        </div>` : ""}

      <!-- STEP 3: FORMAT -->
      <div style="margin-bottom:20px;">
        <p style="font-size:12px;font-weight:600;color:var(--gray-500);margin-bottom:8px;">${s.layer==="filtered"?"3.":"2."} Format File</p>
        <div style="display:flex;gap:8px;">
          ${[
            {key:"excel", icon:"📊", label:"Excel (.xlsx)", sub:"Bisa diolah lebih lanjut"},
            {key:"pdf",   icon:"📄", label:"PDF",           sub:"Siap print / share"},
          ].map(f => `
            <div onclick="_exportState.format='${f.key}';renderExportModal()"
              style="flex:1;padding:10px;border-radius:var(--r-md);cursor:pointer;
              border:1.5px solid ${s.format===f.key?"var(--blue)":"var(--border)"};
              background:${s.format===f.key?"var(--blue-light)":"var(--gray-50)"};text-align:center;">
              <div style="font-size:18px;margin-bottom:4px;">${f.icon}</div>
              <div style="font-size:12px;font-weight:500;color:${s.format===f.key?"var(--blue)":"var(--gray-700)"};">${f.label}</div>
              <div style="font-size:10px;color:var(--gray-400);margin-top:2px;">${f.sub}</div>
            </div>`).join("")}
        </div>
      </div>

      <!-- ACTION BUTTONS -->
      <div class="modal-footer">
        <button class="btn-ghost" onclick="closeModal('exportModal')">Batal</button>
        <button class="btn-primary" onclick="doExport()" style="gap:6px;">
          ${s.format==="excel"?"📊 Export Excel":"📄 Export PDF"}
        </button>
      </div>
    </div>`;
}

function toggleExportCol(key, checked) {
  if(checked) { if(!_exportState.customCols.includes(key)) _exportState.customCols.push(key); }
  else { _exportState.customCols = _exportState.customCols.filter(k=>k!==key); }
  renderExportModal();
}

function selectAllExportCols(checked) {
  _exportState.customCols = checked ? Object.keys(EXPORT_COLUMNS) : [];
  renderExportModal();
}

// ---- DO EXPORT ----
function doExport() {
  const {layer, format, template, customCols} = _exportState;
  if(format === "excel") {
    if(layer === "filtered")       exportFilteredExcel(template, customCols);
    else if(layer === "summary_ar") exportSummaryARExcel();
    else if(layer === "summary_credit") exportSummaryCreditExcel();
  } else {
    if(layer === "filtered")       exportFilteredPDF(template, customCols);
    else if(layer === "summary_ar") exportSummaryARPDF();
    else if(layer === "summary_credit") exportSummaryCreditPDF();
  }
  closeModal("exportModal");
}

// ---- GET COLS FOR TEMPLATE ----
function getTemplateCols(template, customCols) {
  if(template === "internal") return TEMPLATE_INTERNAL;
  if(template === "external") return TEMPLATE_EXTERNAL;
  return customCols.length > 0 ? customCols : TEMPLATE_EXTERNAL;
}

// ---- GET ROW VALUE ----
function getColValue(inv, key) {
  if(key === "fuCount")  return (inv.followUps||[]).length;
  if(key === "lastFU")   return inv.lastFU || "";
  if(key === "total" || key === "nominalDiterima" || key === "selisih" ||
     key === "lancar" || key.startsWith("aging")) return parseFloat(inv[key])||0;
  return inv[key] || "";
}

// ===== FILTERED DETAIL EXCEL =====
function exportFilteredExcel(template, customCols) {
  const cols = getTemplateCols(template, customCols);
  const filtered = getFiltered();

  const headers = cols.map(k => EXPORT_COLUMNS[k]?.label || k);
  const rows = filtered.map(inv => cols.map(k => getColValue(inv, k)));

  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = cols.map(k => {
    const w = k.includes("Remark") || k.includes("Catatan") ? 30 : k === "namaCust" || k === "masterName" ? 25 : 14;
    return {wch: w};
  });

  // Style header row (bold)
  headers.forEach((_, i) => {
    const cell = ws[XLSX.utils.encode_cell({r:0, c:i})];
    if(cell) { cell.s = {font:{bold:true}, fill:{fgColor:{rgb:"1e40af"}}}; }
  });

  XLSX.utils.book_append_sheet(wb, ws, "Data Invoice");

  // Add meta sheet
  const metaData = [
    ["MOFLEX Export — Filtered Detail"],
    ["Tanggal Export", fmtDateLong(today())],
    ["Template", template.toUpperCase()],
    ["Filter Stage", APP_STATE.filterStage],
    ["Filter Divisi", APP_STATE.filterDivisi],
    ["Filter Alert", APP_STATE.filterAlert ? "Ya" : "Tidak"],
    ["Search Query", APP_STATE.searchQ || "-"],
    ["Total Invoice", filtered.length],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(metaData);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Info Export");

  XLSX.writeFile(wb, `MOFLEX_Invoice_${template}_${today()}.xlsx`);
  toast(`Excel exported — ${filtered.length} invoice ✓`, "success");
}

// ===== FILTERED DETAIL PDF =====
function exportFilteredPDF(template, customCols) {
  const cols = getTemplateCols(template, customCols);
  const filtered = getFiltered();
  const headers  = cols.map(k => EXPORT_COLUMNS[k]?.label || k);

  const filterInfo = [
    APP_STATE.filterStage !== "Semua" ? `Stage: ${APP_STATE.filterStage}` : "",
    APP_STATE.filterDivisi !== "Semua" ? `Divisi: ${APP_STATE.filterDivisi}` : "",
    APP_STATE.filterAlert ? "Perlu Perhatian" : "",
    APP_STATE.searchQ ? `Search: "${APP_STATE.searchQ}"` : "",
    APP_STATE.agingFilterKey ? `Aging: ${AGING_LABEL[APP_STATE.agingFilterKey]}` : "",
  ].filter(Boolean).join(" · ") || "Semua data";

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"/>
<title>MOFLEX Export — ${today()}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:9pt;color:#111;padding:10mm;}
h1{font-size:14pt;font-weight:bold;margin-bottom:4px;color:#1e40af;}
.meta{font-size:9pt;color:#555;margin-bottom:12px;}
table{width:100%;border-collapse:collapse;margin-top:8px;}
th{background:#1e40af;color:#fff;padding:6px 8px;text-align:left;font-size:8pt;white-space:nowrap;}
td{padding:5px 8px;border-bottom:0.5px solid #e5e7eb;font-size:8pt;white-space:nowrap;}
tr:nth-child(even) td{background:#f8faff;}
.footer{margin-top:12px;font-size:8pt;color:#aaa;text-align:center;}
@media print{body{padding:8mm;} @page{margin:8mm;size:A4 landscape;}}
</style></head><body>
<h1>MOFLEX — Data Invoice Export</h1>
<div class="meta">
  <strong>Template:</strong> ${template.toUpperCase()} &nbsp;·&nbsp;
  <strong>Filter:</strong> ${filterInfo} &nbsp;·&nbsp;
  <strong>Total:</strong> ${filtered.length} invoice &nbsp;·&nbsp;
  <strong>Tanggal:</strong> ${fmtDateLong(today())}
</div>
<div style="overflow-x:auto;">
<table>
  <thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
  <tbody>
    ${filtered.map(inv => `
      <tr>${cols.map(k => {
        const v = getColValue(inv, k);
        const isRp = ["total","nominalDiterima","selisih","lancar","aging1_30","aging31_60","aging61_90","aging91_120","aging121_150","agingOver150"].includes(k);
        const isStage = k === "stage";
        if(isRp) return `<td style="text-align:right;">${v ? fmtRp(v) : "-"}</td>`;
        if(isStage) return `<td><span style="padding:2px 6px;border-radius:3px;background:${STAGE_COLORS[v]||"#eee"}22;color:${STAGE_COLORS[v]||"#555"};font-weight:bold;">${v}</span></td>`;
        if(k==="problemId"&&v) return `<td><span style="padding:2px 6px;border-radius:3px;background:#fee2e2;color:#b91c1c;font-weight:bold;">${v}</span></td>`;
        return `<td>${v||"-"}</td>`;
      }).join("")}</tr>`).join("")}
  </tbody>
</table>
</div>
<div class="footer">MOFLEX — PT. Nasmoco Kaligawe · ${fmtDateLong(today())}</div>
<script>window.onload=()=>setTimeout(()=>window.print(),600);<\/script>
</body></html>`;

  const w = window.open("","_blank");
  if(!w){ toast("Pop-up diblokir browser","error"); return; }
  w.document.write(html);
  w.document.close();
  toast(`PDF export siap — ${filtered.length} invoice ✓`, "success");
}

// ===== SUMMARY AR EXCEL =====
function exportSummaryARExcel() {
  const wb = XLSX.utils.book_new();
  const kurangBayarList = invoices.filter(i=>i.stage==="Lunas"&&(i.nominalDiterima||0)<i.total&&i.total>0);
  const totalSelisih    = kurangBayarList.reduce((s,i)=>s+(i.total-(i.nominalDiterima||0)),0);
  const totalBelumLunas = invoices.filter(i=>i.stage!=="Lunas").reduce((s,i)=>s+i.total,0);
  const totalAR         = totalBelumLunas + totalSelisih;

  // Overview sheet
  const ovData = [
    ["MOFLEX — Summary AR Tracker"],
    ["Tanggal Export", fmtDateLong(today())],
    [""],
    ["OVERVIEW"],
    ["Total AR Outstanding", totalAR],
    ["Total Belum Lunas", totalBelumLunas],
    ["Total Kurang Bayar", totalSelisih],
    ["Total Invoice", invoices.length],
    ["Invoice Aktif", invoices.filter(i=>i.stage!=="Lunas").length],
    ["Invoice Lunas", invoices.filter(i=>i.stage==="Lunas").length],
    ["Invoice Stuck", invoices.filter(i=>isStuck(i)).length],
    [""],
    ["PIPELINE"],
    ["Stage","Jumlah","Nominal"],
    ...STAGES.map(s => {
      const list = invoices.filter(i=>i.stage===s);
      return [s, list.length, list.reduce((sum,i)=>sum+i.total,0)];
    }),
    [""],
    ["AGING"],
    ["Bucket","Jumlah (Rp)"],
    ["Lancar",    invoices.reduce((s,i)=>s+i.lancar,0)],
    ["1-30 Hr",   invoices.reduce((s,i)=>s+i.aging1_30,0)],
    ["31-60 Hr",  invoices.reduce((s,i)=>s+i.aging31_60,0)],
    ["61-90 Hr",  invoices.reduce((s,i)=>s+i.aging61_90,0)],
    ["91-120 Hr", invoices.reduce((s,i)=>s+i.aging91_120,0)],
    ["121-150 Hr",invoices.reduce((s,i)=>s+i.aging121_150,0)],
    [">150 Hr",   invoices.reduce((s,i)=>s+i.agingOver150,0)],
    [""],
    ["PER DIVISI"],
    ["Divisi","Invoice","Total AR"],
    ...["BP","GRP","Mobil"].map(div => {
      const di = invoices.filter(i=>i.sbr===div);
      return [div, di.length, di.reduce((s,i)=>s+i.total,0)];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ovData), "Summary AR");

  // Stuck invoice sheet
  const stuckList = invoices.filter(i=>isStuck(i));
  if(stuckList.length>0) {
    const stuckData = [
      ["No. Invoice","Customer","Divisi","Stage","Total","Hari di Stage"],
      ...stuckList.map(i=>[i.noInvoice, i.namaCust, i.sbr, i.stage, i.total, daysDiff(i.stageUpdatedAt||i.tglMasuk)])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stuckData), "Perlu Perhatian");
  }

  XLSX.writeFile(wb, `MOFLEX_Summary_AR_${today()}.xlsx`);
  toast("Summary AR Excel exported ✓", "success");
}

// ===== SUMMARY AR PDF =====
function exportSummaryARPDF() {
  const kurangBayarList = invoices.filter(i=>i.stage==="Lunas"&&(i.nominalDiterima||0)<i.total&&i.total>0);
  const totalSelisih    = kurangBayarList.reduce((s,i)=>s+(i.total-(i.nominalDiterima||0)),0);
  const totalBelumLunas = invoices.filter(i=>i.stage!=="Lunas").reduce((s,i)=>s+i.total,0);
  const totalAR         = totalBelumLunas+totalSelisih;
  const stuckList       = invoices.filter(i=>isStuck(i));

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"/>
<title>MOFLEX Summary AR — ${today()}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:10pt;color:#111;padding:15mm;}
h1{font-size:16pt;font-weight:bold;color:#1e40af;margin-bottom:4px;}
h2{font-size:12pt;font-weight:bold;color:#1e40af;margin:18px 0 8px;padding-bottom:4px;border-bottom:2px solid #1e40af;}
.meta{font-size:9pt;color:#555;margin-bottom:16px;}
.metric-row{display:flex;gap:10px;margin-bottom:12px;}
.metric{flex:1;background:#f8faff;border:1px solid #dbeafe;border-radius:6px;padding:10px;}
.metric-label{font-size:9pt;color:#555;}
.metric-value{font-size:14pt;font-weight:bold;color:#1e40af;}
table{width:100%;border-collapse:collapse;margin-bottom:12px;}
th{background:#1e40af;color:#fff;padding:7px 10px;font-size:9pt;text-align:left;}
td{padding:6px 10px;border-bottom:0.5px solid #e5e7eb;font-size:9pt;}
@media print{body{padding:10mm;} @page{margin:10mm;}}
</style></head><body>
<h1>Summary AR Tracker</h1>
<div class="meta">PT. Nasmoco Kaligawe &nbsp;·&nbsp; ${fmtDateLong(today())}</div>

<div class="metric-row">
  <div class="metric"><div class="metric-label">Total AR Outstanding</div><div class="metric-value">${fmtRp(totalAR)}</div></div>
  <div class="metric"><div class="metric-label">Belum Lunas</div><div class="metric-value">${invoices.filter(i=>i.stage!=="Lunas").length} invoice</div></div>
  <div class="metric"><div class="metric-label">Perlu Perhatian</div><div class="metric-value" style="color:#dc2626;">${stuckList.length}</div></div>
</div>

<h2>Pipeline</h2>
<table>
  <thead><tr><th>Stage</th><th>Invoice</th><th style="text-align:right;">Nominal</th></tr></thead>
  <tbody>
    ${STAGES.map(s=>{
      const list=invoices.filter(i=>i.stage===s);
      const nom=list.reduce((sum,i)=>sum+i.total,0);
      return `<tr><td><strong>${s}</strong></td><td>${list.length}</td><td style="text-align:right;">${fmtRp(nom)}</td></tr>`;
    }).join("")}
  </tbody>
</table>

<h2>Aging</h2>
<table>
  <thead><tr><th>Bucket</th><th style="text-align:right;">Nominal</th></tr></thead>
  <tbody>
    ${[["Lancar","lancar"],["1-30 Hr","aging1_30"],["31-60 Hr","aging31_60"],["61-90 Hr","aging61_90"],["91-120 Hr","aging91_120"],["121-150 Hr","aging121_150"],[">150 Hr","agingOver150"]].map(([l,k])=>
      `<tr><td>${l}</td><td style="text-align:right;">${fmtRp(invoices.reduce((s,i)=>s+(i[k]||0),0))}</td></tr>`
    ).join("")}
  </tbody>
</table>

${stuckList.length>0?`
<h2>Perlu Perhatian (${stuckList.length})</h2>
<table>
  <thead><tr><th>No. Invoice</th><th>Customer</th><th>Divisi</th><th>Stage</th><th>Hari Stuck</th></tr></thead>
  <tbody>
    ${stuckList.slice(0,30).map(i=>`<tr><td>${i.noInvoice}</td><td>${i.namaCust}</td><td>${i.sbr}</td><td>${i.stage}</td><td style="color:#dc2626;">${daysDiff(i.stageUpdatedAt||i.tglMasuk)} hr</td></tr>`).join("")}
    ${stuckList.length>30?`<tr><td colspan="5" style="color:#aaa;text-align:center;">+${stuckList.length-30} lainnya...</td></tr>`:""}
  </tbody>
</table>`:""}

<p style="margin-top:16px;font-size:8pt;color:#aaa;text-align:center;">MOFLEX — PT. Nasmoco Kaligawe · ${fmtDateLong(today())}</p>
<script>window.onload=()=>setTimeout(()=>window.print(),600);<\/script>
</body></html>`;

  const w = window.open("","_blank");
  if(!w){toast("Pop-up diblokir browser","error");return;}
  w.document.write(html); w.document.close();
  toast("Summary AR PDF siap ✓","success");
}

// ===== SUMMARY CREDIT EXCEL =====
function exportSummaryCreditExcel() {
  const customers = groupByCustomer(invoices);
  const wb = XLSX.utils.book_new();

  // Distribution
  const distData = [
    ["MOFLEX — Summary Credit Scoring"],
    ["Tanggal Export", fmtDateLong(today())],
    [""],
    ["DISTRIBUSI RISIKO"],
    ["Risk Tier","Jumlah Customer","Total AR Outstanding"],
    ...RISK_CATEGORIES.map(cat=>{
      const cust=customers.filter(c=>c.score.category.label===cat.label);
      return [cat.label, cust.length, cust.reduce((s,c)=>s+c.totalOutstanding,0)];
    }),
    [""],
    ["PROMISE TO PAY"],
  ];
  const weekly = getWeeklyPromise();
  distData.push(["Minggu Ini",weekly.thisWeek.length,weekly.thisWeekTotal]);
  distData.push(["Overdue",weekly.overdue.length,weekly.overdueTotal]);
  distData.push(["Minggu Depan",weekly.nextWeek.length,weekly.nextWeekTotal]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(distData), "Summary Credit");

  // Customer list sheet
  const custData = [
    ["Master Name","Tipe Customer","Invoice","Outstanding","Risk Score","Risk Tier","Problem IDs","Has Promise"],
    ...customers.map(c=>[
      c.masterName,
      c.custType,
      c.invoiceCount,
      c.totalOutstanding,
      c.score.total,
      c.score.category.label,
      [...new Set(c.invoices.map(i=>i.problemId).filter(Boolean))].join(", "),
      c.invoices.some(i=>i.promiseToPay)?"Ya":"Tidak",
    ])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(custData), "Customer List");

  XLSX.writeFile(wb, `MOFLEX_Summary_Credit_${today()}.xlsx`);
  toast("Summary Credit Excel exported ✓","success");
}

// ===== SUMMARY CREDIT PDF =====
function exportSummaryCreditPDF() {
  const customers = groupByCustomer(invoices);
  const weekly    = getWeeklyPromise();
  const totalAR   = customers.reduce((s,c)=>s+c.totalOutstanding,0);

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"/>
<title>MOFLEX Summary Credit — ${today()}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:10pt;color:#111;padding:15mm;}
h1{font-size:16pt;font-weight:bold;color:#6c47ff;margin-bottom:4px;}
h2{font-size:12pt;font-weight:bold;color:#6c47ff;margin:18px 0 8px;padding-bottom:4px;border-bottom:2px solid #6c47ff;}
.meta{font-size:9pt;color:#555;margin-bottom:16px;}
.tier-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px;}
.tier{text-align:center;padding:10px;border-radius:6px;border:1px solid #e5e7eb;}
table{width:100%;border-collapse:collapse;margin-bottom:12px;}
th{background:#6c47ff;color:#fff;padding:7px 10px;font-size:9pt;text-align:left;}
td{padding:6px 10px;border-bottom:0.5px solid #e5e7eb;font-size:9pt;}
@media print{body{padding:10mm;} @page{margin:10mm;}}
</style></head><body>
<h1>Summary Credit Scoring</h1>
<div class="meta">PT. Nasmoco Kaligawe &nbsp;·&nbsp; ${fmtDateLong(today())} &nbsp;·&nbsp; ${customers.length} customers &nbsp;·&nbsp; AR: ${fmtRp(totalAR)}</div>

<h2>Distribusi Risiko</h2>
<div class="tier-grid">
  ${RISK_CATEGORIES.map(cat=>{
    const cust=customers.filter(c=>c.score.category.label===cat.label);
    return `<div class="tier" style="background:${cat.bg};border-color:${cat.border};">
      <div style="font-size:18px;">${cat.icon}</div>
      <div style="font-size:16pt;font-weight:bold;color:${cat.color};">${cust.length}</div>
      <div style="font-size:9pt;color:${cat.color};">${cat.label}</div>
      <div style="font-size:9pt;font-weight:bold;color:${cat.color};">${fmtRp(cust.reduce((s,c)=>s+c.totalOutstanding,0))}</div>
    </div>`;
  }).join("")}
</div>

<h2>Promise to Pay</h2>
<table>
  <thead><tr><th>Periode</th><th>Invoice</th><th style="text-align:right;">Total</th></tr></thead>
  <tbody>
    <tr><td>Minggu Ini</td><td>${weekly.thisWeek.length}</td><td style="text-align:right;">${fmtRp(weekly.thisWeekTotal)}</td></tr>
    <tr><td style="color:#dc2626;">Overdue Promise</td><td style="color:#dc2626;">${weekly.overdue.length}</td><td style="text-align:right;color:#dc2626;">${fmtRp(weekly.overdueTotal)}</td></tr>
    <tr><td>Minggu Depan</td><td>${weekly.nextWeek.length}</td><td style="text-align:right;">${fmtRp(weekly.nextWeekTotal)}</td></tr>
  </tbody>
</table>

<h2>Top Risk Customers</h2>
<table>
  <thead><tr><th>Customer</th><th>Tipe</th><th>Invoice</th><th style="text-align:right;">Outstanding</th><th>Score</th><th>Tier</th></tr></thead>
  <tbody>
    ${customers.slice(0,20).map(c=>`
      <tr>
        <td><strong>${c.masterName}</strong></td>
        <td>${c.custType}</td>
        <td>${c.invoiceCount}</td>
        <td style="text-align:right;">${fmtRp(c.totalOutstanding)}</td>
        <td style="font-weight:bold;color:${c.score.category.color};">${c.score.total}</td>
        <td><span style="padding:2px 8px;border-radius:4px;background:${c.score.category.bg};color:${c.score.category.color};font-weight:bold;">${c.score.category.label}</span></td>
      </tr>`).join("")}
  </tbody>
</table>

<p style="margin-top:16px;font-size:8pt;color:#aaa;text-align:center;">MOFLEX — PT. Nasmoco Kaligawe · ${fmtDateLong(today())}</p>
<script>window.onload=()=>setTimeout(()=>window.print(),600);<\/script>
</body></html>`;

  const w = window.open("","_blank");
  if(!w){toast("Pop-up diblokir browser","error");return;}
  w.document.write(html); w.document.close();
  toast("Summary Credit PDF siap ✓","success");
}
