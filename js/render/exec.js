// ===== EXECUTIVE SUMMARY =====
function renderExec() {
  const el = document.getElementById("exec-content");
  if(!el) return;

  const invoices = visibleInvoices(); // scoped by dealer filter kalau SuperAdmin lagi milih 1 dealer

  const kurangBayarList = invoices.filter(i => i.stage === "Lunas" && (i.nominalDiterima||0) < i.total && i.total > 0);
  const totalSelisih    = kurangBayarList.reduce((s,i) => s + (i.total - (i.nominalDiterima||0)), 0);
  const totalBelumLunas = invoices.filter(i => i.stage !== "Lunas").reduce((s,i) => s + i.total, 0);
  const totalAR         = totalBelumLunas + totalSelisih;
  const stuckList       = invoices.filter(i => isStuck(i));

  // Credit summary
  const creditSum = invoices.length > 0 ? getCreditSummary() : null;
  const avgScore  = creditSum?.avgScore || 0;
  const avgCat    = getRiskCategory(avgScore);

  // Aging buckets
  const agingBuckets = [
    { label:"Lancar",   val:invoices.reduce((s,i)=>s+i.lancar,0),       color:"#16a34a", key:"lancar" },
    { label:"1–30 Hr",  val:invoices.reduce((s,i)=>s+i.aging1_30,0),    color:"#d97706", key:"1_30"   },
    { label:"31–60 Hr", val:invoices.reduce((s,i)=>s+i.aging31_60,0),   color:"#ea580c", key:"31_60"  },
    { label:">60 Hr",   val:invoices.reduce((s,i)=>s+i.aging61_90+i.aging91_120+i.aging121_150+i.agingOver150,0), color:"#dc2626", key:"61_90" },
  ];

  // Top risk customers
  const topRisk = creditSum?.topRisk || [];

  el.innerHTML = `
    <!-- PAGE HEADER -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">Executive Summary</div>
        <div class="page-subtitle">Laporan real-time kondisi keuangan — ${new Date().toLocaleDateString("id-ID",{month:"long",year:"numeric"})}</div>
      </div>
      <div class="page-header-actions">
        <button class="btn-sm" onclick="openReportModal()">📋 Ekspor PDF</button>
      </div>
    </div>

    <!-- METRIC CARDS -->
    <div class="metric-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="metric-card ac-purple" onclick="navigateTo('ar')">
        <div class="metric-label">Total Piutang (AR)</div>
        <div class="metric-value">${fmtRpShort(totalAR)}</div>
        <div class="metric-sub">${invoices.filter(i=>i.stage!=="Lunas").length} invoice aktif</div>
      </div>
      <div class="metric-card ac-red" onclick="jumpToAlert()">
        <div class="metric-label">Total Overdue / Stuck</div>
        <div class="metric-value">${fmtRpShort(totalBelumLunas)}</div>
        <div class="metric-sub">${stuckList.length} invoice perlu perhatian</div>
      </div>
      <div class="metric-card ac-teal" onclick="navigateTo('credit')">
        <div class="metric-label">Rata-rata Skor Kredit</div>
        <div class="metric-value">${avgScore} <span style="font-size:13px;font-weight:400;color:var(--gray-400);">/ 100</span></div>
        <div class="metric-sub"><span class="badge" style="background:${avgCat.bg};color:${avgCat.color};">${avgCat.icon} ${avgCat.label}</span></div>
      </div>
    </div>

    <!-- MAIN GRID -->
    <div class="grid-2">
      <!-- AGING ANALYSIS -->
      <div class="card">
        <div class="sec-hdr">
          <span class="sec-title">Aging Analysis Summary</span>
          <span class="sec-link" onclick="navigateTo('ar');switchARTab('aging',document.querySelectorAll('#arSubtabs .subtab')[2])">Lihat detail →</span>
        </div>
        ${agingBuckets.map(b => {
          const pct = totalAR > 0 ? b.val/totalAR*100 : 0;
          return `
            <div class="aging-row" onclick="jumpFromAging('${b.key}')" style="cursor:pointer;">
              <div class="aging-label">${b.label}</div>
              <div class="aging-track"><div class="aging-fill" style="width:${Math.min(pct,100)}%;background:${b.color};"></div></div>
              <div class="aging-val" style="color:${b.color};">${fmtRpShort(b.val)}</div>
            </div>`;
        }).join("")}
      </div>

      <!-- CREDIT RISK DISTRIBUTION -->
      <div class="card">
        <div class="sec-hdr">
          <span class="sec-title">Credit Risk Distribution</span>
          <span style="margin-left:auto;display:flex;align-items:center;gap:10px;">
            <span class="sec-link" style="font-size:11px;" onclick="APP_STATE.creditDistIncludeArchived=!APP_STATE.creditDistIncludeArchived;renderCurrentPage();">
              ${APP_STATE.creditDistIncludeArchived ? "↩ Cuma Aktif" : "📦 Lihat Keseluruhan"}
            </span>
            <span class="sec-link" onclick="navigateTo('credit')">Lihat detail →</span>
          </span>
        </div>
        ${creditSum ? `
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
            <div class="donut-wrap">
              <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f3f4f6" stroke-width="14"/>
                ${(() => {
                  const total = creditSum.distCustomers.length || 1;
                  let offset = 0;
                  const circ = 2 * Math.PI * 38;
                  return RISK_CATEGORIES.map(cat => {
                    const count = creditSum.dist[cat.label]?.count || 0;
                    const pct = count / total;
                    const dash = pct * circ;
                    const el2 = `<circle cx="50" cy="50" r="38" fill="none" stroke="${cat.color}" stroke-width="14"
                      stroke-dasharray="${dash} ${circ-dash}"
                      stroke-dashoffset="${-offset}"
                      transform="rotate(-90 50 50)"/>`;
                    offset += dash;
                    return el2;
                  }).join("");
                })()}
                <text x="50" y="55" text-anchor="middle" font-size="14" font-weight="600" fill="var(--gray-900)">${creditSum.distCustomers.length}</text>
              </svg>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
              ${RISK_CATEGORIES.map(cat => {
                const d = creditSum.dist[cat.label] || {};
                if(!d.count) return "";
                const pct = creditSum.distCustomers.length > 0 ? Math.round(d.count/creditSum.distCustomers.length*100) : 0;
                return `
                  <div style="display:flex;align-items:center;gap:6px;font-size:11px;" onclick="jumpToCreditTier('${cat.label}')" style="cursor:pointer;">
                    <span>${cat.icon}</span>
                    <span style="color:var(--gray-500);min-width:65px;">${cat.label}</span>
                    <div style="flex:1;height:4px;background:var(--gray-100);border-radius:2px;overflow:hidden;">
                      <div style="width:${pct}%;height:100%;background:${cat.color};border-radius:2px;"></div>
                    </div>
                    <span style="color:var(--gray-500);min-width:28px;text-align:right;">${pct}%</span>
                  </div>`;
              }).join("")}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;border-top:0.5px solid var(--border);padding-top:10px;">
            ${["Low Risk","Watch","Critical"].map(l => {
              const d = creditSum.dist[l] || {};
              const cat = RISK_CATEGORIES.find(c=>c.label===l);
              return `
                <div style="text-align:center;">
                  <div style="font-size:15px;font-weight:600;color:${cat?.color};">${d.count||0}</div>
                  <div style="font-size:10px;color:var(--gray-400);">${l}</div>
                </div>`;
            }).join("")}
          </div>` : `
          <div class="empty-state">
            <div class="empty-state-icon">🛡</div>
            <div class="empty-state-text">Upload data untuk melihat scoring</div>
          </div>`}
      </div>
    </div>

    <!-- PIPELINE SUMMARY -->
    <div class="pipeline-wrap" style="margin-bottom:14px;">
      <div class="pipeline-header">
        <span class="pipeline-title">Pipeline AR Overview</span>
        <span class="pipeline-action" onclick="navigateTo('ar')">Lihat AR Tracker →</span>
      </div>
      <div class="pipeline-stages">
        ${STAGES.map(s => {
          const list = invoices.filter(i => i.stage === s);
          const nominal = list.reduce((sum,i) => sum + (s==="Lunas"?(i.nominalDiterima||i.total||0):i.total), 0);
          const stageIcon = {
            "AR Masuk":"📥","Cek Kelengkapan":"📋","Plan & Kirim":"📤","Follow Up":"📞","Lunas":"✅"
          }[s] || "📄";
          return `
            <div class="pipeline-stage" onclick="jumpToStage('${s}')">
              <div class="stage-icon-wrap" style="background:${STAGE_COLORS[s]}22;">
                <span style="font-size:14px;">${stageIcon}</span>
              </div>
              <div class="stage-count">${list.length}</div>
              <div class="stage-label">${s}</div>
              <div class="stage-nominal" style="color:${STAGE_COLORS[s]};">${fmtRpShort(nominal)}</div>
            </div>`;
        }).join("")}
      </div>
    </div>

    <!-- BOTTOM GRID -->
    <div class="grid-2">
      <!-- TOP RISK CUSTOMERS -->
      <div class="card">
        <div class="sec-hdr">
          <span class="sec-title">Top Risk Customers</span>
          <span class="sec-link" onclick="navigateTo('credit');switchCreditTab('customers',document.querySelectorAll('#creditSubtabs .subtab')[1])">Lihat semua →</span>
        </div>
        ${topRisk.length > 0 ? `
          <table style="width:100%;font-size:12px;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="padding:6px 8px;background:var(--gray-50);color:var(--gray-400);font-weight:500;text-align:left;border-bottom:0.5px solid var(--border);">Customer</th>
                <th style="padding:6px 8px;background:var(--gray-50);color:var(--gray-400);font-weight:500;text-align:left;border-bottom:0.5px solid var(--border);">Score</th>
                <th style="padding:6px 8px;background:var(--gray-50);color:var(--gray-400);font-weight:500;text-align:right;border-bottom:0.5px solid var(--border);">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              ${topRisk.slice(0,5).map(c => `
                <tr style="cursor:pointer;" onclick="openCustDetail('${c.masterName}')">
                  <td style="padding:7px 8px;border-bottom:0.5px solid var(--gray-100);font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.masterName}</td>
                  <td style="padding:7px 8px;border-bottom:0.5px solid var(--gray-100);">
                    <span class="badge" style="background:${c.score.category.bg};color:${c.score.category.color};">${c.score.category.icon} ${c.score.total}</span>
                  </td>
                  <td style="padding:7px 8px;border-bottom:0.5px solid var(--gray-100);text-align:right;font-weight:500;">${fmtRpShort(c.totalOutstanding)}</td>
                </tr>`).join("")}
            </tbody>
          </table>` : `
          <div class="empty-state">
            <div class="empty-state-icon">🛡</div>
            <div class="empty-state-text">Belum ada data credit scoring</div>
          </div>`}
      </div>

      <!-- QUICK ACTIONS -->
      <div class="card">
        <div class="sec-hdr"><span class="sec-title">Quick Actions</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button onclick="document.getElementById('fileInput').click()" style="padding:14px;border:0.5px solid var(--border);border-radius:var(--r-md);background:var(--gray-50);cursor:pointer;text-align:center;">
            <div style="font-size:20px;margin-bottom:6px;">📥</div>
            <div style="font-size:12px;font-weight:500;color:var(--gray-700);">Upload XLS</div>
          </button>
          <button onclick="openAddModal()" style="padding:14px;border:0.5px solid var(--border);border-radius:var(--r-md);background:var(--gray-50);cursor:pointer;text-align:center;">
            <div style="font-size:20px;margin-bottom:6px;">➕</div>
            <div style="font-size:12px;font-weight:500;color:var(--gray-700);">Invoice Manual</div>
          </button>
          <button onclick="navigateTo('ar')" style="padding:14px;border:0.5px solid var(--border);border-radius:var(--r-md);background:var(--gray-50);cursor:pointer;text-align:center;">
            <div style="font-size:20px;margin-bottom:6px;">📄</div>
            <div style="font-size:12px;font-weight:500;color:var(--gray-700);">AR Tracker</div>
          </button>
          <button onclick="navigateTo('credit')" style="padding:14px;border:0.5px solid var(--border);border-radius:var(--r-md);background:var(--gray-50);cursor:pointer;text-align:center;">
            <div style="font-size:20px;margin-bottom:6px;">🛡</div>
            <div style="font-size:12px;font-weight:500;color:var(--gray-700);">Credit Scoring</div>
          </button>
        </div>

        ${stuckList.length > 0 ? `
          <div style="margin-top:12px;padding:10px 12px;background:#fff7ed;border:0.5px solid #fed7aa;border-radius:var(--r-md);">
            <div style="font-size:12px;font-weight:600;color:#92400e;margin-bottom:6px;">⚠️ ${stuckList.length} Invoice Stuck</div>
            <div style="font-size:11px;color:#b45309;">Klik untuk lihat detail</div>
            <button onclick="jumpToAlert()" style="margin-top:8px;width:100%;padding:6px;background:#d97706;color:#fff;border:none;border-radius:var(--r-sm);font-size:12px;cursor:pointer;">
              Lihat Invoice Stuck →
            </button>
          </div>` : ""}
      </div>
    </div>
  `;
}