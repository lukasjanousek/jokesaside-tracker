// ==================== MAIN APP ====================
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState(null);
  const [timerCompany, setTimerCompany] = useState(null);
  const [timerDesc, setTimerDesc] = useState('');
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [billingLocks, setBillingLocks] = useState([]);
  const [discountSchemes, setDiscountSchemes] = useState([]);
  const [retainers, setRetainers] = useState([]);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [recurringMeetings, setRecurringMeetings] = useState([]);
  const [clientTasks, setClientTasks] = useState([]);
  const [clientProfiles, setClientProfiles] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Check session on mount
  useEffect(() => {
    if (!supabase) return;
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadUserProfile(session.user.id);
      }
    };
    checkSession();
  }, []);

  const loadUserProfile = async (userId) => {
    if (!supabase) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile) {
        setCurrentUser(profile);
        setIsLoggedIn(true);
        await loadAllData();
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const loadAllData = async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      const [companiesRes, usersRes, entriesRes, schemesRes, schemeCompaniesRes, schemeTiersRes, meetingsRes, locksRes, retainersRes, approvalRes, clientTasksRes, clientProfilesRes] = await Promise.all([
        supabase.from('companies').select('*').eq('is_active', true),
        supabase.from('profiles').select('*').eq('is_active', true),
        supabase.from('time_entries').select('*').order('created_at', { ascending: false }),
        supabase.from('discount_schemes').select('*'),
        supabase.from('discount_scheme_companies').select('*'),
        supabase.from('discount_tiers').select('*'),
        supabase.from('recurring_meetings').select('*'),
        supabase.from('billing_locks').select('*'),
        supabase.from('retainers').select('*'),
        supabase.from('approval_requests').select('*'),
        supabase.from('client_tasks').select('*').eq('is_deleted', false).order('created_at', { ascending: false }),
        supabase.from('client_profiles').select('*'),
      ]);

      if (companiesRes.data) setCompanies(companiesRes.data);
      if (usersRes.data) setUsers(usersRes.data);
      if (entriesRes.data) setEntries(entriesRes.data);
      // Merge discount schemes with their companies and tiers
      if (schemesRes.data) {
        const schemes = schemesRes.data.map(s => ({
          ...s,
          companyIds: (schemeCompaniesRes.data || []).filter(sc => sc.scheme_id === s.id).map(sc => sc.company_id),
          tiers: (schemeTiersRes.data || []).filter(t => t.scheme_id === s.id).sort((a,b) => a.from_czk - b.from_czk)
        }));
        setDiscountSchemes(schemes);
      }
      console.log('[Meetings] raw response:', JSON.stringify(meetingsRes));
      if (meetingsRes.error) console.error('[Meetings] DB error:', meetingsRes.error);
      if (meetingsRes.data && meetingsRes.data.length > 0) {
        const normalized = meetingsRes.data.map(m => ({
          ...m,
          companyIds: m.company_ids || m.companyIds || [],
          participantIds: m.participant_ids || m.participantIds || [],
          confirmedParticipantIds: m.confirmed_participant_ids || m.confirmedParticipantIds || [],
          authorId: m.author_id || m.authorId,
          dayOfWeek: m.day_of_week ?? m.dayOfWeek ?? 0,
          dayOfMonth: m.day_of_month ?? m.dayOfMonth ?? 1,
          durationMin: m.duration_min || m.durationMin || 60,
          startDate: m.start_date || m.startDate,
          endDate: m.end_date || m.endDate,
          isActive: m.is_active ?? m.isActive ?? true,
        }));
        console.log('[Meetings] normalized:', JSON.stringify(normalized));
        setRecurringMeetings(normalized);
      } else if (meetingsRes.data) {
        console.log('[Meetings] empty array from DB');
        setRecurringMeetings([]);
      }
      if (locksRes.data) setBillingLocks(locksRes.data);
      if (retainersRes.data) setRetainers(retainersRes.data);
      if (approvalRes && approvalRes.data) setApprovalRequests(approvalRes.data);
      if (clientTasksRes && clientTasksRes.data) setClientTasks(clientTasksRes.data);
      if (clientProfilesRes && clientProfilesRes.data) setClientProfiles(clientProfilesRes.data);
      // Load notifications for current user
      const { data: notifData } = await supabase.from('task_notifications').select('*').order('created_at', { ascending: false });
      if (notifData) setNotifications(notifData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (email, password) => {
    if (!supabase) {
      setAuthError('Supabase nenÃ­ nakonfigurovÃ¡n');
      return;
    }
    try {
      setLoading(true);
      setAuthError('');
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) throw signUpError;
      setAuthError('ÃÄet vytvoÅen! NynÃ­ se pÅihlaste.');
    } catch (err) {
      setAuthError(err.message || 'Chyba pÅi registraci');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (email, password) => {
    if (!supabase) {
      setAuthError('Supabase nenÃ­ nakonfigurovÃ¡n');
      return;
    }
    try {
      setLoading(true);
      setAuthError('');
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      if (authData.user) {
        await loadUserProfile(authData.user.id);
      }
    } catch (err) {
      setAuthError(err.message || 'Chyba pÅi pÅihlÃ¡Å¡enÃ­');
    } finally {
      setLoading(false);
    }
  };

  // Timer tick
  useEffect(() => {
    if (!timerRunning || !timerStart) return;
    const iv = setInterval(() => setTimerElapsed(Date.now() - timerStart), 1000);
    return () => clearInterval(iv);
  }, [timerRunning, timerStart]);

  // Generate entries from recurring meetings
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    recurringMeetings.forEach(meeting => {
      // Support both camelCase and snake_case property names
      const isActive = meeting.isActive ?? meeting.is_active;
      const mStartDate = meeting.startDate || meeting.start_date;
      const mEndDate = meeting.endDate || meeting.end_date;
      const mDayOfWeek = meeting.dayOfWeek ?? meeting.day_of_week;
      const mDayOfMonth = meeting.dayOfMonth ?? meeting.day_of_month;
      const mDurationMin = meeting.durationMin || meeting.duration_min;

      if (!isActive) return;
      if (!mStartDate) return;
      const endDate = mEndDate ? mEndDate : today;
      if (today < mStartDate || today > endDate) return;

      const datesToGenerate = [];
      const currentDate = new Date(mStartDate);
      const maxDate = new Date(endDate);
      maxDate.setDate(maxDate.getDate() + 1);

      while (currentDate < maxDate) {
        const dateStr = currentDate.toISOString().slice(0, 10);
        const dayOfWeek = currentDate.getDay();

        let shouldGenerate = false;
        if (meeting.frequency === 'daily' && dayOfWeek >= 1 && dayOfWeek <= 5) {
          shouldGenerate = true;
        } else if (meeting.frequency === 'weekly' && dayOfWeek === mDayOfWeek) {
          shouldGenerate = true;
        } else if (meeting.frequency === 'monthly' && currentDate.getDate() === mDayOfMonth) {
          shouldGenerate = true;
        }

        if (shouldGenerate) {
          datesToGenerate.push(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Generate entries for confirmed participants and companies
      if (!supabase) return;
      const confirmedIds = meeting.confirmedParticipantIds || meeting.confirmed_participant_ids || meeting.participantIds || meeting.participant_ids || [];
      const companyIds = meeting.companyIds || meeting.company_ids || [];
      console.log('[Meetings] Generating entries for:', meeting.description, '| dates:', datesToGenerate.length, '| participants:', confirmedIds.length, '| companies:', companyIds.length);
      datesToGenerate.forEach(date => {
        confirmedIds.forEach(userId => {
          companyIds.forEach(companyId => {
            const exists = entries.some(e =>
              e.recurring_meeting_id === meeting.id &&
              e.date === date &&
              e.user_id === userId &&
              e.company_id === companyId
            );
            if (!exists) {
              addEntry({
                user_id: userId,
                company_id: companyId,
                description: meeting.description,
                duration_min: mDurationMin,
                date,
                is_manual: false,
                recurring_meeting_id: meeting.id
              });
            }
          });
        });
      });
    });
  }, [recurringMeetings, entries]);

  const getSchemeForCompany = useCallback((companyId) => {
    return discountSchemes.find(scheme => scheme.companyIds && scheme.companyIds.includes(companyId)) || null;
  }, [discountSchemes]);

  const getCompanyBudget = useCallback((companyId, monthKey) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return { payment: 0, credit: 0, rollover: 0, total: 0, used: 0, remaining: 0, pct: 0 };

    // Find retainer for this month (or inherit from valid_from)
    let ret = retainers.find(r => r.company_id === companyId && r.month === monthKey);
    if (!ret) {
      // Look for a base retainer with valid_from <= monthKey
      const baseRetainers = retainers
        .filter(r => r.company_id === companyId && r.valid_from && r.valid_from <= monthKey)
        .sort((a,b) => b.valid_from.localeCompare(a.valid_from));
      if (baseRetainers.length > 0) ret = baseRetainers[0];
    }
    const payment = ret ? ret.payment_czk : 0;
    const rollover = ret && ret.month === monthKey ? parseFloat(ret.rollover_czk || 0) : 0;

    const scheme = getSchemeForCompany(companyId);
    const tiers = scheme && !scheme.no_discount ? scheme.tiers : null;
    const credit = calculateCredit(payment, tiers);
    const total = credit + rollover;

    const monthEntries = entries.filter(e => e.company_id === companyId && getMonthKey(e.date) === monthKey);
    let used = 0;
    for (const entry of monthEntries) {
      const user = users.find(u => u.id === entry.user_id);
      if (user) used += (entry.duration_min / 60) * user.hourly_rate;
    }

    const remaining = total - used;
    const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
    return { payment, credit, rollover, total, used, remaining, pct };
  }, [companies, entries, users, retainers, getSchemeForCompany]);

  const addEntry = async (entry) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .insert([entry])
        .select();
      if (error) throw error;
      if (data) setEntries(prev => [...prev, data[0]]);
    } catch (err) {
      console.error('Error adding entry:', err);
    }
  };

  const deleteEntry = async (entryId) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId);
      if (error) throw error;
      setEntries(prev => prev.filter(e => e.id !== entryId));
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
  };

  const updateEntry = async (entryId, updates) => {
    if (!supabase) return;
    try {
      const updatesWithTime = { ...updates, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from('time_entries')
        .update(updatesWithTime)
        .eq('id', entryId);
      if (error) throw error;
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...updatesWithTime } : e));
    } catch (err) {
      console.error('Error updating entry:', err);
    }
  };

  const isEntryLocked = useCallback((entry) => {
    return billingLocks.some(lock => entry.date >= lock.date_from && entry.date <= lock.date_to);
  }, [billingLocks]);

  // === NOTIFICATION HELPERS ===
  const createNotifications = async (participantIds, referenceId, referenceType, title, message) => {
    if (!supabase || !currentUser) return;
    const otherIds = participantIds.filter(uid => uid !== currentUser.id);
    if (otherIds.length === 0) return;
    const rows = otherIds.map(uid => ({
      user_id: uid,
      type: 'task_invitation',
      reference_id: referenceId,
      reference_type: referenceType,
      title,
      message,
      status: 'pending',
      created_by: currentUser.id,
    }));
    const { data, error } = await supabase.from('task_notifications').insert(rows).select();
    if (!error && data) setNotifications(prev => [...data, ...prev]);
  };

  const handleNotificationResponse = async (notif, accept) => {
    if (!supabase) return;
    const newStatus = accept ? 'accepted' : 'declined';
    const { error } = await supabase.from('task_notifications').update({ status: newStatus, responded_at: new Date().toISOString() }).eq('id', notif.id);
    if (error) { alert('Chyba: ' + error.message); return; }
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, status: newStatus, responded_at: new Date().toISOString() } : n));

    // If accepted, add user to confirmed_participant_ids
    if (accept && notif.reference_type === 'recurring_meeting') {
      const meeting = recurringMeetings.find(m => m.id === notif.reference_id);
      if (meeting) {
        const confirmed = [...(meeting.confirmedParticipantIds || meeting.confirmed_participant_ids || [])];
        if (!confirmed.includes(notif.user_id)) {
          confirmed.push(notif.user_id);
          const { error: updateErr } = await supabase.from('recurring_meetings').update({ confirmed_participant_ids: confirmed }).eq('id', notif.reference_id);
          if (!updateErr) {
            setRecurringMeetings(prev => prev.map(m => m.id === notif.reference_id ? { ...m, confirmedParticipantIds: confirmed, confirmed_participant_ids: confirmed } : m));
          }
        }
      }
    }
    // For client_task acceptance, update status to pracuje_se if it was zadano
    if (accept && notif.reference_type === 'client_task') {
      const task = clientTasks.find(t => t.id === notif.reference_id);
      if (task && task.status === 'zadano') {
        await supabase.from('client_tasks').update({ status: 'pracuje_se', updated_at: new Date().toISOString() }).eq('id', notif.reference_id);
        setClientTasks(prev => prev.map(t => t.id === notif.reference_id ? { ...t, status: 'pracuje_se' } : t));
      }
    }
  };

  const pendingNotifications = notifications.filter(n => n.status === 'pending' && n.user_id === currentUser?.id);

  const navTo = (p, companyId) => {
    setPage(p);
    if (companyId !== undefined) setSelectedCompanyId(companyId);
  };

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLogin} onSignUp={handleSignUp} loading={loading} error={authError} />;
  }

  return (
    <div className="app" onClick={()=>showNotifications && setShowNotifications(false)}>
      <div className="topbar">
        <div className="topbar-title">Jokes Aside</div>
        <div className="topbar-user">
          <div style={{position:'relative',marginRight:4}}>
            <button onClick={()=>setShowNotifications(!showNotifications)} style={{background:'none',border:'none',cursor:'pointer',padding:6,position:'relative'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pendingNotifications.length > 0 ? 'var(--primary)' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              {pendingNotifications.length > 0 && (
                <span style={{position:'absolute',top:2,right:2,width:16,height:16,borderRadius:'50%',background:'var(--danger)',color:'white',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{pendingNotifications.length}</span>
              )}
            </button>
            {showNotifications && (
              <div style={{position:'absolute',right:0,top:'100%',marginTop:8,width:340,maxHeight:420,overflowY:'auto',background:'var(--surface)',borderRadius:'var(--radius)',border:'1px solid var(--border)',boxShadow:'var(--shadow-lg)',zIndex:999,padding:0}} onClick={e=>e.stopPropagation()}>
                <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',fontWeight:700,fontSize:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span>Notifikace</span>
                  <button onClick={()=>setShowNotifications(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:'var(--text-secondary)'}}>x</button>
                </div>
                {notifications.filter(n => n.user_id === currentUser?.id).length === 0 ? (
                  <div style={{padding:24,textAlign:'center',color:'var(--text-secondary)',fontSize:13}}>ZatÃ­m Å¾Ã¡dnÃ© notifikace</div>
                ) : (
                  notifications.filter(n => n.user_id === currentUser?.id).slice(0, 20).map(n => {
                    const creator = users.find(u => u.id === n.created_by);
                    const isPending = n.status === 'pending';
                    const statusColors = { pending: {bg:'#fffbeb',color:'#b45309'}, accepted: {bg:'#f0fdf4',color:'var(--success)'}, declined: {bg:'#fef2f2',color:'var(--danger)'} };
                    const sc = statusColors[n.status] || statusColors.pending;
                    return (
                      <div key={n.id} style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',background:isPending?'#fefce8':'transparent'}}>
                        <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{n.title}</div>
                        {n.message && <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:6}}>{n.message}</div>}
                        <div style={{fontSize:11,color:'var(--text-secondary)',marginBottom:6}}>
                          Od: {creator?.name || 'NeznÃ¡mÃ½'} Â· {new Date(n.created_at).toLocaleDateString('cs-CZ')}
                        </div>
                        {isPending ? (
                          <div style={{display:'flex',gap:8}}>
                            <button onClick={()=>handleNotificationResponse(n, true)} style={{flex:1,padding:'6px 0',fontSize:12,fontWeight:600,borderRadius:6,border:'none',background:'var(--success)',color:'white',cursor:'pointer'}}>PÅijmout</button>
                            <button onClick={()=>handleNotificationResponse(n, false)} style={{flex:1,padding:'6px 0',fontSize:12,fontWeight:600,borderRadius:6,border:'1px solid var(--danger)',background:'white',color:'var(--danger)',cursor:'pointer'}}>OdmÃ­tnout</button>
                          </div>
                        ) : (
                          <div style={{fontSize:11,fontWeight:600,color:sc.color,background:sc.bg,padding:'3px 8px',borderRadius:4,display:'inline-block'}}>
                            {n.status === 'accepted' ? 'PÅijato' : 'OdmÃ­tnuto'}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <button onClick={async () => { if(supabase) { await supabase.auth.signOut(); setIsLoggedIn(false); setCurrentUser(null); } }} style={{fontSize:12,color:'var(--text-secondary)',marginRight:8,cursor:'pointer',background:'none',border:'none'}}>OdhlÃ¡sit</button>
          <span style={{fontSize: 13, color: 'var(--text-secondary)'}}>{currentUser?.name?.split(' ')[0]}</span>
          <div className="avatar">{currentUser?.name?.charAt(0) || '?'}</div>
        </div>
      </div>

      <div className="main">
        {page === 'dashboard' && (
          <Dashboard
            companies={companies} users={users} entries={entries}
            getCompanyBudget={getCompanyBudget} onSelectCompany={(id) => navTo('company', id)}
            timerRunning={timerRunning} timerCompany={timerCompany} timerDesc={timerDesc}
            timerElapsed={timerElapsed} timerStart={timerStart}
            onStartTimer={(compId, desc) => { setTimerRunning(true); setTimerStart(Date.now()); setTimerCompany(compId); setTimerDesc(desc); setTimerElapsed(0); }}
            onStopTimer={() => {
              if (timerCompany && timerDesc) {
                const mins = Math.max(15, Math.round(timerElapsed / 60000));
                addEntry({ user_id: currentUser.id, company_id: timerCompany, description: timerDesc, duration_min: mins, date: new Date().toISOString().slice(0,10), is_manual: false });
              }
              setTimerRunning(false); setTimerStart(null); setTimerCompany(null); setTimerDesc(''); setTimerElapsed(0);
            }}
            onAddManual={(compId, desc, mins, date, userId) => {
              addEntry({ user_id: userId || currentUser.id, company_id: compId, description: desc, duration_min: mins, date, is_manual: true });
            }}
            currentUser={currentUser}
            recurringMeetings={recurringMeetings}
            setRecurringMeetings={setRecurringMeetings}
            createNotifications={createNotifications}
          />
        )}
        {page === 'company' && selectedCompanyId && (
          <CompanyDetail
            company={companies.find(c => c.id === selectedCompanyId)}
            users={users} entries={entries}
            getCompanyBudget={getCompanyBudget}
            onBack={() => navTo('dashboard')}
            onDeleteEntry={deleteEntry}
            onUpdateEntry={updateEntry}
            companies={companies}
            currentUser={currentUser}
            isEntryLocked={isEntryLocked}
            recurringMeetings={recurringMeetings}
          />
        )}
        {page === 'track' && (
          <TrackPage
            companies={companies} currentUser={currentUser} entries={entries} users={users}
            timerRunning={timerRunning} timerCompany={timerCompany} timerDesc={timerDesc}
            timerElapsed={timerElapsed}
            onStartTimer={(compId, desc) => { setTimerRunning(true); setTimerStart(Date.now()); setTimerCompany(compId); setTimerDesc(desc); setTimerElapsed(0); }}
            onStopTimer={() => {
              if (timerCompany && timerDesc) {
                const mins = Math.max(1, Math.round(timerElapsed / 60000));
                addEntry({ user_id: currentUser.id, company_id: timerCompany, description: timerDesc, duration_min: mins, date: new Date().toISOString().slice(0,10), is_manual: false });
              }
              setTimerRunning(false); setTimerStart(null); setTimerCompany(null); setTimerDesc(''); setTimerElapsed(0);
            }}
            onAddManual={(compId, desc, mins, date, userId) => {
              addEntry({ user_id: userId || currentUser.id, company_id: compId, description: desc, duration_min: mins, date, is_manual: true });
            }}
            onDeleteEntry={deleteEntry}
            onUpdateEntry={updateEntry}
            isEntryLocked={isEntryLocked}
            recurringMeetings={recurringMeetings}
            setRecurringMeetings={setRecurringMeetings}
          />
        )}
        {page === 'reports' && (
          <ReportsPage
            companies={companies} users={users} entries={entries}
            currentUser={currentUser} billingLocks={billingLocks}
            approvalRequests={approvalRequests} setApprovalRequests={setApprovalRequests}
            discountSchemes={discountSchemes} retainers={retainers}
            addBillingLock={async (lock) => {
              if (supabase) {
                const { data, error } = await supabase.from('billing_locks').insert([lock]).select();
                if (!error && data && data[0]) {
                  setBillingLocks(prev => [...prev, data[0]]);
                }
              }
            }}
          />
        )}
        {page === 'meetings' && (
          <MeetingsPage
            companies={companies} users={users} currentUser={currentUser}
            recurringMeetings={recurringMeetings} setRecurringMeetings={setRecurringMeetings}
            entries={entries}
            createNotifications={createNotifications}
          />
        )}
        {page === 'client-tasks' && (
          <ClientTasksPage
            clientTasks={clientTasks} setClientTasks={setClientTasks}
            clientProfiles={clientProfiles}
            companies={companies} users={users} currentUser={currentUser}
            entries={entries} setEntries={setEntries}
            createNotifications={createNotifications}
          />
        )}
        {page === 'admin' && (
          <AdminPage
            companies={companies} setCompanies={setCompanies}
            users={users} setUsers={setUsers}
            discountSchemes={discountSchemes} setDiscountSchemes={setDiscountSchemes}
            retainers={retainers} setRetainers={setRetainers}
            recurringMeetings={recurringMeetings} setRecurringMeetings={setRecurringMeetings}
            currentUser={currentUser}
          />
        )}
      </div>

      <div className="bottomnav">
        <button className={`nav-item ${page === 'dashboard' ? 'active' : ''}`} onClick={() => navTo('dashboard')} title="Dashboard">
          {Icons.home}
          <span>Dashboard</span>
        </button>
        <button className={`nav-item ${page === 'track' ? 'active' : ''}`} onClick={() => navTo('track')} title="Tracking">
          {Icons.clock}
          <span>Tracking</span>
        </button>
        <button className={`nav-item ${page === 'meetings' ? 'active' : ''}`} onClick={() => navTo('meetings')} title="OpakovanÃ©">
          {Icons.users}
          <span>OpakovanÃ©</span>
        </button>
        <button className={`nav-item ${page === 'client-tasks' ? 'active' : ''}`} onClick={() => navTo('client-tasks')} title="Ãkoly">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          <span>Ãkoly</span>
        </button>
        <button className={`nav-item ${page === 'reports' ? 'active' : ''}`} onClick={() => navTo('reports')} title="Reports">
          {Icons.chart}
          <span>Reports</span>
        </button>
        <button className={`nav-item ${page === 'admin' ? 'active' : ''}`} onClick={() => navTo('admin')} title="Admin">
          {Icons.settings}
          <span>Admin</span>
        </button>
      </div>
    </div>
  );
}

