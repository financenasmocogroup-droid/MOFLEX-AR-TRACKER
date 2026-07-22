// ===== REPORT GENERATOR =====
function generateReport() {
  const bulan = parseInt(document.getElementById("reportBulan").value);
  const tahun = parseInt(document.getElementById("reportTahun").value);
  const namaBulan = new Date(tahun, bulan-1, 1).toLocaleDateString("id-ID",{month:"long",year:"numeric"});
  const invoices = visibleInvoices(); // ikut filter dealer SuperAdmin kalau lagi milih 1 dealer

  const periodeInv = invoices.filter(i => {
    const d = new Date(i.tglMasuk || i.tglJual);
    return d.getFullYear()===tahun && d.getMonth()+1===bulan;
  });

  const allInv = invoices;
  const kurangBayarList = allInv.filter(i => i.stage==="Lunas"&&(i.nominalDiterima||0)<i.total&&i.total>0);
  const totalSelisih    = kurangBayarList.reduce((s,i)=>s+(i.total-(i.nominalDiterima||0)),0);
  const totalBelumLunas = allInv.filter(i=>i.stage!=="Lunas").reduce((s,i)=>s+i.total,0);
  const totalAR         = totalBelumLunas + totalSelisih;
  const totalBP         = allInv.filter(i=>i.sbr==="BP").reduce((s,i)=>s+i.total,0);
  const totalGRP        = allInv.filter(i=>i.sbr==="GRP").reduce((s,i)=>s+i.total,0);
  const totalMobil      = allInv.filter(i=>i.sbr==="Mobil").reduce((s,i)=>s+i.total,0);

  const stageData = STAGES.map(s => {
    const list = allInv.filter(i=>i.stage===s);
    return {stage:s, count:list.length, nominal:list.reduce((sum,i)=>sum+i.total,0)};
  });

  const agingData = [
    {label:"Lancar",     val:allInv.reduce((s,i)=>s+i.lancar,0),       color:"#16a34a"},
    {label:"1–30 Hari",  val:allInv.reduce((s,i)=>s+i.aging1_30,0),    color:"#d97706"},
    {label:"31–60 Hari", val:allInv.reduce((s,i)=>s+i.aging31_60,0),   color:"#ea580c"},
    {label:"61–90 Hari", val:allInv.reduce((s,i)=>s+i.aging61_90,0),   color:"#dc2626"},
    {label:"91–120 Hari",val:allInv.reduce((s,i)=>s+i.aging91_120,0),  color:"#991b1b"},
    {label:"121–150 Hari",val:allInv.reduce((s,i)=>s+i.aging121_150,0),color:"#7f1d1d"},
    {label:">150 Hari",  val:allInv.reduce((s,i)=>s+i.agingOver150,0), color:"#450a0a"},
  ];

  const bottleneckData = STAGES.filter(s=>s!=="Lunas").map(s => {
    const list = allInv.filter(i=>i.stage===s&&i.stageUpdatedAt);
    if(!list.length) return {stage:s,avg:0,threshold:STUCK_DAYS[s]||3,count:0,stuckCount:0,dominan:"BP",dominanPct:0};
    const avg = list.reduce((sum,i)=>sum+daysDiff(i.stageUpdatedAt),0)/list.length;
    const stuckCount = list.filter(i=>isStuck(i)).length;
    const divCounts = {BP:list.filter(i=>i.sbr==="BP").length,GRP:list.filter(i=>i.sbr==="GRP").length,Mobil:list.filter(i=>i.sbr==="Mobil").length};
    const dominan = Object.entries(divCounts).sort((a,b)=>b[1]-a[1])[0];
    const dominanPct = list.length>0?Math.round(dominan[1]/list.length*100):0;
    return {stage:s,avg:avg.toFixed(1),threshold:STUCK_DAYS[s]||3,count:list.length,stuckCount,dominan:dominan[0],dominanPct};
  });

  const lunasInv   = periodeInv.filter(i=>i.stage==="Lunas");
  const totalLunas = lunasInv.reduce((s,i)=>s+(i.nominalDiterima||i.total||0),0);
  const lunasKurang= lunasInv.filter(i=>(i.nominalDiterima||0)<i.total);
  const lunasOk    = lunasInv.filter(i=>(i.nominalDiterima||0)>=i.total);
  const ketBreakdown = {};
  lunasInv.forEach(i=>{ if(i.keteranganLunas) ketBreakdown[i.keteranganLunas]=(ketBreakdown[i.keteranganLunas]||0)+(i.total-(i.nominalDiterima||0)); });

  const bottleneckWorst = bottleneckData.filter(b=>parseFloat(b.avg)>b.threshold).sort((a,b)=>parseFloat(b.avg)-parseFloat(a.avg));
  const agingBuruk      = agingData.filter(a=>a.label!=="Lancar"&&a.val>0).sort((a,b)=>b.val-a.val);
  const stuckTotal      = allInv.filter(i=>isStuck(i)).length;

  let kesimpulan = "";
  if(bottleneckWorst.length>0){
    const w = bottleneckWorst[0];
    kesimpulan += `Bottleneck utama periode ${namaBulan} terdapat pada stage <strong>${w.stage}</strong> dengan rata-rata ${w.avg} hari per invoice (threshold ${w.threshold} hari). `;
    if(w.dominanPct>40) kesimpulan += `Didominasi divisi <strong>${w.dominan} (${w.dominanPct}%)</strong>. `;
  }
  if(agingBuruk.length>0&&agingBuruk[0].val>0) kesimpulan += `Aging terbesar di bucket <strong>${agingBuruk[0].label}</strong> senilai ${fmtRp(agingBuruk[0].val)}. `;
  if(stuckTotal>0) kesimpulan += `Total <strong>${stuckTotal} invoice</strong> melewati threshold dan memerlukan eskalasi. `;
  if(totalSelisih>0) kesimpulan += `Kurang bayar ${fmtRp(totalSelisih)} dari ${kurangBayarList.length} invoice. `;
  if(!kesimpulan) kesimpulan = "Seluruh tahapan AR berjalan sesuai threshold. Tidak ada bottleneck signifikan pada periode ini.";

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"/>
<title>AR Monthly Report — ${namaBulan}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:11pt;color:#111;background:#fff;padding:20mm;}
h1{font-size:18pt;font-weight:bold;margin-bottom:4px;}
h2{font-size:13pt;font-weight:bold;margin:24px 0 12px;padding-bottom:6px;border-bottom:2px solid #1e40af;color:#1e40af;}
.subtitle{font-size:10pt;color:#555;margin-bottom:4px;}
.meta{font-size:10pt;color:#555;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #1e40af;}
.metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
.metric-card{background:#f8faff;border:1px solid #dbeafe;border-radius:6px;padding:12px;}
.metric-label{font-size:9pt;color:#555;margin-bottom:4px;}
.metric-value{font-size:16pt;font-weight:bold;color:#1e40af;}
.metric-sub{font-size:9pt;color:#888;margin-top:2px;}
.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:7px;}
.bar-label{font-size:10pt;color:#444;width:90px;flex-shrink:0;}
.bar-track{flex:1;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;}
.bar-fill{height:100%;border-radius:4px;}
.bar-val{font-size:10pt;font-weight:bold;width:80px;text-align:right;}
.bar-pct{font-size:9pt;color:#888;width:36px;text-align:right;}
.pipeline-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px;}
.pipeline-cell{text-align:center;padding:10px 4px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;}
.pipeline-count{font-size:16pt;font-weight:bold;}
.pipeline-label{font-size:8pt;color:#666;margin-top:2px;line-height:1.3;}
.pipeline-nominal{font-size:9pt;font-weight:bold;margin-top:3px;}
table{width:100%;border-collapse:collapse;margin-bottom:12px;}
th{background:#eff6ff;color:#1e40af;padding:8px 10px;text-align:left;font-size:10pt;border-bottom:2px solid #bfdbfe;}
td{padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:10pt;}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:9pt;font-weight:bold;}
.badge-danger{background:#fee2e2;color:#b91c1c;}
.badge-warning{background:#fef3c7;color:#92400e;}
.badge-ok{background:#d1fae5;color:#065f46;}
.conclusion-box{background:#eff6ff;border-left:4px solid #1e40af;border-radius:6px;padding:14px 16px;line-height:1.7;font-size:11pt;}
.collection-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:10pt;}
.collection-row:last-child{border-bottom:none;}
@media print{body{padding:15mm;} @page{margin:15mm;}}
</style></head><body>

<div class="header">
  <div><h1>AR Monthly Report</h1><p class="subtitle">${APP_STATE.dealerFilter && APP_STATE.dealerFilter!=="Semua" ? "PT. "+APP_STATE.dealerFilter : "Seluruh Dealer"} — Divisi BP, GRP, Mobil</p></div>
  <div style="text-align:right;">
    <p class="meta"><strong>Periode:</strong> ${namaBulan}</p>
    <p class="meta"><strong>Digenerate:</strong> ${fmtDateLong(today())}</p>
    <p class="meta"><strong>Total Invoice:</strong> ${allInv.length}</p>
  </div>
</div>

<h2>1. Overview AR Outstanding</h2>
<div class="metric-grid">
  <div class="metric-card"><div class="metric-label">Total AR Outstanding</div><div class="metric-value">${fmtRp(totalAR)}</div><div class="metric-sub">${allInv.filter(i=>i.stage!=="Lunas").length} invoice aktif</div></div>
  <div class="metric-card"><div class="metric-label">Sudah Lunas</div><div class="metric-value" style="color:#16a34a;">${fmtRp(allInv.filter(i=>i.stage==="Lunas").reduce((s,i)=>s+(i.nominalDiterima||i.total||0),0))}</div><div class="metric-sub">${allInv.filter(i=>i.stage==="Lunas").length} invoice</div></div>
  <div class="metric-card"><div class="metric-label">Kurang Bayar</div><div class="metric-value" style="color:#dc2626;">${fmtRp(totalSelisih)}</div><div class="metric-sub">${kurangBayarList.length} invoice selisih</div></div>
</div>
${["BP","GRP","Mobil"].map((div,_,arr) => {
  const val = div==="BP"?totalBP:div==="GRP"?totalGRP:totalMobil;
  const pct = totalAR>0?val/totalAR*100:0;
  const color = div==="BP"?"#1e40af":div==="GRP"?"#16a34a":"#d97706";
  return `<div class="bar-row"><div class="bar-label">${div}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color};"></div></div><div class="bar-val">${fmtRp(val)}</div><div class="bar-pct">${pct.toFixed(1)}%</div></div>`;
}).join("")}

<h2>2. Pipeline Progress</h2>
<div class="pipeline-grid">
  ${stageData.map(({stage,count,nominal})=>`
    <div class="pipeline-cell">
      <div style="width:8px;height:8px;border-radius:50%;background:${STAGE_COLORS[stage]};margin:0 auto 6px;"></div>
      <div class="pipeline-count">${count}</div>
      <div class="pipeline-label">${stage}</div>
      <div class="pipeline-nominal" style="color:${STAGE_COLORS[stage]};">${fmtRp(nominal)}</div>
    </div>`).join("")}
</div>

<h2>3. Aging Breakdown</h2>
<table>
  <thead><tr><th>Bucket</th><th>Jumlah (Rp)</th><th>% dari Total</th></tr></thead>
  <tbody>
    ${agingData.map(a=>{
      const pct=totalAR>0?a.val/totalAR*100:0;
      return `<tr>
        <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${a.color};margin-right:8px;"></span>${a.label}</td>
        <td style="font-weight:bold;">${fmtRp(a.val)}</td>
        <td><div style="display:flex;align-items:center;gap:8px;"><div style="width:100px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;"><div style="width:${Math.min(pct,100)}%;height:100%;background:${a.color};border-radius:3px;"></div></div>${pct.toFixed(1)}%</div></td>
      </tr>`;
    }).join("")}
  </tbody>
</table>

<h2>4. Bottleneck Analysis</h2>
<table>
  <thead><tr><th>Stage</th><th>Rata-rata</th><th>Threshold</th><th>Invoice</th><th>Stuck</th><th>Dominan</th><th>Status</th></tr></thead>
  <tbody>
    ${bottleneckData.map(b=>{
      const over=parseFloat(b.avg)>b.threshold;
      const warn=parseFloat(b.avg)>b.threshold*0.8&&!over;
      return `<tr>
        <td style="font-weight:500;">${b.stage}</td>
        <td style="font-weight:bold;color:${over?"#dc2626":warn?"#d97706":"#16a34a"};">${b.avg} hr</td>
        <td>${b.threshold} hr</td><td>${b.count}</td>
        <td style="color:${b.stuckCount>0?"#dc2626":"#16a34a"};font-weight:500;">${b.stuckCount}</td>
        <td>${b.dominan} (${b.dominanPct}%)</td>
        <td>${over?`<span class="badge badge-danger">+${(parseFloat(b.avg)-b.threshold).toFixed(1)} hr over</span>`:warn?`<span class="badge badge-warning">Mendekati batas</span>`:`<span class="badge badge-ok">On track</span>`}</td>
      </tr>`;
    }).join("")}
  </tbody>
</table>

<h2>5. Collection Summary</h2>
<div class="collection-row"><span>Total lunas periode ini</span><strong>${fmtRp(totalLunas)} (${lunasInv.length} invoice)</strong></div>
<div class="collection-row"><span>Nominal pas / lebih</span><strong style="color:#16a34a;">${fmtRp(lunasOk.reduce((s,i)=>s+(i.nominalDiterima||i.total||0),0))} (${lunasOk.length} invoice)</strong></div>
<div class="collection-row"><span>Kurang bayar</span><strong style="color:#dc2626;">${fmtRp(lunasKurang.reduce((s,i)=>s+(i.total-(i.nominalDiterima||0)),0))} (${lunasKurang.length} invoice)</strong></div>
${Object.entries(ketBreakdown).map(([k,v])=>`<div class="collection-row"><span>Potongan ${k}</span><strong>${fmtRp(v)}</strong></div>`).join("")}

<h2>6. Kesimpulan</h2>
<div class="conclusion-box">${kesimpulan}</div>

<p style="margin-top:20px;font-size:9pt;color:#888;text-align:center;">
  Report ini digenerate otomatis oleh MOFLEX — Nasmoco Group · ${fmtDateLong(today())}
</p>

<script>window.onload=()=>window.print();<\/script>
</body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  closeModal("reportModal");
}