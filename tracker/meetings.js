// ==================== MEETINGS PAGE ====================
function MeetingsPage({ companies, users, currentUser, recurringMeetings, setRecurringMeetings, entries, createNotifications }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showInactive, setShowInactive] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // New meeting form state
  const [newDesc, setNewDesc] = useState('');
  const [newCompanies, setNewCompanies] = useState([]);
  const [newParticipants, setNewParticipants] = useState([]);
  const [newFreq, setNewFreq] = useState('weekly');
  const [newDay, setNewDay] = useState(1);
  const [newDayOfMonth, setNewDayOfMonth] = useState(1);
  const [newDuration, setNewDuration] = useState(60);
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().slice(0,10));
  const [newEndDate, setNewEndDate] = useState('');
  const [newIndefinite, setNewIndefinite] = useState(true);

  const activeMeetings = recurringMeetings.filter(m => m.isActive);
  const inactiveMeetings = recurringMeetings.filter(m => !m.isActive);

  const freqLabels = { daily: 'DennÄ', weekly: 'TÃ½dnÄ', monthly: 'MÄsÃ­ÄnÄ' };
  const dayLabels = ['Ne','Po','Ãt','St','Ät','PÃ¡','So'];

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditForm({
      description: m.description,
      companyIds: [...m.companyIds],
      participantIds: [...m.participantIds],
      frequency: m.frequency,
      dayOfWeek: m.dayOfWeek,
      dayOfMonth: m.dayOfMonth,
      durationMin: m.durationMin,
      startDate: m.startDate,
      endDate: m.endDate || '',
      indefinite: !m.endDate,
    });
  };

  const saveEdit = async () => {
    const dbData = {
      description: editForm.description,
      company_ids: editForm.companyIds,
      participant_ids: editForm.participantIds,
      frequency: editForm.frequency,
      day_of_week: editForm.frequency === 'weekly' ? editForm.dayOfWeek : 0,
      day_of_month: editForm.frequency === 'monthly' ? editForm.dayOfMonth : 1,
      duration_min: editForm.durationMin,
      start_date: editForm.startDate,
      end_date: editForm.indefinite ? null : editForm.endDate,
    };
    try {
      const sb = window.__supabase;
      if (sb) {
        const { error } = await sb.from('recurring_meetings').update(dbData).eq('id', editingId);
        if (error) throw error;
      }
      setRecurringMeetings(recurringMeetings.map(m => m.id === editingId ? {
        ...m, ...editForm,
        dayOfWeek: dbData.day_of_week,
        dayOfMonth: dbData.day_of_month,
        endDate: dbData.end_date,
      } : m));
      setEditingId(null);
    } catch (err) {
      alert('Chyba pÅi uklÃ¡dÃ¡nÃ­: ' + err.message);
    }
  };

  const deleteMeeting = async (id) => {
    if (!confirm('Opravdu chcete smazat tento meeting? JiÅ¾ vygenerovanÃ© zÃ¡znamy zÅ¯stanou.')) return;
    try {
      const sb = window.__supabase;
      if (sb) {
        const { error } = await sb.from('recurring_meetings').delete().eq('id', id);
        if (error) throw error;
      }
      setRecurringMeetings(recurringMeetings.filter(m => m.id !== id));
    } catch (err) {
      alert('Chyba pÅi mazÃ¡nÃ­: ' + err.message);
    }
  };

  const deactivateMeeting = async (id) => {
    try {
      const sb = window.__supabase;
      if (sb) await sb.from('recurring_meetings').update({ is_active: false }).eq('id', id);
      setRecurringMeetings(recurringMeetings.map(m => m.id === id ? { ...m, isActive: false } : m));
    } catch (err) { alert('Chyba: ' + err.message); }
  };

  const reactivateMeeting = async (id) => {
    try {
      const sb = window.__supabase;
      if (sb) await sb.from('recurring_meetings').update({ is_active: true }).eq('id', id);
      setRecurringMeetings(recurringMeetings.map(m => m.id === id ? { ...m, isActive: true } : m));
    } catch (err) { alert('Chyba: ' + err.message); }
  };

  const createMeeting = async () => {
    const missing = [];
    if (!newDesc) missing.push('Popis');
    if (newCompanies.length === 0) missing.push('Firmy');
    if (!newStartDate) missing.push('Datum zaÄÃ¡tku');
    if (missing.length > 0) { alert('VyplÅte prosÃ­m: ' + missing.join(', ')); return; }
    const allParts = [currentUser.id, ...newParticipants.filter(id => id !== currentUser.id)];
    const meetingData = {
      description: newDesc,
      company_ids: newCompanies,
      participant_ids: allParts,
      confirmed_participant_ids: [currentUser.id],
      author_id: currentUser.id,
      frequency: newFreq,
      day_of_week: newFreq === 'weekly' ? newDay : 0,
      day_of_month: newFreq === 'monthly' ? newDayOfMonth : 1,
      duration_min: newDuration,
      start_date: newStartDate,
      end_date: newIndefinite ? null : newEndDate,
      is_active: true,
    };
    try {
      const sb = window.__supabase;
      if (sb) {
        const { data, error } = await sb.from('recurring_meetings').insert([meetingData]).select();
        if (error) throw error;
        if (data) {
          const md = data[0];
          setRecurringMeetings([...recurringMeetings, {...md, companyIds: md.company_ids||[], participantIds: md.participant_ids||[], confirmedParticipantIds: md.confirmed_participant_ids||[], authorId: md.author_id, dayOfWeek: md.day_of_week??0, dayOfMonth: md.day_of_month??1, durationMin: md.duration_min||60, startDate: md.start_date, endDate: md.end_date, isActive: md.is_active??true}]);
          // Create in-app notifications for participants
          const compNames = newCompanies.map(cid => companies.find(c => c.id === cid)?.name).filter(Boolean).join(', ');
          createNotifications(allParts, md.id, 'recurring_meeting', 'PozvÃ¡nka: ' + newDesc, 'Byli jste pÅidÃ¡ni k opakovanÃ©mu tasku pro ' + compNames + '. PotvrÄte prosÃ­m svoji ÃºÄast.');
        }
      }
      setNewDesc(''); setNewCompanies([]); setNewParticipants([]); setNewFreq('weekly');
      setNewDay(1); setNewDayOfMonth(1); setNewDuration(60);
      setNewStartDate(new Date().toISOString().slice(0,10)); setNewEndDate(''); setNewIndefinite(true);
      setShowNew(false);
    } catch (err) { alert('Chyba pÅi uklÃ¡dÃ¡nÃ­: ' + err.message); }
  };

  const renderMeetingCard = (m) => {
    const companyNames = (m.companyIds||[]).map(cid => companies.find(c => c.id === cid)?.name).filter(Boolean);
    const participantNames = (m.participantIds||[]).map(uid => users.find(u => u.id === uid)?.name).filter(Boolean);
    const authorName = users.find(u => u.id === m.authorId)?.name || '';
    const isEditing = editingId === m.id;
    const meetingEntries = entries.filter(e => e.recurring_meeting_id === m.id);
    const totalMin = meetingEntries.reduce((sum, e) => sum + (e.duration_min || 0), 0);

    if (isEditing) {
      return (
        <div key={m.id} className="card" style={{marginBottom:16,padding:20}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>Upravit meeting</div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>Popis</label>
            <input className="input" value={editForm.description} onChange={e=>setEditForm({...editForm, description:e.target.value})} style={{width:'100%'}} />
          </div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>Firmy</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {companies.filter(c=>c.is_active!==false).map(c=>(
                <button key={c.id} className="btn btn-sm" style={{padding:'4px 10px',fontSize:12,borderRadius:16,background:editForm.companyIds.includes(c.id)?'var(--primary)':'var(--surface)',color:editForm.companyIds.includes(c.id)?'#fff':'var(--text)',border:'1px solid var(--border)'}} onClick={()=>{
                  setEditForm({...editForm, companyIds: editForm.companyIds.includes(c.id) ? editForm.companyIds.filter(id=>id!==c.id) : [...editForm.companyIds, c.id]});
                }}>{c.name}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>ÃÄastnÃ­ci</label>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {users.map(u=>(
                <label key={u.id} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
                  <input type="checkbox" checked={editForm.participantIds.includes(u.id)} onChange={e=>{
                    setEditForm({...editForm, participantIds: e.target.checked ? [...editForm.participantIds, u.id] : editForm.participantIds.filter(id=>id!==u.id)});
                  }} />
                  {u.name}
                </label>
              ))}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>Frekvence</label>
              <select className="input" value={editForm.frequency} onChange={e=>setEditForm({...editForm, frequency:e.target.value})}>
                <option value="daily">DennÄ</option><option value="weekly">TÃ½dnÄ</option><option value="monthly">MÄsÃ­ÄnÄ</option>
              </select>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>DÃ©lka (min)</label>
              <select className="input" value={editForm.durationMin} onChange={e=>setEditForm({...editForm, durationMin:parseInt(e.target.value)})}>
                <option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>1 hod</option><option value={90}>1.5 hod</option><option value={120}>2 hod</option><option value={180}>3 hod</option><option value={240}>4 hod</option>
              </select>
            </div>
          </div>
          {editForm.frequency === 'weekly' && (
            <div style={{marginBottom:10}}>
              <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>Den</label>
              <div style={{display:'flex',gap:4}}>
                {[1,2,3,4,5].map(d=>(<button key={d} className="btn btn-sm" style={{padding:'4px 10px',fontSize:12,background:editForm.dayOfWeek===d?'var(--primary)':'var(--surface)',color:editForm.dayOfWeek===d?'#fff':'var(--text)',border:'1px solid var(--border)'}} onClick={()=>setEditForm({...editForm,dayOfWeek:d})}>{dayLabels[d]}</button>))}
              </div>
            </div>
          )}
          <div style={{marginBottom:10}}>
            <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>Platnost</label>
            <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
              <input className="input" type="date" value={editForm.startDate} onChange={e=>setEditForm({...editForm,startDate:e.target.value})} style={{flex:1}} />
              <span style={{fontSize:12,color:'var(--text-secondary)'}}>â</span>
              <input className="input" type="date" value={editForm.indefinite?'':editForm.endDate} onChange={e=>setEditForm({...editForm,endDate:e.target.value})} disabled={editForm.indefinite} style={{flex:1,opacity:editForm.indefinite?0.4:1}} />
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
              <input type="checkbox" checked={editForm.indefinite} onChange={e=>setEditForm({...editForm,indefinite:e.target.checked})} /> Dokud nezruÅ¡Ã­m
            </label>
          </div>
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button className="btn btn-primary" style={{flex:1}} onClick={saveEdit}>UloÅ¾it</button>
            <button className="btn" style={{flex:1,border:'1px solid var(--border)'}} onClick={()=>setEditingId(null)}>ZruÅ¡it</button>
          </div>
        </div>
      );
    }

    return (
      <div key={m.id} className="card" style={{marginBottom:12,padding:16,opacity:m.isActive?1:0.6}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{m.description}</div>
            <div style={{fontSize:13,color:'var(--text-secondary)',marginBottom:4}}>
              {freqLabels[m.frequency] || m.frequency}
              {m.frequency === 'weekly' && (' Â· ' + (dayLabels[m.dayOfWeek] || ''))}
              {' Â· '}{m.durationMin < 60 ? m.durationMin + ' min' : (m.durationMin/60) + ' hod'} na firmu
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:6}}>
              {companyNames.map((name,i)=>(<span key={i} style={{fontSize:11,padding:'2px 8px',borderRadius:12,background:'var(--primary-bg)',color:'var(--primary)',fontWeight:600}}>{name}</span>))}
            </div>
            <div style={{fontSize:12,color:'var(--text-secondary)'}}>
              ÃÄastnÃ­ci: {participantNames.join(', ')}
            </div>
            <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:4}}>
              {m.startDate && ('Od ' + formatDate(m.startDate))} {m.endDate ? (' do ' + formatDate(m.endDate)) : ' Â· Dokud nezruÅ¡Ã­m'}
              {authorName && (' Â· VytvoÅil: ' + authorName)}
            </div>
            {totalMin > 0 && (
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>
                Celkem zalogovÃ¡no: {formatHours(totalMin)}
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:6,marginLeft:8,flexShrink:0}}>
            <button className="btn btn-sm" title="Upravit" style={{padding:'6px 8px',border:'1px solid var(--border)',borderRadius:6,background:'var(--surface)',fontSize:12}} onClick={()=>startEdit(m)}>
              <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.edit}</span>
            </button>
            {m.isActive ? (
              <button className="btn btn-sm" title="Pozastavit" style={{padding:'6px 8px',border:'1px solid var(--warning)',borderRadius:6,background:'var(--surface)',color:'var(--warning)',fontSize:12}} onClick={()=>deactivateMeeting(m.id)}>â¸</button>
            ) : (
              <button className="btn btn-sm" title="Obnovit" style={{padding:'6px 8px',border:'1px solid var(--success)',borderRadius:6,background:'var(--surface)',color:'var(--success)',fontSize:12}} onClick={()=>reactivateMeeting(m.id)}>â¶</button>
            )}
            <button className="btn btn-sm" title="Smazat" style={{padding:'6px 8px',border:'1px solid var(--danger)',borderRadius:6,background:'var(--surface)',color:'var(--danger)',fontSize:12}} onClick={()=>deleteMeeting(m.id)}>
              <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.trash}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div className="section-title" style={{margin:0}}>OpakovanÃ© tasky</div>
        <button className="btn btn-primary" style={{padding:'8px 16px',fontSize:13}} onClick={()=>setShowNew(!showNew)}>
          {showNew ? 'ZruÅ¡it' : '+ NovÃ½ task'}
        </button>
      </div>

      {showNew && (
        <div className="card" style={{marginBottom:16,padding:20}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>NovÃ½ pravidelnÃ½ meeting</div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>Popis</label>
            <input className="input" value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="NÃ¡zev opakovanÃ©ho tasku" style={{width:'100%'}} />
          </div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>Firmy</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {companies.filter(c=>c.is_active!==false).map(c=>(
                <button key={c.id} className="btn btn-sm" style={{padding:'4px 10px',fontSize:12,borderRadius:16,background:newCompanies.includes(c.id)?'var(--primary)':'var(--surface)',color:newCompanies.includes(c.id)?'#fff':'var(--text)',border:'1px solid var(--border)'}} onClick={()=>{
                  setNewCompanies(newCompanies.includes(c.id) ? newCompanies.filter(id=>id!==c.id) : [...newCompanies, c.id]);
                }}>{c.name}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>ÃÄastnÃ­ci</label>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {users.map(u=>(
                <label key={u.id} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:u.id===currentUser?.id?'not-allowed':'pointer'}}>
                  <input type="checkbox" checked={newParticipants.includes(u.id)||u.id===currentUser?.id} disabled={u.id===currentUser?.id} onChange={e=>{
                    if(u.id===currentUser?.id) return;
                    setNewParticipants(e.target.checked ? [...newParticipants, u.id] : newParticipants.filter(id=>id!==u.id));
                  }} />
                  {u.name} {u.id===currentUser?.id && '(vy)'}
                </label>
              ))}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>Frekvence</label>
              <select className="input" value={newFreq} onChange={e=>setNewFreq(e.target.value)}>
                <option value="daily">DennÄ</option><option value="weekly">TÃ½dnÄ</option><option value="monthly">MÄsÃ­ÄnÄ</option>
              </select>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>DÃ©lka (min)</label>
              <select className="input" value={newDuration} onChange={e=>setNewDuration(parseInt(e.target.value))}>
                <option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>1 hod</option><option value={90}>1.5 hod</option><option value={120}>2 hod</option><option value={180}>3 hod</option><option value={240}>4 hod</option>
              </select>
            </div>
          </div>
          {newFreq === 'weekly' && (
            <div style={{marginBottom:10}}>
              <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>Den</label>
              <div style={{display:'flex',gap:4}}>
                {[1,2,3,4,5].map(d=>(<button key={d} className="btn btn-sm" style={{padding:'4px 10px',fontSize:12,background:newDay===d?'var(--primary)':'var(--surface)',color:newDay===d?'#fff':'var(--text)',border:'1px solid var(--border)'}} onClick={()=>setNewDay(d)}>{dayLabels[d]}</button>))}
              </div>
            </div>
          )}
          <div style={{marginBottom:10}}>
            <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4}}>Platnost</label>
            <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
              <input className="input" type="date" value={newStartDate} onChange={e=>setNewStartDate(e.target.value)} style={{flex:1}} />
              <span style={{fontSize:12,color:'var(--text-secondary)'}}>â</span>
              <input className="input" type="date" value={newIndefinite?'':newEndDate} onChange={e=>setNewEndDate(e.target.value)} disabled={newIndefinite} style={{flex:1,opacity:newIndefinite?0.4:1}} />
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
              <input type="checkbox" checked={newIndefinite} onChange={e=>setNewIndefinite(e.target.checked)} /> Dokud nezruÅ¡Ã­m
            </label>
          </div>
          <button className="btn btn-primary" style={{width:'100%'}} onClick={createMeeting}>VytvoÅit meeting</button>
        </div>
      )}

      {activeMeetings.length === 0 && !showNew && (
        <div className="card" style={{padding:32,textAlign:'center',color:'var(--text-secondary)'}}>
          ZatÃ­m nemÃ¡te Å¾Ã¡dnÃ© opakovanÃ© tasky. KliknÄte na "+ NovÃ½ task" pro vytvoÅenÃ­.
        </div>
      )}

      {activeMeetings.map(m => renderMeetingCard(m))}

      {inactiveMeetings.length > 0 && (
        <div style={{marginTop:24}}>
          <button className="btn btn-sm" style={{fontSize:12,color:'var(--text-secondary)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 12px'}} onClick={()=>setShowInactive(!showInactive)}>
            {showInactive ? 'SkrÃ½t' : 'Zobrazit'} neaktivnÃ­ ({inactiveMeetings.length})
          </button>
          {showInactive && (
            <div style={{marginTop:12}}>
              {inactiveMeetings.map(m => renderMeetingCard(m))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

