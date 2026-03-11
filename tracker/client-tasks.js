// ==================== CLIENT TASKS PAGE ====================
function ClientTasksPage({ clientTasks, setClientTasks, clientProfiles, companies, users, currentUser, entries, setEntries, createNotifications }) {
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterDivision, setFilterDivision] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [completeDialog, setCompleteDialog] = useState(null); // task being completed
  const [completeDuration, setCompleteDuration] = useState({ hours: '0', mins: '30' });
  const [completeDesc, setCompleteDesc] = useState('');
  const [assignDialog, setAssignDialog] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);

  const DIVISIONS = ['Finance', 'Legal', 'Operations/HR', 'Marketing'];
  const PRIORITIES = { low: { label: 'NÃ­zkÃ¡', color: '#9ca3af' }, medium: { label: 'StÅednÃ­', color: '#f59e0b' }, high: { label: 'VysokÃ¡', color: '#ef4444' } };
  const STATUSES = { zadano: { label: 'ZadÃ¡no', bg: '#dbeafe', color: '#1d4ed8' }, pracuje_se: { label: 'Pracuje se', bg: '#fef3c7', color: '#b45309' }, hotovo: { label: 'Hotovo', bg: '#d1fae5', color: '#047857' } };

  // Filter tasks
  const filtered = clientTasks.filter(t => {
    if (filterCompany !== 'all' && t.company_id !== filterCompany) return false;
    if (filterDivision !== 'all' && t.division !== filterDivision) return false;
    if (filterClient !== 'all' && t.client_id !== filterClient) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    return true;
  });

  // Group by date
  const grouped = {};
  filtered.forEach(t => {
    const d = (t.created_at || '').substring(0, 10);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(t);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getClientName = (clientId) => {
    const cp = clientProfiles.find(c => c.id === clientId);
    return cp ? cp.name : 'NeznÃ¡mÃ½ klient';
  };

  const getClientCompany = (clientId) => {
    const cp = clientProfiles.find(c => c.id === clientId);
    if (cp?.company_id) {
      const comp = companies.find(c => c.id === cp.company_id);
      return comp ? comp.name : '';
    }
    return '';
  };

  // Change status
  const changeStatus = async (task, newStatus) => {
    if (newStatus === 'hotovo') {
      setCompleteDialog(task);
      setCompleteDesc(task.title);
      setCompleteDuration({ hours: '0', mins: '30' });
      return;
    }
    const sb = window.__supabase;
    if (!sb) return;
    const { error } = await sb.from('client_tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', task.id);
    if (error) { alert('Chyba: ' + error.message); return; }
    // Log
    await sb.from('client_task_logs').insert([{ task_id: task.id, user_type: 'admin', user_id: currentUser.id, action: 'status_changed', old_values: { status: task.status }, new_values: { status: newStatus } }]);
    setClientTasks(clientTasks.map(t => t.id === task.id ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t));
  };

  // Complete task and create time entry
  const handleComplete = async () => {
    if (!completeDialog) return;
    const totalMins = (parseInt(completeDuration.hours) || 0) * 60 + (parseInt(completeDuration.mins) || 0);
    if (totalMins < 15) { alert('MinimÃ¡lnÃ­ dÃ©lka je 15 minut'); return; }

    const sb = window.__supabase;
    if (!sb) return;

    const assignedUser = completeDialog.assigned_user_id || currentUser.id;
    const today = new Date().toISOString().substring(0, 10);

    // Create time entry
    const { data: entryData, error: entryError } = await sb.from('time_entries').insert([{
      user_id: assignedUser,
      company_id: completeDialog.company_id,
      description: completeDesc || completeDialog.title,
      duration_min: totalMins,
      date: today,
      is_manual: true,
    }]).select();

    if (entryError) { alert('Chyba pÅi vytvÃ¡ÅenÃ­ zÃ¡znamu: ' + entryError.message); return; }

    // Update task
    const { error: taskError } = await sb.from('client_tasks').update({
      status: 'hotovo',
      completed_at: new Date().toISOString(),
      completed_duration_min: totalMins,
      time_entry_id: entryData?.[0]?.id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', completeDialog.id);

    if (taskError) { alert('Chyba: ' + taskError.message); return; }

    // Log
    await sb.from('client_task_logs').insert([{
      task_id: completeDialog.id, user_type: 'admin', user_id: currentUser.id,
      action: 'status_changed', old_values: { status: completeDialog.status }, new_values: { status: 'hotovo', completed_duration_min: totalMins }
    }]);

    // Update local state
    setClientTasks(clientTasks.map(t => t.id === completeDialog.id ? { ...t, status: 'hotovo', completed_at: new Date().toISOString(), completed_duration_min: totalMins, time_entry_id: entryData?.[0]?.id } : t));
    if (entryData) setEntries([entryData[0], ...entries]);
    setCompleteDialog(null);
  };

  // Assign user
  const handleAssign = async (taskId, userId) => {
    const sb = window.__supabase;
    if (!sb) return;
    const { error } = await sb.from('client_tasks').update({ assigned_user_id: userId, assigned_by: currentUser.id, updated_at: new Date().toISOString() }).eq('id', taskId);
    if (error) { alert('Chyba: ' + error.message); return; }
    await sb.from('client_task_logs').insert([{ task_id: taskId, user_type: 'admin', user_id: currentUser.id, action: 'assigned', new_values: { assigned_user_id: userId } }]);
    setClientTasks(clientTasks.map(t => t.id === taskId ? { ...t, assigned_user_id: userId, assigned_by: currentUser.id } : t));
    // Send notification to assigned user
    const task = clientTasks.find(t => t.id === taskId);
    if (task && userId !== currentUser.id) {
      const compName = companies.find(c => c.id === task.company_id)?.name || '';
      createNotifications([userId], taskId, 'client_task', 'NovÃ½ Ãºkol: ' + task.title, 'Byl vÃ¡m pÅiÅazen Ãºkol pro ' + compName + '. PotvrÄte prosÃ­m pÅijetÃ­.');
    }
    setAssignDialog(null);
  };

  // Delete task
  const handleDelete = async (task) => {
    if (!confirm('Opravdu chcete smazat Ãºkol "' + task.title + '"?')) return;
    const sb = window.__supabase;
    if (!sb) return;
    const { error } = await sb.from('client_tasks').update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by_type: 'admin', deleted_by: currentUser.id }).eq('id', task.id);
    if (error) { alert('Chyba: ' + error.message); return; }
    await sb.from('client_task_logs').insert([{ task_id: task.id, user_type: 'admin', user_id: currentUser.id, action: 'deleted', old_values: task }]);
    setClientTasks(clientTasks.filter(t => t.id !== task.id));
  };

  // Get users for assignment (current user + their direct reports)
  const assignableUsers = users.filter(u => u.is_active && (u.id === currentUser?.id || u.manager_id === currentUser?.id || currentUser?.is_admin));

  const taskCounts = { all: clientTasks.length, zadano: clientTasks.filter(t=>t.status==='zadano').length, pracuje_se: clientTasks.filter(t=>t.status==='pracuje_se').length, hotovo: clientTasks.filter(t=>t.status==='hotovo').length };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:700}}>KlientskÃ© Ãºkoly</div>
        <div style={{display:'flex',gap:8}}>
          {Object.entries(taskCounts).filter(([k])=>k!=='all').map(([k,v]) => (
            <span key={k} style={{background:STATUSES[k].bg,color:STATUSES[k].color,padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600}}>{STATUSES[k].label}: {v}</span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{padding:12,marginBottom:16}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <select className="input" style={{width:'auto',fontSize:12,padding:'6px 28px 6px 8px'}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="all">VÅ¡echny statusy</option>
            <option value="zadano">ZadÃ¡no</option>
            <option value="pracuje_se">Pracuje se</option>
            <option value="hotovo">Hotovo</option>
          </select>
          <select className="input" style={{width:'auto',fontSize:12,padding:'6px 28px 6px 8px'}} value={filterCompany} onChange={e=>setFilterCompany(e.target.value)}>
            <option value="all">VÅ¡echny firmy</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" style={{width:'auto',fontSize:12,padding:'6px 28px 6px 8px'}} value={filterDivision} onChange={e=>setFilterDivision(e.target.value)}>
            <option value="all">VÅ¡echny divize</option>
            {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="input" style={{width:'auto',fontSize:12,padding:'6px 28px 6px 8px'}} value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
            <option value="all">VÅ¡echny priority</option>
            <option value="high">VysokÃ¡</option>
            <option value="medium">StÅednÃ­</option>
            <option value="low">NÃ­zkÃ¡</option>
          </select>
          {clientProfiles.length > 0 && (
            <select className="input" style={{width:'auto',fontSize:12,padding:'6px 28px 6px 8px'}} value={filterClient} onChange={e=>setFilterClient(e.target.value)}>
              <option value="all">VÅ¡ichni klienti</option>
              {clientProfiles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Task list grouped by date */}
      {filtered.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text-secondary)'}}>
          <div style={{fontSize:48,marginBottom:12}}>ð</div>
          <div style={{fontSize:16,fontWeight:600,color:'var(--text)',marginBottom:4}}>Å½Ã¡dnÃ© Ãºkoly</div>
          <div>Klienti zatÃ­m nezadali Å¾Ã¡dnÃ© Ãºkoly. SdÃ­lejte jim odkaz: <strong>jokesaside.cz/tasks</strong></div>
        </div>
      ) : (
        sortedDates.map(date => (
          <div key={date}>
            <div style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',padding:'12px 0 6px',textTransform:'capitalize',borderBottom:'1px solid var(--border)',marginBottom:8}}>
              {formatDateLabel(date)} ({grouped[date].length})
            </div>
            {grouped[date].map(task => {
              const comp = companies.find(c => c.id === task.company_id);
              const assigned = task.assigned_user_id ? users.find(u => u.id === task.assigned_user_id) : null;
              const prio = PRIORITIES[task.priority] || PRIORITIES.medium;
              const status = STATUSES[task.status] || STATUSES.zadano;
              const clientName = getClientName(task.client_id);
              const isExpanded = expandedTask === task.id;

              return (
                <div key={task.id} className="card" style={{padding:'8px 12px',marginBottom:4,borderLeft:`3px solid ${prio.color}`,cursor:'pointer'}} onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                  {/* Compact single line */}
                  <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                    <span style={{width:7,height:7,borderRadius:'50%',background:prio.color,flexShrink:0}} />
                    <span style={{fontWeight:600,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{task.title}</span>
                    {comp && <span style={{background:comp.color+'15',color:comp.color,padding:'1px 7px',borderRadius:10,fontSize:11,fontWeight:600,flexShrink:0}}>{comp.name}</span>}
                    <span style={{fontSize:11,color:'var(--text-secondary)',flexShrink:0}}>{task.division}</span>
                    {assigned && <span style={{fontSize:11,color:'var(--primary)',fontWeight:600,flexShrink:0}}>â {assigned.name}</span>}
                    {task.deadline && <span style={{fontSize:11,color:'var(--text-secondary)',flexShrink:0}}>{new Date(task.deadline + 'T12:00:00').toLocaleDateString('cs-CZ')}</span>}
                    {task.completed_duration_min > 0 && <span style={{fontSize:11,color:'var(--text-secondary)',flexShrink:0}}>{Math.floor(task.completed_duration_min/60)}h {task.completed_duration_min%60}m</span>}
                    <span style={{background:status.bg,color:status.color,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,whiteSpace:'nowrap',flexShrink:0}}>{status.label}</span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}} onClick={e => e.stopPropagation()}>
                      {task.description && <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:8}}>{task.description}</div>}
                      <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:8}}>
                        Klient: <strong>{clientName}</strong>
                        {task.deadline && <span style={{marginLeft:12}}>Deadline: <strong>{new Date(task.deadline + 'T12:00:00').toLocaleDateString('cs-CZ')}</strong></span>}
                        {assigned && <span style={{marginLeft:12}}>PÅiÅazeno: <strong>{assigned.name}</strong></span>}
                      </div>
                      {task.status !== 'hotovo' && (
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          {task.status === 'zadano' && !task.assigned_user_id && (
                            <button className="btn btn-outline btn-sm" onClick={() => setAssignDialog(task)}>PÅiÅadit</button>
                          )}
                          {task.status === 'zadano' && (
                            <button className="btn btn-sm" style={{background:'#fef3c7',color:'#b45309',border:'1px solid #fde68a',borderRadius:8}} onClick={() => changeStatus(task, 'pracuje_se')}>Pracuje se</button>
                          )}
                          {task.status === 'pracuje_se' && (
                            <button className="btn btn-sm" style={{background:'#d1fae5',color:'#047857',border:'1px solid #a7f3d0',borderRadius:8}} onClick={() => changeStatus(task, 'hotovo')}>Hotovo</button>
                          )}
                          <button className="btn btn-sm" style={{color:'var(--danger)',border:'1px solid var(--danger)',borderRadius:8,background:'var(--surface)'}} onClick={() => handleDelete(task)}>Smazat</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* Complete dialog - create time entry */}
      {completeDialog && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div className="card" style={{maxWidth:420,width:'100%',padding:24}}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>DokonÄit Ãºkol</div>
            <div style={{fontSize:13,color:'var(--text-secondary)',marginBottom:16}}>Zadejte Äas strÃ¡venÃ½ na Ãºkolu â automaticky se vytvoÅÃ­ zÃ¡znam v trackeru.</div>

            <div style={{marginBottom:12}}>
              <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:6}}>Popis zÃ¡znamu</label>
              <input className="input" value={completeDesc} onChange={e => setCompleteDesc(e.target.value)} />
            </div>

            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:6}}>StrÃ¡venÃ½ Äas</label>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input className="input" type="number" min="0" value={completeDuration.hours} onChange={e => setCompleteDuration({...completeDuration, hours: e.target.value})} style={{width:60}} />
                <span style={{fontSize:12,color:'var(--text-secondary)'}}>h</span>
                <input className="input" type="number" min="0" max="59" value={completeDuration.mins} onChange={e => setCompleteDuration({...completeDuration, mins: e.target.value})} style={{width:60}} />
                <span style={{fontSize:12,color:'var(--text-secondary)'}}>min</span>
              </div>
            </div>

            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setCompleteDialog(null)}>ZruÅ¡it</button>
              <button className="btn btn-primary" style={{flex:2}} onClick={handleComplete}>DokonÄit a vytvoÅit zÃ¡znam</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign dialog */}
      {assignDialog && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div className="card" style={{maxWidth:360,width:'100%',padding:24}}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>PÅiÅadit zodpovÄdnou osobu</div>
            <div style={{fontSize:13,color:'var(--text-secondary)',marginBottom:16}}>Ãkol: {assignDialog.title}</div>

            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {assignableUsers.map(u => (
                <button key={u.id} className="btn btn-outline" style={{display:'flex',alignItems:'center',padding:'10px 14px',width:'100%'}}
                  onClick={() => handleAssign(assignDialog.id, u.id)}>
                  <span style={{width:28,height:28,borderRadius:'50%',background:'var(--primary)',color:'white',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,marginRight:10,flexShrink:0}}>{u.name.charAt(0)}</span>
                  <span style={{textAlign:'left',flex:1}}>{u.name}</span>
                  <span style={{fontSize:11,color:'var(--text-secondary)',textAlign:'right',flexShrink:0}}>{u.position || u.division || ''}</span>
                </button>
              ))}
            </div>

            <button className="btn btn-outline" style={{width:'100%',marginTop:12}} onClick={() => setAssignDialog(null)}>ZruÅ¡it</button>
          </div>
        </div>
      )}
    </div>
  );
}

