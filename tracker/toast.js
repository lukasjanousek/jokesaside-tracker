// ==================== TOAST NOTIFICATIONS ====================
// Global toast utility - replaces alert() calls across the app
(function() {
  var container = document.createElement('div');
  container.id = 'toast-container';
  container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
  document.body.appendChild(container);

  var style = document.createElement('style');
  style.textContent = [
    '.toast-item { pointer-events:auto; padding:12px 20px; border-radius:8px; color:#fff;',
    '  font-size:14px; max-width:400px; box-shadow:0 4px 12px rgba(0,0,0,0.15);',
    '  animation: toastIn 0.3s ease-out; display:flex; align-items:center; gap:8px;',
    '  font-family: -apple-system, BlinkMacSystemFont, sans-serif; }',
    '.toast-item.removing { animation: toastOut 0.3s ease-in forwards; }',
    '.toast-error { background:#dc3545; }',
    '.toast-success { background:#28a745; }',
    '.toast-info { background:#007bff; }',
    '.toast-warning { background:#fd7e14; }',
    '@keyframes toastIn { from { opacity:0; transform:translateX(80px); } to { opacity:1; transform:translateX(0); } }',
    '@keyframes toastOut { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(80px); } }'
  ].join('\n');
  document.head.appendChild(style);

  window.showToast = function(message, type) {
    type = type || 'info';
    var el = document.createElement('div');
    el.className = 'toast-item toast-' + type;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function() {
      el.classList.add('removing');
      setTimeout(function() { el.remove(); }, 300);
    }, 4000);
  };
  window.toastError = function(msg) { window.showToast(msg, 'error'); };
  window.toastSuccess = function(msg) { window.showToast(msg, 'success'); };
  window.toastInfo = function(msg) { window.showToast(msg, 'info'); };
  window.toastWarning = function(msg) { window.showToast(msg, 'warning'); };
})();
