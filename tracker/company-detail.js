// ==================== COMPANY DETAIL ====================
function CompanyDetail({ company, users, entries, getCompanyBudget, onBack, onDeleteEntry, onUpdateEntry, companies, currentUser, isEntryLocked, recurringMeetings }) {
  if (!company) return <div>Firmu se nepodaÅilo naÄÃ­st</div>;

  const month = currentMonthKey();
  const budget = getCompanyBudget(company.id, month);
  const companyEntries = entries.filter(e => e.company_id === company.id).sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));

  const grouped = {};
  companyEntries.forEach(e => {
    const mk = getMonthKey(e.date);
    if (!grouped[mk]) grouped[mk] = [];
    grouped[mk].push(e);
  });

  const monthEntries = companyEntries.filter(e => getMonthKey(e.date) === month);
  const peopleSummary = {};
  monthEntries.forEach(e => {
    if (!peopleSummary[e.user_id]) peopleSummary[e.user_id] = { mins: 0, czk: 0 };
    const user = users.find(u => u.id === e.user_id);
    peopleSummary[e.user_id].mins += e.duration_min;
    if (user) peopleSummary[e.user_id].czk += (e.duration_min / 60) * user.hourly_rate;
  });

  const progressColor = budget.pct > 90 ? 'var(--danger)' : budget.pct > 70 ? 'var(--warning)' : 'var(--success)';

  return (
    <div>
      <button className="back-btn" onClick={onBack}>
        <span style={{width:18,height:18,display:'inline-flex'}}>{Icons.back}</span> ZpÄt
      </button>

      <div className="detail-header">
        <div className="detail-logo" style={{background: company.color}}>
          {COMPANY_INITIALS[company.name] || company.name.charAt(0)}
        </div>
        <div>
          <div className="detail-title">{company.name}</div>
          <div className="detail-subtitle">
            {company.legal_name || 'Firmu'}
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-value" style={{color: 'var(--primary)'}}>{formatCzk(budget.total)}</div>
          <div className="stat-label">CelkovÃ½ kredit bez DPH</div>
        </div>
        <div className="stat-box">
          <div className="stat-value" style={{color: 'var(--warning)'}}>{formatCzk(budget.used)}</div>
          <div className="stat-label">VyÄerpÃ¡no bez DPH</div>
        </div>
        {budget.total > 0 && (
          <div className="stat-box">
            <div className="stat-value" style={{color: budget.remaining >= 0 ? 'var(--success)' : 'var(--danger)'}}>
              {formatCzk(Math.abs(budget.remaining))}
            </div>
            <div className="stat-label">{budget.remaining >= 0 ? 'ZbÃ½vÃ¡' : 'PÅeÄerpÃ¡no'}</div>
          </div>
        )}
      </div>

      <div className="progress-bar" style={{height:8,marginBottom:16}}>
        <div className="progress-fill" style={{width: budget.pct+'%', background: progressColor}} />
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div className="section-title">LidÃ© tento mÄsÃ­c</div>
        {Object.entries(peopleSummary).map(([uid, data]) => {
          const user = users.find(u => u.id === uid);
          if (!user) return null;
          const colors = ['#6366f1','#f97316','#10b981','#8b5cf6','#ec4899','#06b6d4'];
          const ci = users.indexOf(user) % colors.length;
          return (
            <div key={uid} className="person-row">
              <div className="person-avatar" style={{background: colors[ci]}}>{user.name.charAt(0)}</div>
              <div className="person-info">
                <div className="person-name">{user.name}</div>
                <div className="person-role">{user.position} Â· {formatCzk(data.czk)} bez DPH</div>
              </div>
              <div className="person-hours">{formatHours(data.mins)}</div>
            </div>
          );
        })}
      </div>

      {/* Recurring meetings for this company */}
      {(recurringMeetings || []).filter(m => {
        const isActive = m.isActive ?? m.is_active;
        const compIds = m.companyIds || m.company_ids || [];
        return isActive && compIds.includes(company.id);
      }).length > 0 && (
        <div className="card" style={{marginBottom:16}}>
          <div className="section-title">OpakovanÃ© tasky</div>
          {(recurringMeetings || []).filter(m => {
            const isActive = m.isActive ?? m.is_active;
            const compIds = m.companyIds || m.company_ids || [];
            return isActive && compIds.includes(company.id);
          }).map(m => {
            const freqLabel = m.frequency === 'daily' ? 'DennÄ' : m.frequency === 'weekly' ? 'TÃ½dnÄ' : 'MÄsÃ­ÄnÄ';
            const dayLabel = m.frequency === 'weekly' ? ['Ne','Po','Ãt','St','Ät','PÃ¡','So'][m.dayOfWeek ?? m.day_of_week ?? 0] : '';
            const dur = m.durationMin || m.duration_min || 60;
            const partIds = m.participantIds || m.participant_ids || [];
            const partNames = partIds.map(pid => users.find(u => u.id === pid)?.name).filter(Boolean).join(', ');
            return (
              <div key={m.id} className="person-row">
                <div className="person-avatar" style={{background:'var(--primary)'}}>ð</div>
                <div className="person-info">
                  <div className="person-name">{m.description}</div>
                  <div className="person-role">{freqLabel}{dayLabel ? ' Â· ' + dayLabel : ''} Â· {dur < 60 ? dur + ' min' : (dur/60) + ' hod'}</div>
                  {partNames && <div className="person-role" style={{fontSize:11, color:'var(--text-secondary)'}}>{partNames}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {Object.entries(grouped).sort((a,b) => b[0].localeCompare(a[0])).map(([mk, items]) => {
        const monthTotal = items.reduce((s,e) => s+e.duration_min, 0);
        let monthCzk = 0;
        items.forEach(e => { const u = users.find(u=>u.id===e.user_id); if(u) monthCzk += (e.duration_min/60)*u.hourly_rate; });
        return (
          <div key={mk} className="month-group">
            <div className="month-header">
              <span>{getMonthLabel(mk)}</span>
              <span>{formatHours(monthTotal)} Â· {formatCzk(monthCzk)} bez DPH</span>
            </div>
            <div className="task-list">
              {items.map(e => (
                <EditableTaskItem
                  key={e.id} entry={e} companies={companies} users={users}
                  currentUser={currentUser} onUpdate={onUpdateEntry} onDelete={onDeleteEntry}
                  showUser={true} isLocked={isEntryLocked(e)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==================== EDITABLE TASK ITEM ====================
function EditableTaskItem({ entry, companies, users, currentUser, onUpdate, onDelete, showUser, isLocked }) {
  const [editing, setEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(entry.description);
  const [editCompany, setEditCompany] = useState(entry.company_id);
  const [editHours, setEditHours] = useState(String(Math.floor(entry.duration_min / 60)));
  const [editMins, setEditMins] = useState(String(entry.duration_min % 60));
  const [editDate, setEditDate] = useState(entry.date);

  const comp = companies.find(c => c.id === entry.company_id);
  const user = users.find(u => u.id === entry.user_id);
  const isOwner = currentUser && entry.user_id === currentUser.id;
  const isManager = currentUser && entry.user_id !== currentUser.id && users.find(u => u.id === entry.user_id)?.manager_id === currentUser.id;
  const canEdit = (isOwner || currentUser?.is_admin || isManager) && !isLocked;

  const handleSave = () => {
    const totalMins = (parseInt(editHours)||0)*60 + (parseInt(editMins)||0);
    if (totalMins < 15) { alert('MinimÃ¡lnÃ­ dÃ©lka tasku je 15 minut'); return; }
    if (!editDesc.trim()) return;
    onUpdate(entry.id, {
      description: editDesc.trim(),
      company_id: editCompany,
      duration_min: totalMins,
      date: editDate,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditDesc(entry.description);
    setEditCompany(entry.company_id);
    setEditHours(String(Math.floor(entry.duration_min / 60)));
    setEditMins(String(entry.duration_min % 60));
    setEditDate(entry.date);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="card" style={{padding:12, marginBottom:4, background:'var(--primary-light)', border:'1px solid var(--primary)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:600,color:'var(--primary)'}}>Upravit zÃ¡znam</span>
          <button className="btn-icon" onClick={handleCancel} title="ZruÅ¡it" style={{width:28,height:28}}>
            <span style={{width:16,height:16,display:'inline-flex'}}>{Icons.x}</span>
          </button>
        </div>
        <input className="input" value={editDesc} onChange={e=>setEditDesc(e.target.value)} placeholder="Popis" style={{marginBottom:8}} />
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
          {companies.map(c => (
            <button key={c.id} className={`company-pill ${editCompany===c.id?'selected':''}`}
              onClick={()=>setEditCompany(c.id)}
              style={{fontSize:12,padding:'5px 10px',...(editCompany===c.id?{borderColor:c.color,background:c.color+'15',color:c.color}:{})}}>
              {c.name}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10}}>
          <div className="time-input-group">
            <input className="input time-input" type="number" min="0" value={editHours} onChange={e=>setEditHours(e.target.value)} style={{width:48}} />
            <span style={{fontSize:12,color:'var(--text-secondary)'}}>h</span>
            <input className="input time-input" type="number" min="0" max="59" value={editMins} onChange={e=>setEditMins(e.target.value)} style={{width:48}} />
            <span style={{fontSize:12,color:'var(--text-secondary)'}}>m</span>
          </div>
          <input className="input" type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} style={{width:140,fontSize:13}} />
        </div>
        <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
          <button className="btn btn-outline btn-sm" onClick={handleCancel}>ZruÅ¡it</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>UloÅ¾it</button>
        </div>
      </div>
    );
  }

  return (
    <div className="task-item">
      <div className="task-dot" style={{background: comp?.color || '#999'}} />
      <div className="task-info">
        <div className="task-desc">{entry.description}</div>
        <div className="task-meta">
          {showUser && user ? `${user.name} Â· ` : ''}{comp?.name} Â· {formatDate(entry.date)} {entry.is_manual && 'Â· ruÄnÃ­'}{entry.updated_at && ` Â· editovÃ¡no ${new Date(entry.updated_at).toLocaleString('cs-CZ',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`}
        </div>
      </div>
      <div className="task-time">{formatHours(entry.duration_min)}</div>
      {isLocked ? (
        <div title="UzamÄeno â vyfakturovÃ¡no" style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-secondary)',opacity:0.5}}>
          <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.lock}</span>
        </div>
      ) : canEdit ? (
        <div style={{display:'flex',gap:2}}>
          <button className="btn-icon" onClick={() => setEditing(true)} title="Upravit" style={{width:28,height:28,color:'var(--text-secondary)'}}>
            <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.edit}</span>
          </button>
          <button className="delete-btn" onClick={() => onDelete(entry.id)} title="Smazat" style={{width:28,height:28}}>
            <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.trash}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

