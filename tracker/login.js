// ==================== LOGIN PAGE ====================
function LoginPage({ onLoginSuccess, onSignUp, loading, error }) {
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

      </div>
    </div>
  );
}

