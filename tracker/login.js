// ==================== LOGIN PAGE ====================
function LoginPage({ onLoginSuccess, onSignUp, onGoogleLogin, loading, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [localError, setLocalError] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async () => {
    setLocalError('');
    if (!email) {
      setLocalError('Zadejte email');
      return;
    }
    const { error } = await window.__supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/tracker'
    });
    if (error) {
      setLocalError(error.message);
    } else {
      setResetSent(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!email || !password) {
      setLocalError('Vyplňte email a heslo');
      return;
    }

    if (isRegistering) {
      await onSignUp(email, password);
    } else {
      await onLoginSuccess(email, password);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">Jokes Aside</div>
        <div className="login-subtitle">Time Tracker</div>

        <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              className="input"
              type="password"
              placeholder="Heslo"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          {(error || localError) && (
            <div className="error-message" style={{ marginBottom: 12 }}>
              {error || localError}
            </div>
          )}
          {forgotMode ? (
            <>
              {resetSent ? (
                <div style={{padding:12,background:'var(--success-bg)',borderRadius:8,marginBottom:8,color:'var(--success)',fontSize:14}}>
                  Odkaz pro reset hesla byl odeslán na {email}. Zkontrolujte svůj email.
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginBottom: 8 }}
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Odeslat odkaz pro reset hesla
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline"
                style={{ width: '100%' }}
                onClick={() => { setForgotMode(false); setResetSent(false); setLocalError(''); }}
              >
                Zpět na přihlášení
              </button>
            </>
          ) : (
            <>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginBottom: 8 }}
                disabled={loading}
              >
                {loading ? 'Načítám...' : (isRegistering ? 'Registrovat' : 'Přihlásit')}
              </button>
              {!isRegistering && (
                <button
                  type="button"
                  style={{ width: '100%', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, marginBottom: 8 }}
                  onClick={() => { setForgotMode(true); setLocalError(''); }}
                >
                  Zapomněl/a jsem heslo
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline"
                style={{ width: '100%' }}
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setLocalError('');
                }}
                disabled={loading}
              >
                {isRegistering ? 'Už mám účet' : 'Vytvořit nový účet'}
              </button>
            </>
          )}
        </form>

        <div style={{textAlign:'center',margin:'16px 0 8px',color:'var(--text-secondary)',fontSize:13}}>nebo</div>
        <button
          type="button"
          className="btn btn-outline"
          style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}
          onClick={onGoogleLogin}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Přihlásit přes Google
        </button>

      </div>
    </div>
  );
}

