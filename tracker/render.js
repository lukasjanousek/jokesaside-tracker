// ==================== ERROR BOUNDARY ====================
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('React Error Boundary:', error, info); }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {style: {padding: 40, textAlign: 'center'}},
        React.createElement('h2', null, 'Došlo k chybě'),
        React.createElement('pre', {style: {textAlign: 'left', background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', maxHeight: 300, fontSize: 12}}, String(this.state.error)),
        React.createElement('button', {onClick: () => { this.setState({hasError: false}); window.location.reload(); }, style: {marginTop: 16, padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer'}}, 'Obnovit stránku')
      );
    }
    return this.props.children;
  }
}

// ==================== RENDER ====================
ReactDOM.createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
