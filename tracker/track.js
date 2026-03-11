// ==================== TRACK PAGE ====================
function TrackPage({ companies, currentUser, entries, users, timerRunning, timerCompany, timerDesc, timerElapsed, onStartTimer, onStopTimer, onAddManual, onDeleteEntry, onUpdateEntry, isEntryLocked, recurringMeetings, setRecurringMeetings }) {
  const [selCompanies, setSelCompanies] = useState([]);
  const [desc, setDesc] = useState('');
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [timeFromStr, setTimeFromStr] = useState('');
  const [timeToStr, setTimeToStr] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [taskParticipants, setTaskParticipants] = useState([]);
  const [showDescSuggestions, setShowDescSuggestions] = useState(false);
  const [descInputRef, setDescInputRef] = useState(null);

  // Meeting form state
  const [trackMode, setTrackMode] = useState('task');
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

  const todayEntries = entries.filter(e => e.user_id === currentUser.id).sort((a,b) => (b.created_at||'').localeCompare(a.created_at||'')).slice(0,30);

  // Get unique past descriptions for autocomplete
  const uniqueDescriptions = useMemo(() => {
    const userEntries = entries.filter(e => e.user_id === currentUser.id);
    const descs = [...new Set(userEntries.map(e => e.description))];
    return descs;
  }, [entries, currentUser.id]);

  const descSuggestions = desc.length > 0
    ? uniqueDescriptions.filter(d => d.toLowerCase().includes(desc.toLowerCase())).slice(0, 5)
    : [];

  const handleAddManual = () => {
    if (selCompanies.length === 0 || !desc) return;
    const totalMins = (parseInt(hours)||0)*60 + (parseInt(mins)||0);
    if (totalMins < 15) { alert('MinimÃ¡lnÃ­ dÃ©lka tasku je 15 minut'); return; }
    const participantIds = taskParticipants.length > 0 ? taskParticipants : [currentUser.id];
    participantIds.forEach(userId => {
      selCompanies.forEach(compId => {
        onAddManual(compId, desc, totalMins, date, userId);
      });
    });
    setDesc(''); setHours(''); setMins(''); setTimeFromStr(''); setTimeToStr(''); setTaskParticipants([]);
  };

  return (
    <div>
      <div className="section-title" style={{marginBottom:12}}>
        <span>Time Tracking</span>
      </div>

      {timerRunning ? (
        <div className="card" style={{marginBottom:16, textAlign:'center'}}>
          <div style={{fontSize:13, color:'var(--text-secondary)', marginBottom:4}}>
            {companies.find(c=>c.id===timerCompany)?.name}
          </div>
          <div style={{fontSize:15, fontWeight:600, marginBottom:4}}>{timerDesc}</div>
          <div className="timer-display timer-running">
            {new Date(timerElapsed).toISOString().substr(11,8)}
          </div>
          <button className="btn btn-danger" style={{width:'100%'}} onClick={onStopTimer}>
            <span style={{width:16,height:16,display:'inline-flex'}}>{Icons.stop}</span> Zastavit a uloÅ¾it
          </button>
        </div>
      ) : (
        <div className="card" style={{marginBottom:16}}>
          {/* Mode toggle */}
          <div style={{display:'flex',gap:0,marginBottom:10}}>
            <button onClick={()=>setTrackMode('task')} style={{flex:1,padding:'8px 12px',fontSize:13,fontWeight:600,border:'1px solid var(--border)',borderRadius:'8px 0 0 8px',background:trackMode==='task'?'var(--primary)':'var(--surface)',color:trackMode==='task'?'white':'var(--text-secondary)',cursor:'pointer',borderRight:'none'}}>
              NovÃ½ task
            </button>
            <button onClick={()=>setTrackMode('meeting')} style={{flex:1,padding:'8px 12px',fontSize:13,fontWeight:600,border:'1px solid var(--border)',borderRadius:'0 8px 8px 0',background:trackMode==='meeting'?'var(--primary)':'var(--surface)',color:trackMode==='meeting'?'white':'var(--text-secondary)',cursor:'pointer'}}>
              OpakovanÃ½ task
            </button>
          </div>

          {trackMode === 'task' && (
          <div>
          {/* Company selector */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span style={{fontSize:13,fontWeight:500,color:'var(--text-secondary)'}}>Firma</span>
            {selCompanies.length > 1 && <span style={{fontSize:11,color:'var(--primary)',fontWeight:500}}>{selCompanies.length} firem vybrÃ¡no â task se pÅidÃ¡ ke vÅ¡em</span>}
          </div>
          <div className="company-pills">
            {companies.filter(c => c.is_active).map(c => {
              const isSelected = selCompanies.includes(c.id);
              return (
                <button key={c.id} className={`company-pill ${isSelected?'selected':''}`}
                  onClick={()=>setSelCompanies(prev => isSelected ? prev.filter(id=>id!==c.id) : [...prev, c.id])}
                  style={isSelected?{borderColor:c.color,background:c.color+'15',color:c.color}:{}}>
                  {c.name}
                </button>
              );
            })}
          </div>

          <div style={{fontSize:13,fontWeight:500,color:'var(--text-secondary)',marginBottom:6,marginTop:8}}>Popis</div>
          <div style={{position:'relative',marginBottom:12}}>
            <input
              ref={el => setDescInputRef(el)}
              className="input"
              placeholder="Co jdeÅ¡ dÄlat?"
              value={desc}
              onChange={e=>setDesc(e.target.value)}
              onFocus={() => setShowDescSuggestions(true)}
              onBlur={() => setTimeout(() => setShowDescSuggestions(false), 200)}
            />
            {showDescSuggestions && descSuggestions.length > 0 && (
              <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--surface)',border:'1px solid var(--border)',borderTop:'none',borderBottomLeftRadius:8,borderBottomRightRadius:8,zIndex:10,maxHeight:200,overflowY:'auto'}}>
                {descSuggestions.map((s, i) => (
                  <div key={i} style={{padding:'8px 12px',fontSize:13,borderBottom:i < descSuggestions.length-1 ? '1px solid var(--border)' : 'none',cursor:'pointer',transition:'background 0.15s'}} onMouseDown={() => { setDesc(s); setShowDescSuggestions(false); }}>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timer + Manual side by side */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1.5fr',gap:12,marginTop:12}}>
            {/* Left: Timer */}
            <button className="btn btn-primary" onClick={() => { if(selCompanies.length > 0 && desc) onStartTimer(selCompanies[0], desc); }} disabled={selCompanies.length === 0 || !desc} style={{width:'100%'}}>
              <span style={{width:16,height:16,display:'inline-flex'}}>{Icons.play}</span> Spustit timer{selCompanies.length > 1 ? ' ('+companies.find(c=>c.id===selCompanies[0])?.name+')' : ''}
            </button>

            {/* Right: Manual entry */}
            <div style={{border:'1px solid var(--border)',borderRadius:8,padding:12}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',marginBottom:8}}>
                RuÄnÃ­ zadÃ¡nÃ­
              </div>

              <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:8}}>
                <input className="input" type="time" value={timeFromStr} onChange={e=>{
                  setTimeFromStr(e.target.value);
                  if (e.target.value && timeToStr) {
                    const [fH,fM] = e.target.value.split(':').map(Number);
                    const [tH,tM] = timeToStr.split(':').map(Number);
                    const diff = (tH*60+tM)-(fH*60+fM);
                    if (diff > 0) { setHours(String(Math.floor(diff/60))); setMins(String(diff%60)); }
                  }
                }} style={{flex:1,fontSize:13,minWidth:70}} />
                <span style={{fontSize:12,color:'var(--text-secondary)'}}>â</span>
                <input className="input" type="time" value={timeToStr} onChange={e=>{
                  setTimeToStr(e.target.value);
                  if (timeFromStr && e.target.value) {
                    const [fH,fM] = timeFromStr.split(':').map(Number);
                    const [tH,tM] = e.target.value.split(':').map(Number);
                    const diff = (tH*60+tM)-(fH*60+fM);
                    if (diff > 0) { setHours(String(Math.floor(diff/60))); setMins(String(diff%60)); }
                  }
                }} style={{flex:1,fontSize:13,minWidth:70}} />
                <span style={{fontSize:12,color:'var(--text-secondary)',margin:'0 2px'}}>=</span>
                <input className="input time-input" type="number" min="0" placeholder="0" value={hours} onChange={e=>{setHours(e.target.value);setTimeFromStr('');setTimeToStr('');}} style={{width:48}} />
                <span style={{fontSize:12,color:'var(--text-secondary)'}}>h</span>
                <input className="input time-input" type="number" min="0" max="59" placeholder="0" value={mins} onChange={e=>{setMins(e.target.value);setTimeFromStr('');setTimeToStr('');}} style={{width:48}} />
                <span style={{fontSize:12,color:'var(--text-secondary)'}}>m</span>
              </div>

              <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} style={{marginBottom:8,fontSize:13}} />

              <button className="btn btn-primary" style={{width:'100%',fontSize:13}} onClick={handleAddManual}>
                UloÅ¾it
              </button>
            </div>
          </div>
          </div>
          )}

          {trackMode === 'meeting' && (
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
                  if (sb) {
                    const { data, error } = await sb.from('recurring_meetings').insert([meetingData]).select();
                    if (error) throw error;
                    if (data) { const md = data[0]; setRecurringMeetings([...recurringMeetings, {...md, companyIds: md.company_ids||md.companyIds||[], participantIds: md.participant_ids||md.participantIds||[], confirmedParticipantIds: md.confirmed_participant_ids||md.confirmedParticipantIds||[], authorId: md.author_id||md.authorId, dayOfWeek: md.day_of_week??md.dayOfWeek??0, dayOfMonth: md.day_of_month??md.dayOfMonth??1, durationMin: md.duration_min||md.durationMin||60, startDate: md.start_date||md.startDate, endDate: md.end_date||md.endDate, isActive: md.is_active??md.isActive??true}]); }
                  } else {
                    const newMeeting = { id: 'rm' + Date.now(), ...meetingData };
                    setRecurringMeetings([...recurringMeetings, newMeeting]);
                  }
                } catch(err) { console.error('Error saving meeting:', err); alert('Chyba pÅi uklÃ¡dÃ¡nÃ­:' + err.message); }
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
              setTrackMode('task');
            }}>UloÅ¾it meeting</button>
          </div>
          )}
        </div>
      )}

      {/* Recent entries grouped by date with daily totals */}
      <div className="section-title">Moje zÃ¡znamy</div>
      <div className="task-list">
        {(() => {
          const grouped = {};
          todayEntries.forEach(e => {
            if (!grouped[e.date]) grouped[e.date] = [];
            grouped[e.date].push(e);
          });
          const sortedDates = Object.keys(grouped).sort((a,b) => b.localeCompare(a));
          return sortedDates.map(date => {
            const dayEntries = grouped[date];
            const totalMins = dayEntries.reduce((sum, e) => sum + e.duration_min, 0);
            const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('cs-CZ', {weekday:'long', day:'numeric', month:'numeric'});
            return (
              <div key={date}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0 4px',borderBottom:'1px solid var(--border)',marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:'var(--text-secondary)',textTransform:'capitalize'}}>{dayLabel}</span>
                  <span style={{fontSize:13,fontWeight:700,color:'var(--primary)'}}>{formatHours(totalMins)}</span>
                </div>
                {dayEntries.map(e => (
                  <EditableTaskItem
                    key={e.id} entry={e} companies={companies} users={users}
                    currentUser={currentUser} onUpdate={onUpdateEntry} onDelete={onDeleteEntry}
                    showUser={false} isLocked={isEntryLocked(e)}
                  />
                ))}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

