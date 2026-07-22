// ===== ADD MANUAL MODAL =====
const ADD_FIELDS = [
  {label:"No. Invoice *", key:"noInvoice", type:"text"},
  {label:"Nama Customer *", key:"namaCust", type:"text"},
  {label:"Total (Rp)", key:"total", type:"number"},
  {label:"Tgl Jual", key:"tglJual", type:"date"},
  {label:"Jth Tempo", key:"jthTempo", type:"date"},
  {label:"No. WO", key:"noWO", type:"text"},
  {label:"No. Polisi / PO", key:"noPol", type:"text"},
  {label:"No. SPK", key:"noSPK", type:"text"},
  {label:"Sales / SA", key:"salesSA", type:"text"},
  {label:"Keterangan", key:"keterangan", type:"text"},
];

function updateSubTipeOptions(divisi) {
  const container = document.getElementById("subTipeContainer");
  const sel = document.getElementById("af_subTipe");
  const opts = SUBTIPE[divisi] || [];
  if(!opts.length || opts[0] === "") { container.style.display = "none"; return; }
  container.style.display = "";
  sel.innerHTML = opts.map(o => `<option>${o}</option>`).join("");
}

function openAddModal() {
  document.getElementById("addModal").style.display = "flex";
  document.getElementById("addFormFields").innerHTML = `
    ${ADD_FIELDS.map(f => `
      <div class="form-group">
        <label class="form-label">${f.label}</label>
        <input type="${f.type}" id="af_${f.key}" class="form-input"
          ${(f.key==="tglJual"||f.key==="jthTempo")?`value="${today()}"`:""}/>
      </div>`).join("")}
    <div class="form-group">
      <label class="form-label">Divisi</label>
      <select id="af_divisi" class="form-input" onchange="updateSubTipeOptions(this.value)">
        ${DIVISI.map(d=>`<option>${d}</option>`).join("")}
      </select>
    </div>
    <div id="subTipeContainer" style="display:none;" class="form-group">
      <label class="form-label">Sub-tipe</label>
      <select id="af_subTipe" class="form-input"></select>
    </div>`;
}

function submitAddForm() {
  const get = k => (document.getElementById(`af_${k}`)?.value || "").trim();
  const noInv = get("noInvoice"), nama = get("namaCust");
  if(!noInv || !nama) { toast("No. Invoice dan Nama Customer wajib diisi!", "error"); return; }
  if(invoices.find(i => i.noInvoice === noInv)) { toast("No. Invoice sudah ada!", "error"); return; }

  const divisi  = get("divisi") || "BP";
  const subTipe = document.getElementById("af_subTipe")?.value || "";
  const namaCust = nama;

  const newInv = {
    id: noInv, noInvoice: noInv, kodeCust: "",
    namaCust, masterName: getMasterName(namaCust), custType: detectCustomerType(namaCust),
    tglJual: get("tglJual") || today(), jthTempo: get("jthTempo") || today(),
    total: parseFloat(get("total")) || 0,
    lancar:0, aging1_30:0, aging31_60:0, aging61_90:0, aging91_120:0, aging121_150:0, agingOver150:0,
    sbr: divisi, subTipe,
    noWO: get("noWO"), noPol: get("noPol"), noSPK: get("noSPK"),
    salesSA: get("salesSA"), keterangan: get("keterangan"),
    stage: "AR Masuk", stageUpdatedAt: today(), tglMasuk: today(),
    dokumen: {}, planKirim: "", tglKirim: "", tglTerima: "", isBillSent: "",
    tglLunas: "", nominalDiterima: 0, selisih: 0, keteranganLunas: "", keteranganLunasCustom: "",
    problemId: "", lastRemark: "", pdcaRemark: "", updateRemarks: "",
    isBukpot: "", pph23: "", isRetur: "", promiseToPay: "", promiseMining: "", subsequent: 0,
    catatanKendala: "", followUps: [], lastFU: "", fuCleared: false,
    adjustSPK: [], isManual: true, cetakHistory: [],
    createdAt: today(), updatedAt: today(), createdBy: APP_STATE.user?.nama || "User",
    history: [{tgl: nowTime(), aksi: "Input manual", user: APP_STATE.user?.nama || "User"}],
  };

  invoices = [newInv, ...invoices];

  saveStorage();
  closeModal("addModal");
  toast("Invoice ditambahkan!", "success");
  invalidateCreditCache();
  renderCurrentPage();

  // FIXED: sebelumnya invoice manual cuma nyimpen ke localStorage, gak pernah
  // ke-sync ke backend — hilang begitu appInit() narik ulang data dari Api.getInvoices()
  // saat reload/logout. Sekarang di-upsert ke backend juga.
  if(Api.isLoggedIn()) {
    Api.upsertInvoice(newInv).catch(e => {
      console.warn("Sync error (manual invoice):", e);
      toast("Invoice tersimpan lokal, tapi gagal sync ke server", "error");
    });
  }
}

// ===== LUNAS MODAL =====
let lunasTargetId = null;

function openLunasModal(id) {
  lunasTargetId = id;
  const inv = getInv(id);
  document.getElementById("lunasInfo").textContent = `${inv.noInvoice} · ${inv.namaCust} · ${fmtRp(inv.total)}`;
  document.getElementById("lunasDate").value  = today();
  document.getElementById("lunasNominal").value = inv.total || "";
  document.getElementById("lunasKetSelect").value = "";
  document.getElementById("lunasKetCustom").value = "";
  updateLunasSelisih();
  document.getElementById("lunasModal").style.display = "flex";
}

function updateLunasSelisih() {
  const inv = lunasTargetId ? getInv(lunasTargetId) : null;
  if(!inv) return;
  const nominal = parseFloat(document.getElementById("lunasNominal")?.value) || 0;
  const el = document.getElementById("lunasSelisihInfo");
  if(el) el.innerHTML = renderSelisihBadge(nominal - inv.total);
}

function confirmLunas() {
  const tgl      = document.getElementById("lunasDate").value || today();
  const nominal  = parseFloat(document.getElementById("lunasNominal")?.value) || 0;
  const ket      = document.getElementById("lunasKetSelect")?.value || "";
  const ketCustom= document.getElementById("lunasKetCustom")?.value || "";
  const inv = getInv(lunasTargetId);

  updateInvoice(lunasTargetId, {
    stage: "Lunas", tglLunas: tgl, stageUpdatedAt: tgl,
    nominalDiterima: nominal, selisih: nominal - inv.total,
    keteranganLunas: ket, keteranganLunasCustom: ketCustom,
  });

  closeModal("lunasModal");
  lunasTargetId = null;
  toast("Invoice lunas! ✅", "success");
  invalidateCreditCache();
  renderCurrentPage();
}

// ===== PRINT MODAL =====
let printTargetId = null;

function openPrintModal(id) {
  printTargetId = id;
  const inv = getInv(id);
  if(!inv) return;

  document.getElementById("printModalContent").innerHTML = `
    <div class="modal" style="width:540px;">
      <div class="modal-header">
        <strong>🖨️ Cetak Tagihan</strong>
        <button class="modal-close" onclick="closePrintModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Tipe Surat</label>
          <select id="printTipe" class="form-input">${TIPE_SURAT.map(t=>`<option>${t}</option>`).join("")}</select></div>
        <div class="form-group"><label class="form-label">Nomor Surat</label>
          <input type="text" id="printNoSurat" class="form-input" placeholder="Cth: 17/NK/BP/C/VI/26"/></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Tanggal Surat</label>
            <input type="date" id="printTglSurat" class="form-input" value="${today()}"/></div>
          <div class="form-group"><label class="form-label">Biaya Meterai (Rp)</label>
            <input type="number" id="printMeterai" class="form-input" value="0"/></div>
        </div>
        <div class="form-group"><label class="form-label">Kepada</label>
          <input type="text" id="printKepada" class="form-input" value="${inv.namaCust||""}"/></div>
        <div class="form-group"><label class="form-label">Alamat Tujuan</label>
          <textarea id="printAlamat" class="form-input" rows="2" placeholder="Alamat lengkap..."></textarea></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Up (Perhatian)</label>
            <input type="text" id="printUp" class="form-input" placeholder="Cth: Ibu Elly"/></div>
          <div class="form-group"><label class="form-label">Hal / Perihal</label>
            <input type="text" id="printHal" class="form-input" value="Tagihan Service Body Repair"/></div>
        </div>
        <div class="form-group"><label class="form-label">TTD</label>
          <select id="printTTD" class="form-input">
            <option value="ttd1">${MASTER.ttd1.nama} (${MASTER.ttd1.jabatan})</option>
            <option value="ttd2">${MASTER.ttd2.nama} (${MASTER.ttd2.jabatan})</option>
          </select></div>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="closePrintModal()">Batal</button>
        <button class="btn-primary" onclick="doPrintPDF()">🖨️ PDF</button>
        <button class="btn-green" onclick="doExportWord()">📄 Word</button>
      </div>
    </div>`;

  document.getElementById("printModal").style.display = "flex";
}

function closePrintModal() {
  document.getElementById("printModal").style.display = "none";
  printTargetId = null;
}

function getOpts() {
  return {
    tipe:      document.getElementById("printTipe")?.value || "",
    noSurat:   document.getElementById("printNoSurat")?.value || "",
    tglSurat:  document.getElementById("printTglSurat")?.value || today(),
    kepada:    document.getElementById("printKepada")?.value || "",
    alamat:    document.getElementById("printAlamat")?.value || "",
    up:        document.getElementById("printUp")?.value || "",
    hal:       document.getElementById("printHal")?.value || "Tagihan Service Body Repair",
    meterai:   document.getElementById("printMeterai")?.value || 0,
    ttd:       document.getElementById("printTTD")?.value || "ttd1",
  };
}

function buildSuratHTML(inv, opts) {
  const ttd     = opts.ttd === "ttd2" ? MASTER.ttd2 : MASTER.ttd1;
  const meterai = parseFloat(opts.meterai) || 0;
  const total   = inv.total + meterai;

  return `
    <div style="font-family:'Times New Roman',serif;font-size:11pt;line-height:1.5;color:#000;max-width:700px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:16px;">
        <h2 style="font-size:14pt;font-weight:bold;margin:0;">${MASTER.perusahaan}</h2>
        <p style="font-size:10pt;margin:2px 0;">${MASTER.alamat}</p>
      </div>
      <hr style="border:2px solid #000;margin-bottom:20px;"/>
      <table style="width:100%;margin-bottom:16px;">
        <tr><td style="width:80px;">Nomor</td><td>: ${opts.noSurat||"..."}</td>
            <td style="text-align:right;">${fmtDateLong(opts.tglSurat)}, Semarang</td></tr>
        <tr><td>Hal</td><td colspan="2">: <strong>${opts.hal}</strong></td></tr>
      </table>
      <p><strong>Kepada Yth.</strong></p>
      <p><strong>${opts.kepada || inv.namaCust}</strong></p>
      ${opts.alamat ? `<p>${opts.alamat.replace(/\n/g,"<br/>")}</p>` : ""}
      ${opts.up ? `<p style="margin-bottom:16px;">Up. ${opts.up}</p>` : `<div style="margin-bottom:16px;"></div>`}
      <p style="margin-bottom:16px;">Bersama ini kami kirimkan Invoice Asli tagihan dan Faktur Pajak dengan data sbb :</p>
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
          <tr>
            <td style="border:1px solid #000;padding:6px;text-align:center;">1</td>
            <td style="border:1px solid #000;padding:6px;">${fmtDate(inv.tglJual)}</td>
            <td style="border:1px solid #000;padding:6px;">${inv.noInvoice}</td>
            <td style="border:1px solid #000;padding:6px;">${inv.noWO||"-"}</td>
            <td style="border:1px solid #000;padding:6px;">${inv.noPol||"-"}</td>
            <td style="border:1px solid #000;padding:6px;text-align:right;">${fmtRp(inv.total)}</td>
          </tr>
          ${meterai>0?`<tr><td colspan="5" style="border:1px solid #000;padding:6px;">Biaya Meterai</td><td style="border:1px solid #000;padding:6px;text-align:right;">${fmtRp(meterai)}</td></tr>`:""}
          <tr style="font-weight:bold;">
            <td colspan="5" style="border:1px solid #000;padding:6px;text-align:right;">Jumlah Total</td>
            <td style="border:1px solid #000;padding:6px;text-align:right;">${fmtRp(total)}</td>
          </tr>
        </tbody>
      </table>
      <p style="font-style:italic;margin-bottom:16px;">${terbilang(total)} rupiah</p>
      <p style="margin-bottom:4px;">Pembayaran mohon di transfer ke Rekening kami :</p>
      <table style="margin-bottom:16px;">
        <tr><td style="width:60px;">Nama</td><td>: ${MASTER.perusahaan}</td></tr>
        <tr><td>Bank</td><td>: ${MASTER.bank1.nama}, ${MASTER.bank1.cabang}</td></tr>
        <tr><td>No. Rek</td><td>: ${MASTER.bank1.norek}</td></tr>
      </table>
      <p style="margin-bottom:24px;">Demikian surat tagihan dari kami, atas perhatian serta kerja samanya yang baik, kami ucapkan terima kasih.</p>
      <table style="width:100%;">
        <tr><td style="width:50%;">Hormat kami,</td><td>Di terima Oleh :</td></tr>
        <tr><td style="height:60px;"></td><td></td></tr>
        <tr><td><strong>${ttd.nama}</strong></td><td>. . . . . . . . . . . . . . . . . .</td></tr>
        <tr><td>${ttd.jabatan}</td><td></td></tr>
      </table>
      <p style="margin-top:16px;font-size:9pt;color:#555;">NB: Sebagai tanda terima, mohon di fax ke ${MASTER.fax} up DESI atau email ke ${MASTER.email}</p>
    </div>`;
}

function logCetak(id, tipe, noSurat, format) {
  const inv = getInv(id);
  if(!inv) return;
  updateInvoice(id, {cetakHistory: [...(inv.cetakHistory||[]), {tgl:nowTime(), tipe, noSurat, format}]});
  addHistory(id, `Cetak ${format}: ${tipe} — ${noSurat||"-"}`);
}

function doPrintPDF() {
  const opts = getOpts();
  const ids  = printTargetId ? [printTargetId] : [...APP_STATE.selectedIds];
  if(!ids.length) return;
  const invList = ids.map(id => getInv(id)).filter(Boolean);
  const html = invList.map(inv => buildSuratHTML(inv, opts)).join('<div style="page-break-after:always;"></div>');
  const w = window.open("", "_blank", "width=800,height=600");
  if(!w) { toast("Pop-up diblokir browser. Izinkan pop-up untuk cetak.", "error"); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>Surat Tagihan</title>
    <style>@media print{body{margin:15mm;} @page{margin:15mm;}}</style></head>
    <body>${html}<script>window.onload=()=>{setTimeout(()=>window.print(),500);}<\/script></body></html>`);
  w.document.close();
  invList.forEach(inv => logCetak(inv.id, opts.tipe, opts.noSurat, "PDF"));
  closePrintModal();
  saveStorage();
}

function doExportWord() {
  const opts = getOpts();
  const ids  = printTargetId ? [printTargetId] : [...APP_STATE.selectedIds];
  if(!ids.length) return;
  const invList = ids.map(id => getInv(id)).filter(Boolean);
  const html = invList.map(inv => buildSuratHTML(inv, opts)).join("<br/><hr/><br/>");
  const blob = new Blob(
    [`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'/></head><body>${html}</body></html>`],
    {type:"application/msword"}
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Tagihan_${ids.length>1?"Bulk_"+ids.length:invList[0]?.noInvoice}.doc`;
  a.click();
  invList.forEach(inv => logCetak(inv.id, opts.tipe, opts.noSurat, "Word"));
  closePrintModal();
  saveStorage();
}