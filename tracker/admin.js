// ==================== ADMIN PAGE ====================
function AdminPage({ companies, setCompanies, users, setUsers, discountSchemes, setDiscountSchemes, retainers, setRetainers, recurringMeetings, setRecurringMeetings, currentUser }) {
  const [tab, setTab] = useState('profile');
  const [editUser, setEditUser] = useState(null);
  const [editCompany, setEditCompany] = useState(null);
  const [editingScheme, setEditingScheme] = useState(null);
  const [retainerMonth, setRetainerMonth] = useState(currentMonthKey());
  const [editRetainer, setEditRetainer] = useState(null);

  const isAdmin = currentUser?.is_admin === true;

  const handleSaveUser = async (userData) => {
    if (window.__supabase && userData.id) {
      const updateData = {
        name: userData.name, email: userData.email, position: userData.position,
        division: userData.division, hourly_rate: userData.hourly_rate,
        manager_id: userData.manager_id || null
      };
      if (isAdmin) updateData.is_admin = userData.is_admin;
      await window.__supabase.from('profiles').update(updateData).eq('id', userData.id);
    }
    setUsers(prev => prev.map(u => u.id === userData.id ? {...u, ...userData} : u));
    if (userData.id === currentUser?.id) {
      // Update currentUser if editing self
    }
    setEditUser(null);
  };

  const handleSaveCompany = async (company) => {
    const sb = window.__supabase;
    if (!sb) return;
    if (!company.name || !company.ico) {
      alert('VyplÅte prosÃ­m: ' + (!company.name ? 'NÃ¡zev' : '') + (!company.name && !company.ico ? ', ' : '') + (!company.ico ? 'IÄ' : ''));
      return;
    }
    // Check for duplicate IÄ
    const duplicate = companies.find(c => c.ico === company.ico && c.id !== company.id);
    if (duplicate) {
      alert('Firma s IÄ ' + company.ico + ' jiÅ¾ existuje: ' + duplicate.name);
      return;
    }
    const compData = {
      name: company.name, legal_name: company.legal_name, address: company.address,
      ico: company.ico, dic: company.dic, is_vat_payer: company.is_vat_payer,
      color: company.color || '#6366f1', is_active: company.is_active !== false
    };
    if (company.id) {
      await sb.from('companies').update(compData).eq('id', company.id);
      setCompanies(prev => prev.map(c => c.id === company.id ? {...c, ...compData} : c));
    } else {
      const { data: inserted, error } = await sb.from('companies').insert([compData]).select();
      if (!error && inserted?.[0]) {
        setCompanies(prev => [...prev, inserted[0]]);
      }
    }
    setEditCompany(null);
  };

  const handleSaveScheme = async (scheme) => {
    if (!window.__supabase) return;
    const sb = window.__supabase;

    if (scheme.id) {
      // Update existing
      await sb.from('discount_schemes').update({ name: scheme.name, no_discount: scheme.no_discount }).eq('id', scheme.id);
      // Replace companies
      await sb.from('discount_scheme_companies').delete().eq('scheme_id', scheme.id);
      if (scheme.companyIds.length > 0) {
        await sb.from('discount_scheme_companies').insert(scheme.companyIds.map(cid => ({ scheme_id: scheme.id, company_id: cid })));
      }
      // Replace tiers
      await sb.from('discount_tiers').delete().eq('scheme_id', scheme.id);
      if (!scheme.no_discount && scheme.tiers && scheme.tiers.length > 0) {
        await sb.from('discount_tiers').insert(scheme.tiers.map(t => ({ scheme_id: scheme.id, from_czk: t.from_czk, to_czk: t.to_czk, discount_pct: t.discount_pct })));
      }
      setDiscountSchemes(prev => prev.map(s => s.id === scheme.id ? scheme : s));
    } else {
      // Insert new
      const { data } = await sb.from('discount_schemes').insert([{ name: scheme.name, no_discount: scheme.no_discount }]).select();
      if (data && data[0]) {
        const newId = data[0].id;
        if (scheme.companyIds.length > 0) {
          await sb.from('discount_scheme_companies').insert(scheme.companyIds.map(cid => ({ scheme_id: newId, company_id: cid })));
        }
        if (!scheme.no_discount && scheme.tiers && scheme.tiers.length > 0) {
          await sb.from('discount_tiers').insert(scheme.tiers.map(t => ({ scheme_id: newId, from_czk: t.from_czk, to_czk: t.to_czk, discount_pct: t.discount_pct })));
        }
        setDiscountSchemes(prev => [...prev, { ...scheme, id: newId }]);
      }
    }
    setEditingScheme(null);
  };

  const handleDeleteScheme = async (schemeId) => {
    if (window.__supabase) {
      await window.__supabase.from('discount_schemes').delete().eq('id', schemeId);
    }
    setDiscountSchemes(prev => prev.filter(s => s.id !== schemeId));
  };

  return (
    <div>
      <div className="section-title">Administrace</div>

      <div className="tabs">
        <button className={`tab ${tab==='profile'?'active':''}`} onClick={()=>setTab('profile')}>MÅ¯j profil</button>
        {isAdmin && <button className={`tab ${tab==='users'?'active':''}`} onClick={()=>setTab('users')}>LidÃ©</button>}
        <button className={`tab ${tab==='companies'?'active':''}`} onClick={()=>setTab('companies')}>Firmy</button>
        {isAdmin && <button className={`tab ${tab==='tiers'?'active':''}`} onClick={()=>setTab('tiers')}>SlevovÃ¡ pÃ¡sma</button>}
      </div>

      {tab === 'profile' && currentUser && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <h3 style={{marginBottom:12,fontSize:16}}>MÅ¯j profil</h3>
            <div className="form-group">
              <label className="form-label">JmÃ©no</label>
              <input className="input" value={currentUser.name||''} onChange={e=>setCurrentUser && setUsers(prev => { const updated = {...currentUser, name:e.target.value}; return prev.map(u=>u.id===currentUser.id?updated:u); })} disabled />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><span style={{fontSize:12,color:'var(--text-secondary)'}}>Email</span><div style={{fontWeight:500}}>{currentUser.email}</div></div>
              <div><span style={{fontSize:12,color:'var(--text-secondary)'}}>Pozice</span><div style={{fontWeight:500}}>{currentUser.position || 'â'}</div></div>
              <div><span style={{fontSize:12,color:'var(--text-secondary)'}}>Divize</span><div style={{fontWeight:500}}>{currentUser.division || 'â'}</div></div>
              <div><span style={{fontSize:12,color:'var(--text-secondary)'}}>HodinovÃ¡ sazba</span><div style={{fontWeight:500}}>{currentUser.hourly_rate} KÄ</div></div>
              {currentUser.manager_id && <div><span style={{fontSize:12,color:'var(--text-secondary)'}}>ManaÅ¾er</span><div style={{fontWeight:500}}>{users.find(u=>u.id===currentUser.manager_id)?.name || 'â'}</div></div>}
            </div>
            <button className="btn btn-outline btn-sm" style={{marginTop:12}} onClick={() => setEditUser({...currentUser})}>
              <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.edit}</span> Upravit profil
            </button>
          </div>
        </div>
      )}

      {tab === 'users' && isAdmin && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button className="btn btn-primary btn-sm" onClick={() => setEditUser({id:'',name:'',email:'',position:'',division:'',hourly_rate:0,is_admin:false})}>
              <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.plus}</span> PÅidat osobu
            </button>
          </div>
          <div className="scroll-x">
            <table className="admin-table">
              <thead><tr><th>JmÃ©no</th><th>Pozice</th><th>Divize</th><th>Sazba</th><th>Admin</th><th></th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><div style={{fontWeight:500}}>{u.name}</div><div style={{fontSize:12,color:'var(--text-secondary)'}}>{u.email}</div></td>
                    <td>{u.position}</td>
                    <td>{u.division}</td>
                    <td>{(u.hourly_rate||0).toLocaleString('cs-CZ')} KÄ/h</td>
                    <td>{u.is_admin ? <span className="badge badge-success">Admin</span> : 'â'}</td>
                    <td>
                      <button className="btn-icon btn-outline btn-sm" onClick={() => setEditUser({...u})} title="Upravit">
                        <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.edit}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'companies' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button className="btn btn-primary btn-sm" onClick={() => setEditCompany({id:'',name:'',legal_name:'',address:'',ico:'',dic:'',is_vat_payer:false,color:'#6366f1',is_active:true})}>
              <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.plus}</span> PÅidat firmu
            </button>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
            <label className="form-label" style={{margin:0,whiteSpace:'nowrap'}}>MÄsÃ­c:</label>
            <input className="input" type="month" value={retainerMonth} onChange={e=>setRetainerMonth(e.target.value)} style={{flex:1,maxWidth:200}} />
            <span style={{fontSize:13,color:'var(--text-secondary)'}}>{getMonthLabel(retainerMonth)}</span>
          </div>
          {companies.map(c => {
            const ret = retainers.find(r => r.company_id === c.id && r.month === retainerMonth);
            const payment = ret ? ret.payment_czk : 0;
            const rollover = ret ? parseFloat(ret.rollover_czk || 0) : 0;
            const validFrom = ret ? ret.valid_from : null;
            const scheme = discountSchemes.find(s => s.companyIds && s.companyIds.includes(c.id));
            const tiers = scheme && !scheme.no_discount ? scheme.tiers : null;
            const credit = calculateCredit(payment, tiers);

            // If no retainer for this month, check if there's a base retainer (valid_from <= this month)
            let inheritedPayment = payment;
            let inheritedRollover = rollover;
            let isInherited = false;
            if (!ret) {
              const baseRetainers = retainers
                .filter(r => r.company_id === c.id && r.valid_from && r.valid_from <= retainerMonth)
                .sort((a,b) => b.valid_from.localeCompare(a.valid_from));
              if (baseRetainers.length > 0) {
                inheritedPayment = baseRetainers[0].payment_czk;
                isInherited = true;
              }
            }
            const displayPayment = ret ? payment : inheritedPayment;
            const displayCredit = calculateCredit(displayPayment, tiers);

            return (
              <div key={c.id} className="card" style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:15}}>{c.name}</div>
                    <div style={{fontSize:12,color:'var(--text-secondary)'}}>
                      {c.ico ? 'IÄ: '+c.ico : ''}{c.dic ? ' Â· DIÄ: '+c.dic : ''}{c.is_vat_payer ? ' Â· PlÃ¡tce DPH' : ''}
                    </div>
                    {scheme && <div style={{fontSize:12,color:'var(--primary)',marginTop:2}}>SlevovÃ© schÃ©ma: {scheme.name}</div>}
                    {isInherited && <div style={{fontSize:11,color:'var(--warning)',marginTop:2}}>ZdÄdÄno z dÅÃ­vÄjÅ¡Ã­ho nastavenÃ­</div>}
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-outline btn-sm" onClick={() => setEditCompany({...c})}>
                      <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.settings}</span>
                    </button>
                    {isAdmin && currentUser?.email === 'lukas.janousek@gmail.com' && <button className="btn btn-outline btn-sm" style={{color:'var(--danger)',borderColor:'var(--danger)'}} onClick={async () => {
                      if (!confirm('Opravdu chcete smazat firmu "' + c.name + '"? Tato akce je nevratnÃ¡.')) return;
                      try {
                        const sb = window.__supabase;
                        if (sb) {
                          const { error } = await sb.from('companies').update({is_active: false}).eq('id', c.id);
                          if (error) throw error;
                        }
                        setCompanies(companies.filter(co => co.id !== c.id));
                      } catch(err) { alert('Chyba pÅi mazÃ¡nÃ­: ' + err.message); }
                    }}>
                      <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.trash}</span>
                    </button>}
                    {isAdmin && <button className="btn btn-outline btn-sm" onClick={() => setEditRetainer({
                      company_id: c.id, company_name: c.name, month: retainerMonth,
                      payment_czk: ret ? ret.payment_czk : inheritedPayment,
                      rollover_czk: ret ? parseFloat(ret.rollover_czk||0) : 0,
                      valid_from: ret ? (ret.valid_from || retainerMonth) : retainerMonth,
                      existing_id: ret ? ret.id : null
                    })}>
                      <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.edit}</span>
                    </button>}
                  </div>
                </div>
                <div className="stats-row" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
                  <div className="stat-box">
                    <div className="stat-value" style={{fontSize:16}}>{formatCzk(displayPayment)}</div>
                    <div className="stat-label">Platba</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-value" style={{fontSize:16}}>{formatCzk(displayCredit)}</div>
                    <div className="stat-label">Kredit</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-value" style={{fontSize:16}}>{formatCzk(rollover)}</div>
                    <div className="stat-label">Rollover</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Retainer Modal */}
      {editRetainer && (
        <div className="modal-overlay" onClick={() => setEditRetainer(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h2>Retainer â {editRetainer.company_name}</h2>
            <div style={{fontSize:13,color:'var(--text-secondary)',marginBottom:12}}>MÄsÃ­c: {getMonthLabel(editRetainer.month)}</div>
            <div className="form-group">
              <label className="form-label">PlatÃ­ od (mÄsÃ­c)</label>
              <input className="input" type="month" value={editRetainer.valid_from || ''} onChange={e=>setEditRetainer({...editRetainer, valid_from:e.target.value})} />
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:4}}>Retainer se automaticky pÅenÃ¡Å¡Ã­ do dalÅ¡Ã­ch mÄsÃ­cÅ¯ od tohoto data</div>
            </div>
            <div className="form-group">
              <label className="form-label">MÄsÃ­ÄnÃ­ platba (KÄ)</label>
              <input className="input" type="number" value={editRetainer.payment_czk} onChange={e=>setEditRetainer({...editRetainer, payment_czk:parseInt(e.target.value)||0})} />
            </div>
            <div className="form-group">
              <label className="form-label">Rollover z pÅedchozÃ­ho mÄsÃ­ce (KÄ)</label>
              <input className="input" type="number" value={editRetainer.rollover_czk} onChange={e=>setEditRetainer({...editRetainer, rollover_czk:parseFloat(e.target.value)||0})} />
            </div>
            {(() => {
              const scheme = discountSchemes.find(s => s.companyIds && s.companyIds.includes(editRetainer.company_id));
              const tiers = scheme && !scheme.no_discount ? scheme.tiers : null;
              const credit = calculateCredit(editRetainer.payment_czk, tiers);
              return (
                <div style={{padding:12,background:'var(--bg)',borderRadius:8,marginBottom:16,fontSize:13}}>
                  {scheme && <div style={{marginBottom:6}}>SchÃ©ma: <strong>{scheme.name}</strong> {scheme.no_discount && '(bez slevy)'}</div>}
                  <div>Kredit z platby: <strong>{formatCzk(credit)}</strong></div>
                  <div>+ Rollover: <strong>{formatCzk(editRetainer.rollover_czk)}</strong></div>
                  <div style={{borderTop:'1px solid var(--border)',marginTop:6,paddingTop:6,fontWeight:700}}>
                    CelkovÃ½ budget: {formatCzk(credit + editRetainer.rollover_czk)}
                  </div>
                </div>
              );
            })()}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-outline" onClick={()=>setEditRetainer(null)}>ZruÅ¡it</button>
              <button className="btn btn-primary" onClick={async () => {
                const sb = window.__supabase;
                if (!sb) { alert('Supabase nenÃ­ pÅipojeno'); return; }
                try {
                  const retData = {
                    company_id: editRetainer.company_id,
                    month: editRetainer.month,
                    payment_czk: editRetainer.payment_czk,
                    rollover_czk: editRetainer.rollover_czk,
                    valid_from: editRetainer.valid_from || editRetainer.month
                  };
                  if (editRetainer.existing_id) {
                    const { error } = await sb.from('retainers').update(retData).eq('id', editRetainer.existing_id);
                    if (error) { console.error('Retainer update error:', error); alert('Chyba pÅi uklÃ¡dÃ¡nÃ­: ' + error.message); return; }
                    setRetainers(prev => prev.map(r => r.id === editRetainer.existing_id ? {...r, ...retData, id: editRetainer.existing_id} : r));
                  } else {
                    const { data: inserted, error } = await sb.from('retainers').insert([retData]).select();
                    if (error) { console.error('Retainer insert error:', error); alert('Chyba pÅi uklÃ¡dÃ¡nÃ­: ' + error.message); return; }
                    if (inserted && inserted[0]) setRetainers(prev => [...prev, inserted[0]]);
                  }
                  setEditRetainer(null);
                } catch(err) { console.error('Retainer save error:', err); alert('Chyba: ' + err.message); }
              }}>UloÅ¾it</button>
            </div>
          </div>
        </div>
      )}

            {tab === 'tiers' && isAdmin && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button className="btn btn-primary btn-sm" onClick={() => setEditingScheme({name:'',no_discount:false,companyIds:[],tiers:[{from_czk:0,to_czk:15000,discount_pct:0.20}]})}>
              <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.plus}</span> NovÃ© schÃ©ma
            </button>
          </div>
          {discountSchemes.map(scheme => (
            <div key={scheme.id} className="card" style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div>
                  <div style={{fontWeight:600,fontSize:15}}>{scheme.name}</div>
                  <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:2}}>
                    {scheme.no_discount ? 'Bez slevy (100% kredit)' : (scheme.tiers?.length || 0) + ' pÃ¡sem'}
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditingScheme({...scheme, companyIds: [...(scheme.companyIds||[])], tiers: (scheme.tiers||[]).map(t=>({...t}))})} title="Upravit">
                    <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.edit}</span>
                  </button>
                  {(!scheme.companyIds || scheme.companyIds.length === 0) && (
                    <button className="btn delete-btn" onClick={() => handleDeleteScheme(scheme.id)} title="Smazat">
                      <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.trash}</span>
                    </button>
                  )}
                </div>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:500,color:'var(--text-secondary)',marginBottom:6}}>PÅiÅazenÃ© firmy:</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {(!scheme.companyIds || scheme.companyIds.length === 0) ? (
                    <span style={{fontSize:13,color:'var(--text-secondary)'}}>Å½Ã¡dnÃ©</span>
                  ) : (
                    scheme.companyIds.map(cid => {
                      const comp = companies.find(c => c.id === cid);
                      return <span key={cid} className="badge badge-success">{comp?.name || cid}</span>;
                    })
                  )}
                </div>
              </div>
              {!scheme.no_discount && scheme.tiers && scheme.tiers.length > 0 && (
                <div className="scroll-x">
                  <table className="admin-table" style={{marginTop:8}}>
                    <thead><tr><th>PÃ¡smo</th><th>Od (KÄ)</th><th>Do (KÄ)</th><th>Sleva</th></tr></thead>
                    <tbody>
                      {scheme.tiers.map((t, i) => (
                        <tr key={i}>
                          <td style={{fontWeight:600}}>{i+1}</td>
                          <td>{(t.from_czk||0).toLocaleString('cs-CZ')}</td>
                          <td>{(t.to_czk||0).toLocaleString('cs-CZ')}</td>
                          <td><span className="badge badge-success">{Math.round((t.discount_pct||0)*100)}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {discountSchemes.length === 0 && (
            <div style={{textAlign:'center',color:'var(--text-secondary)',padding:20}}>Å½Ã¡dnÃ¡ slevovÃ¡ schÃ©mata. KliknÄte na "NovÃ© schÃ©ma" pro vytvoÅenÃ­.</div>
          )}
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h2>{editUser.id ? 'Upravit osobu' : 'PÅidat osobu'}</h2>
            <div className="form-group">
              <label className="form-label">JmÃ©no</label>
              <input className="input" value={editUser.name} onChange={e=>setEditUser({...editUser, name:e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="input" type="email" value={editUser.email} onChange={e=>setEditUser({...editUser, email:e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Pozice</label>
              <input className="input" value={editUser.position} onChange={e=>setEditUser({...editUser, position:e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Divize</label>
              <select className="input select" value={editUser.division} onChange={e=>setEditUser({...editUser, division:e.target.value})}>
                <option value="">Vyberte...</option>
                <option value="Finance">Finance</option>
                <option value="Legal">Legal</option>
                <option value="Operations/HR">Operations/HR</option>
                <option value="Marketing">Marketing</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">HodinovÃ¡ sazba (KÄ)</label>
              <input className="input" type="number" value={editUser.hourly_rate} onChange={e=>setEditUser({...editUser, hourly_rate:parseInt(e.target.value)||0})} />
            </div>
            <div className="form-group">
              <label className="form-label">ManaÅ¾er (schvaluje report)</label>
              <select className="input select" value={editUser.manager_id||''} onChange={e=>setEditUser({...editUser, manager_id:e.target.value||null})}>
                <option value="">Å½Ã¡dnÃ½</option>
                {users.filter(u => u.id !== editUser.id).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            {isAdmin && <div className="form-group">
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <input type="checkbox" checked={editUser.is_admin} onChange={e=>setEditUser({...editUser, is_admin:e.target.checked})} />
                <span className="form-label" style={{margin:0}}>AdministrÃ¡tor</span>
              </label>
            </div>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
              <button className="btn btn-outline" onClick={()=>setEditUser(null)}>ZruÅ¡it</button>
              <button className="btn btn-primary" onClick={()=>handleSaveUser(editUser)}>UloÅ¾it</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Company Modal */}
      {editCompany && (
        <div className="modal-overlay" onClick={() => setEditCompany(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h2>{editCompany.id ? 'Upravit firmu â ' + editCompany.name : 'NovÃ¡ firma'}</h2>
            <div className="form-group">
              <label className="form-label">NÃ¡zev</label>
              <input className="input" value={editCompany.name||''} onChange={e=>setEditCompany({...editCompany, name:e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">ObchodnÃ­ jmÃ©no</label>
              <input className="input" value={editCompany.legal_name||''} onChange={e=>setEditCompany({...editCompany, legal_name:e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Adresa</label>
              <input className="input" value={editCompany.address||''} onChange={e=>setEditCompany({...editCompany, address:e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Barva</label>
              <input className="input" type="color" value={editCompany.color||'#6366f1'} onChange={e=>setEditCompany({...editCompany, color:e.target.value})} style={{height:40,padding:4}} />
            </div>
            <div className="form-group">
              <label className="form-label">IÄ <span style={{color:'var(--danger)'}}>*</span></label>
              <input className="input" value={editCompany.ico||''} onChange={e=>setEditCompany({...editCompany, ico:e.target.value})} placeholder="PovinnÃ©" />
            </div>
            <div className="form-group">
              <label className="form-label">DIÄ</label>
              <input className="input" value={editCompany.dic||''} onChange={e=>setEditCompany({...editCompany, dic:e.target.value})} />
            </div>
            <div className="form-group">
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <input type="checkbox" checked={editCompany.is_vat_payer||false} onChange={e=>setEditCompany({...editCompany, is_vat_payer:e.target.checked})} />
                <span className="form-label" style={{margin:0}}>PlÃ¡tce DPH</span>
              </label>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
              <button className="btn btn-outline" onClick={()=>setEditCompany(null)}>ZruÅ¡it</button>
              <button className="btn btn-primary" onClick={()=>handleSaveCompany(editCompany)}>UloÅ¾it</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Discount Scheme Modal */}
      {editingScheme && (
        <div className="modal-overlay" onClick={() => setEditingScheme(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:'85dvh',overflowY:'auto'}}>
            <h2>{editingScheme.id ? 'Upravit schÃ©ma' : 'NovÃ© schÃ©ma slevy'}</h2>
            <div className="form-group">
              <label className="form-label">NÃ¡zev schÃ©matu</label>
              <input className="input" value={editingScheme.name} onChange={e=>setEditingScheme({...editingScheme,name:e.target.value})} />
            </div>
            <div className="form-group">
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <input type="checkbox" checked={editingScheme.no_discount} onChange={e=>setEditingScheme({...editingScheme,no_discount:e.target.checked})} />
                <span className="form-label" style={{margin:0}}>Bez slevy (kredit = platba)</span>
              </label>
            </div>
            {!editingScheme.no_discount && (
              <div>
                <div style={{fontSize:13,fontWeight:600,marginBottom:10,marginTop:10}}>PÃ¡sma slevy:</div>
                {(editingScheme.tiers||[]).map((tier,i) => (
                  <div key={i} style={{display:'flex',gap:6,alignItems:'center',marginBottom:10,padding:10,background:'var(--bg)',borderRadius:8}}>
                    <div style={{flex:1}}>
                      <label style={{fontSize:11,color:'var(--text-secondary)'}}>Od (KÄ)</label>
                      <input className="input" type="number" value={tier.from_czk} onChange={e=>setEditingScheme({...editingScheme,tiers:editingScheme.tiers.map((t,j)=>j===i?{...t,from_czk:parseInt(e.target.value)||0}:t)})} />
                    </div>
                    <div style={{flex:1}}>
                      <label style={{fontSize:11,color:'var(--text-secondary)'}}>Do (KÄ)</label>
                      <input className="input" type="number" value={tier.to_czk} onChange={e=>setEditingScheme({...editingScheme,tiers:editingScheme.tiers.map((t,j)=>j===i?{...t,to_czk:parseInt(e.target.value)||0}:t)})} />
                    </div>
                    <div style={{flex:0.8}}>
                      <label style={{fontSize:11,color:'var(--text-secondary)'}}>Sleva (%)</label>
                      <input className="input" type="number" min="0" max="100" value={Math.round((tier.discount_pct||0)*100)} onChange={e=>setEditingScheme({...editingScheme,tiers:editingScheme.tiers.map((t,j)=>j===i?{...t,discount_pct:(parseInt(e.target.value)||0)/100}:t)})} />
                    </div>
                    <button className="delete-btn" onClick={()=>setEditingScheme({...editingScheme,tiers:editingScheme.tiers.filter((_,j)=>j!==i)})} style={{marginTop:20}}>
                      <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.trash}</span>
                    </button>
                  </div>
                ))}
                <button className="btn btn-outline btn-sm" style={{width:'100%',marginBottom:12}} onClick={()=>setEditingScheme({...editingScheme,tiers:[...(editingScheme.tiers||[]),{from_czk:0,to_czk:15000,discount_pct:0.20}]})}>
                  <span style={{width:14,height:14,display:'inline-flex'}}>{Icons.plus}</span> PÅidat pÃ¡smo
                </button>
              </div>
            )}
            <div style={{fontSize:13,fontWeight:600,marginBottom:10,marginTop:10}}>PÅiÅadit firmÃ¡m:</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
              {companies.map(c => {
                const isSelected = (editingScheme.companyIds||[]).includes(c.id);
                return (
                  <button key={c.id} className={`btn btn-sm ${isSelected?'btn-primary':'btn-outline'}`} onClick={() => setEditingScheme({...editingScheme,companyIds:isSelected?(editingScheme.companyIds||[]).filter(id=>id!==c.id):[...(editingScheme.companyIds||[]),c.id]})}>
                    {c.name}
                  </button>
                );
              })}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
              <button className="btn btn-outline" onClick={()=>setEditingScheme(null)}>ZruÅ¡it</button>
              <button className="btn btn-primary" onClick={()=>handleSaveScheme(editingScheme)}>UloÅ¾it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

