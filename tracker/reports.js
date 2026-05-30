// ==================== REPORTS PAGE ====================
function ReportsPage({ companies, users, entries, billingLocks, addBillingLock, currentUser, approvalRequests, setApprovalRequests, discountSchemes, retainers }) {
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
    return last.toISOString().slice(0,10);
  });
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [period, setPeriod] = useState('month');
  const [showInvoiceConfirm, setShowInvoiceConfirm] = useState(false);
  const [invoiceGenerated, setInvoiceGenerated] = useState(false);
  const [showApprovalSection, setShowApprovalSection] = useState(false);
  const [activeTab, setActiveTab] = useState('reports');
  const myPendingApprovals = (approvalRequests||[]).filter(ar => ar.status === 'pending' && users.find(u => u.id === ar.user_id)?.manager_id === currentUser?.id);
  const [userFinalizations, setUserFinalizations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tracker_finalizations') || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem('tracker_finalizations', JSON.stringify(userFinalizations)); } catch {}
  }, [userFinalizations]);

  // Check if current period is already locked
  const isPeriodLocked = billingLocks.some(lock =>
    lock.date_from === dateFrom && lock.date_to === dateTo
  );
  // Check if any part of current period overlaps with a lock
  const hasOverlappingLock = billingLocks.some(lock =>
    dateFrom <= lock.date_to && dateTo >= lock.date_from
  );

  const setPresetPeriod = (p) => {
    setPeriod(p);
    const now = new Date();
    if (p === 'day') {
      const d = now.toISOString().slice(0,10);
      setDateFrom(d); setDateTo(d);
    } else if (p === 'week') {
      const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setDateFrom(mon.toISOString().slice(0,10)); setDateTo(sun.toISOString().slice(0,10));
    } else if (p === 'month') {
      setDateFrom(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`);
      const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
      setDateTo(last.toISOString().slice(0,10));
    }
  };

  const filtered = entries.filter(e => {
    if (e.date < dateFrom || e.date > dateTo) return false;
    if (filterCompany !== 'all' && e.company_id !== filterCompany) return false;
    if (filterUser !== 'all' && e.user_id !== filterUser) return false;
    return true;
  });

  // Discount ratio per company: payment/credit (how much client actually pays vs ceníková cena)
  const getDiscountRatio = (companyId) => {
    const scheme = (discountSchemes || []).find(s => s.companyIds && s.companyIds.includes(companyId));
    if (!scheme || scheme.no_discount) return 1;
    const tiers = scheme.tiers;
    if (!tiers || tiers.length === 0) return 1;
    // Use a reference payment to calculate the ratio (e.g. 100000)
    const refPayment = 100000;
    const refCredit = calculateCredit(refPayment, tiers);
    return refCredit > 0 ? refPayment / refCredit : 1;
  };

  // Sazba per klient (override) s fallbackem na osobní sazbu člověka
  const getEffectiveRate = (companyId, user) => {
    const c = companies.find(c => c.id === companyId);
    if (c && c.hourly_rate) return c.hourly_rate; // klientská sazba má přednost
    return user?.hourly_rate || 0;                 // jinak osobní sazba
  };
  const hasClientRate = (companyId) => {
    const c = companies.find(c => c.id === companyId);
    return !!(c && c.hourly_rate);
  };
  // U klienta s vlastní sazbou je sazba finální → slevy se neaplikují
  const effectiveDiscountRatio = (companyId) => hasClientRate(companyId) ? 1 : getDiscountRatio(companyId);

  const totalMins = filtered.reduce((s,e) => s+e.duration_min, 0);
  let totalCzk = 0;
  let totalDiscountedCzk = 0;
  filtered.forEach(e => {
    const u = users.find(u=>u.id===e.user_id);
    if(u) {
      const amt = (e.duration_min/60)*getEffectiveRate(e.company_id, u);
      totalCzk += amt;
      totalDiscountedCzk += amt * effectiveDiscountRatio(e.company_id);
    }
  });
  const uniqueCompanies = [...new Set(filtered.map(e=>e.company_id))].length;
  const uniqueUsers = [...new Set(filtered.map(e=>e.user_id))].length;

  // By company breakdown
  const byCompany = {};
  filtered.forEach(e => {
    if (!byCompany[e.company_id]) byCompany[e.company_id] = { mins: 0, czk: 0, discountedCzk: 0 };
    byCompany[e.company_id].mins += e.duration_min;
    const u = users.find(u=>u.id===e.user_id);
    if (u) {
      const amt = (e.duration_min/60)*getEffectiveRate(e.company_id, u);
      byCompany[e.company_id].czk += amt;
      byCompany[e.company_id].discountedCzk += amt * effectiveDiscountRatio(e.company_id);
    }
  });

  // By user breakdown
  const byUser = {};
  filtered.forEach(e => {
    if (!byUser[e.user_id]) byUser[e.user_id] = { mins: 0, czk: 0, discountedCzk: 0 };
    byUser[e.user_id].mins += e.duration_min;
    const u = users.find(u=>u.id===e.user_id);
    if (u) {
      const amt = (e.duration_min/60)*getEffectiveRate(e.company_id, u);
      byUser[e.user_id].czk += amt;
      byUser[e.user_id].discountedCzk += amt * effectiveDiscountRatio(e.company_id);
    }
  });

  // Detailed breakdown per company per user (for invoice)
  const invoiceData = {};
  filtered.forEach(e => {
    const key = e.company_id;
    if (!invoiceData[key]) invoiceData[key] = {};
    if (!invoiceData[key][e.user_id]) invoiceData[key][e.user_id] = { mins: 0, czk: 0, discountedCzk: 0, entries: [] };
    invoiceData[key][e.user_id].mins += e.duration_min;
    const u = users.find(u=>u.id===e.user_id);
    if (u) {
      const amt = (e.duration_min/60)*getEffectiveRate(e.company_id, u);
      invoiceData[key][e.user_id].czk += amt;
      invoiceData[key][e.user_id].discountedCzk += amt * effectiveDiscountRatio(e.company_id);
    }
    invoiceData[key][e.user_id].entries.push(e);
  });

  // Export přehledu (firmy × lidé × hodiny) do Excelu
  const exportExcel = () => {
    if (!window.XLSX) { toastError('Export se nenačetl, obnovte stránku (Ctrl+R)'); return; }
    if (filtered.length === 0) { toastError('Žádné záznamy v tomto období'); return; }
    const XLSX = window.XLSX;
    const TIME_FMT = '[h]:mm';
    const day = (m) => m / 1440; // minuty -> Excel čas (zlomek dne)

    // Lidé a firmy, které mají v období záznam
    const expUsers = [...new Set(filtered.map(e => e.user_id))]
      .map(id => users.find(u => u.id === id)).filter(Boolean)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'cs'));
    const expComps = [...new Set(filtered.map(e => e.company_id))]
      .map(id => companies.find(c => c.id === id)).filter(Boolean)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'cs'));

    // Matice minut [firma][člověk]
    const mins = {};
    filtered.forEach(e => {
      mins[e.company_id] = mins[e.company_id] || {};
      mins[e.company_id][e.user_id] = (mins[e.company_id][e.user_id] || 0) + e.duration_min;
    });

    // List 1: Přehled (pivot firmy × lidé)
    const colTotals = expUsers.map(() => 0);
    let grand = 0;
    const aoa = [['Firma', ...expUsers.map(u => u.name), 'CELKEM']];
    expComps.forEach(c => {
      const row = [c.name];
      let rowTotal = 0;
      expUsers.forEach((u, i) => {
        const m = (mins[c.id] && mins[c.id][u.id]) || 0;
        row.push(m > 0 ? day(m) : '');
        rowTotal += m; colTotals[i] += m;
      });
      row.push(day(rowTotal));
      grand += rowTotal;
      aoa.push(row);
    });
    aoa.push(['CELKEM', ...colTotals.map(m => day(m)), day(grand)]);
    const ws1 = XLSX.utils.aoa_to_sheet(aoa);
    const range = XLSX.utils.decode_range(ws1['!ref']);
    for (let r = 1; r <= range.e.r; r++) {
      for (let col = 1; col <= range.e.c; col++) {
        const cell = ws1[XLSX.utils.encode_cell({ r, c: col })];
        if (cell && typeof cell.v === 'number') { cell.t = 'n'; cell.z = TIME_FMT; }
      }
    }
    ws1['!cols'] = [{ wch: 22 }, ...expUsers.map(() => ({ wch: 11 })), { wch: 11 }];

    // List 2: Záznamy (syrová data pro vlastní kontingenční tabulky)
    const raw = [['Datum', 'Člověk', 'Firma', 'Hodiny', 'Popis']];
    filtered.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).forEach(e => {
      const u = users.find(u => u.id === e.user_id);
      const c = companies.find(c => c.id === e.company_id);
      raw.push([e.date, u?.name || '?', c?.name || '?', Math.round(e.duration_min / 60 * 100) / 100, e.description || '']);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(raw);
    ws2['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 9 }, { wch: 50 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Přehled');
    XLSX.utils.book_append_sheet(wb, ws2, 'Záznamy');
    XLSX.writeFile(wb, `prehled_hodin_${dateFrom}_${dateTo}.xlsx`);
    toastSuccess('Export stažen');
  };

  const generatePDF = (shouldLock) => {
    const { jsPDF } = window.jspdf;
    const primary = [79, 70, 229];
    const dark = [26, 26, 46];
    const gray = [107, 114, 128];
    const light = [243, 244, 246];
    const genDate = new Date().toLocaleDateString('cs-CZ');
    const VAT_RATE = 0.21;

    const fmtK = (n) => Math.round(n).toLocaleString('cs-CZ').replace(/\u00A0/g, ' ') + ' Kč';

    const createPDFDoc = (title, companyName) => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      // Embed Czech fonts
      window.__registerLatoFont(doc);
      doc.setFont('Lato', 'normal');

      const pw = doc.internal.pageSize.getWidth(); // 210
      const ph = doc.internal.pageSize.getHeight(); // 297
      const ml = 14, mr = 14;
      const cw = pw - ml - mr; // 182

      const footer = (pg) => {
        doc.setFont('Lato', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text('Jokes Aside s.r.o. | Podklad k fakturaci | ' + dateFrom + ' \u2013 ' + dateTo, ml, ph - 8);
        doc.text('Strana ' + pg, pw - mr, ph - 8, { align: 'right' });
      };

      let y = 12;
      // Header bar
      doc.setFillColor(...primary);
      doc.rect(0, 0, pw, 32, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('Lato', 'bold');
      doc.setFontSize(16);
      doc.text('Jokes Aside', ml, 13);
      doc.setFont('Lato', 'normal');
      doc.setFontSize(9);
      doc.text(title + (companyName ? ' \u2013 ' + companyName : ''), ml, 21);
      doc.setFontSize(7.5);
      doc.text('Období: ' + dateFrom + ' až ' + dateTo, ml, 28);
      doc.text('Vygenerováno: ' + genDate + ' (' + (currentUser?.name || '') + ')', pw - mr, 28, { align: 'right' });
      y = 40;

      return { doc, pw, ph, ml, mr, cw, yRef: { v: y }, footer };
    };

    const checkPg = (doc, yRef, ph, needed) => {
      if (yRef.v + needed > ph - 16) {
        doc.addPage();
        yRef.v = 12;
      }
    };

    // ===== PER-COMPANY PDFs =====
    const sortedComps = Object.entries(invoiceData).sort((a,b) => {
      const ca = companies.find(c=>c.id===a[0]);
      const cb = companies.find(c=>c.id===b[0]);
      return (ca?.name || '').localeCompare(cb?.name || '');
    });

    sortedComps.forEach(([compId, userData]) => {
      const comp = companies.find(c=>c.id===compId);
      const compEntries = filtered.filter(e => e.company_id === compId);
      let compMins = 0, compCzk = 0;
      Object.values(userData).forEach(d => { compMins += d.mins; compCzk += d.czk; });
      const compVat = compCzk * VAT_RATE;
      const compTotal = compCzk + compVat;

      const { doc, pw, ph, ml, mr, cw, yRef, footer } = createPDFDoc('Podklad k fakturaci', comp?.name);

      // Summary box
      doc.setFillColor(...light);
      doc.roundedRect(ml, yRef.v, cw, 22, 2, 2, 'F');
      const bx = ml + 4;
      doc.setFont('Lato', 'bold'); doc.setFontSize(9); doc.setTextColor(...dark);
      doc.text('Celkem bez DPH: ' + fmtK(compCzk), bx, yRef.v + 7);
      doc.setFont('Lato', 'normal'); doc.setFontSize(8); doc.setTextColor(...gray);
      doc.text('DPH 21%: ' + fmtK(compVat) + '   |   Celkem s DPH: ' + fmtK(compTotal), bx, yRef.v + 13);
      doc.text(formatHours(compMins) + '  |  ' + compEntries.length + ' záznamů', bx, yRef.v + 18.5);
      yRef.v += 28;

      // Per user tables
      Object.entries(userData).sort((a,b)=>b[1].czk-a[1].czk).forEach(([uid, data]) => {
        const user = users.find(u=>u.id===uid);
        const uVat = data.czk * VAT_RATE;
        checkPg(doc, yRef, ph, 16 + data.entries.length * 5.5);

        // User header
        doc.setFont('Lato', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);
        doc.text(user?.name + ' (' + getEffectiveRate(compId, user).toLocaleString('cs-CZ').replace(/\u00A0/g, ' ') + ' Kč/h)', ml + 1, yRef.v + 3);
        doc.setFont('Lato', 'normal'); doc.setTextColor(...gray);
        doc.text(formatHours(data.mins) + ' | ' + fmtK(data.czk) + ' bez DPH', pw - mr - 1, yRef.v + 3, { align: 'right' });
        yRef.v += 6;

        // Entries table: Datum | Popis | Čas | Bez DPH | DPH | S DPH
        const tw = cw - 2; // table width
        const c0 = 17; // datum
        const c2 = 13; // cas
        const c3 = 22; // bez dph
        const c4 = 18; // dph
        const c5 = 24; // s dph
        const c1 = tw - c0 - c2 - c3 - c4 - c5; // popis = rest

        const tData = data.entries.sort((a,b)=>a.date.localeCompare(b.date)).map(e => {
          const bez = (e.duration_min/60) * getEffectiveRate(compId, user);
          const dph = bez * VAT_RATE;
          return [
            formatDate(e.date),
            e.description.length > 35 ? e.description.substring(0, 32) + '...' : e.description,
            formatHours(e.duration_min),
            fmtK(bez),
            fmtK(dph),
            fmtK(bez + dph),
          ];
        });

        // Totals row
        tData.push([
          '', 'CELKEM', formatHours(data.mins), fmtK(data.czk), fmtK(uVat), fmtK(data.czk + uVat)
        ]);

        doc.autoTable({
          startY: yRef.v,
          margin: { left: ml + 1, right: mr + 1 },
          tableWidth: tw,
          head: [['Datum', 'Popis', 'Čas', 'Bez DPH', 'DPH', 'S DPH']],
          body: tData,
          theme: 'plain',
          styles: {
            font: 'Lato', fontSize: 6.5, cellPadding: { top: 1, right: 1, bottom: 1, left: 1 },
            textColor: dark, lineColor: [229,231,235], lineWidth: 0.15, overflow: 'ellipsize'
          },
          headStyles: { fontStyle: 'bold', textColor: gray, fontSize: 6, fillColor: false },
          columnStyles: {
            0: { cellWidth: c0 },
            1: { cellWidth: c1 },
            2: { cellWidth: c2, halign: 'right' },
            3: { cellWidth: c3, halign: 'right' },
            4: { cellWidth: c4, halign: 'right' },
            5: { cellWidth: c5, halign: 'right', fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.row.index === tData.length - 1 && data.section === 'body') {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [243, 244, 246];
            }
          },
        });

        yRef.v = doc.lastAutoTable.finalY + 5;
      });

      // Grand total box
      checkPg(doc, yRef, ph, 18);
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(ml, yRef.v, cw, 15, 2, 2, 'F');
      doc.setDrawColor(...primary);
      doc.roundedRect(ml, yRef.v, cw, 15, 2, 2, 'S');
      doc.setFont('Lato', 'bold'); doc.setFontSize(9); doc.setTextColor(...primary);
      doc.text('CELKEM S DPH', ml + 4, yRef.v + 9);
      doc.setFontSize(12);
      doc.text(fmtK(compTotal), pw - mr - 4, yRef.v + 9, { align: 'right' });
      doc.setFont('Lato', 'normal'); doc.setFontSize(7); doc.setTextColor(...gray);
      doc.text('Bez DPH: ' + fmtK(compCzk) + '  |  DPH 21%: ' + fmtK(compVat), ml + 4, yRef.v + 13.5);

      // Footers
      const tp = doc.getNumberOfPages();
      for (let i = 1; i <= tp; i++) { doc.setPage(i); footer(i); }

      const cn = comp?.name?.replace(/\s+/g, '_') || 'firma';
      doc.save('fakturace-' + cn + '-' + dateFrom + '-' + dateTo + '.pdf');
    });

    // ===== SUMMARY PDF =====
    const { doc: sd, pw: sp, ph: sph, ml: sm, mr: smr, cw: sc, yRef: sy, footer: sf } = createPDFDoc('Souhrnný přehled fakturace', null);

    // Stats box
    let grandCzk = totalCzk;
    let grandVat = grandCzk * VAT_RATE;
    let grandTotal = grandCzk + grandVat;

    sd.setFillColor(...light);
    sd.roundedRect(sm, sy.v, sc, 26, 2, 2, 'F');
    const cols = [
      { label: 'Bez DPH', value: fmtK(grandCzk) },
      { label: 'DPH 21%', value: fmtK(grandVat) },
      { label: 'S DPH', value: fmtK(grandTotal) },
      { label: 'Hodin', value: formatHours(totalMins) },
    ];
    const colW = sc / 4;
    cols.forEach((col, i) => {
      const cx = sm + colW * i + colW / 2;
      sd.setFont('Lato', 'bold'); sd.setFontSize(11); sd.setTextColor(...primary);
      sd.text(col.value, cx, sy.v + 10, { align: 'center' });
      sd.setFont('Lato', 'normal'); sd.setFontSize(7); sd.setTextColor(...gray);
      sd.text(col.label, cx, sy.v + 18, { align: 'center' });
    });
    sy.v += 34;

    // Per company summary table
    const sTw = sc - 2;
    const sData = sortedComps.map(([compId, userData]) => {
      const comp = companies.find(c=>c.id===compId);
      let cMins = 0, cCzk = 0;
      Object.values(userData).forEach(d => { cMins += d.mins; cCzk += d.czk; });
      return [comp?.name || '', formatHours(cMins), fmtK(cCzk), fmtK(cCzk * VAT_RATE), fmtK(cCzk * (1 + VAT_RATE))];
    });
    sData.push(['CELKEM', formatHours(totalMins), fmtK(grandCzk), fmtK(grandVat), fmtK(grandTotal)]);

    sd.autoTable({
      startY: sy.v,
      margin: { left: sm + 1, right: smr + 1 },
      tableWidth: sTw,
      head: [['Firma', 'Čas', 'Bez DPH', 'DPH', 'S DPH']],
      body: sData,
      theme: 'plain',
      styles: {
        font: 'Lato', fontSize: 7.5, cellPadding: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
        textColor: dark, lineColor: [229,231,235], lineWidth: 0.15, overflow: 'ellipsize'
      },
      headStyles: { fontStyle: 'bold', textColor: gray, fontSize: 7, fillColor: false },
      columnStyles: {
        0: { cellWidth: sTw - 18 - 26 - 22 - 28 },
        1: { cellWidth: 18, halign: 'right' },
        2: { cellWidth: 26, halign: 'right' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.row.index === sData.length - 1 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [238, 242, 255];
        }
      },
    });

    const stp = sd.getNumberOfPages();
    for (let i = 1; i <= stp; i++) { sd.setPage(i); sf(i); }
    sd.save('fakturace-souhrn-' + dateFrom + '-' + dateTo + '.pdf');
  };

  const handleGenerateInvoice = () => {
    const filename = generatePDF(true);
    addBillingLock({ date_from: dateFrom, date_to: dateTo, generated_by: currentUser?.id });
    setShowInvoiceConfirm(false);
    setInvoiceGenerated(true);
    setTimeout(() => setInvoiceGenerated(false), 5000);
  };

  const handleDownloadPDFOnly = () => {
    generatePDF(false);
  };

  return (
    <div>
      <div className="section-title">Reporty & Fakturace</div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab==='reports'?'active':''}`} onClick={()=>setActiveTab('reports')}>Přehledy</button>
        <button className={`tab ${activeTab==='invoice'?'active':''}`} onClick={()=>setActiveTab('invoice')}>
          Fakturace
          {billingLocks.length > 0 && <span className="badge badge-success" style={{marginLeft:6}}>{billingLocks.length}</span>}
        </button>
      </div>

      {/* Shared filters for both tabs */}
      <div style={{display:'flex',gap:6,marginBottom:12}}>
        {['day','week','month'].map(p => (
          <button key={p} className={`btn btn-sm ${period===p?'btn-primary':'btn-outline'}`} onClick={()=>setPresetPeriod(p)}>
            {p==='day'?'Den':p==='week'?'Týden':'Měsíc'}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <input className="input" type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPeriod('custom');}} style={{flex:1}} />
        <span style={{alignSelf:'center',color:'var(--text-secondary)'}}>—</span>
        <input className="input" type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPeriod('custom');}} style={{flex:1}} />
      </div>
      {activeTab === 'reports' && (
        <div className="filter-row">
          <select className="select input" value={filterCompany} onChange={e=>setFilterCompany(e.target.value)} style={{flex:1}}>
            <option value="all">Všechny firmy</option>
            {companies.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select input" value={filterUser} onChange={e=>setFilterUser(e.target.value)} style={{flex:1}}>
            <option value="all">Všichni lidé</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}

      {/* =============== REPORTS TAB =============== */}
      {activeTab === 'reports' && (
        <div>
          {/* Export do Excelu */}
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button className="btn btn-outline btn-sm" onClick={exportExcel}>
              <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.download}</span> Export do Excelu
            </button>
          </div>
          {/* Lock indicator */}
          {isPeriodLocked && (
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'#fef3c7',borderRadius:8,marginBottom:12,fontSize:13,color:'#92400e'}}>
              <span style={{width:16,height:16,display:'inline-flex',flexShrink:0}}>{Icons.lock}</span>
              Toto období je uzamčeno (vyfakturováno). Záznamy nelze editovat.
            </div>
          )}

          {/* Summary */}
          <div className="report-summary">
            <div className="stat-box">
              <div className="stat-value">{formatHours(totalMins)}</div>
              <div className="stat-label">Celkem hodin</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{formatCzk(totalCzk)}</div>
              <div className="stat-label">Ceníková cena</div>
              <div style={{fontSize:10,color:'var(--text-secondary)',marginTop:4}}>DPH: {formatCzk(dphAmount(totalCzk))}</div>
              <div style={{fontSize:10,color:'var(--text-secondary)',marginTop:3}}>s DPH: {formatCzk(withDph(totalCzk))}</div>
            </div>
            <div className="stat-box">
              <div className="stat-value" style={{color:'var(--success)'}}>{formatCzk(totalDiscountedCzk)}</div>
              <div className="stat-label">Po slevě</div>
              <div style={{fontSize:10,color:'var(--text-secondary)',marginTop:4}}>DPH: {formatCzk(dphAmount(totalDiscountedCzk))}</div>
              <div style={{fontSize:10,color:'var(--text-secondary)',marginTop:3}}>s DPH: {formatCzk(withDph(totalDiscountedCzk))}</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{uniqueCompanies}</div>
              <div className="stat-label">Firem</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{uniqueUsers}</div>
              <div className="stat-label">Lidí</div>
            </div>
          </div>

          {/* By company */}
          <div className="card" style={{marginBottom:12}}>
            <div className="section-title">Podle firem</div>
            {Object.entries(byCompany).sort((a,b)=>b[1].czk-a[1].czk).map(([cid, data]) => {
              const comp = companies.find(c=>c.id===cid);
              const pct = totalCzk > 0 ? (data.czk/totalCzk)*100 : 0;
              return (
                <div key={cid} style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:14,fontWeight:500,marginBottom:2}}>
                    <span>{comp?.name}</span>
                    <span>{formatHours(data.mins)} · {formatCzk(data.czk)} bez DPH</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--text-secondary)',textAlign:'right',marginTop:3,marginBottom:3}}>s DPH: {formatCzk(withDph(data.czk))}</div>
                  {data.discountedCzk !== data.czk && (
                    <div style={{fontSize:11,color:'var(--success)',textAlign:'right',marginBottom:3}}>Po slevě: {formatCzk(data.discountedCzk)} bez DPH · s DPH: {formatCzk(withDph(data.discountedCzk))}</div>
                  )}
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width:pct+'%', background: comp?.color || '#999'}} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* By user */}
          <div className="card" style={{marginBottom:12}}>
            <div className="section-title">Podle lidí</div>
            {Object.entries(byUser).sort((a,b)=>b[1].czk-a[1].czk).map(([uid, data]) => {
              const user = users.find(u=>u.id===uid);
              return (
                <div key={uid} className="person-row" style={{padding:'8px 0'}}>
                  <div className="person-info">
                    <div className="person-name">{user?.name}</div>
                    <div className="person-role">{user?.position} · {formatCzk(data.czk)} bez DPH · s DPH: {formatCzk(withDph(data.czk))}{data.discountedCzk !== data.czk && <span style={{color:'var(--success)'}}> · po slevě: {formatCzk(data.discountedCzk)}</span>}</div>
                  </div>
                  <div className="person-hours">{formatHours(data.mins)}</div>
                </div>
              );
            })}
          </div>

          {/* Entries detail */}
          <div className="card">
            <div className="section-title">Jednotlivé záznamy ({filtered.length})</div>
            <div className="task-list">
              {filtered.sort((a,b)=>b.date.localeCompare(a.date)).map(e => {
                const user = users.find(u=>u.id===e.user_id);
                const comp = companies.find(c=>c.id===e.company_id);
                const locked = billingLocks.some(lock => e.date >= lock.date_from && e.date <= lock.date_to);
                return (
                  <div key={e.id} className="task-item">
                    <div className="task-dot" style={{background: comp?.color || '#999'}} />
                    <div className="task-info">
                      <div className="task-desc">{e.description}</div>
                      <div className="task-meta">{user?.name} · {comp?.name} · {formatDate(e.date)}</div>
                    </div>
                    <div className="task-time">{formatHours(e.duration_min)}</div>
                    {locked && (
                      <span style={{width:14,height:14,display:'inline-flex',color:'var(--text-secondary)',opacity:0.5}} title="Uzamčeno">
                        {Icons.lock}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =============== INVOICE TAB =============== */}
      {activeTab === 'invoice' && (
        <div>
          {/* Success toast */}
          {invoiceGenerated && (
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'12px 16px',background:'#d1fae5',borderRadius:8,marginBottom:12,fontSize:14,color:'#065f46',fontWeight:500}}>
              <span style={{width:18,height:18,display:'inline-flex'}}>{Icons.check}</span>
              Fakturační podklad vygenerován. Záznamy za toto období jsou uzamčeny.
            </div>
          )}

          {/* Period lock status */}
          {isPeriodLocked ? (
            <div className="card" style={{marginBottom:16,borderColor:'var(--success)',background:'#f0fdf4'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <span style={{width:20,height:20,display:'inline-flex',color:'var(--success)'}}>{Icons.lock}</span>
                <span style={{fontWeight:700,color:'var(--success)'}}>Období uzamčeno</span>
              </div>
              <div style={{fontSize:13,color:'var(--text-secondary)',marginBottom:10}}>
                Období {dateFrom} — {dateTo} bylo vyfakturováno. Záznamy v tomto období nelze editovat ani mazat.
              </div>
              <button className="btn btn-outline btn-sm" onClick={handleDownloadPDFOnly}>
                <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.download}</span> Znovu stáhnout PDF
              </button>
            </div>
          ) : hasOverlappingLock ? (
            <div className="card" style={{marginBottom:16,borderColor:'var(--warning)',background:'#fffbeb'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <span style={{width:20,height:20,display:'inline-flex',color:'var(--warning)'}}>{Icons.lock}</span>
                <span style={{fontWeight:700,color:'#92400e'}}>Částečný překryv</span>
              </div>
              <div style={{fontSize:13,color:'var(--text-secondary)'}}>
                Vybrané období se částečně překrývá s již uzamčeným fakturačním obdobím. Vyberte jiný rozsah.
              </div>
            </div>
          ) : null}

          {/* Invoice summary per company */}
          <div className="section-title" style={{marginTop:4}}>
            Podklad k fakturaci — {dateFrom} až {dateTo}
          </div>

          {filtered.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:24,color:'var(--text-secondary)'}}>
              Žádné záznamy v tomto období
            </div>
          ) : (
            <div>
              {Object.entries(invoiceData).sort((a,b) => {
                const ca = companies.find(c=>c.id===a[0]);
                const cb = companies.find(c=>c.id===b[0]);
                return (ca?.name || '').localeCompare(cb?.name || '');
              }).map(([compId, userData]) => {
                const comp = companies.find(c=>c.id===compId);
                let compTotalMins = 0, compTotalCzk = 0, compTotalDiscountedCzk = 0;
                Object.values(userData).forEach(d => { compTotalMins += d.mins; compTotalCzk += d.czk; compTotalDiscountedCzk += d.discountedCzk; });

                return (
                  <div key={compId} className="card" style={{marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,paddingBottom:10,borderBottom:'1px solid var(--border)'}}>
                      <div style={{width:32,height:32,borderRadius:8,background:comp?.color,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:13}}>
                        {COMPANY_INITIALS[comp?.name] || comp?.name?.charAt(0)}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700}}>{comp?.name}</div>
                        <div style={{fontSize:12,color:'var(--text-secondary)'}}>
                          {Object.keys(userData).length} pracovníků · {formatHours(compTotalMins)}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontWeight:700,fontSize:16}}>{formatCzk(compTotalCzk)} bez DPH</div>
                        <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:3}}>DPH 21%: {formatCzk(dphAmount(compTotalCzk))}</div>
                        <div style={{fontSize:12,fontWeight:600,marginTop:3}}>s DPH: {formatCzk(withDph(compTotalCzk))}</div>
                        {compTotalDiscountedCzk !== compTotalCzk && (
                          <div style={{fontSize:11,color:'var(--success)',marginTop:4,fontWeight:600}}>Po slevě: {formatCzk(compTotalDiscountedCzk)} bez DPH</div>
                        )}
                      </div>
                    </div>

                    {/* Per user breakdown */}
                    {Object.entries(userData).sort((a,b)=>b[1].czk-a[1].czk).map(([uid, data]) => {
                      const user = users.find(u=>u.id===uid);
                      return (
                        <div key={uid} style={{marginBottom:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:13,fontWeight:600,marginBottom:4}}>
                            <span>{user?.name} <span style={{fontWeight:400,color:'var(--text-secondary)'}}>({user?.position}, {user?.hourly_rate?.toLocaleString('cs-CZ')} Kč/h)</span></span>
                            <span>{formatHours(data.mins)} · {formatCzk(data.czk)} bez DPH{data.discountedCzk !== data.czk && <span style={{color:'var(--success)',fontWeight:500}}> · po slevě: {formatCzk(data.discountedCzk)}</span>}</span>
                          </div>
                          {data.entries.sort((a,b)=>a.date.localeCompare(b.date)).map(e => (
                            <div key={e.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-secondary)',padding:'2px 0 2px 12px'}}>
                              <span>{formatDate(e.date)} — {e.description}</span>
                              <span style={{whiteSpace:'nowrap'}}>{formatHours(e.duration_min)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Grand total */}
              <div className="card" style={{marginBottom:16,background:'var(--primary-light)',borderColor:'var(--primary)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:15}}>Celkem za období</div>
                    <div style={{fontSize:13,color:'var(--text-secondary)'}}>{filtered.length} záznamů · {uniqueUsers} pracovníků · {uniqueCompanies} firem</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700,fontSize:18,color:'var(--primary)'}}>{formatCzk(totalCzk)} bez DPH</div>
                    <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:3}}>DPH 21%: {formatCzk(dphAmount(totalCzk))}</div>
                    <div style={{fontWeight:700,fontSize:16,color:'var(--primary)',marginTop:3}}>s DPH: {formatCzk(withDph(totalCzk))}</div>
                    {totalDiscountedCzk !== totalCzk && (
                      <div style={{fontWeight:700,fontSize:15,color:'var(--success)',marginTop:6}}>Po slevě: {formatCzk(totalDiscountedCzk)} bez DPH</div>
                    )}
                    {totalDiscountedCzk !== totalCzk && (
                      <div style={{fontWeight:600,fontSize:13,color:'var(--success)',marginTop:2}}>s DPH: {formatCzk(withDph(totalDiscountedCzk))}</div>
                    )}
                    <div style={{fontSize:12,color:'var(--text-secondary)'}}>{formatHours(totalMins)}</div>
                  </div>
                </div>
              </div>

              {/* User finalization panel — visible to all users */}
              {!isPeriodLocked && !hasOverlappingLock && (
                <div className="card" style={{marginBottom:16,background:'var(--bg)'}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--text-secondary)',marginBottom:12}}>
                    Finalizace pracovníků
                  </div>
                  {(() => {
                    const periodKey = dateFrom + '_' + dateTo;
                    const usersWithEntries = [...new Set(entries.filter(e => e.date >= dateFrom && e.date <= dateTo).map(e => e.user_id))];
                    const finalizedCount = usersWithEntries.filter(uid => userFinalizations[periodKey + '_' + uid]).length;
                    const allFinalized = finalizedCount >= usersWithEntries.length && usersWithEntries.length > 0;
                    const unfinalized = usersWithEntries.filter(uid => !userFinalizations[periodKey + '_' + uid]);
                    return (
                      <div>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                          <div style={{fontSize:13,color:'var(--text-secondary)'}}>
                            {allFinalized ? (
                              <span style={{color:'var(--success)',fontWeight:600}}>Všichni finalizovali</span>
                            ) : (
                              <span>{finalizedCount}/{usersWithEntries.length} pracovníků finalizovalo</span>
                            )}
                          </div>
                          {(currentUser?.is_admin || currentUser?.manager_id === null) && unfinalized.length > 0 && (
                            <button className="btn btn-outline btn-sm" style={{fontSize:11}} onClick={() => {
                              const trackerUrl = window.location.href;
                              const unfinalizedUsers = unfinalized.map(uid => users.find(u => u.id === uid)).filter(Boolean);
                              const emails = unfinalizedUsers.map(u => u.email).join(',');
                              const subject = encodeURIComponent('Jokes Aside – Potvrďte finalizaci výkazů za ' + dateFrom + ' až ' + dateTo);
                              const body = encodeURIComponent(
                                'Dobrý den,\n\n' +
                                'prosím o potvrzení finalizace vašich výkazů za období ' + dateFrom + ' až ' + dateTo + '.\n\n' +
                                'Klikněte na odkaz níže a v sekci Reporty → Fakturace potvrďte, že vaše záznamy jsou finální:\n' +
                                trackerUrl + '\n\n' +
                                'Dokud všichni nepotvrdí, fakturační podklad nelze uzamknout.\n\n' +
                                'Děkuji,\n' + (currentUser?.name || 'Administrátor')
                              );
                              window.open('mailto:' + emails + '?subject=' + subject + '&body=' + body, '_blank');
                            }}>
                              Upomínka e-mailem ({unfinalized.length})
                            </button>
                          )}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
                          {usersWithEntries.map(uid => {
                            const user = users.find(u => u.id === uid);
                            const isFinalized = userFinalizations[periodKey + '_' + uid];
                            const isMe = currentUser?.id === uid;
                            const canToggle = isMe || currentUser?.is_admin;
                            return (
                              <div key={uid} style={{display:'flex',alignItems:'center',gap:8,padding:8,background: isFinalized ? '#f0fdf4' : 'var(--surface)',borderRadius:8,border: isMe ? '1px solid var(--primary)' : '1px solid transparent'}}>
                                <input type="checkbox" checked={isFinalized || false} disabled={!canToggle} onChange={e => {
                                  setUserFinalizations(prev => ({
                                    ...prev,
                                    [periodKey + '_' + uid]: e.target.checked
                                  }));
                                }} style={{cursor: canToggle ? 'pointer' : 'not-allowed',accentColor:'var(--primary)'}} />
                                <span style={{fontSize:13,flex:1,fontWeight: isMe ? 600 : 400}}>
                                  {user?.name || 'Neznámý'}
                                  {isMe && <span style={{fontSize:11,color:'var(--primary)',marginLeft:6}}>(já)</span>}
                                </span>
                                {isFinalized ? (
                                  <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'var(--success)',fontWeight:600}}>
                                    <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.check}</span> Finalizováno
                                  </span>
                                ) : (
                                  <span style={{fontSize:11,color:'var(--text-secondary)'}}>Čeká na potvrzení</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {currentUser?.is_admin && unfinalized.length > 0 && (
                          <button className="btn btn-outline btn-sm" style={{width:'100%',fontSize:12}} onClick={() => {
                            unfinalized.forEach(uid => {
                              setUserFinalizations(prev => ({ ...prev, [periodKey + '_' + uid]: true }));
                            });
                          }}>
                            Schválit za všechny (admin)
                          </button>
                        )}

                        {/* Manager approval section */}
                        {(() => {
                          const myRequest = (approvalRequests||[]).find(ar => ar.user_id === currentUser?.id && ar.period_from === dateFrom && ar.period_to === dateTo);
                          const hasManager = currentUser?.manager_id;
                          const managerName = hasManager ? users.find(u => u.id === currentUser.manager_id)?.name : null;
                          const isFinalized = userFinalizations[periodKey + '_' + currentUser?.id];

                          // Requests I need to review (as manager)
                          const pendingForMe = (approvalRequests||[]).filter(ar => ar.status === 'pending' && ar.period_from === dateFrom && ar.period_to === dateTo && users.find(u => u.id === ar.user_id)?.manager_id === currentUser?.id);

                          return (
                            <div style={{marginTop:12}}>
                              {/* Submit for approval (user with manager) */}
                              {hasManager && isFinalized && !myRequest && (
                                <button className="btn btn-primary btn-sm" style={{width:'100%',marginBottom:8}} onClick={async () => {
                                  if (!window.__supabase) return;
                                  const { data, error } = await window.supabaseRetry(() => window.__supabase.from('approval_requests').insert([{
                                    user_id: currentUser.id, period_from: dateFrom, period_to: dateTo, status: 'pending'
                                  }]).select());
                                  if (!error && data?.[0]) setApprovalRequests(prev => [...prev, data[0]]);
                                }}>
                                  Odeslat ke schválení ({managerName})
                                </button>
                              )}
                              {hasManager && myRequest && (
                                <div style={{padding:8,borderRadius:8,fontSize:12,textAlign:'center',
                                  background: myRequest.status==='approved'?'#f0fdf4': myRequest.status==='rejected'?'#fef2f2':'#fffbeb',
                                  color: myRequest.status==='approved'?'var(--success)': myRequest.status==='rejected'?'var(--danger)':'#b45309',
                                  fontWeight:600,marginBottom:8}}>
                                  {myRequest.status==='pending' && 'Čeká na schválení manažerem'}
                                  {myRequest.status==='approved' && 'Schváleno manažerem'}
                                  {myRequest.status==='rejected' && ('Zamítnuto: ' + (myRequest.note || 'bez důvodu'))}
                                </div>
                              )}

                              {/* Review section for managers */}
                              {pendingForMe.length > 0 && (
                                <div style={{marginTop:8,padding:12,background:'#fffbeb',borderRadius:8,border:'1px solid #fbbf24'}}>
                                  <div style={{fontWeight:600,fontSize:13,marginBottom:8,color:'#b45309'}}>Ke schválení ({pendingForMe.length})</div>
                                  {pendingForMe.map(ar => {
                                    const arUser = users.find(u => u.id === ar.user_id);
                                    return (
                                      <div key={ar.id} style={{display:'flex',alignItems:'center',gap:8,padding:8,background:'white',borderRadius:6,marginBottom:6}}>
                                        <span style={{flex:1,fontSize:13,fontWeight:500}}>{arUser?.name || 'Neznámý'}</span>
                                        <button className="btn btn-sm" style={{background:'var(--success)',color:'white',fontSize:11,padding:'4px 10px',border:'none',borderRadius:6,cursor:'pointer'}} onClick={async () => {
                                          if (!window.__supabase) return;
                                          const { error: approveErr } = await window.supabaseRetry(() => window.__supabase.from('approval_requests').update({status:'approved',reviewed_at:new Date().toISOString(),reviewer_id:currentUser.id}).eq('id',ar.id).select());
                                          if (approveErr) console.error('Approval update failed:', approveErr);
                                          setApprovalRequests(prev => prev.map(a => a.id===ar.id ? {...a,status:'approved',reviewer_id:currentUser.id} : a));
                                        }}>Schválit</button>
                                        <button className="btn btn-sm" style={{background:'var(--danger)',color:'white',fontSize:11,padding:'4px 10px',border:'none',borderRadius:6,cursor:'pointer'}} onClick={async () => {
                                          const note = prompt('Důvod zamítnutí:');
                                          if (note === null) return;
                                          if (!window.__supabase) return;
                                          const { error: rejectErr } = await window.supabaseRetry(() => window.__supabase.from('approval_requests').update({status:'rejected',reviewed_at:new Date().toISOString(),reviewer_id:currentUser.id,note}).eq('id',ar.id).select());
                                          if (rejectErr) console.error('Rejection update failed:', rejectErr);
                                          setApprovalRequests(prev => prev.map(a => a.id===ar.id ? {...a,status:'rejected',reviewer_id:currentUser.id,note} : a));
                                        }}>Zamítnout</button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Generate / Lock button */}
              {!isPeriodLocked && !hasOverlappingLock && currentUser?.is_admin && (
                <div>
                  <div style={{display:'flex',gap:8,marginBottom:8}}>
                    <button className="btn btn-outline" style={{flex:1}} onClick={handleDownloadPDFOnly}>
                      <span style={{width:16,height:16,display:'inline-flex'}}>{Icons.download}</span> Stáhnout podklady k fakturaci (PDF)
                    </button>
                  </div>
                  {(() => {
                    const usersInPeriod = [...new Set(entries.filter(e => e.date >= dateFrom && e.date <= dateTo).map(e => e.user_id))];
                    const usersNeedingApproval = usersInPeriod.filter(uid => {
                      const u = users.find(u2 => u2.id === uid);
                      return u?.manager_id;
                    });
                    const allApproved = usersNeedingApproval.every(uid => 
                      (approvalRequests||[]).some(ar => ar.user_id === uid && ar.period_from === dateFrom && ar.period_to === dateTo && ar.status === 'approved')
                    );
                    const periodKey = dateFrom + '_' + dateTo;
                    const usersWithEntries = [...new Set(entries.filter(e => e.date >= dateFrom && e.date <= dateTo).map(e => e.user_id))];
                    const finalizedCount = usersWithEntries.filter(uid => userFinalizations[periodKey + '_' + uid]).length;
                    const allFinalized = finalizedCount >= usersWithEntries.length && usersWithEntries.length > 0;
                    if (!allFinalized) return <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:4}}>Pro uzamčení období musí být všechny výkazy finalizované ({finalizedCount}/{usersWithEntries.length}).</div>;
                    if (!allApproved && usersNeedingApproval.length > 0) return <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:4}}>Pro uzamčení období musí být schváleny všechny approval requesty.</div>;
                    return showInvoiceConfirm ? (
                      <div className="card" style={{borderColor:'var(--danger)',background:'#fef2f2',marginTop:8}}>
                        <div style={{fontWeight:600,marginBottom:8,color:'var(--danger)'}}>
                          <span style={{width:16,height:16,display:'inline-flex',verticalAlign:'middle',marginRight:6}}>{Icons.lock}</span>
                          Opravdu uzamknout období?
                        </div>
                        <div style={{fontSize:13,color:'var(--text-secondary)',marginBottom:12}}>
                          Po vygenerování fakturačního podkladu se uzamknou všechny záznamy za období {dateFrom} — {dateTo}. Pracovníci je již nebudou moci zpětně editovat ani mazat. Tato akce je nevratná.
                        </div>
                        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                          <button className="btn btn-outline btn-sm" onClick={()=>setShowInvoiceConfirm(false)}>Zrušit</button>
                          <button className="btn btn-danger btn-sm" onClick={handleGenerateInvoice}>
                            <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.lock}</span> Uzamknout a vygenerovat
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-primary" style={{width:'100%',marginTop:8}} onClick={()=>setShowInvoiceConfirm(true)}>
                        <span style={{width:16,height:16,display:'inline-flex'}}>{Icons.lock}</span> Uzamknout období
                      </button>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
          {/* Existing locks list */}
          {billingLocks.length > 0 && (
            <div style={{marginTop:20}}>
              <div className="section-title">Uzamčená období</div>
              {billingLocks.sort((a,b)=>b.date_from.localeCompare(a.date_from)).map(lock => (
                <div key={lock.id} className="task-item" style={{marginBottom:4}}>
                  <span style={{width:16,height:16,display:'inline-flex',color:'var(--success)',flexShrink:0}}>{Icons.lock}</span>
                  <div className="task-info">
                    <div className="task-desc">{lock.date_from} — {lock.date_to}</div>
                    <div className="task-meta">Uzamknul/a {users.find(u=>u.id===lock.generated_by)?.name || 'Neznámý'} · {new Date(lock.generated_at).toLocaleDateString('cs-CZ')} {new Date(lock.generated_at).toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                  <span className="badge badge-success">Uzamčeno</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

