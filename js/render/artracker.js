// ===== AR TRACKER =====

// ---- HELPERS ----
let _searchTimer  = null;
let agingBreakdownBucket = null;

function handleSearchInput(val) {
  APP_STATE.searchQ = val;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => renderMonitoring(), 250);
}

function selectInv(id) {
  const scrollArea = document.getElementById("tableScrollArea");
  const scrollTop  = scrollArea ? scrollArea.scrollTop : 0;
  if(APP_STATE.selectedId === id) {
    APP_STATE.selectedId = null;
  } else {
    APP_STATE.selectedId = id;
    const inv = getInv(id);
    if(inv?.stage === "Cek Kelengkapan") APP_STATE.detailTab = "dokumen";
    else if(inv?.stage === "Plan & Kirim") APP_STATE.detailTab = "plankirim";
    else if(inv?.stage === "Follow Up")   APP_STATE.detailTab = "followup";
    else APP_STATE.detailTab = "detail";
  }
  renderMonitoring();
  requestAnimationFrame(() => {
    const nd = document.getElementById("tableScrollArea");
    if(nd) nd.scrollTop = scrollTop;
  });
}

function switchDetailTab(t) {
  APP_STATE.detailTab = t;
  if(t === "history" && APP_STATE.selectedId) {
    const id = APP_STATE.selectedId;
    // Selalu fetch ulang tiap tab dibuka biar dapet data paling baru (bukan cache basi)
    APP_STATE.historyCache[id] = { loading: true, items: [] };
    Api.getHistory(id).then(items => {
      APP_STATE.historyCache[id] = { loading: false, items };
      if(APP_STATE.selectedId === id && APP_STATE.detailTab === "history") renderMonitoring();
    }).catch(() => {
      APP_STATE.historyCache[id] = { loading: false, items: [], error: true };
      if(APP_STATE.selectedId === id && APP_STATE.detailTab === "history") renderMonitoring();
    });
  }
  if(t === "followup" && APP_STATE.selectedId) {
    const id = APP_STATE.selectedId;
    APP_STATE.followUpCache[id] = { loading: true, items: [] };
    Api.getFollowUps(id).then(items => {
      APP_STATE.followUpCache[id] = { loading: false, items };
      if(APP_STATE.selectedId === id && APP_STATE.detailTab === "followup") renderMonitoring();
    }).catch(() => {
      APP_STATE.followUpCache[id] = { loading: false, items: [], error: true };
      if(APP_STATE.selectedId === id && APP_STATE.detailTab === "followup") renderMonitoring();
    });
  }
  renderMonitoring();
}

function toggleSelectAll(checked) {
  const f = getFiltered();
  if(checked) f.forEach(i => APP_STATE.selectedIds.add(i.id));
  else APP_STATE.selectedIds.clear();
  rerenderBulkBar();
  rerenderCheckboxes();
}

function toggleSelectOne(id, checked) {
  if(checked) APP_STATE.selectedIds.add(id);
  else APP_STATE.selectedIds.delete(id);
  rerenderBulkBar();
  rerenderCheckboxes();
}

function rerenderBulkBar() {
  const bar = document.getElementById("bulkBar");
  if(!bar) return;
  const n = APP_STATE.selectedIds.size;
  bar.style.display = n > 0 ? "flex" : "none";
  const c = bar.querySelector(".bulk-count");
  if(c) c.textContent = `${n} invoice dipilih`;
}

function rerenderCheckboxes() {
  const filtered = getFiltered();
  const allChecked = filtered.length > 0 && filtered.every(i => APP_STATE.selectedIds.has(i.id));
  const allBox = document.getElementById("checkAll");
  if(allBox) allBox.checked = allChecked;
  filtered.forEach(i => {
    const cb = document.getElementById(`cb_${i.id}`);
    if(cb) cb.checked = APP_STATE.selectedIds.has(i.id);
  });
}

function doNext(id, nextStage) {
  const inv = getInv(id);
  const gate = checkGate(inv, nextStage);
  if(!gate.ok) { toast(`⛔ ${gate.reason}`, "error"); return; }
  updateInvoice(id, {stage: nextStage});
  if(nextStage === "Cek Kelengkapan")  APP_STATE.detailTab = "dokumen";
  else if(nextStage === "Plan & Kirim") APP_STATE.detailTab = "plankirim";
  else if(nextStage === "Follow Up")   APP_STATE.detailTab = "followup";
  else APP_STATE.detailTab = "detail";
  renderMonitoring();
  toast(`✓ Lanjut ke ${nextStage}`, "success");
}

async function submitFU(id) {
  const tgl        = document.getElementById("fuTgl")?.value || today();
  const status     = document.getElementById("fuStatus")?.value || "Sudah FU";
  const alasan     = document.getElementById("fuAlasanCustom")?.value || document.getElementById("fuAlasan")?.value || "";
  const remarks    = document.getElementById("fuRemarks")?.value || "";
  const promiseToPay = document.getElementById("fuPromise")?.value || "";
  const problemId    = document.getElementById("fuProblemId")?.value || "";
  const promiseMining = document.getElementById("fuPromiseMining")?.value || "";
  await addFollowUp(id, {tgl, status, alasan, remarks, promiseToPay});
  // Sync enrichment fields to invoice level
  if(problemId)    { saveEnrichmentField(id, "problemId", problemId); invalidateCreditCache(); }
  if(remarks)        saveEnrichmentField(id, "lastRemark", remarks);
  if(promiseMining)  saveEnrichmentField(id, "promiseMining", promiseMining);
  toast("Follow Up disimpan ✓", "success");
  renderMonitoring();
}

function saveKendala(id)       { updateInvoice(id,{catatanKendala:document.getElementById("kendalaInput")?.value||""}); toast("Catatan disimpan!","success"); renderMonitoring(); }
function toggleDoc(id,doc,val) { const inv=getInv(id); updateInvoice(id,{dokumen:{...(inv.dokumen||{}),[doc]:val}}); renderMonitoring(); }
function saveDokumen(id)       { saveStorage(); toast("Checklist disimpan!","success"); renderMonitoring(); }
function tandaiLengkapSemua(id){ const inv=getInv(id); const dok={}; getDocsForInvoice(inv).forEach(d=>dok[d]=true); updateInvoice(id,{dokumen:dok}); toast("Semua dokumen lengkap ✓","success"); renderMonitoring(); }
function savePlanKirim(id)     { const v=document.getElementById("planKirimInput")?.value; if(v){updateInvoice(id,{planKirim:v});toast("Plan kirim disimpan!","success");renderMonitoring();} }
function saveTglTerima(id)     { const v=document.getElementById("tglTerimaInput")?.value; if(v){updateInvoice(id,{tglTerima:v});addHistory(id,`Tgl terima: ${v}`);toast("Tgl terima disimpan!","success");renderMonitoring();} }
function toggleLangDiterima(id,checked){ updateInvoice(id,{tglTerima:checked?today():""}); if(checked) addHistory(id,"Konfirmasi terima same day"); renderMonitoring(); }
function saveAdjustSPK(id){
  const lama=document.getElementById("spkLama")?.value?.trim();
  const baru=document.getElementById("spkBaru")?.value?.trim();
  if(!baru){toast("No. SPK Baru wajib diisi!","error");return;}
  const inv=getInv(id);
  updateInvoice(id,{noSPK:baru,adjustSPK:[...(inv.adjustSPK||[]),{noSPKLama:lama||inv.noSPK,noSPKBaru:baru,catatan:document.getElementById("spkCatatan")?.value?.trim()||"",tgl:today()}]});
  addHistory(id,`Adjust SPK: ${lama} → ${baru}`);toast("Adjust SPK disimpan!","success");renderMonitoring();
}
function renderSelisihBadge(s){ return s===0?`<span class="selisih-badge pas">✓ Pas</span>`:s<0?`<span class="selisih-badge kurang">Kurang ${fmtRp(Math.abs(s))}</span>`:`<span class="selisih-badge lebih">Lebih ${fmtRp(s)}</span>`; }
function previewSelisih(id,v){ const inv=getInv(id); if(!inv)return; const el=document.getElementById(`selisihPreview_${id}`); if(el) el.innerHTML=renderSelisihBadge((parseFloat(v)||0)-inv.total); }
function saveLunasDetail(id){
  const inv=getInv(id);
  const nominal=parseFloat(document.getElementById("lunasNominalEdit")?.value)||0;
  updateInvoice(id,{nominalDiterima:nominal,selisih:nominal-inv.total,keteranganLunas:document.getElementById("lunasKetEdit")?.value||"",keteranganLunasCustom:document.getElementById("lunasKetCustomEdit")?.value||""});
  toast("Info pembayaran disimpan!","success");renderMonitoring();
}

// Event delegation for bulk bar
document.addEventListener("click", function(e) {
  const action = e.target.closest("[data-action]")?.dataset?.action;
  if(!action) return;
  if(action === "openBulkModal") openBulkModal();
  else if(action === "clearSelection") { APP_STATE.selectedIds.clear(); rerenderBulkBar(); rerenderCheckboxes(); renderMonitoring(); }
});

// ---- AR DASHBOARD ----
function renderARDashboard() {
  const el = document.getElementById("arDashboardContent");
  if(!el) return;
  const invoices = visibleInvoices();

  const kurangBayarList = invoices.filter(i => i.stage==="Lunas"&&(i.nominalDiterima||0)<i.total&&i.total>0);
  const totalSelisih    = kurangBayarList.reduce((s,i)=>s+(i.total-(i.nominalDiterima||0)),0);
  const totalBelumLunas = invoices.filter(i=>i.stage!=="Lunas").reduce((s,i)=>s+i.total,0);
  const totalAR         = totalBelumLunas + totalSelisih;
  const stuckList       = invoices.filter(i=>isStuck(i));
  const lunasOk         = invoices.filter(i=>i.stage==="Lunas"&&(i.nominalDiterima||0)>=i.total);

  const stageData = STAGES.map(s => {
    const list = invoices.filter(i => i.stage===s);
    const nominal = list.reduce((sum,i) => sum+(s==="Lunas"?(i.nominalDiterima||i.total||0):i.total),0);
    let extra = "";
    if(s==="Cek Kelengkapan"&&list.length>0){ const avg=list.reduce((sum,i)=>sum+docPct(i).pct,0)/list.length; extra=`<div style="font-size:10px;color:#d97706;margin-top:2px;">Dok: ${avg.toFixed(0)}%</div>`; }
    if(s==="Plan & Kirim"&&list.length>0){ const sp=list.filter(i=>i.planKirim).length; extra=`<div style="font-size:10px;color:#2563eb;margin-top:2px;">Plan: ${sp}/${list.length}</div>`; }
    if(s==="Follow Up"&&list.length>0){ const cleared=list.filter(i=>i.fuCleared).length; const wp=list.filter(i=>i.hasPromiseFollowUp).length; extra=`<div style="font-size:10px;color:#7c3aed;margin-top:2px;">Clear: ${cleared}/${list.length} · Promise: ${wp}</div>`; }
    return {s, list, nominal, extra};
  });

  const pipelineBreak = DIVISI.map(div=>({
    div,
    stages: STAGES.map(s=>{
      const list=invoices.filter(i=>i.stage===s&&i.sbr===div);
      return {s,count:list.length,nominal:list.reduce((sum,i)=>sum+i.total,0)};
    })
  }));

  const stageIcons = {"AR Masuk":"📥","Cek Kelengkapan":"📋","Plan & Kirim":"📤","Follow Up":"📞","Lunas":"✅"};

  el.innerHTML = `
    <!-- PAGE HEADER -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">AR Tracker</div>
        <div class="page-subtitle">Real-time outstanding monitoring dan pipeline analysis.</div>
      </div>
    </div>

    <!-- METRIC CARDS -->
    <div class="metric-grid">
      <div class="metric-card ac-blue" onclick="switchARTab('monitoring',document.querySelectorAll('#arSubtabs .subtab')[1])">
        <div class="metric-label">Total AR Outstanding</div>
        <div class="metric-value">${fmtRpShort(totalAR)}</div>
        <div class="metric-sub">${invoices.filter(i=>i.stage!=="Lunas").length} invoice aktif${totalSelisih>0?` · +${fmtRpShort(totalSelisih)} selisih`:""}</div>
      </div>
      <div class="metric-card ac-red" onclick="jumpToAlert()">
        <div class="metric-label">Perlu Perhatian</div>
        <div class="metric-value">${stuckList.length}</div>
        <div class="metric-sub">Invoice stuck &gt; threshold</div>
      </div>
      <div class="metric-card ac-amber" onclick="jumpToKurangBayar()">
        <div class="metric-label">Kurang Bayar</div>
        <div class="metric-value">${kurangBayarList.length}</div>
        <div class="metric-sub">${fmtRpShort(totalSelisih)}</div>
      </div>
      <div class="metric-card ac-green">
        <div class="metric-label">Lunas Penuh</div>
        <div class="metric-value">${lunasOk.length}</div>
        <div class="metric-sub">Verified settlement</div>
      </div>
    </div>

    <!-- PIPELINE -->
    <div class="pipeline-wrap">
      <div class="pipeline-header">
        <span class="pipeline-title">📊 Pipeline Stage + Nominal</span>
        <button onclick="APP_STATE.dashBreakdown=!APP_STATE.dashBreakdown;renderARDashboard()"
          style="font-size:12px;padding:5px 12px;border:0.5px solid var(--border-md);border-radius:var(--r-sm);background:${APP_STATE.dashBreakdown?"var(--blue)":"transparent"};color:${APP_STATE.dashBreakdown?"#fff":"var(--gray-700)"};cursor:pointer;">
          ${APP_STATE.dashBreakdown?"▲ Sembunyikan":"▼ Breakdown per Area"}
        </button>
      </div>
      ${!APP_STATE.dashBreakdown ? `
        <div class="pipeline-stages">
          ${stageData.map(({s,list,nominal,extra}) => `
            <div class="pipeline-stage" onclick="jumpToStage('${s}')">
              <div class="stage-icon-wrap" style="background:${STAGE_COLORS[s]}22;">
                <span style="font-size:15px;">${stageIcons[s]||"📄"}</span>
              </div>
              <div class="stage-count">${list.length}</div>
              <div class="stage-label">${s}</div>
              <div class="stage-nominal" style="color:${STAGE_COLORS[s]};">${fmtRpShort(nominal)}</div>
              ${extra}
            </div>`).join("")}
        </div>` : `
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${pipelineBreak.map(({div,stages}) => `
            <div>
              <p style="font-size:12px;font-weight:600;margin-bottom:8px;color:${(DIVISI_COLORS[div]||{text:"#374151"}).text};">${div}</p>
              <div style="display:grid;grid-template-columns:repeat(${STAGES.length},1fr);gap:6px;">
                ${stages.map(({s,count,nominal}) => `
                  <div onclick="jumpToStage('${s}','${div}')" style="text-align:center;padding:8px 4px;border-radius:var(--r-sm);background:var(--gray-50);cursor:pointer;border:0.5px solid var(--border);">
                    <div style="font-size:15px;font-weight:600;">${count}</div>
                    <div style="font-size:9px;color:var(--gray-400);line-height:1.3;margin:2px 0;">${s}</div>
                    <div style="font-size:10px;font-weight:600;color:${STAGE_COLORS[s]};">${fmtRpShort(nominal)}</div>
                  </div>`).join("")}
              </div>
            </div>`).join("")}
        </div>`}
    </div>

    <!-- PERLU PERHATIAN -->
    ${stuckList.length > 0 ? `
      <div class="attention-wrap">
        <div class="attention-header">
          <span class="attention-title">⚠️ Perlu Perhatian (${stuckList.length})</span>
          <span class="attention-link" onclick="jumpToAlert()">Lihat semua →</span>
        </div>
        ${stuckList.slice(0,4).map(inv => `
          <div class="attention-row" onclick="selectInv('${inv.id}');switchARTab('monitoring',document.querySelectorAll('#arSubtabs .subtab')[1])">
            <span class="attention-no">${inv.noInvoice}</span>
            <span class="attention-name">${inv.namaCust}</span>
            <span class="badge" style="background:${STAGE_COLORS[inv.stage]}22;color:${STAGE_COLORS[inv.stage]};">${inv.stage}</span>
            <span style="font-size:11px;color:var(--red);font-weight:500;">+${daysDiff(inv.stageUpdatedAt||inv.tglMasuk)} hr</span>
          </div>`).join("")}
        ${stuckList.length > 4 ? `<div class="attention-more" onclick="jumpToAlert()">+ ${stuckList.length-4} lainnya →</div>` : ""}
      </div>` : ""}

    <!-- KURANG BAYAR -->
    ${kurangBayarList.length > 0 ? `
      <div class="card" style="border-color:var(--red-light);margin-bottom:14px;">
        <div class="sec-hdr">
          <span class="sec-title" style="color:var(--red);">🔴 Kurang Bayar (${kurangBayarList.length}) — ${fmtRpShort(totalSelisih)}</span>
          <span class="sec-link" onclick="jumpToKurangBayar()">Lihat semua →</span>
        </div>
        ${kurangBayarList.slice(0,3).map(inv => `
          <div onclick="selectInv('${inv.id}');switchARTab('monitoring',document.querySelectorAll('#arSubtabs .subtab')[1])"
            style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:var(--r-sm);background:var(--red-light);cursor:pointer;border:0.5px solid #fecaca;margin-bottom:6px;">
            <div><strong style="font-size:12px;">${inv.noInvoice}</strong><span style="color:var(--gray-500);margin-left:8px;font-size:12px;">${inv.namaCust}</span></div>
            <span style="font-size:12px;color:var(--red);font-weight:500;">Kurang ${fmtRpShort(inv.total-(inv.nominalDiterima||0))}</span>
          </div>`).join("")}
      </div>` : ""}

    ${invoices.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <div class="empty-state-text">Belum ada data invoice</div>
        <div class="empty-state-sub">Upload XLS dari NIS atau tambah invoice manual</div>
      </div>` : ""}
  `;
}

// ---- MONITORING ----
function renderMonitoring() {
  const el = document.getElementById("monitoringContent");
  if(!el) return;

  const filtered = getFiltered();
  const inv = APP_STATE.selectedId ? getInv(APP_STATE.selectedId) : null;
  const allChecked = filtered.length > 0 && filtered.every(i => APP_STATE.selectedIds.has(i.id));

  rerenderBulkBar();

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:${inv?"1fr 420px":"1fr"};gap:14px;height:calc(100vh - ${APP_STATE.selectedIds.size>0?215:175}px);">

      <!-- LEFT: TABLE -->
      <div style="display:flex;flex-direction:column;overflow:hidden;">

        <!-- FILTER BAR -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
          <input type="text" class="filter-search" id="searchInput"
            placeholder="Cari invoice / customer..."
            value="${APP_STATE.searchQ.replace(/"/g,'&quot;')}"
            oninput="handleSearchInput(this.value)"/>
          <select class="filter-select" onchange="APP_STATE.filterStage=this.value;APP_STATE.activeFilterBanner=null;APP_STATE.agingFilterKey=null;renderMonitoring()">
            ${["Semua",...STAGES].map(s=>`<option ${APP_STATE.filterStage===s?"selected":""}>${s}</option>`).join("")}
          </select>
          <select class="filter-select" onchange="APP_STATE.filterDivisi=this.value;APP_STATE.activeFilterBanner=null;renderMonitoring()">
            ${["Semua",...DIVISI].map(d=>`<option ${APP_STATE.filterDivisi===d?"selected":""}>${d}</option>`).join("")}
          </select>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px;color:var(--gray-600);">
            <input type="checkbox" ${APP_STATE.filterAlert?"checked":""} onchange="APP_STATE.filterAlert=this.checked;renderMonitoring()"/> Perlu Perhatian
          </label>
          <span style="margin-left:auto;font-size:12px;color:var(--gray-400);">${filtered.length} invoice</span>
          <button class="btn-sm" onclick="openAddModal()">+ Manual</button>
        </div>

        <!-- ACTIVE FILTER BANNER -->
        ${APP_STATE.activeFilterBanner ? `
          <div style="background:var(--blue-light);border:0.5px solid #bfdbfe;border-radius:var(--r-md);padding:8px 14px;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:var(--blue);">🔍 Filter aktif: <strong>${APP_STATE.activeFilterBanner.label}</strong></span>
            <button onclick="clearActiveFilter()" style="margin-left:auto;background:transparent;border:none;color:var(--blue);font-size:18px;cursor:pointer;line-height:1;">×</button>
          </div>` : ""}

        <!-- TABLE -->
        <div class="table-wrap" style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
          ${filtered.length === 0 ? `
            <div class="empty-state" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;">
              <div class="empty-state-icon">📄</div>
              <div class="empty-state-text">${invoices.length===0?"Upload XLS untuk memulai":"Tidak ada invoice yang cocok"}</div>
            </div>` : `
            <div style="overflow:auto;flex:1;" id="tableScrollArea">
              <table style="min-width:860px;">
                <thead style="position:sticky;top:0;z-index:10;">
                  <tr>
                    <th style="width:36px;"><input type="checkbox" id="checkAll" ${allChecked?"checked":""} onchange="toggleSelectAll(this.checked)"/></th>
                    <th>No. Invoice</th><th>Customer</th><th>Divisi</th>
                    <th style="text-align:right;">Total</th><th>Jth Tempo</th>
                    <th>Stage</th><th>Info Stage</th><th></th><th></th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.slice(0,500).map(i => {
                    const {done,total:dtotal,pct} = docPct(i);
                    let stageInfo = "";
                    if(i.stage==="Cek Kelengkapan"){
                      const c = pct===100?"#16a34a":pct>=50?"#d97706":"#dc2626";
                      stageInfo = `<span style="font-size:11px;color:${c};font-weight:500;">${done}/${dtotal} (${pct}%)</span>`;
                    } else if(i.stage==="Plan & Kirim"){
                      stageInfo = i.planKirim
                        ? `<span style="font-size:11px;color:var(--blue);">${fmtDate(i.planKirim)}</span>`
                        : `<span style="font-size:11px;color:var(--red);">⚠ Belum diisi</span>`;
                    } else if(i.stage==="Follow Up"){
                      stageInfo = `
                        <div>
                          <span style="font-size:11px;color:${i.fuCleared?"#16a34a":"#d97706"};font-weight:500;">${i.fuCleared?"✓ Cleared":"FU #"+(i.followUpCount||0)}</span>
                          ${i.lastPromiseToPay?`<br><span style="font-size:10px;color:#7c3aed;">Promise: ${fmtDate(i.lastPromiseToPay)}</span>`:""}
                        </div>`;
                    } else if(i.stage==="Lunas"){
                      const kurang = (i.nominalDiterima||0) < i.total && i.total > 0;
                      stageInfo = kurang ? `<span style="font-size:11px;color:var(--red);">Kurang ${fmtRpShort(i.total-(i.nominalDiterima||0))}</span>` : `<span style="font-size:11px;color:#16a34a;">✓ ${fmtDate(i.tglLunas)}</span>`;
                    }
                    const subBadge = i.subTipe ? `<span style="font-size:10px;background:var(--gray-100);color:var(--gray-400);padding:1px 5px;border-radius:3px;margin-left:3px;">${i.subTipe}</span>` : "";
                    const isSelected = APP_STATE.selectedId === i.id;
                    const stuck = isStuck(i);
                    return `
                      <tr class="${isSelected?"row-selected":stuck?"row-stuck":""}">
                        <td onclick="event.stopPropagation()"><input type="checkbox" id="cb_${i.id}" ${APP_STATE.selectedIds.has(i.id)?"checked":""} onchange="toggleSelectOne('${i.id}',this.checked)"/></td>
                        <td onclick="selectInv('${i.id}')" style="cursor:pointer;">
                          <strong style="font-size:12px;">${i.noInvoice}</strong>
                          ${i.isManual?` <span class="badge badge-amber" style="font-size:10px;">manual</span>`:""}
                          ${(i.adjustSPK?.length)?`<span class="adjust-badge">SPK</span>`:""}
                          ${i.problemId?`<span class="badge badge-red" style="font-size:10px;">${i.problemId}</span>`:""}
                        </td>
                        <td onclick="selectInv('${i.id}')" style="cursor:pointer;max-width:150px;overflow:hidden;text-overflow:ellipsis;font-size:12px;">
                          ${i.namaCust}
                          ${i.dealer?`<div style="font-size:10px;color:var(--gray-400);overflow:hidden;text-overflow:ellipsis;">${i.dealer}</div>`:""}
                        </td>
                        <td onclick="selectInv('${i.id}')" style="cursor:pointer;">
                          <span class="badge ${`divisi-${i.sbr}`}">${i.sbr}</span>${subBadge}
                        </td>
                        <td onclick="selectInv('${i.id}')" style="cursor:pointer;text-align:right;font-size:12px;font-weight:500;">${fmtRpShort(i.total)}</td>
                        <td onclick="selectInv('${i.id}')" style="cursor:pointer;font-size:12px;color:${daysDiff(i.jthTempo)>0&&i.stage!=="Lunas"?"var(--red)":"inherit"};">${fmtDate(i.jthTempo)}</td>
                        <td onclick="selectInv('${i.id}')" style="cursor:pointer;"><span class="badge" style="background:${STAGE_COLORS[i.stage]}22;color:${STAGE_COLORS[i.stage]};">${i.stage}</span></td>
                        <td style="font-size:11px;">${stageInfo}</td>
                        <td>${stuck?`<span title="Stuck" style="font-size:13px;">⚠️</span>`:""}</td>
                        <td onclick="selectInv('${i.id}')" style="cursor:pointer;color:var(--gray-300);font-size:16px;">›</td>
                      </tr>`;
                  }).join("")}
                </tbody>
              </table>
              ${filtered.length>500?`<p style="padding:10px 12px;font-size:12px;color:var(--gray-400);">Menampilkan 500 dari ${filtered.length}. Gunakan filter.</p>`:""}
            </div>`}
        </div>
      </div>

      <!-- RIGHT: DETAIL PANEL -->
      ${inv ? `<div style="overflow-y:auto;height:100%;">${renderDetailPanel(inv)}</div>` : ""}
    </div>
  `;
}

// ---- DETAIL PANEL ----
function renderDetailPanel(inv) {
  const curIdx = STAGES.indexOf(inv.stage);
  const nextStage = STAGES[curIdx+1] || null;
  const {done:docsDone, total:docsTotal, pct:docsPct, docs:docsList} = docPct(inv);
  const fuCache   = APP_STATE.followUpCache[inv.id];
  const fuLoading = !fuCache || fuCache.loading;
  const fuError   = fuCache && fuCache.error;
  const fuList = (fuCache && !fuCache.loading && !fuCache.error) ? fuCache.items : [];
  const promises = fuList.filter(f => f.promiseToPay);
  let content = "";

  if(APP_STATE.detailTab === "detail") {
    const gate = nextStage ? checkGate(inv, nextStage) : {ok:true};
    content = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${[["Kode Customer",inv.kodeCust],["Total Tagihan",fmtRp(inv.total)],
           ["Tgl Jual",fmtDate(inv.tglJual)],["Jth Tempo",fmtDate(inv.jthTempo)],
           ["Divisi",inv.sbr+(inv.subTipe?" — "+inv.subTipe:"")],
           ["Dealer",inv.dealer],
           ["No. WO",inv.noWO],["No. Pol/PO",inv.noPol],["No. SPK",inv.noSPK],
           ["Sales/SA",inv.salesSA],["Keterangan",inv.keterangan],
        ].filter(([,v])=>v).map(([k,v])=>`
          <div style="display:flex;justify-content:space-between;font-size:12px;gap:8px;">
            <span style="color:var(--gray-400);flex-shrink:0;">${k}</span>
            <span style="text-align:right;word-break:break-word;font-weight:500;">${v}</span>
          </div>`).join("")}

        ${inv.sbr!=="BP"?`
          <div style="border-top:0.5px solid var(--border);padding-top:10px;">
            <label class="form-label">Sub-tipe</label>
            <select class="form-input" onchange="updateInvoice('${inv.id}',{subTipe:this.value,subTipeManual:true,dokumen:{}});renderMonitoring();">
              ${(SUBTIPE[inv.sbr]||[]).map(s=>`<option ${inv.subTipe===s?"selected":""}>${s}</option>`).join("")}
            </select>
          </div>`:""}

        <!-- ENRICHMENT SECTION -->
        <div style="border-top:0.5px solid var(--border);padding-top:10px;">
          <p style="font-size:12px;font-weight:600;color:var(--gray-700);margin-bottom:8px;">📊 Enrichment Data</p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div>
              <label class="form-label">Problem Identification</label>
              <select class="form-input" id="problemIdSel" onchange="saveEnrichmentField('${inv.id}','problemId',this.value)">
                <option value="">-- Tidak ada --</option>
                ${PROBLEM_IDS.map(p=>`<option value="${p.id}" ${inv.problemId===p.id?"selected":""}>${p.label}</option>`).join("")}
              </select>
            </div>

            <div>
              <label class="form-label">Last Remark</label>
              <textarea class="form-input" rows="2" onchange="saveEnrichmentField('${inv.id}','lastRemark',this.value)" placeholder="Remark terbaru...">${inv.lastRemark||""}</textarea>
            </div>
            <div>
              <label class="form-label">PDCA Remark</label>
              <textarea class="form-input" rows="2" onchange="saveEnrichmentField('${inv.id}','pdcaRemark',this.value)" placeholder="PDCA...">${inv.pdcaRemark||""}</textarea>
            </div>

          </div>
        </div>

        <div style="border-top:0.5px solid var(--border);padding-top:10px;">
          <label class="form-label">Catatan Kendala</label>
          <textarea id="kendalaInput" rows="2" class="form-input" style="resize:vertical;" placeholder="Tulis kendala...">${inv.catatanKendala||""}</textarea>
          <button class="btn-sm" onclick="saveKendala('${inv.id}')" style="margin-top:6px;">Simpan</button>
        </div>

        ${inv.stage==="Lunas"?`
          <div style="border-top:0.5px solid var(--border);padding-top:12px;">
            <p style="font-size:13px;font-weight:500;margin-bottom:10px;">💰 Info Pembayaran</p>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div>
                <label class="form-label">Nominal Diterima (Rp)</label>
                <input type="number" id="lunasNominalEdit" class="form-input" value="${inv.nominalDiterima||inv.total||""}" oninput="previewSelisih('${inv.id}',this.value)"/>
              </div>
              <div id="selisihPreview_${inv.id}">${inv.nominalDiterima?renderSelisihBadge(inv.nominalDiterima-inv.total):""}</div>
              <div>
                <label class="form-label">Keterangan Selisih</label>
                <select id="lunasKetEdit" class="form-input" style="margin-bottom:6px;">
                  <option value="">-- Pilih --</option>
                  ${KETERANGAN_LUNAS.map(k=>`<option ${inv.keteranganLunas===k?"selected":""}>${k}</option>`).join("")}
                </select>
                <input type="text" id="lunasKetCustomEdit" class="form-input" value="${inv.keteranganLunasCustom||""}" placeholder="Keterangan tambahan..."/>
              </div>
              <div class="form-row" style="margin-top:4px;">
                <div class="form-group">
                  <label class="form-label">Bukpot</label>
                  <select class="form-input" onchange="saveEnrichmentField('${inv.id}','isBukpot',this.value)">
                    <option value="" ${!inv.isBukpot?"selected":""}>—</option>
                    <option value="Y" ${inv.isBukpot==="Y"?"selected":""}>Y</option>
                    <option value="N" ${inv.isBukpot==="N"?"selected":""}>N</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">PPh 23</label>
                  <input type="text" class="form-input" value="${inv.pph23||""}" placeholder="%" onchange="saveEnrichmentField('${inv.id}','pph23',this.value)"/>
                </div>
              </div>
              <button class="btn-primary" onclick="saveLunasDetail('${inv.id}')" style="padding:7px;">Simpan Info Pembayaran</button>
            </div>
          </div>
          <div style="background:var(--green-light);border:0.5px solid #bbf7d0;border-radius:var(--r-sm);padding:8px 12px;font-size:12px;color:#15803d;">
            ✅ Lunas ${fmtDate(inv.tglLunas)}
            ${inv.nominalDiterima&&inv.nominalDiterima<inv.total?`<span style="color:var(--red);margin-left:8px;">⚠️ Kurang ${fmtRpShort(inv.total-inv.nominalDiterima)}</span>`:""}
          </div>`:""}

        ${inv.stage!=="Lunas"&&nextStage?`
          ${!gate.ok?`<div style="background:var(--red-light);border:0.5px solid #fca5a5;border-radius:var(--r-md);padding:10px 12px;font-size:12px;color:var(--red);">⛔ ${gate.reason}</div>`:""}
          <button style="background:var(--blue);color:#fff;padding:10px;border:none;border-radius:var(--r-md);width:100%;font-size:13px;font-weight:600;cursor:pointer;margin-top:4px;${!gate.ok?"opacity:0.5;cursor:not-allowed;":""}" onclick="doNext('${inv.id}','${nextStage}')" ${!gate.ok?"disabled":""}>
            ➜ Lanjut ke ${nextStage}
          </button>`:""} 
        ${inv.stage==="Follow Up"?`
          <button style="background:${!inv.fuCleared?"#9ca3af":"var(--green)"};color:#fff;padding:10px;border:none;border-radius:var(--r-md);width:100%;font-size:13px;font-weight:600;cursor:${!inv.fuCleared?"not-allowed":"pointer"};" onclick="${inv.fuCleared?"openLunasModal('"+inv.id+"')":`toast('Clear Follow Up dulu','error')`}" ${!inv.fuCleared?"disabled":""}>
            ${!inv.fuCleared?"⛔ Clear Follow Up Dulu":"✓ Tandai Lunas"}
          </button>`:""}
      </div>`;
  }

  else if(APP_STATE.detailTab === "dokumen") {
    content = `
      <div>
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
            <span>Kelengkapan Dokumen</span>
            <strong style="color:${docsPct===100?"#16a34a":docsPct>=50?"#d97706":"#dc2626"};">${docsDone}/${docsTotal} (${docsPct}%)</strong>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${docsPct}%;background:${docsPct===100?"#16a34a":docsPct>=50?"#d97706":"#dc2626"};"></div></div>
          <p style="font-size:11px;color:var(--gray-400);margin-top:3px;">${inv.sbr}${inv.subTipe?" — "+inv.subTipe:""}</p>
        </div>
        <button onclick="tandaiLengkapSemua('${inv.id}')" style="width:100%;padding:7px;margin-bottom:10px;background:var(--blue-light);border:0.5px solid #bfdbfe;border-radius:var(--r-sm);color:var(--blue);font-weight:500;font-size:12px;cursor:pointer;">✓ Lengkap Semua</button>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
          ${docsList.map(doc=>`
            <label class="doc-item ${inv.dokumen&&inv.dokumen[doc]?"checked":""}">
              <input type="checkbox" ${inv.dokumen&&inv.dokumen[doc]?"checked":""} onchange="toggleDoc('${inv.id}','${doc}',this.checked)"/>
              <span style="font-size:12px;">${doc}</span>
              ${inv.dokumen&&inv.dokumen[doc]?`<span style="margin-left:auto;color:#16a34a;font-size:12px;">✓</span>`:""}
            </label>`).join("")}
        </div>
        ${inv.stage==="Cek Kelengkapan"?`
          <button style="background:${docsPct===100?"var(--blue)":"#d97706"};color:#fff;padding:9px;border:none;border-radius:var(--r-md);width:100%;font-size:13px;font-weight:600;cursor:${docsPct<100?"not-allowed":"pointer"};" onclick="doNext('${inv.id}','Plan & Kirim')" ${docsPct<100?"disabled":""}>
            ${docsPct===100?"➜ Dokumen Lengkap — Lanjut Plan & Kirim":"⛔ Lengkapi Dokumen Dulu ("+docsDone+"/"+docsTotal+")"}
          </button>`:""}
      </div>`;
  }

  else if(APP_STATE.detailTab === "plankirim") {
    const gateNext = checkGate(inv, "Follow Up");
    content = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="form-group">
          <label class="form-label">Plan Tanggal Kirim</label>
          <div style="display:flex;gap:8px;">
            <input type="date" id="planKirimInput" class="form-input" value="${inv.planKirim||today()}"/>
            <button class="btn-primary" style="flex:none;padding:7px 12px;" onclick="savePlanKirim('${inv.id}')">Simpan</button>
          </div>
          ${inv.planKirim?`<p style="font-size:11px;color:#16a34a;margin-top:3px;">✓ Plan: ${fmtDate(inv.planKirim)}</p>`:`<p style="font-size:11px;color:var(--red);margin-top:3px;">⚠️ Belum diisi (wajib)</p>`}
        </div>
        <div style="border:0.5px solid var(--border);border-radius:var(--r-md);padding:12px;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;margin-bottom:6px;">
            <input type="checkbox" ${inv.tglTerima&&inv.planKirim&&inv.tglTerima===inv.planKirim?"checked":""} onchange="toggleLangDiterima('${inv.id}',this.checked)"/>
            <strong>Langsung Diterima (same day)</strong>
          </label>
          ${inv.tglTerima?`<p style="font-size:11px;color:#16a34a;">✓ Diterima: ${fmtDate(inv.tglTerima)}</p>`:`<p style="font-size:11px;color:var(--red);">⚠️ Tgl terima belum diisi</p>`}
        </div>
        <div class="form-group">
          <label class="form-label">Tanggal Terima (jika berbeda)</label>
          <input type="date" id="tglTerimaInput" class="form-input" value="${inv.tglTerima||""}"/>
          <button class="btn-ghost" style="margin-top:6px;" onclick="saveTglTerima('${inv.id}')">Simpan Tgl Terima</button>
        </div>
        <div style="border-top:0.5px solid var(--border);padding-top:10px;">
          <p style="font-size:12px;font-weight:600;margin-bottom:8px;">🖨️ Cetak Tagihan</p>
          <button class="btn-primary" style="width:100%;padding:8px;" onclick="openPrintModal('${inv.id}')">Buka Template Cetak</button>
        </div>
        ${!gateNext.ok?`<div style="background:var(--red-light);border:0.5px solid #fca5a5;border-radius:var(--r-md);padding:9px 12px;font-size:12px;color:var(--red);">⛔ ${gateNext.reason}</div>`:""}
        <button style="background:var(--blue);color:#fff;padding:10px;border:none;border-radius:var(--r-md);width:100%;font-size:13px;font-weight:600;cursor:pointer;${!gateNext.ok?"opacity:0.5;cursor:not-allowed;":""}" onclick="doNext('${inv.id}','Follow Up')" ${!gateNext.ok?"disabled":""}>
          ➜ Lanjut ke Follow Up
        </button>
      </div>`;
  }

  else if(APP_STATE.detailTab === "followup") {
    const cleared = inv.fuCleared;
    content = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="padding:10px 12px;border-radius:var(--r-md);background:${cleared?"var(--green-light)":"var(--amber-light)"};border:0.5px solid ${cleared?"#bbf7d0":"#fde68a"};">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <p style="font-weight:600;font-size:12px;color:${cleared?"#16a34a":"#d97706"};">${cleared?"✓ Follow Up Cleared":"Dalam Proses Follow Up"}</p>
              <p style="font-size:11px;color:var(--gray-400);margin-top:1px;">${inv.followUpCount||0} FU${fuLoading?" · memuat detail...":` · ${promises.length} Promise`}</p>
            </div>
            ${cleared?`
              <button onclick="updateInvoice('${inv.id}',{fuCleared:false});addHistory('${inv.id}','FU Clear dibatalkan');renderMonitoring();"
                style="font-size:11px;padding:4px 10px;border:0.5px solid #fca5a5;border-radius:var(--r-sm);color:var(--red);background:#fff;cursor:pointer;">Batal</button>`:
              `<button onclick="clearFollowUp('${inv.id}');renderMonitoring();"
                style="font-size:11px;padding:4px 10px;background:#16a34a;color:#fff;border:none;border-radius:var(--r-sm);cursor:pointer;">✓ Clear FU</button>`}
          </div>
        </div>
        <div class="card card-sm">
          <p style="font-size:12px;font-weight:600;margin-bottom:8px;">+ Tambah Follow Up</p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div class="form-row">
              <div class="form-group"><label class="form-label">Tanggal</label><input type="date" id="fuTgl" class="form-input" value="${today()}"/></div>
              <div class="form-group"><label class="form-label">Status</label>
                <select id="fuStatus" class="form-input"><option>Sudah FU</option><option>Belum FU</option></select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Alasan Customer</label>
              <select id="fuAlasan" class="form-input" style="margin-bottom:5px;"><option value="">-- Pilih --</option>${FU_REASONS.map(r=>`<option>${r}</option>`).join("")}</select>
              <input type="text" id="fuAlasanCustom" class="form-input" placeholder="Atau ketik lain..."/>
            </div>
            <div class="form-group"><label class="form-label">Remarks</label><textarea id="fuRemarks" class="form-input" rows="2" placeholder="Catatan..."></textarea></div>
            <div class="form-group"><label class="form-label">Promise to Pay</label><input type="date" id="fuPromise" class="form-input"/></div>
            <div class="form-group">
              <label class="form-label">Problem Identification</label>
              <select id="fuProblemId" class="form-input">
                <option value="">-- Tidak ada --</option>
                ${PROBLEM_IDS.map(p=>`<option value="${p.id}" ${inv.problemId===p.id?"selected":""}>${p.label}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Promise Mining</label>
              <input type="date" id="fuPromiseMining" class="form-input" value="${inv.promiseMining||""}"/>
            </div>
            <button class="btn-primary" onclick="submitFU('${inv.id}')" style="padding:8px;">Simpan Follow Up</button>
          </div>
        </div>
        ${fuLoading?`
          <div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px;">Memuat riwayat follow up...</div>`
        : fuError?`
          <div style="text-align:center;padding:20px;color:var(--red);font-size:12px;">Gagal memuat riwayat dari server.</div>`
        : fuList.length>0?`
          <div>
            <p style="font-size:12px;font-weight:600;margin-bottom:8px;">Riwayat (${fuList.length})</p>
            ${[...fuList].reverse().map((fu,i)=>{
              const isPromise = !!fu.promiseToPay;
              const overdue = isPromise && new Date(fu.promiseToPay)<new Date() && inv.stage!=="Lunas";
              return `
                <div style="padding:9px 11px;border-radius:var(--r-sm);border:0.5px solid ${isPromise?(overdue?"#fca5a5":"#bfdbfe"):"var(--border)"};background:${isPromise?(overdue?"var(--red-light)":"var(--blue-light)"):"var(--gray-50)"};margin-bottom:6px;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                    <div style="display:flex;gap:5px;flex-wrap:wrap;">
                      <span style="font-size:11px;font-weight:600;">FU #${fuList.length-i}</span>
                      <span class="badge ${fu.status==="Sudah FU"?"badge-green":"badge-red"}">${fu.status}</span>
                      ${isPromise?`<span class="badge ${overdue?"badge-red":"badge-blue"}">Promise ${fmtDate(fu.promiseToPay)}${overdue?" ⚠️":""}</span>`:""}
                    </div>
                    <span style="font-size:10px;color:var(--gray-400);">${fmtDate(fu.tgl)}</span>
                  </div>
                  ${fu.alasan?`<p style="font-size:11px;color:var(--gray-700);">📌 ${fu.alasan}</p>`:""}
                  ${fu.remarks?`<p style="font-size:11px;color:var(--gray-400);margin-top:2px;">${fu.remarks}</p>`:""}
                  ${fu.problemId?`<span class="badge badge-red" style="font-size:10px;margin-top:4px;display:inline-block;">${fu.problemId}</span>`:""}
                </div>`;
            }).join("")}
          </div>`:""}
        ${cleared?`<button class="btn-green" onclick="openLunasModal('${inv.id}')" style="width:100%;padding:9px;font-size:13px;">✓ Tandai Lunas</button>`:""}
      </div>`;
  }

  else if(APP_STATE.detailTab === "adjustspk") {
    content = `
      <div>
        <p style="font-size:12px;color:var(--gray-400);margin-bottom:10px;">Koreksi No. SPK jika terjadi kesalahan</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
          <div class="form-group"><label class="form-label">No. SPK Lama</label><input type="text" id="spkLama" class="form-input" value="${inv.noSPK||""}"/></div>
          <div class="form-group"><label class="form-label">No. SPK Baru</label><input type="text" id="spkBaru" class="form-input" placeholder="No SPK yang benar"/></div>
          <div class="form-group"><label class="form-label">Catatan</label><input type="text" id="spkCatatan" class="form-input" placeholder="Alasan adjust..."/></div>
          <button class="btn-primary" onclick="saveAdjustSPK('${inv.id}')" style="padding:7px;">Simpan</button>
        </div>
        ${(inv.adjustSPK?.length)?inv.adjustSPK.map(a=>`
          <div style="font-size:12px;padding:8px;background:var(--amber-light);border-radius:var(--r-sm);margin-bottom:6px;border:0.5px solid #fde68a;">
            <strong>${a.noSPKBaru}</strong> <span style="color:var(--gray-400);">(dari: ${a.noSPKLama})</span>
            <div style="color:var(--gray-400);margin-top:2px;">${fmtDate(a.tgl)}${a.catatan?" — "+a.catatan:""}</div>
          </div>`).join(""):`<p style="font-size:12px;color:var(--gray-400);text-align:center;padding:14px;">Belum ada adjust SPK</p>`}
      </div>`;
  }

  else if(APP_STATE.detailTab === "history") {
    const hc = APP_STATE.historyCache[inv.id];
    if(!hc || hc.loading) {
      content = `<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:12px;">Memuat history...</div>`;
    } else if(hc.error) {
      content = `<div style="text-align:center;padding:24px;color:var(--red);font-size:12px;">Gagal memuat history dari server.</div>`;
    } else if(!hc.items.length) {
      content = `<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:12px;">Belum ada history.</div>`;
    } else {
      content = `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${[...hc.items].reverse().map(h=>`
            <div style="display:flex;gap:10px;font-size:12px;">
              <div style="width:6px;height:6px;border-radius:50%;background:var(--blue);margin-top:4px;flex-shrink:0;"></div>
              <div><p style="font-weight:500;">${h.aksi}</p><p style="font-size:10px;color:var(--gray-400);margin-top:1px;">${fmtDateTime(h.tgl)} · ${h.user}</p></div>
            </div>`).join("")}
        </div>`;
    }
  }

  const showPlanKirim = ["Plan & Kirim","Follow Up","Lunas"].includes(inv.stage);
  const tabs = [
    {key:"detail",   label:"Detail"},
    {key:"dokumen",  label:`Dok ${docsDone}/${docsTotal}`, warn:docsPct<100&&inv.stage!=="AR Masuk"},
    ...(showPlanKirim?[{key:"plankirim",label:"Kirim"}]:[]),
    ...(["Follow Up","Lunas"].includes(inv.stage)?[{key:"followup",label:`FU${inv.followUpCount>0?" ("+inv.followUpCount+")":""}`}]:[]),
    {key:"adjustspk",label:"Adj.SPK"},
    {key:"history",  label:"History"},
  ];

  return `
    <div class="card" style="height:100%;overflow-y:auto;padding:0;">
      <div style="padding:12px 14px;border-bottom:0.5px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;position:sticky;top:0;background:#fff;z-index:5;">
        <div>
          <p style="font-weight:600;font-size:13px;">${inv.noInvoice}</p>
          <p style="font-size:11px;color:var(--gray-400);margin-top:1px;">${inv.namaCust}</p>
          ${inv.dealer?`<p style="font-size:10px;color:var(--gray-400);margin-top:2px;">🏢 ${inv.dealer}</p>`:""}
        </div>
        <button onclick="APP_STATE.selectedId=null;renderMonitoring()" style="background:none;font-size:20px;color:var(--gray-300);border:none;cursor:pointer;line-height:1;">×</button>
      </div>
      <!-- STEPPER -->
      <div style="padding:10px 14px;border-bottom:0.5px solid var(--border);">
        <div style="display:flex;align-items:center;">
          ${STAGES.map((s,idx)=>`
            <div style="display:flex;align-items:center;${idx<STAGES.length-1?"flex:1;":""}">
              <div title="${s}" style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;flex-shrink:0;
                background:${idx<curIdx?"#16a34a":idx===curIdx?STAGE_COLORS[s]:"var(--gray-200)"};
                color:${idx<=curIdx?"#fff":"var(--gray-400)"};
                border:${idx===curIdx?`2px solid ${STAGE_COLORS[s]}`:"none"};">
                ${idx<curIdx?"✓":idx+1}
              </div>
              ${idx<STAGES.length-1?`<div style="flex:1;height:2px;background:${idx<curIdx?"#16a34a":"var(--gray-200)"};margin:0 2px;"></div>`:""}
            </div>`).join("")}
        </div>
        <p style="font-size:10px;color:var(--gray-400);margin-top:6px;">
          <strong style="color:var(--gray-700);">${inv.stage}</strong>
          ${isStuck(inv)?`<span style="color:var(--red);"> · stuck +${daysDiff(inv.stageUpdatedAt||inv.tglMasuk)} hr</span>`:""}
        </p>
      </div>
      <!-- TAB BAR -->
      <div style="display:flex;border-bottom:0.5px solid var(--border);overflow-x:auto;">
        ${tabs.map(t=>`
          <button onclick="switchDetailTab('${t.key}')"
            style="flex-shrink:0;padding:8px 10px;font-size:11px;background:transparent;border:none;
            border-bottom:2px solid ${APP_STATE.detailTab===t.key?"var(--blue)":"transparent"};
            color:${APP_STATE.detailTab===t.key?"var(--blue)":t.warn?"#d97706":"var(--gray-400)"};cursor:pointer;white-space:nowrap;">
            ${t.label}${t.warn?" ⚠":""}
          </button>`).join("")}
      </div>
      <div style="padding:14px;">${content}</div>
    </div>`;
}

// Enrichment field quick save
function saveEnrichmentField(id, field, value) {
  const patch = {};
  patch[field] = value;
  updateInvoice(id, patch);
  addHistory(id, `${field}: ${value}`);
}

// ---- AGING ----
function renderAging() {
  const el = document.getElementById("agingContent");
  if(!el) return;
  const invoices = visibleInvoices();

  const totalAR = invoices.reduce((s,i)=>s+i.total,0);
  const buckets = [
    {key:"lancar",   label:"Lancar",     val:invoices.reduce((s,i)=>s+i.lancar,0),       color:"#16a34a"},
    {key:"1_30",     label:"1–30 Hari",  val:invoices.reduce((s,i)=>s+i.aging1_30,0),    color:"#d97706"},
    {key:"31_60",    label:"31–60 Hari", val:invoices.reduce((s,i)=>s+i.aging31_60,0),   color:"#ea580c"},
    {key:"61_90",    label:"61–90 Hari", val:invoices.reduce((s,i)=>s+i.aging61_90,0),   color:"#dc2626"},
    {key:"91_120",   label:"91–120 Hari",val:invoices.reduce((s,i)=>s+i.aging91_120,0),  color:"#991b1b"},
    {key:"121_150",  label:"121–150 Hari",val:invoices.reduce((s,i)=>s+i.aging121_150,0),color:"#7f1d1d"},
    {key:"over150",  label:">150 Hari",  val:invoices.reduce((s,i)=>s+i.agingOver150,0), color:"#450a0a"},
  ];

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">Aging Analysis</div>
        <div class="page-subtitle">Klik bucket untuk jump ke Monitoring dengan filter aging.</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <div class="sec-hdr"><span class="sec-title">Rekap Aging</span></div>
      <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>Bucket</th><th style="text-align:right;">Jumlah (Rp)</th><th style="text-align:right;">%</th><th></th></tr></thead>
          <tbody>
            ${buckets.map(b => {
              const pct = totalAR > 0 ? b.val/totalAR*100 : 0;
              const isOpen = agingBreakdownBucket === b.key;
              const bInvs = invoices.filter(i=>(i[AGING_FIELD[b.key]]||0)!==0);
              const bpV = bInvs.filter(i=>i.sbr==="BP").reduce((s,i)=>s+(i[AGING_FIELD[b.key]]||0),0);
              const grV = bInvs.filter(i=>i.sbr==="GRP").reduce((s,i)=>s+(i[AGING_FIELD[b.key]]||0),0);
              const mbV = bInvs.filter(i=>i.sbr==="Mobil").reduce((s,i)=>s+(i[AGING_FIELD[b.key]]||0),0);
              return `
                <tr style="cursor:pointer;" onclick="agingBreakdownBucket=agingBreakdownBucket==='${b.key}'?null:'${b.key}';renderAging()">
                  <td><div style="display:flex;align-items:center;gap:8px;"><div style="width:10px;height:10px;border-radius:50%;background:${b.color};flex-shrink:0;"></div><strong style="font-size:12px;">${b.label}</strong></div></td>
                  <td style="text-align:right;"><span style="font-weight:600;color:var(--blue);cursor:pointer;font-size:12px;" onclick="event.stopPropagation();jumpFromAging('${b.key}')">${fmtRp(b.val)}</span></td>
                  <td style="text-align:right;">
                    <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;">
                      <div style="width:80px;height:5px;background:var(--gray-100);border-radius:3px;overflow:hidden;"><div style="width:${Math.min(pct,100)}%;height:100%;background:${b.color};border-radius:3px;"></div></div>
                      <span style="font-size:11px;color:var(--gray-400);min-width:36px;">${pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style="color:var(--gray-300);font-size:12px;">${isOpen?"▲":"▼"}</td>
                </tr>
                ${isOpen?`
                  <tr><td colspan="4" style="padding:0;background:var(--gray-50);">
                    <div style="padding:12px 14px;">
                      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
                        ${[{d:"BP",v:bpV},{d:"GRP",v:grV},{d:"Mobil",v:mbV}].map(x=>`
                          <div onclick="jumpFromAging('${b.key}','${x.d}')" style="padding:10px;background:#fff;border-radius:var(--r-sm);border:0.5px solid var(--border);text-align:center;cursor:pointer;">
                            <span class="badge divisi-${x.d}" style="margin-bottom:4px;display:inline-block;">${x.d}</span>
                            <p style="font-size:12px;font-weight:600;margin-top:4px;">${fmtRpShort(x.v)}</p>
                            <p style="font-size:10px;color:var(--purple);margin-top:3px;">→ Monitoring</p>
                          </div>`).join("")}
                      </div>
                      <div style="max-height:180px;overflow-y:auto;">
                        ${bInvs.slice(0,50).map(i=>`
                          <div onclick="selectInv('${i.id}');switchARTab('monitoring',document.querySelectorAll('#arSubtabs .subtab')[1])" style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:#fff;border-radius:4px;cursor:pointer;font-size:11px;border:0.5px solid var(--border);margin-bottom:4px;">
                            <div><strong>${i.noInvoice}</strong><span style="color:var(--gray-400);margin-left:6px;">${i.namaCust}</span></div>
                            <span style="font-weight:500;color:${b.color};">${fmtRpShort(i[AGING_FIELD[b.key]]||0)}</span>
                          </div>`).join("")}
                        ${bInvs.length>50?`<p style="font-size:11px;color:var(--gray-400);text-align:center;padding:6px;">+${bInvs.length-50} lainnya</p>`:""}
                      </div>
                    </div>
                  </td></tr>`:""}`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">
      ${DIVISI.map(div => {
        const di = invoices.filter(i=>i.sbr===div);
        const dt = di.reduce((s,i)=>s+i.total,0);
        const stk = di.filter(i=>isStuck(i)).length;
        const lns = di.filter(i=>i.stage==="Lunas").length;
        return `
          <div class="card">
            <div class="sec-hdr"><span class="sec-title">${div}</span><span style="font-size:12px;color:var(--gray-400);">${di.length} invoice</span></div>
            <p style="font-size:18px;font-weight:600;margin-bottom:6px;">${fmtRpShort(dt)}</p>
            <p style="font-size:12px;color:var(--gray-400);margin-bottom:3px;">Lunas: ${di.length>0?Math.round(lns/di.length*100):0}%</p>
            ${stk>0?`<p style="font-size:12px;color:var(--red);">⚠️ ${stk} perlu perhatian</p>`:`<p style="font-size:12px;color:#16a34a;">✓ On track</p>`}
          </div>`;
      }).join("")}
    </div>`;
}

// render() alias for backward compat
function render() { renderCurrentPage(); }
