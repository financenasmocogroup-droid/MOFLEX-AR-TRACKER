// ===== USER & ROLE MANAGEMENT PAGE (dipisah dari Settings) =====
function renderUsers() {
  const el = document.getElementById("usersContent");
  if(!el) return;

  if(APP_STATE.user?.role !== "head") {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-text">🔒 Hanya SuperAdmin (head) yang bisa akses halaman ini.</div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">User & Role Management</div>
        <div class="page-subtitle">SuperAdmin bisa akses semua divisi. Admin BP/GRP/Sales hanya melihat & mengelola invoice divisinya sendiri.</div>
      </div>
    </div>
    <div style="max-width:780px;">
      <div class="card">
        <div class="sec-hdr">
          <span class="sec-title">👥 Daftar User</span>
          <button class="btn-sm" onclick="openUserModal()">+ Tambah User</button>
        </div>
        <div id="usersListWrap">
          <div class="empty-state"><div class="empty-state-text">Memuat data user...</div></div>
        </div>
      </div>
    </div>
  `;
  loadUsersList();
}

// ===== SETTINGS PAGE =====
function renderSettings() {
  const el = document.getElementById("settingsContent");
  if(!el) return;
  const isHead = APP_STATE.user?.role === "head";

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">Settings</div>
        <div class="page-subtitle">Konfigurasi sistem, threshold, dokumen, dan scoring.</div>
      </div>
    </div>

    <div style="max-width:780px;display:flex;flex-direction:column;gap:16px;">

      <!-- COMPANY MASTER -->
      <div class="card">
        <div class="sec-hdr"><span class="sec-title">🏢 Info Perusahaan</span></div>
        ${!isHead?`<p style="font-size:11px;color:var(--gray-400);margin-bottom:10px;">🔒 Hanya SuperAdmin (head) yang bisa mengubah bagian ini — nilai di bawah berlaku untuk semua dealer.</p>`:""}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${[
            ["Nama Perusahaan","master_perusahaan",MASTER.perusahaan,"text"],
            ["Alamat","master_alamat",MASTER.alamat,"text"],
            ["Bank 1 - Nama","master_bank1_nama",MASTER.bank1.nama,"text"],
            ["Bank 1 - No. Rek","master_bank1_norek",MASTER.bank1.norek,"text"],
            ["Bank 2 - Nama","master_bank2_nama",MASTER.bank2.nama,"text"],
            ["Bank 2 - No. Rek","master_bank2_norek",MASTER.bank2.norek,"text"],
            ["TTD 1 - Nama","master_ttd1_nama",MASTER.ttd1.nama,"text"],
            ["TTD 1 - Jabatan","master_ttd1_jabatan",MASTER.ttd1.jabatan,"text"],
            ["TTD 2 - Nama","master_ttd2_nama",MASTER.ttd2.nama,"text"],
            ["TTD 2 - Jabatan","master_ttd2_jabatan",MASTER.ttd2.jabatan,"text"],
            ["Fax","master_fax",MASTER.fax,"text"],
            ["Email","master_email",MASTER.email,"text"],
          ].map(([label,id,val]) => `
            <div class="form-group">
              <label class="form-label">${label}</label>
              <input type="text" id="${id}" class="form-input" value="${val||""}" ${!isHead?"disabled":""}/>
            </div>`).join("")}
        </div>
      </div>

      <!-- STUCK THRESHOLD -->
      <div class="card">
        <div class="sec-hdr">
          <span class="sec-title">⏱ Threshold Perlu Perhatian</span>
        </div>
        <p style="font-size:12px;color:var(--gray-400);margin-bottom:14px;">Atur batas hari invoice dianggap stuck per stage${!isHead?" (🔒 hanya SuperAdmin yang bisa ubah)":""}</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${STAGES.filter(s=>s!=="Lunas").map(s => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--gray-50);border-radius:var(--r-md);border:0.5px solid var(--border);">
              <div>
                <p style="font-weight:500;font-size:13px;">${s}</p>
                <p style="font-size:11px;color:var(--gray-400);">Stuck jika lebih dari X hari</p>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="number" id="sd_${s.replace(/ /g,'_').replace(/&/g,'n')}" class="form-input"
                  value="${STUCK_DAYS[s]||3}" min="1" max="90" style="width:70px;text-align:center;" ${!isHead?"disabled":""}/>
                <span style="font-size:12px;color:var(--gray-400);">hari</span>
              </div>
            </div>`).join("")}
        </div>
      </div>

      <!-- DOCS CONFIG -->
      <div class="card">
        <div class="sec-hdr"><span class="sec-title">📋 Kelengkapan Dokumen per Divisi</span></div>
        <p style="font-size:12px;color:var(--gray-400);margin-bottom:14px;">Centang dokumen yang wajib ada per divisi/sub-tipe${!isHead?" (🔒 hanya SuperAdmin yang bisa ubah)":""}</p>
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${Object.entries(DEFAULT_DOCS).map(([key, defaults]) => `
            <div>
              <p style="font-size:12px;font-weight:600;margin-bottom:8px;padding:5px 10px;background:var(--gray-100);border-radius:var(--r-sm);">${key.replace("-"," — ")}</p>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:5px;">
                ${DOCS_MASTER.map(doc => `
                  <label style="display:flex;align-items:center;gap:8px;font-size:12px;${isHead?"cursor:pointer;":"cursor:not-allowed;opacity:0.7;"}padding:5px 8px;border-radius:4px;background:${(DOCS_CONFIG[key]||defaults).includes(doc)?"var(--green-light)":"var(--gray-50)"};border:0.5px solid ${(DOCS_CONFIG[key]||defaults).includes(doc)?"#bbf7d0":"var(--border)"};">
                    <input type="checkbox" id="doc_${key.replace(/[ -]/g,'_')}_${doc.replace(/[^a-zA-Z0-9]/g,'_')}"
                      ${(DOCS_CONFIG[key]||defaults).includes(doc)?"checked":""} ${!isHead?"disabled":""}/>
                    <span>${doc}</span>
                  </label>`).join("")}
              </div>
            </div>`).join("")}
        </div>
      </div>

      <!-- SCORING WEIGHTS -->
      <div class="card">
        <div class="sec-hdr"><span class="sec-title">🎯 Bobot Credit Scoring</span></div>
        <p style="font-size:12px;color:var(--gray-400);margin-bottom:14px;">Total bobot harus 100%</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${[
            ["A. Payment Behavior","sw_payment",scoringWeights.payment*100],
            ["B. Problem Pattern","sw_problem",scoringWeights.problem*100],
            ["C. Volume & Konsistensi","sw_volume",scoringWeights.volume*100],
            ["D. Promise to Pay","sw_promise",scoringWeights.promise*100],
          ].map(([label,id,val]) => `
            <div style="padding:10px 12px;background:var(--gray-50);border-radius:var(--r-md);border:0.5px solid var(--border);">
              <p style="font-size:12px;font-weight:500;margin-bottom:6px;">${label}</p>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="number" id="${id}" class="form-input" value="${val}" min="0" max="100" style="width:70px;text-align:center;" oninput="updateWeightTotal()"/>
                <span style="font-size:12px;color:var(--gray-400);">%</span>
              </div>
            </div>`).join("")}
        </div>
        <div id="weightTotalDisplay" style="margin-top:8px;font-size:12px;padding:6px 10px;border-radius:var(--r-sm);background:var(--green-light);color:#15803d;">
          Total: 100%
        </div>
      </div>

      <!-- CUSTOMER TYPE KEYWORDS -->
      <div class="card">
        <div class="sec-hdr"><span class="sec-title">🏷 Keyword Auto-Detect Tipe Customer</span></div>
        <p style="font-size:12px;color:var(--gray-400);margin-bottom:14px;">Pisahkan dengan koma. Urutan prioritas: Afiliasi → Asuransi → Leasing → Fleet → Personal. Dipakai buat Credit Scoring.</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${["Afiliasi","Asuransi","Leasing","Fleet"].map(type => `
            <div class="form-group">
              <label class="form-label">${type}</label>
              <textarea id="kw_${type}" class="form-input" rows="2" style="resize:vertical;">${(custTypeKeywords[type]||DEFAULT_CUST_TYPE_KEYWORDS[type]||[]).join(", ")}</textarea>
            </div>`).join("")}
        </div>
      </div>

      <!-- SUB-TIPE KEYWORDS (Opsi A — terpisah dari custType di atas) -->
      <div class="card">
        <div class="sec-hdr"><span class="sec-title">🔀 Keyword Auto-Detect Sub-Tipe (Mobil & GRP)</span></div>
        <p style="font-size:12px;color:var(--gray-400);margin-bottom:6px;">Terpisah dari keyword Tipe Customer di atas. Ini yang nentuin badge "Leasing/Cash" & "Fleet/NRM" di detail invoice, sekaligus checklist dokumen yang berlaku. Pisahkan dengan koma.${!isHead?" 🔒 Hanya SuperAdmin (head) yang bisa ubah.":""}</p>
        <div style="display:flex;flex-direction:column;gap:14px;margin-top:10px;">
          <div>
            <p style="font-size:12px;font-weight:600;margin-bottom:8px;padding:5px 10px;background:var(--gray-100);border-radius:var(--r-sm);">Divisi Mobil (fallback: Cash)</p>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${["Leasing","Cash"].map(t => `
                <div class="form-group">
                  <label class="form-label">${t}</label>
                  <textarea id="subkw_Mobil_${t}" class="form-input" rows="2" style="resize:vertical;" ${!isHead?"disabled":""}>${(subTipeKeywords?.Mobil?.[t]||[]).join(", ")}</textarea>
                </div>`).join("")}
            </div>
          </div>
          <div>
            <p style="font-size:12px;font-weight:600;margin-bottom:8px;padding:5px 10px;background:var(--gray-100);border-radius:var(--r-sm);">Divisi GRP (fallback: NRM)</p>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${["Fleet","NRM"].map(t => `
                <div class="form-group">
                  <label class="form-label">${t}</label>
                  <textarea id="subkw_GRP_${t}" class="form-input" rows="2" style="resize:vertical;" ${!isHead?"disabled":""}>${(subTipeKeywords?.GRP?.[t]||[]).join(", ")}</textarea>
                </div>`).join("")}
            </div>
          </div>
        </div>
        ${isHead?`
          <div style="margin-top:14px;padding-top:14px;border-top:0.5px solid var(--border);">
            <button class="btn-sm" onclick="runRecalculateSubTipe()">🔄 Jalankan Ulang Auto-Detect ke Semua Invoice</button>
            <p style="font-size:11px;color:var(--gray-400);margin-top:6px;">Simpan keyword di atas dulu sebelum jalanin ini. Invoice yang sub-tipe-nya udah pernah diubah manual gak akan ketimpa.</p>
          </div>`:""}
      </div>

      <!-- CUSTOMER MAPPING -->
      <div class="card">
        <div class="sec-hdr">
          <span class="sec-title">🔗 Customer Name Mapping</span>
          <button class="btn-sm" onclick="addMappingRow()">+ Tambah</button>
        </div>
        <p style="font-size:12px;color:var(--gray-400);margin-bottom:12px;">Alias → Master Name untuk deduplication customer</p>
        <div id="mappingRows" style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;margin-bottom:10px;">
          ${Object.entries(customerMapping).map(([alias, master]) => `
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" class="form-input map-alias" value="${alias}" placeholder="Alias (nama di sistem)" style="flex:1;"/>
              <span style="color:var(--gray-300);">→</span>
              <input type="text" class="form-input map-master" value="${master}" placeholder="Master Name" style="flex:1;"/>
              <button class="btn-icon" onclick="this.closest('div').remove()">×</button>
            </div>`).join("")}
        </div>
        <button class="btn-ghost" style="width:100%;font-size:12px;" onclick="addMappingRow()">+ Tambah Baris</button>
      </div>

      <!-- SAVE BUTTONS -->
      <div style="display:flex;gap:8px;padding-bottom:20px;">
        <button class="btn-ghost" onclick="resetSettings()" style="flex:1;">Reset Default</button>
        <button class="btn-primary" onclick="applySettings()" style="flex:1;">💾 Simpan Semua Settings</button>
      </div>

    </div>
  `;

  updateWeightTotal();
}

// ===== USER & ROLE MANAGEMENT =====
const ROLE_LABELS = {
  head:        { label:"SuperAdmin", badgeBg:"#ede9fe", badgeColor:"#6d28d9" },
  admin_bp:    { label:"Admin BP",   badgeBg:"#dbeafe", badgeColor:"#1e40af" },
  admin_grp:   { label:"Admin GRP",  badgeBg:"#d1fae5", badgeColor:"#065f46" },
  admin_sales: { label:"Admin Sales",badgeBg:"#fef3c7", badgeColor:"#92400e" },
};
const ROLE_DIVISI = { head:"Semua", admin_bp:"BP", admin_grp:"GRP", admin_sales:"Mobil" };
// DEALER_LIST sekarang di constants.js (dipakai bareng sama app.js buat filter dealer SuperAdmin)

async function loadUsersList() {
  const wrap = document.getElementById("usersListWrap");
  if(!wrap) return;
  try {
    const users = await Api.getUsers();
    renderUsersTable(users);
  } catch(e) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-text">Gagal memuat user: ${e.message}</div></div>`;
  }
}

function renderUsersTable(users) {
  const wrap = document.getElementById("usersListWrap");
  if(!wrap) return;
  if(!users.length) { wrap.innerHTML = `<div class="empty-state"><div class="empty-state-text">Belum ada user</div></div>`; return; }

  wrap.innerHTML = `
    <table style="width:100%;font-size:12px;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="padding:8px;background:var(--gray-50);color:var(--gray-400);font-weight:500;text-align:left;border-bottom:0.5px solid var(--border);">Nama</th>
          <th style="padding:8px;background:var(--gray-50);color:var(--gray-400);font-weight:500;text-align:left;border-bottom:0.5px solid var(--border);">Email</th>
          <th style="padding:8px;background:var(--gray-50);color:var(--gray-400);font-weight:500;text-align:left;border-bottom:0.5px solid var(--border);">Role</th>
          <th style="padding:8px;background:var(--gray-50);color:var(--gray-400);font-weight:500;text-align:left;border-bottom:0.5px solid var(--border);">Dealer</th>
          <th style="padding:8px;background:var(--gray-50);color:var(--gray-400);font-weight:500;text-align:center;border-bottom:0.5px solid var(--border);">Status</th>
          <th style="padding:8px;background:var(--gray-50);color:var(--gray-400);font-weight:500;text-align:right;border-bottom:0.5px solid var(--border);">Aksi</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => {
          const rl = ROLE_LABELS[u.role] || { label:u.role, badgeBg:"#f3f4f6", badgeColor:"#374151" };
          return `
            <tr>
              <td style="padding:8px;border-bottom:0.5px solid var(--gray-100);font-weight:500;">${u.nama}</td>
              <td style="padding:8px;border-bottom:0.5px solid var(--gray-100);color:var(--gray-500);">${u.email}</td>
              <td style="padding:8px;border-bottom:0.5px solid var(--gray-100);">
                <span class="badge" style="background:${rl.badgeBg};color:${rl.badgeColor};">${rl.label}</span>
              </td>
              <td style="padding:8px;border-bottom:0.5px solid var(--gray-100);color:var(--gray-500);">${u.role==="head" ? "Semua Dealer" : (u.dealer||"—")}</td>
              <td style="padding:8px;border-bottom:0.5px solid var(--gray-100);text-align:center;">
                ${u.isActive!==false ? `<span class="badge" style="background:var(--green-light);color:#15803d;">Aktif</span>` : `<span class="badge" style="background:var(--red-light);color:var(--red);">Nonaktif</span>`}
              </td>
              <td style="padding:8px;border-bottom:0.5px solid var(--gray-100);text-align:right;">
                <button class="btn-icon" onclick='openUserModal(${JSON.stringify(u.email)})' title="Edit">✏️</button>
                ${u.email !== APP_STATE.user.email ? `<button class="btn-icon" onclick="deactivateUser('${u.email}')" title="Nonaktifkan">🚫</button>` : ""}
              </td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

function ensureUserModal() {
  if(document.getElementById("userModal")) return;
  const div = document.createElement("div");
  div.id = "userModal";
  div.className = "modal-overlay";
  div.style.display = "none";
  div.innerHTML = `<div id="userModalInner"></div>`;
  document.body.appendChild(div);
}

async function openUserModal(email=null) {
  ensureUserModal();
  const isEdit = !!email;
  let u = null;
  if(isEdit) {
    const users = await Api.getUsers();
    u = users.find(x => x.email === email);
    if(!u) { toast("User tidak ditemukan", "error"); return; }
  }

  document.getElementById("userModalInner").innerHTML = `
    <div class="modal" style="width:420px;">
      <div class="modal-header">
        <strong>${isEdit ? "Edit User" : "Tambah User"}</strong>
        <button class="modal-close" onclick="closeModal('userModal')">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nama</label>
          <input type="text" id="um_nama" class="form-input" value="${u?.nama||""}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="text" id="um_email" class="form-input" value="${u?.email||""}" ${isEdit?"disabled":""} placeholder="nama@nasmoco.co.id"/>
        </div>
        <div class="form-group">
          <label class="form-label">Role</label>
          <select id="um_role" class="form-input" onchange="document.getElementById('um_dealerWrap').style.display = this.value==='head' ? 'none' : ''">
            ${Object.entries(ROLE_LABELS).map(([val,r]) => `<option value="${val}" ${u?.role===val?"selected":""}>${r.label}</option>`).join("")}
          </select>
          <p style="font-size:11px;color:var(--gray-400);margin-top:4px;">Menentukan divisi yang bisa diakses (BP/GRP/Mobil) — SuperAdmin akses semua.</p>
        </div>
        <div class="form-group" id="um_dealerWrap" style="display:${u?.role==="head"?"none":""};">
          <label class="form-label">Dealer</label>
          <select id="um_dealer" class="form-input">
            ${DEALER_LIST.map(d => `<option value="${d}" ${u?.dealer===d?"selected":""}>${d}</option>`).join("")}
          </select>
          <p style="font-size:11px;color:var(--gray-400);margin-top:4px;">User cuma bisa lihat & kelola invoice dari dealer ini. Satu akun = satu dealer.</p>
        </div>
        ${!isEdit ? `
        <div class="form-group">
          <label class="form-label">Password Awal (opsional)</label>
          <input type="text" id="um_password" class="form-input" placeholder="Kosongkan untuk pakai default"/>
        </div>` : ""}
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="closeModal('userModal')">Batal</button>
        <button class="btn-primary" onclick="submitUserForm(${isEdit ? `'${email}'` : "null"})">💾 Simpan</button>
      </div>
    </div>`;

  document.getElementById("userModal").style.display = "flex";
}

async function submitUserForm(editEmail) {
  const nama  = document.getElementById("um_nama")?.value?.trim();
  const email = (editEmail || document.getElementById("um_email")?.value?.trim() || "").toLowerCase();
  const role  = document.getElementById("um_role")?.value;
  const pwdEl = document.getElementById("um_password");

  if(!nama || !email || !role) { toast("Nama, email, dan role wajib diisi", "error"); return; }

  const payload = { nama, email, role, divisi: ROLE_DIVISI[role] || "Semua", dealer: role==="head" ? "Semua" : (document.getElementById("um_dealer")?.value || "Semua") };
  if(!editEmail && pwdEl?.value) payload.password = pwdEl.value;

  try {
    const res = await Api.upsertUser(payload);
    closeModal("userModal");
    if(res.defaultPassword) {
      toast(`User dibuat! Password awal: ${res.defaultPassword}`, "success");
    } else {
      toast("User disimpan!", "success");
    }
    loadUsersList();
  } catch(e) {
    toast(`Gagal simpan user: ${e.message}`, "error");
  }
}

async function deactivateUser(email) {
  if(!confirm(`Nonaktifkan akses user ${email}?`)) return;
  try {
    await Api.deleteUser(email);
    toast("User dinonaktifkan", "success");
    loadUsersList();
  } catch(e) {
    toast(`Gagal: ${e.message}`, "error");
  }
}

function updateWeightTotal() {
  const total = ["sw_payment","sw_problem","sw_volume","sw_promise"]
    .reduce((s,id) => s + (parseFloat(document.getElementById(id)?.value)||0), 0);
  const el = document.getElementById("weightTotalDisplay");
  if(el) {
    el.textContent = `Total: ${total}%`;
    el.style.background = Math.abs(total-100)<0.01 ? "var(--green-light)" : "var(--red-light)";
    el.style.color = Math.abs(total-100)<0.01 ? "#15803d" : "var(--red)";
  }
}

function addMappingRow() {
  const container = document.getElementById("mappingRows");
  if(!container) return;
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:8px;align-items:center;";
  row.innerHTML = `
    <input type="text" class="form-input map-alias" placeholder="Alias (nama di sistem)" style="flex:1;"/>
    <span style="color:var(--gray-300);">→</span>
    <input type="text" class="form-input map-master" placeholder="Master Name" style="flex:1;"/>
    <button class="btn-icon" onclick="this.closest('div').remove()">×</button>`;
  container.appendChild(row);
}

function applySettings() {
  // Stuck days
  const newStuck = {};
  STAGES.filter(s=>s!=="Lunas").forEach(s => {
    const key = s.replace(/ /g,'_').replace(/&/g,'n');
    const el  = document.getElementById(`sd_${key}`);
    if(el) newStuck[s] = parseInt(el.value) || 3;
  });
  newStuck["Lunas"] = 9999;

  // Docs config
  const newDocs = {};
  Object.keys(DEFAULT_DOCS).forEach(divKey => {
    newDocs[divKey] = DOCS_MASTER.filter(doc => {
      const elId = `doc_${divKey.replace(/[ -]/g,'_')}_${doc.replace(/[^a-zA-Z0-9]/g,'_')}`;
      const el   = document.getElementById(elId);
      return el && el.checked;
    });
  });

  // Master info
  const newMaster = {
    perusahaan: document.getElementById("master_perusahaan")?.value || MASTER.perusahaan,
    alamat:     document.getElementById("master_alamat")?.value || MASTER.alamat,
    bank1: {
      nama:   document.getElementById("master_bank1_nama")?.value || MASTER.bank1.nama,
      cabang: MASTER.bank1.cabang,
      norek:  document.getElementById("master_bank1_norek")?.value || MASTER.bank1.norek,
    },
    bank2: {
      nama:   document.getElementById("master_bank2_nama")?.value || MASTER.bank2.nama,
      cabang: MASTER.bank2.cabang,
      norek:  document.getElementById("master_bank2_norek")?.value || MASTER.bank2.norek,
    },
    ttd1: {
      nama:    document.getElementById("master_ttd1_nama")?.value || MASTER.ttd1.nama,
      jabatan: document.getElementById("master_ttd1_jabatan")?.value || MASTER.ttd1.jabatan,
    },
    ttd2: {
      nama:    document.getElementById("master_ttd2_nama")?.value || MASTER.ttd2.nama,
      jabatan: document.getElementById("master_ttd2_jabatan")?.value || MASTER.ttd2.jabatan,
    },
    fax:   document.getElementById("master_fax")?.value || MASTER.fax,
    email: document.getElementById("master_email")?.value || MASTER.email,
  };

  // Scoring weights
  const payment = parseFloat(document.getElementById("sw_payment")?.value) || 40;
  const problem = parseFloat(document.getElementById("sw_problem")?.value) || 25;
  const volume  = parseFloat(document.getElementById("sw_volume")?.value)  || 20;
  const promise = parseFloat(document.getElementById("sw_promise")?.value) || 15;
  const total   = payment + problem + volume + promise;
  if(Math.abs(total-100) > 0.01) { toast(`Total bobot harus 100% (sekarang ${total}%)`, "error"); return; }
  saveScoringSettings({payment:payment/100, problem:problem/100, volume:volume/100, promise:promise/100});

  // Keywords
  const newKw = {};
  ["Afiliasi","Asuransi","Leasing","Fleet"].forEach(type => {
    const el = document.getElementById(`kw_${type}`);
    if(el) newKw[type] = el.value.split(",").map(s=>s.trim()).filter(Boolean);
  });
  saveCustTypeKeywords(newKw);

  // Sub-tipe keywords (Opsi A — terpisah dari custType di atas)
  const newSubKw = {
    Mobil: {
      Leasing: (document.getElementById("subkw_Mobil_Leasing")?.value||"").split(",").map(s=>s.trim()).filter(Boolean),
      Cash:    (document.getElementById("subkw_Mobil_Cash")?.value||"").split(",").map(s=>s.trim()).filter(Boolean),
    },
    GRP: {
      Fleet: (document.getElementById("subkw_GRP_Fleet")?.value||"").split(",").map(s=>s.trim()).filter(Boolean),
      NRM:   (document.getElementById("subkw_GRP_NRM")?.value||"").split(",").map(s=>s.trim()).filter(Boolean),
    },
  };
  saveSubTipeKeywords(newSubKw);

  // Customer mapping
  const newMapping = {};
  document.querySelectorAll("#mappingRows > div").forEach(row => {
    const alias  = row.querySelector(".map-alias")?.value?.trim().toUpperCase();
    const master = row.querySelector(".map-master")?.value?.trim().toUpperCase();
    if(alias && master) newMapping[alias] = master;
  });
  saveMapping(newMapping);
  // FIXED: sebelumnya cuma nyimpen ke localStorage, gak pernah nyampe ke Sheets —
  // makanya mapping ilang tiap ganti device/browser/clear cache. Sekarang di-sync juga.
  if(Api.isLoggedIn()) {
    Api.saveCustomerMapping(newMapping).catch(e => {
      console.warn("Sync customer mapping error:", e);
      toast("Mapping tersimpan lokal, tapi gagal sync ke server", "error");
    });
  }

  // Save all
  saveSettings(newStuck, newDocs, newMaster);
  invalidateCreditCache();

  toast("Settings disimpan! ✓", "success");
  renderCurrentPage();
}

// Simpen keyword sub-tipe yang lagi diketik, terus jalanin recalculate ke semua invoice
async function runRecalculateSubTipe() {
  if(!confirm("Jalankan ulang auto-detect sub-tipe (Leasing/Cash, Fleet/NRM) ke semua invoice Mobil & GRP?\n\nInvoice yang sub-tipe-nya udah pernah diubah manual TIDAK akan ketimpa.")) return;

  const newSubKw = {
    Mobil: {
      Leasing: (document.getElementById("subkw_Mobil_Leasing")?.value||"").split(",").map(s=>s.trim()).filter(Boolean),
      Cash:    (document.getElementById("subkw_Mobil_Cash")?.value||"").split(",").map(s=>s.trim()).filter(Boolean),
    },
    GRP: {
      Fleet: (document.getElementById("subkw_GRP_Fleet")?.value||"").split(",").map(s=>s.trim()).filter(Boolean),
      NRM:   (document.getElementById("subkw_GRP_NRM")?.value||"").split(",").map(s=>s.trim()).filter(Boolean),
    },
  };
  await saveSubTipeKeywords(newSubKw);
  await recalculateAllSubTipe();
}

function resetSettings() {
  saveSettings({...DEFAULT_STUCK_DAYS}, {...DEFAULT_DOCS}, null);
  saveScoringSettings({...SCORING_WEIGHTS});
  toast("Settings direset ke default", "success");
  renderSettings();
}
