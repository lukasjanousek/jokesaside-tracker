const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ==================== SUPABASE CONFIGURATION ====================
const SUPABASE_URL = 'https://zsuqgsqgcxbiueupjaoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdXFnc3FnY3hiaXVldXBqYW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDYyOTQsImV4cCI6MjA4NzY4MjI5NH0.ClUgxU7t_I8gQw-4MptEVxJw-FcpCvxjOl-66MIcQuE';

window.__supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
