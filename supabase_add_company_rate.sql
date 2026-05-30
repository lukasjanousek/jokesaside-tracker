-- Úkol 3: Sazby per klient (varianta 1 – override + fallback)
-- Spustit JEDNOU v Supabase → SQL Editor.
-- Přidá firmám volitelnou hodinovou sazbu. NULL = účtuje se osobní sazbou člověka (jako dosud).

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS hourly_rate INTEGER;

-- Hotovo. V administraci trackeru se u každé firmy objeví pole "Hodinová sazba klienta (Kč)".
