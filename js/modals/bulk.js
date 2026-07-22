// ===== BULK MODAL =====
let activeBulkTab = "stage";

function openBulkModal() {
  const n = APP_STATE.selectedIds.size;
  document.getElementById("bulkModalInner").innerHTML = `
    <div class="modal" style="width:520px;">
      <div class="modal-header">
        <strong>⚡ Aksi Massal</strong>
        <button class="modal-close" onclick="closeBulkModal()">×</button>
      </div>
      <p style="font-size:13px;color:var(--gray-500);margin-bottom:14px;">${n} invoice dipilih</p>

      <!-- TABS -->
      <div class="modal-tabs">
        ${["stage","plankirim","followup","lunas","dokumen","cetak"].map(t => `
          <button id="btab_${t}" onclick="switchBulkTab('${t}')" class="modal-tab ${activeBulkTab===t?"active":""}">
            ${{stage:"Pindah Stage",plankirim:"Plan & Kirim",followup:"Follow Up",lunas:"Tandai Lunas",dokumen:"Dokumen",cetak:"🖨️ Cetak"}[t]}
          </button>`).join("")}
      </div>

      <!-- PINDAH STAGE -->
      <div id="bulkContent_stage" style="display:${activeBulkTab==="stage"?"":"none"}">
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">Pindah ke Stage</label>
          <select id="bulkStageSelect" class="form-input">${STAGES.map(s=>`<option>${s}</option>`).join("")}</select>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" onclick="closeBulkModal()">Batal</button>
          <button class="btn-primary" onclick="applyBulkStage()">Terapkan</button>
        </div>
      </div>

      <!-- PLAN & KIRIM -->
      <div id="bulkContent_plankirim" style="display:${activeBulkTab==="plankirim"?"":"none"}">
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
          <div class="form-group"><label class="form-label">Plan Tanggal Kirim</label>
            <input type="date" id="bulkPlanKirim" class="form-input" value="${today()}"/></div>
          <div class="form-group"><label class="form-label">Tanggal Terima</label>
            <input type="date" id="bulkTglTerima" class="form-input"/></div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
            <input type="checkbox" id="bulkLangDiterima" onchange="toggleBulkSameDay(this.checked)"/>
            Langsung Diterima (same day)
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" onclick="closeBulkModal()">Batal</button>
          <button class="btn-primary" onclick="applyBulkPlanKirim()">Terapkan</button>
        </div>
      </div>

      <!-- FOLLOW UP -->
      <div id="bulkContent_followup" style="display:${activeBulkTab==="followup"?"":"none"}">
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Tanggal FU</label>
              <input type="date" id="bulkFuTgl" class="form-input" value="${today()}"/></div>
            <div class="form-group"><label class="form-label">Status</label>
              <select id="bulkFuStatus" class="form-input"><option>Sudah FU</option><option>Belum FU</option></select></div>
          </div>
          <div class="form-group"><label class="form-label">Alasan</label>
            <select id="bulkFuAlasan" class="form-input">
              <option value="">-- Pilih --</option>
              ${FU_REASONS.map(r=>`<option>${r}</option>`).join("")}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Remarks</label>
            <textarea id="bulkFuRemarks" class="form-input" rows="2" placeholder="Catatan..."></textarea></div>
          <div class="form-group"><label class="form-label">Promise to Pay (opsional)</label>
            <input type="date" id="bulkFuPromise" class="form-input"/></div>
          <div class="form-group">
            <label class="form-label">Problem Identification (opsional)</label>
            <select id="bulkFuProblemId" class="form-input">
              <option value="">-- Tidak ada / Tidak diubah --</option>
              ${PROBLEM_IDS.map(p=>`<option value="${p.id}">${p.label}</option>`).join("")}
            </select>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
            <input type="checkbox" id="bulkFuClear"/> Clear Follow Up (siap lunas)
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" onclick="closeBulkModal()">Batal</button>
          <button class="btn-primary" onclick="applyBulkFollowUp()">Terapkan</button>
        </div>
      </div>

      <!-- TANDAI LUNAS -->
      <div id="bulkContent_lunas" style="display:${activeBulkTab==="lunas"?"":"none"}">
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
          <div class="form-group"><label class="form-label">Tanggal Lunas</label>
            <input type="date" id="bulkLunasDate" class="form-input" value="${today()}"/></div>
          <div class="form-group">
            <label class="form-label">Nominal Diterima (Rp)</label>
            <p style="font-size:11px;color:var(--gray-400);margin-bottom:4px;">Kosongkan = pakai total tagihan masing-masing</p>
            <input type="number" id="bulkLunasNominal" class="form-input" placeholder="Kosongkan = pakai total tagihan"/>
          </div>
          <div class="form-group"><label class="form-label">Keterangan Selisih</label>
            <select id="bulkLunasKet" class="form-input" style="margin-bottom:6px;">
              <option value="">-- Pilih (opsional) --</option>
              ${KETERANGAN_LUNAS.map(k=>`<option>${k}</option>`).join("")}
            </select>
            <input type="text" id="bulkLunasKetCustom" class="form-input" placeholder="Keterangan tambahan..."/>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" onclick="closeBulkModal()">Batal</button>
          <button class="btn-green" onclick="applyBulkLunas()">✓ Tandai Lunas</button>
        </div>
      </div>

      <!-- DOKUMEN -->
      <div id="bulkContent_dokumen" style="display:${activeBulkTab==="dokumen"?"":"none"}">
        <p style="font-size:12px;color:var(--gray-400);margin-bottom:10px;">Centang dokumen yang ingin ditandai lengkap:</p>
        <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:8px 10px;border-radius:var(--r-sm);border:0.5px solid var(--blue);background:var(--blue-light);margin-bottom:8px;font-weight:500;">
          <input type="checkbox" id="bdoc_ALL" onchange="toggleAllBulkDocs(this.checked)"/> ✓ Lengkap Semua Dokumen
        </label>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px;max-height:220px;overflow-y:auto;">
          ${DOCS_MASTER.map(doc=>`
            <label style="display:flex;align-items:center;gap:10px;font-size:12px;cursor:pointer;padding:6px 10px;border-radius:var(--r-sm);border:0.5px solid var(--border);">
              <input type="checkbox" class="bdoc-item" id="bdoc_${doc.replace(/[\/ ]/g,'_')}"/> ${doc}
            </label>`).join("")}
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" onclick="closeBulkModal()">Batal</button>
          <button class="btn-primary" onclick="applyBulkDokumen()">Simpan</button>
        </div>
      </div>

      <!-- CETAK -->
      <div id="bulkContent_cetak" style="display:${activeBulkTab==="cetak"?"":"none"}">
        <p style="font-size:12px;color:var(--gray-400);margin-bottom:12px;">${n} invoice dipilih</p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
          <div class="form-group"><label class="form-label">Tipe Surat</label>
            <select id="bulkPrintTipe" class="form-input">${TIPE_SURAT.map(t=>`<option>${t}</option>`).join("")}</select></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Nomor Surat</label>
              <input type="text" id="bulkPrintNoSurat" class="form-input" placeholder="Cth: 17/NK/BP/C/VI/26"/></div>
            <div class="form-group"><label class="form-label">Tanggal Surat</label>
              <input type="date" id="bulkPrintTglSurat" class="form-input" value="${today()}"/></div>
          </div>
          <div class="form-group"><label class="form-label">Kepada</label>
            <input type="text" id="bulkPrintKepada" class="form-input" placeholder="Nama perusahaan tujuan"/></div>
          <div class="form-group"><label class="form-label">TTD</label>
            <select id="bulkPrintTTD" class="form-input">
              <option value="ttd1">${MASTER.ttd1.nama} (${MASTER.ttd1.jabatan})</option>
              <option value="ttd2">${MASTER.ttd2.nama} (${MASTER.ttd2.jabatan})</option>
            </select></div>
          <div style="border:0.5px solid var(--border);border-radius:var(--r-md);padding:10px;">
            <p style="font-size:12px;font-weight:600;margin-bottom:8px;">Opsi Cetak:</p>
            <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer;">
              <input type="radio" name="bulkPrintMode" value="perlembar" checked style="margin-top:2px;"/>
              <div><p style="font-size:12px;font-weight:500;">Beda Lembar</p><p style="font-size:11px;color:var(--gray-400);">Tiap invoice jadi 1 lembar terpisah</p></div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;">
              <input type="radio" name="bulkPrintMode" value="gabung" style="margin-top:2px;"/>
              <div><p style="font-size:12px;font-weight:500;">Gabung 1 Lembar</p><p style="font-size:11px;color:var(--gray-400);">Semua invoice jadi 1 surat dengan total gabungan</p></div>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" onclick="closeBulkModal()">Batal</button>
          <button class="btn-primary" onclick="applyBulkCetak('pdf')">🖨️ PDF</button>
          <button class="btn-green" onclick="applyBulkCetak('word')">📄 Word</button>
        </div>
      </div>
    </div>`;

  document.getElementById("bulkModal").style.display = "flex";
}

function closeBulkModal() { document.getElementById("bulkModal").style.display = "none"; }
function switchBulkTab(tab) { activeBulkTab = tab; openBulkModal(); }

function toggleBulkSameDay(checked) {
  const tglKirim = document.getElementById("bulkPlanKirim")?.value || today();
  const tglTerima = document.getElementById("bulkTglTerima");
  if(checked && tglTerima) { tglTerima.value = tglKirim; tglTerima.disabled = true; }
  else if(tglTerima) { tglTerima.disabled = false; }
}

function applyBulkStage() {
  const stage = document.getElementById("bulkStageSelect").value;
  const ids = [...APP_STATE.selectedIds];
  const blocked = ids.filter(id => !checkGate(getInv(id), stage).ok);
  if(blocked.length > 0) {
    const reasons = [...new Set(blocked.map(id => checkGate(getInv(id), stage).reason))];
    toast(`⛔ ${blocked.length} invoice tidak memenuhi syarat: ${reasons.join(", ")}`, "error");
    return;
  }
  let c = 0;
  ids.forEach(id => { updateInvoice(id, {stage}); c++; });
  APP_STATE.selectedIds.clear();
  rerenderBulkBar();
  toast(`${c} invoice → "${stage}"`, "success");
  openBulkModal();
  invalidateCreditCache();
  renderCurrentPage();
}

function applyBulkPlanKirim() {
  const tglKirim  = document.getElementById("bulkPlanKirim")?.value || today();
  const sameDay   = document.getElementById("bulkLangDiterima")?.checked;
  const tglTerima = sameDay ? tglKirim : (document.getElementById("bulkTglTerima")?.value || "");
  let c = 0;
  APP_STATE.selectedIds.forEach(id => {
    const patch = {planKirim: tglKirim};
    if(tglTerima) patch.tglTerima = tglTerima;
    updateInvoice(id, patch);
    if(sameDay) addHistory(id, `Plan kirim & same day terima: ${tglKirim}`);
    c++;
  });
  APP_STATE.selectedIds.clear();
  rerenderBulkBar();
  toast(`${c} invoice diset plan kirim`, "success");
  openBulkModal();
  renderCurrentPage();
}

function applyBulkFollowUp() {
  const tgl        = document.getElementById("bulkFuTgl")?.value || today();
  const status     = document.getElementById("bulkFuStatus")?.value || "Sudah FU";
  const alasan     = document.getElementById("bulkFuAlasan")?.value || "";
  const remarks    = document.getElementById("bulkFuRemarks")?.value || "";
  const promiseToPay = document.getElementById("bulkFuPromise")?.value || "";
  const problemId  = document.getElementById("bulkFuProblemId")?.value || "";
  const doClear    = document.getElementById("bulkFuClear")?.checked;
  let c = 0;
  APP_STATE.selectedIds.forEach(id => {
    addFollowUp(id, {tgl, status, alasan, remarks, promiseToPay, problemId});
    if(problemId) saveEnrichmentField(id, "problemId", problemId);
    if(doClear) clearFollowUp(id);
    c++;
  });
  APP_STATE.selectedIds.clear();
  rerenderBulkBar();
  toast(`Follow Up ditambahkan untuk ${c} invoice`, "success");
  openBulkModal();
  invalidateCreditCache();
  renderCurrentPage();
}

function applyBulkLunas() {
  const tgl          = document.getElementById("bulkLunasDate")?.value || today();
  const nominalInput = parseFloat(document.getElementById("bulkLunasNominal")?.value) || 0;
  const ket          = document.getElementById("bulkLunasKet")?.value || "";
  const ketCustom    = document.getElementById("bulkLunasKetCustom")?.value || "";
  let c = 0, blocked = 0;
  APP_STATE.selectedIds.forEach(id => {
    const inv = getInv(id);
    if(!inv.fuCleared) { blocked++; return; }
    const nominal = nominalInput || inv.total;
    updateInvoice(id, {
      stage:"Lunas", tglLunas:tgl, stageUpdatedAt:tgl,
      nominalDiterima:nominal, selisih:nominal-inv.total,
      keteranganLunas:ket, keteranganLunasCustom:ketCustom,
    });
    c++;
  });
  APP_STATE.selectedIds.clear();
  rerenderBulkBar();
  toast(`${c} invoice lunas ✅${blocked>0?` · ${blocked} dilewati (FU belum clear)`:""}`, "success");
  invalidateCreditCache();
  renderCurrentPage();
  openBulkModal();
}

function toggleAllBulkDocs(checked) {
  document.querySelectorAll(".bdoc-item").forEach(el => el.checked = checked);
}

function applyBulkDokumen() {
  const allChecked = document.getElementById("bdoc_ALL")?.checked;
  const checked = allChecked ? DOCS_MASTER : DOCS_MASTER.filter(doc => {
    const el = document.getElementById(`bdoc_${doc.replace(/[\/ ]/g,'_')}`);
    return el && el.checked;
  });
  if(!checked.length) { toast("Pilih minimal 1 dokumen!", "error"); return; }
  let c = 0;
  APP_STATE.selectedIds.forEach(id => {
    const inv = getInv(id);
    const dok = {...(inv.dokumen||{})};
    checked.forEach(d => dok[d] = true);
    updateInvoice(id, {dokumen:dok});
    c++;
  });
  APP_STATE.selectedIds.clear();
  rerenderBulkBar();
  toast(`Dokumen diupdate untuk ${c} invoice`, "success");
  openBulkModal();
  renderCurrentPage();
}

function applyBulkCetak(format) {
  const mode = document.querySelector('input[name="bulkPrintMode"]:checked')?.value || "perlembar";
  const opts = {
    tipe:    document.getElementById("bulkPrintTipe")?.value || "",
    noSurat: document.getElementById("bulkPrintNoSurat")?.value || "",
    tglSurat:document.getElementById("bulkPrintTglSurat")?.value || today(),
    kepada:  document.getElementById("bulkPrintKepada")?.value || "",
    alamat:"", up:"", hal:"Tagihan Service Body Repair", meterai:0,
    ttd:     document.getElementById("bulkPrintTTD")?.value || "ttd1",
  };

  const ids     = [...APP_STATE.selectedIds];
  const invList = ids.map(id => getInv(id)).filter(Boolean);
  const ttd     = opts.ttd === "ttd2" ? MASTER.ttd2 : MASTER.ttd1;
  let html = "";

  if(mode === "gabung") {
    const totalGabung = invList.reduce((s,i) => s+i.total, 0);
    html = `<div style="font-family:'Times New Roman',serif;font-size:11pt;line-height:1.5;color:#000;max-width:700px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:16px;"><h2 style="font-size:14pt;font-weight:bold;margin:0;">${MASTER.perusahaan}</h2>
      <p style="font-size:10pt;margin:2px 0;">${MASTER.alamat}</p></div>
      <hr style="border:2px solid #000;margin-bottom:20px;"/>
      <table style="width:100%;margin-bottom:16px;">
        <tr><td style="width:80px;">Nomor</td><td>: ${opts.noSurat||"..."}</td><td style="text-align:right;">${fmtDateLong(opts.tglSurat)}, Semarang</td></tr>
        <tr><td>Hal</td><td colspan="2">: <strong>${opts.hal}</strong></td></tr>
      </table>
      <p><strong>Kepada Yth.</strong></p><p><strong>${opts.kepada||"..."}</strong></p>
      <div style="margin:16px 0;"></div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f3f4f6;">
          <th style="border:1px solid #000;padding:6px;text-align:center;">No</th>
          <th style="border:1px solid #000;padding:6px;">Tanggal</th>
          <th style="border:1px solid #000;padding:6px;">No. Invoice</th>
          <th style="border:1px solid #000;padding:6px;">No. WO</th>
          <th style="border:1px solid #000;padding:6px;">No. Polisi</th>
          <th style="border:1px solid #000;padding:6px;text-align:right;">Jumlah</th>
        </tr></thead>
        <tbody>
          ${invList.map((inv,idx) => `<tr>
            <td style="border:1px solid #000;padding:6px;text-align:center;">${idx+1}</td>
            <td style="border:1px solid #000;padding:6px;">${fmtDate(inv.tglJual)}</td>
            <td style="border:1px solid #000;padding:6px;">${inv.noInvoice}</td>
            <td style="border:1px solid #000;padding:6px;">${inv.noWO||"-"}</td>
            <td style="border:1px solid #000;padding:6px;">${inv.noPol||"-"}</td>
            <td style="border:1px solid #000;padding:6px;text-align:right;">${fmtRp(inv.total)}</td>
          </tr>`).join("")}
          <tr style="font-weight:bold;">
            <td colspan="5" style="border:1px solid #000;padding:6px;text-align:right;">Jumlah Total</td>
            <td style="border:1px solid #000;padding:6px;text-align:right;">${fmtRp(totalGabung)}</td>
          </tr>
        </tbody>
      </table>
      <p style="font-style:italic;margin-bottom:20px;">${terbilang(totalGabung)} rupiah</p>
      <table style="width:100%;"><tr><td style="width:50%;">Hormat kami,</td><td>Di terima Oleh :</td></tr>
      <tr><td style="height:60px;"></td><td></td></tr>
      <tr><td><strong>${ttd.nama}</strong></td><td>. . . . . . . . . . . . . . .</td></tr>
      <tr><td>${ttd.jabatan}</td><td></td></tr></table>
    </div>`;
  } else {
    html = invList.map(inv => buildSuratHTML(inv, opts)).join('<div style="page-break-after:always;"></div>');
  }

  if(format === "pdf") {
    const w = window.open("", "_blank", "width=800,height=600");
    if(!w) { toast("Pop-up diblokir browser.", "error"); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>Surat Tagihan Bulk</title>
      <style>@media print{body{margin:15mm;}}</style></head>
      <body>${html}<script>window.onload=()=>{setTimeout(()=>window.print(),500);}<\/script></body></html>`);
    w.document.close();
  } else {
    const blob = new Blob(
      [`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'/></head><body>${html}</body></html>`],
      {type:"application/msword"}
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Tagihan_Bulk_${ids.length}_invoice.doc`;
    a.click();
  }

  invList.forEach(inv => logCetak(inv.id, opts.tipe, opts.noSurat, format==="pdf"?"PDF":"Word"));
  APP_STATE.selectedIds.clear();
  rerenderBulkBar();
  saveStorage();
  openBulkModal();
}
