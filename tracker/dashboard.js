// ==================== DASHBOARD ====================
function Dashboard({ companies, users, entries, getCompanyBudget, onSelectCompany, timerRunning, timerCompany, timerDesc, timerElapsed, onStartTimer, onStopTimer, onAddManual, currentUser, recurringMeetings, setRecurringMeetings, createNotifications }) {
  const month = currentMonthKey();
  const [quickCompanies, setQuickCompanies] = useState([]);
  const [quickDesc, setQuickDesc] = useState('');
  const [manualHours, setManualHours] = useState('');
  const [manualMins, setManualMins] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0,10));
  const [dashTimeFrom, setDashTimeFrom] = useState('');
  const [dashTimeTo, setDashTimeTo] = useState('');
  const [dashParticipants, setDashParticipants] = useState([]);
  const [showDashSuggestions, setShowDashSuggestions] = useState(false);
  const dashDescRef = useRef(null);

  // Meeting form state
  const [dashMode, setDashMode] = useState('task');
  const [meetingDesc, setMeetingDesc] = useState('');
  const [meetingCompanies, setMeetingCompanies] = useState([]);
  const [meetingFreq, setMeetingFreq] = useState('weekly');
  const [meetingDay, setMeetingDay] = useState(1);
  const [meetingDayOfMonth, setMeetingDayOfMonth] = useState(1);
  const [meetingDuration, setMeetingDuration] = useState(60);
  const [meetingParticipants, setMeetingParticipants] = useState([]);
  const [meetingStartDate, setMeetingStartDate] = useState(new Date().toISOString().slice(0,10));
  const [meetingEndDate, setMeetingEndDate] = useState('');
  const [meetingIndefinite, setMeetingIndefinite] = useState(true);
  const [editingMeeting, setEditingMeeting] = useState(null);

  const dashSuggestions = useMemo(() => {
    if (!quickDesc || quickDesc.length < 2) return [];
    const seen = new Set();
    return entries.filter(e => e.user_id === currentUser?.id && e.description.toLowerCase().includes(quickDesc.toLowerCase()))
      .map(e => e.description).filter(d => { if (seen.has(d)) return false; seen.add(d); return true; }).slice(0, 5);
  }, [quickDesc, entries, currentUser]);

  const handleStartTimer = () => {
    if (quickCompanies.length === 0 || !quickDesc) return;
    onStartTimer(quickCompanies[0], quickDesc);
  };
  const handleManualAdd = () => {
    if (quickCompanies.length === 0 || !quickDesc) return;
    const totalMins = (parseInt(manualHours)||0)*60 + (parseInt(manualMins)||0);
    if (totalMins < 15) { alert('MinimÃ¡lnÃ­ dÃ©lka tasku je 15 minut'); return; }
    const participantIds = dashParticipants.length > 0 ? dashParticipants : [currentUser.id];
    participantIds.forEach(userId => {
      quickCompanies.forEach(compId => {
        onAddManual(compId, quickDesc, totalMins, manualDate, userId);
      });
    });
    setQuickDesc(''); setManualHours(''); setManualMins(''); setDashTimeFrom(''); setDashTimeTo(''); setDashParticipants([]);
  };

  return (
    <div>
      {/* Quick Track */}
      <div className="quick-track">
        {timerRunning ? (
          <div>
            <div style={{fontSize:13, color:'var(--text-secondary)', marginBottom:4}}>
              {companies.find(c=>c.id===timerCompany)?.name} â {timerDesc}
            </div>
            <div className={`timer-display timer-running`}>
              {new Date(timerElapsed).toISOString().substr(11,8)}
            </div>
            <button className="btn btn-danger" style={{width:'100%'}} onClick={onStopTimer}>
              <span style={{width:16,height:16,display:'inline-flex'}}>{Icons.stop}</span> Zastavit a uloÅ¾it
            </button>
          </div>
        ) : (
          <div>
            <div style={{display:'flex',gap:0,marginBottom:10}}>
              <button onClick={()=>setDashMode('task')} style={{flex:1,padding:'8px 12px',fontSize:13,fontWeight:600,border:'1px solid var(--border)',borderRadius:'8px 0 0 8px',background:dashMode==='task'?'var(--primary)':'var(--surface)',color:dashMode==='task'?'white':'var(--text-secondary)',cursor:'pointer',borderRight:'none'}}>
                NovÃ½ task
              </button>
              <button onClick={()=>setDashMode('meeting')} style={{flex:1,padding:'8px 12px',fontSize:13,fontWeight:600,border:'1px solid var(--border)',borderRadius:'0 8px 8px 0',background:dashMode==='meeting'?'var(--primary)':'var(--surface)',color:dashMode==='meeting'?'white':'var(--text-secondary)',cursor:'pointer'}}>
                OpakovanÃ½ task
              </button>
            </div>
            {dashMode === 'task' && (
            <div>
            <div className="company-pills">
              {companies.filter(c => c.is_active).map(c => {
                const isSelected = quickCompanies.includes(c.id);
                return (
                  <button key={c.id} className={`company-pill ${isSelected?'selected':''}`}
                    onClick={()=>setQuickCompanies(prev => isSelected ? prev.filter(id=>id!==c.id) : [...prev, c.id])}
                    style={isSelected?{borderColor:c.color,background:c.color+'15',color:c.color}:{}}>
                    {c.name}
                  </button>
                );
              })}
            </div>
            {quickCompanies.length > 1 && <div style={{fontSize:11,color:'var(--text-secondary)',marginBottom:4,textAlign:'center'}}>{quickCompanies.length} firem vybrÃ¡no â task se pÅidÃ¡ ke vÅ¡em</div>}
            <div style={{marginBottom:8}}>
              <label style={{fontSize:11,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:3}}>ÃÄastnÃ­ci</label>
              <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                {users.filter(u => u.is_active !== false).map(u => {
                  const isSel = dashParticipants.includes(u.id);
                  const isMe = u.id === currentUser.id;
                  const autoMe = dashParticipants.length === 0 && isMe;
                  return (
                    <button key={u.id} style={{padding:'3px 8px',fontSize:11,borderRadius:12,border:'1px solid',cursor:'pointer',
                      borderColor: isSel || autoMe ? 'var(--primary)' : 'var(--border)',
                      background: isSel || autoMe ? 'var(--primary-light)' : 'var(--surface)',
                      color: isSel || autoMe ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: isSel || autoMe ? 600 : 400}}
                      onClick={() => {
                        if (dashParticipants.length === 0) {
                          setDashParticipants(isSel ? [] : [currentUser.id, u.id].filter((v,i,a)=>a.indexOf(v)===i));
                        } else {
                          setDashParticipants(prev => isSel ? prev.filter(id=>id!==u.id) : [...prev, u.id]);
                        }
                      }}>
                      {u.name.split(' ')[0]}{isMe ? ' (jÃ¡)' : ''}
                    </button>
                  );
                })}
              </div>
              {dashParticipants.length > 1 && <div style={{fontSize:10,color:'var(--text-secondary)',marginTop:2}}>{dashParticipants.length} ÃºÄastnÃ­kÅ¯</div>}
            </div>
            <div style={{position:'relative',marginBottom:8}}>
              <input className="input" placeholder="Co jdeÅ¡ dÄlat?" value={quickDesc}
                ref={dashDescRef}
                onChange={e=>{setQuickDesc(e.target.value); setShowDashSuggestions(true);}}
                onFocus={()=>setShowDashSuggestions(true)}
                onBlur={()=>setTimeout(()=>setShowDashSuggestions(false),200)} />
              {showDashSuggestions && dashSuggestions.length > 0 && (
                <div className="desc-suggestions">
                  {dashSuggestions.map((s, i) => (
                    <div key={i} className="desc-suggestion-item" onMouseDown={()=>{setQuickDesc(s); setShowDashSuggestions(false);}}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,alignItems:'stretch'}}>
              <button className="btn btn-primary" style={{whiteSpace:'nowrap',padding:'12px 16px',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:6}} onClick={handleStartTimer} disabled={quickCompanies.length===0||!quickDesc}>
                <span style={{width:18,height:18,display:'inline-flex'}}>{Icons.play}</span> Spustit timer
              </button>
              <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:8,background:'var(--surface)'}}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--text-secondary)',marginBottom:6}}>RuÄnÃ­ zadÃ¡nÃ­</div>
                <div style={{display:'flex',gap:5,alignItems:'center',marginBottom:6}}>
                  <input className="input" type="time" value={dashTimeFrom} onChange={e=>{
                    setDashTimeFrom(e.target.value);
                    if (e.target.value && dashTimeTo) {
                      const [fH,fM] = e.target.value.split(':').map(Number);
                      const [tH,tM] = dashTimeTo.split(':').map(Number);
                      const diff = (tH*60+tM)-(fH*60+fM);
                      if (diff > 0) { setManualHours(String(Math.floor(diff/60))); setManualMins(String(diff%60)); }
                    }
                  }} style={{flex:1,fontSize:12,minWidth:60}} />
                  <span style={{fontSize:11,color:'var(--text-secondary)'}}>â</span>
                  <input className="input" type="time" value={dashTimeTo} onChange={e=>{
                    setDashTimeTo(e.target.value);
                    if (dashTimeFrom && e.target.value) {
                      const [fH,fM] = dashTimeFrom.split(':').map(Number);
                      const [tH,tM] = e.target.value.split(':').map(Number);
                      const diff = (tH*60+tM)-(fH*60+fM);
                      if (diff > 0) { setManualHours(String(Math.floor(diff/60))); setManualMins(String(diff%60)); }
                    }
                  }} style={{flex:1,fontSize:12,minWidth:60}} />
                  <span style={{fontSize:11,color:'var(--text-secondary)',margin:'0 1px'}}>=</span>
                  <input className="input time-input" type="number" min="0" placeholder="0" value={manualHours} onChange={e=>{setManualHours(e.target.value);setDashTimeFrom('');setDashTimeTo('');}} style={{width:48,fontSize:12}} />
                  <span style={{fontSize:11,color:'var(--text-secondary)'}}>h</span>
                  <input className="input time-input" type="number" min="0" max="59" placeholder="0" value={manualMins} onChange={e=>{setManualMins(e.target.value);setDashTimeFrom('');setDashTimeTo('');}} style={{width:48,fontSize:12}} />
                  <span style={{fontSize:11,color:'var(--text-secondary)'}}>m</span>
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <input className="input" type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)} style={{flex:1,fontSize:12}} />
                  <button className="btn btn-primary btn-sm" onClick={handleManualAdd}>UloÅ¾it</button>
                </div>
              </div>
            </div>
            </div>
            )}
            {dashMode === 'meeting' && (
            <div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:6}}>Popis</label>
                <input className="input" placeholder="NÃ¡zev opakovanÃ©ho tasku" value={meetingDesc} onChange={e=>setMeetingDesc(e.target.value)} />
              </div>

              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:6}}>Firmy</label>
                <div className="company-pills">
                  {companies.filter(c => c.is_active).map(c => (
                    <button key={c.id} className={`company-pill ${meetingCompanies.includes(c.id)?'selected':''}`}
                      onClick={()=>{
                        if (meetingCompanies.includes(c.id)) {
                          setMeetingCompanies(meetingCompanies.filter(id => id !== c.id));
                        } else {
                          setMeetingCompanies([...meetingCompanies, c.id]);
                        }
                      }}
                      style={meetingCompanies.includes(c.id)?{borderColor:c.color,background:c.color+'15',color:c.color}:{}}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:6}}>Frekvence</label>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>setMeetingFreq('daily')} style={{flex:1,padding:'8px 12px',fontSize:13,fontWeight:600,border:'1px solid var(--border)',borderRadius:'8px',background:meetingFreq==='daily'?'var(--primary)':'var(--surface)',color:meetingFreq==='daily'?'white':'var(--text)',cursor:'pointer'}}>DennÃ­</button>
                  <button onClick={()=>setMeetingFreq('weekly')} style={{flex:1,padding:'8px 12px',fontSize:13,fontWeight:600,border:'1px solid var(--border)',borderRadius:'8px',background:meetingFreq==='weekly'?'var(--primary)':'var(--surface)',color:meetingFreq==='weekly'?'white':'var(--text)',cursor:'pointer'}}>TÃ½dennÃ­</button>
                  <button onClick={()=>setMeetingFreq('monthly')} style={{flex:1,padding:'8px 12px',fontSize:13,fontWeight:600,border:'1px solid var(--border)',borderRadius:'8px',background:meetingFreq==='monthly'?'var(--primary)':'var(--surface)',color:meetingFreq==='monthly'?'white':'var(--text)',cursor:'pointer'}}>MÄsÃ­ÄnÃ­</button>
                </div>
              </div>

              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:6}}>Den</label>
                {meetingFreq === 'weekly' && (
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {['Po','Ãt','St','Ät','PÃ¡'].map((day, idx) => (
                      <button key={idx} onClick={()=>setMeetingDay(idx+1)} style={{flex:1,minWidth:50,padding:'8px 12px',fontSize:13,fontWeight:600,border:'1px solid var(--border)',borderRadius:'8px',background:meetingDay===idx+1?'var(--primary)':'var(--surface)',color:meetingDay===idx+1?'white':'var(--text)',cursor:'pointer'}}>{day}</button>
                    ))}
                  </div>
                )}
                {meetingFreq === 'monthly' && (
                  <input className="input" type="number" min="1" max="28" value={meetingDayOfMonth} onChange={e=>setMeetingDayOfMonth(Number(e.target.value))} />
                )}
              </div>

              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:6}}>DÃ©lka na firmu</label>
                <select className="select" value={meetingDuration} onChange={e=>setMeetingDuration(Number(e.target.value))} style={{width:'100%'}}>
                  <option value={15}>15 minut</option>
                  <option value={30}>30 minut</option>
                  <option value={45}>45 minut</option>
                  <option value={60}>1 hodina</option>
                  <option value={90}>1.5 hodiny</option>
                  <option value={120}>2 hodiny</option>
                  <option value={180}>3 hodiny</option>
                  <option value={240}>4 hodiny</option>
                </select>
              </div>

              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:6}}>ÃÄastnÃ­ci</label>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {users.map(u => (
                    <label key={u.id} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14}}>
                      <input type="checkbox" checked={meetingParticipants.includes(u.id) || u.id === currentUser?.id} onChange={e=>{
                        if (u.id === currentUser?.id) return;
                        if (e.target.checked) {
                          setMeetingParticipants([...meetingParticipants, u.id]);
                        } else {
                          setMeetingParticipants(meetingParticipants.filter(id => id !== u.id));
                        }
                      }} disabled={u.id === currentUser?.id} style={{cursor:u.id === currentUser?.id ? 'not-allowed' : 'pointer'}} />
                      {u.name} {u.id === currentUser?.id && '(vy)'}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:6}}>Platnost</label>
                <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:8}}>
                  <input className="input" type="date" value={meetingStartDate} onChange={e=>setMeetingStartDate(e.target.value)} style={{flex:1}} />
                  <span style={{fontSize:12,color:'var(--text-secondary)'}}>â</span>
                  <input className="input" type="date" value={meetingIndefinite ? '' : meetingEndDate} onChange={e=>setMeetingEndDate(e.target.value)} disabled={meetingIndefinite === true} style={{flex:1, opacity: meetingIndefinite ? 0.4 : 1, cursor: meetingIndefinite ? 'not-allowed' : 'pointer'}} />
                </div>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
                  <input type="checkbox" checked={meetingIndefinite} onChange={e=>setMeetingIndefinite(e.target.checked)} />
                  Dokud nezruÅ¡Ã­m
                </label>
              </div>

              <button className="btn btn-primary" style={{width:'100%'}} onClick={()=>{
                const missing = [];
                if (!meetingDesc) missing.push('Popis');
                if (meetingCompanies.length === 0) missing.push('Firmy');
                if (!meetingStartDate) missing.push('Datum zaÄÃ¡tku');
                if (missing.length > 0) {
                  alert('VyplÅte prosÃ­m: ' + missing.join(', '));
                  return;
                }
                const allParticipants = [currentUser.id, ...meetingParticipants.filter(id => id !== currentUser.id)];
                const meetingData = {
                  description: meetingDesc,
                  company_ids: meetingCompanies,
                  participant_ids: allParticipants,
                  confirmed_participant_ids: [currentUser.id],
                  author_id: currentUser.id,
                  frequency: meetingFreq,
                  day_of_week: meetingFreq === 'weekly' ? meetingDay : 0,
                  day_of_month: meetingFreq === 'monthly' ? meetingDayOfMonth : 1,
                  duration_min: meetingDuration,
                  start_date: meetingStartDate,
                  end_date: meetingIndefinite ? null : meetingEndDate,
                  is_active: true
                };
                (async () => {
                  try {
                    const sb = window.__supabase;
                    console.log('[Meeting Save] Data to insert:', JSON.stringify(meetingData));
                    if (sb) {
                      const { data, error } = await sb.from('recurring_meetings').insert([meetingData]).select();
                      console.log('[Meeting Save] Result:', JSON.stringify({data, error}));
                      if (error) throw error;
                      if (data && data[0]) { const md = data[0]; setRecurringMeetings([...recurringMeetings, {...md, companyIds: md.company_ids||md.companyIds||[], participantIds: md.participant_ids||md.participantIds||[], confirmedParticipantIds: md.confirmed_participant_ids||md.confirmedParticipantIds||[], authorId: md.author_id||md.authorId, dayOfWeek: md.day_of_week??md.dayOfWeek??0, dayOfMonth: md.day_of_month??md.dayOfMonth??1, durationMin: md.duration_min||md.durationMin||60, startDate: md.start_date||md.startDate, endDate: md.end_date||md.endDate, isActive: md.is_active??md.isActive??true}]); alert('Task uloÅ¾en!');
                        // Create in-app notifications for participants
                        const compNames = meetingCompanies.map(cid => companies.find(c => c.id === cid)?.name).filter(Boolean).join(', ');
                        createNotifications(allParticipants, md.id, 'recurring_meeting', 'PozvÃ¡nka: ' + meetingDesc, 'Byli jste pÅidÃ¡ni k opakovanÃ©mu tasku pro ' + compNames + '. PotvrÄte prosÃ­m svoji ÃºÄast.');
                      }
                    } else {
                      const newMeeting = { id: 'rm' + Date.now(), ...meetingData };
                      setRecurringMeetings([...recurringMeetings, newMeeting]);
                    }
                  } catch(err) { console.error('[Meeting Save] Error:', err); alert('Chyba pÅi uklÃ¡dÃ¡nÃ­:' + err.message); }
                })();

                // Send email notification
                const newMeeting = meetingData;
                const otherParticipants = allParticipants.filter(uid => uid !== currentUser.id);
                if (otherParticipants.length > 0) {
                  const emails = otherParticipants.map(uid => users.find(u=>u.id===uid)?.email).filter(Boolean).join(',');
                  const freqLabel = meetingFreq === 'daily' ? 'DennÄ' : meetingFreq === 'weekly' ? 'KaÅ¾dÃ½ tÃ½den' : 'KaÅ¾dÃ½ mÄsÃ­c';
                  const durationLabel = meetingDuration < 60 ? meetingDuration + ' minut' : meetingDuration === 60 ? '1 hodina' : (meetingDuration / 60) + ' hodin';
                  const companyNames = meetingCompanies.map(cid => companies.find(c => c.id === cid)?.name).join(', ');
                  const subject = encodeURIComponent('Jokes Aside â PozvÃ¡nka na pravidelnÃ½ meeting: ' + meetingDesc);
                  const body = encodeURIComponent(
                    'DobrÃ½ den,\n\n' +
                    'byli jste pÅidÃ¡ni do opakovanÃ©ho tasku "' + meetingDesc + '".\n\n' +
                    'Frekvence: ' + freqLabel + '\n' +
                    'DÃ©lka: ' + durationLabel + ' na firmu\n' +
                    'Firmy: ' + companyNames + '\n\n' +
                    'PotvrÄte prosÃ­m svou ÃºÄast v trackeru:\n' + window.location.href + '\n\n' +
                    'DÄkuji,\n' + currentUser.name
                  );
                  if (emails) {
                    window.open('mailto:' + emails + '?subject=' + subject + '&body=' + body, '_blank');
                  }
                }

                setMeetingDesc('');
                setMeetingCompanies([]);
                setMeetingFreq('weekly');
                setMeetingDay(1);
                setMeetingDayOfMonth(1);
                setMeetingDuration(60);
                setMeetingParticipants([]);
                setMeetingStartDate(new Date().toISOString().slice(0,10));
                setMeetingEndDate('');
                setMeetingIndefinite(true);
                setDashMode('task');
              }}>UloÅ¾it meeting</button>
            </div>
            )}
          </div>
        )}
      </div>

      {/* Companies grid */}
      <div className="section-title">Firmy</div>
      <div className="company-grid">
        {companies.filter(c => c.is_active).map(c => {
          const b = getCompanyBudget(c.id, month);

          // Calculate planned future recurring costs
          let planned = 0;
          const today = new Date().toISOString().slice(0, 10);
          const [my, mm] = month.split('-');
          const lastDay = new Date(parseInt(my), parseInt(mm), 0).getDate();
          const monthEnd = month + '-' + String(lastDay).padStart(2, '0');
          const monthStart = month + '-01';
          recurringMeetings.forEach(meeting => {
            const isActive = meeting.isActive ?? meeting.is_active ?? true;
            if (!isActive) return;
            const mCompanyIds = meeting.companyIds || meeting.company_ids || [];
            if (!mCompanyIds.includes(c.id)) return;
            const mStartDate = meeting.startDate || meeting.start_date;
            const mEndDate = meeting.endDate || meeting.end_date;
            const mDayOfWeek = meeting.dayOfWeek ?? meeting.day_of_week ?? 0;
            const mDayOfMonth = meeting.dayOfMonth ?? meeting.day_of_month ?? 1;
            const mDurationMin = meeting.durationMin || meeting.duration_min;
            const confirmedIds = meeting.confirmedParticipantIds || meeting.confirmed_participant_ids || meeting.participantIds || meeting.participant_ids || [];
            const startD = today < monthStart ? monthStart : today;
            const iterDate = new Date(startD + 'T12:00:00');
            iterDate.setDate(iterDate.getDate() + 1);
            const endD = new Date(monthEnd + 'T12:00:00');
            const meetingEnd = mEndDate ? new Date(mEndDate + 'T12:00:00') : endD;
            const actualEnd = meetingEnd < endD ? meetingEnd : endD;
            while (iterDate <= actualEnd) {
              if (mStartDate && iterDate.toISOString().slice(0,10) < mStartDate) { iterDate.setDate(iterDate.getDate() + 1); continue; }
              const dow = iterDate.getDay();
              let shouldCount = false;
              if (meeting.frequency === 'daily' && dow >= 1 && dow <= 5) shouldCount = true;
              else if (meeting.frequency === 'weekly' && dow === mDayOfWeek) shouldCount = true;
              else if (meeting.frequency === 'monthly' && iterDate.getDate() === mDayOfMonth) shouldCount = true;
              if (shouldCount) {
                confirmedIds.forEach(userId => {
                  const user = users.find(u => u.id === userId);
                  if (user) planned += (mDurationMin / 60) * user.hourly_rate;
                });
              }
              iterDate.setDate(iterDate.getDate() + 1);
            }
          });
          b.planned = planned;
          b.plannedPct = b.total > 0 ? Math.min((planned / b.total) * 100, 100 - b.pct) : 0;
          const progressColor = b.pct > 90 ? 'var(--danger)' : b.pct > 70 ? 'var(--warning)' : 'var(--success)';
          return (
            <div key={c.id} className="company-card" onClick={() => onSelectCompany(c.id)}>
              <div className="company-logo" style={{background: c.color}}>
                {COMPANY_INITIALS[c.name] || c.name.charAt(0)}
              </div>
              <div className="company-name">{c.name}</div>
              <div className="progress-bar" style={{position:'relative'}}>
                <div className="progress-fill" style={{width: b.pct+'%', background: progressColor, position:'absolute', left:0, top:0, height:'100%', borderRadius:3, zIndex:2}} />
                {b.plannedPct > 0 && <div style={{width: (b.pct + b.plannedPct)+'%', background: c.color || '#999', opacity: 0.25, position:'absolute', left:0, top:0, height:'100%', borderRadius:3, zIndex:1}} />}
              </div>
              <div className="progress-text">
                {formatCzk(b.used)} / {formatCzk(b.total)} <span style={{fontSize:10,color:'var(--text-secondary)'}}>bez DPH</span>
              </div>
              {b.planned > 0 && (
                <div style={{fontSize:10, color: c.color || 'var(--text-secondary)', fontWeight:500, marginTop:2, opacity:0.7}}>
                  Naplánováno: +{formatCzk(b.planned)}
                </div>
              )}
              {b.total > 0 && (
                <div style={{fontSize:11, color: b.remaining >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight:600, marginTop:4}}>
                  {b.remaining >= 0 ? `ZbÃ½vÃ¡ ${formatCzk(b.remaining)}` : `PÅeÄerpÃ¡no ${formatCzk(Math.abs(b.remaining))}`}
                </div>
              )}
              {b.total > 0 && (
                <div style={{fontSize:10, color:'var(--text-secondary)', marginTop:4}}>
                  s DPH: {formatCzk(withDph(b.used))} / {formatCzk(withDph(b.total))}
                </div>
              )}
              {b.total === 0 && b.used > 0 && (
                <div style={{fontSize:11, color:'var(--text-secondary)', fontWeight:600, marginTop:4}}>
                  OdpracovÃ¡no: {formatCzk(b.used)} (bez retaineru)
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active recurring meetings summary */}
      <div style={{marginTop:20}}>
        <div className="section-title">OpakovanÃ© tasky ({recurringMeetings.length} celkem)</div>
        {recurringMeetings.filter(m => (m.isActive ?? m.is_active ?? true)).length > 0 ? (
          <div className="task-list">
            {recurringMeetings.filter(m => (m.isActive ?? m.is_active ?? true)).map(m => {
              const compIds = m.companyIds || m.company_ids || [];
              const compNames = compIds.map(cid => companies.find(c => c.id === cid)?.name).filter(Boolean).join(', ') || 'bez firmy';
              const freqLabel = m.frequency === 'daily' ? 'DennÄ' : m.frequency === 'weekly' ? 'TÃ½dnÄ' : 'MÄsÃ­ÄnÄ';
              const dur = m.durationMin || m.duration_min || 60;
              return (
                <div key={m.id} className="task-item">
                  <div className="task-dot" style={{background:'var(--primary)'}} />
                  <div className="task-info">
                    <div className="task-desc">ð {m.description}</div>
                    <div className="task-meta">{freqLabel} Â· {compNames} Â· {dur < 60 ? dur + ' min' : (dur/60) + ' hod'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{fontSize:13, color:'var(--text-secondary)', padding:'8px 0'}}>Å½Ã¡dnÃ© opakovanÃ© tasky. VytvoÅte je v zÃ¡loÅ¾ce OpakovanÃ© nebo v sekci vÃ½Å¡e.</div>
        )}
      </div>

      {/* Recent activity */}
      <div className="section-title" style={{marginTop:20}}>PoslednÃ­ aktivita</div>
      <div className="task-list">
        {[...entries].sort((a,b) => (b.created_at||'').localeCompare(a.created_at||'')).slice(0,10).map(e => {
          const user = users.find(u=>u.id===e.user_id);
          const comp = companies.find(c=>c.id===e.company_id);
          return (
            <div key={e.id} className="task-item">
              <div className="task-dot" style={{background: comp?.color || '#999'}} />
              <div className="task-info">
                <div className="task-desc">{e.description}{e.recurring_meeting_id ? ' ð' : ''}</div>
                <div className="task-meta">{user?.name} Â· {comp?.name} Â· {formatDate(e.date)}{e.updated_at && ` Â· editovÃ¡no ${new Date(e.updated_at).toLocaleString('cs-CZ',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`}</div>
              </div>
              <div className="task-time">{formatHours(e.duration_min)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

