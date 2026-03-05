-- ================================================================
-- Jokes Aside Time Tracker — Supabase Migration
-- ================================================================
-- POSTUP:
-- 1. Otevři Supabase Dashboard → SQL Editor → New Query
-- 2. Vlož celý tento skript
-- 3. Klikni "Run"
-- 4. Hotovo!
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABLES
-- ==========================================

-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  position TEXT,
  division TEXT,
  hourly_rate INTEGER NOT NULL DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  -- Company details
  legal_name TEXT,           -- Oficiální název (e.g. "Campiri s.r.o.")
  address TEXT,              -- Sídlo
  ico TEXT,                  -- IČ
  dic TEXT,                  -- DIČ
  is_vat_payer BOOLEAN DEFAULT FALSE,  -- Plátce DPH?
  -- Display
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discount schemes (per-company discount tiers)
CREATE TABLE public.discount_schemes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  no_discount BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Which companies use which discount scheme
CREATE TABLE public.discount_scheme_companies (
  scheme_id UUID NOT NULL REFERENCES public.discount_schemes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  PRIMARY KEY (scheme_id, company_id)
);

-- Discount tiers within a scheme
CREATE TABLE public.discount_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_id UUID NOT NULL REFERENCES public.discount_schemes(id) ON DELETE CASCADE,
  from_czk INTEGER NOT NULL,
  to_czk INTEGER NOT NULL,
  discount_pct NUMERIC(5,4) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- Monthly retainers per company
CREATE TABLE public.retainers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  month TEXT NOT NULL,  -- format: '2026-02'
  payment_czk INTEGER NOT NULL DEFAULT 0,
  rollover_czk NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, month)
);

-- Time entries
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  duration_min INTEGER NOT NULL CHECK (duration_min > 0),
  date DATE NOT NULL,
  is_manual BOOLEAN DEFAULT FALSE,
  recurring_meeting_id UUID,  -- FK added after recurring_meetings table
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recurring meetings
CREATE TABLE public.recurring_meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER DEFAULT 0,     -- 0-6 (Sun-Sat), used for weekly
  day_of_month INTEGER DEFAULT 1,    -- 1-28, used for monthly
  duration_min INTEGER NOT NULL DEFAULT 60,
  start_date DATE NOT NULL,
  end_date DATE,                     -- NULL = indefinite
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting ↔ Company (many-to-many)
CREATE TABLE public.meeting_companies (
  meeting_id UUID NOT NULL REFERENCES public.recurring_meetings(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  PRIMARY KEY (meeting_id, company_id)
);

-- Meeting participants with confirmation status
CREATE TABLE public.meeting_participants (
  meeting_id UUID NOT NULL REFERENCES public.recurring_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  PRIMARY KEY (meeting_id, user_id)
);

-- Billing locks (invoiced periods)
CREATE TABLE public.billing_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  generated_by UUID REFERENCES public.profiles(id),
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-user finalization of billing period
CREATE TABLE public.billing_finalizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  billing_lock_id UUID REFERENCES public.billing_locks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  month TEXT NOT NULL,  -- '2026-02'
  finalized_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- Hourly rate history
CREATE TABLE public.hourly_rate_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rate INTEGER NOT NULL,
  effective_from DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from time_entries to recurring_meetings
ALTER TABLE public.time_entries
  ADD CONSTRAINT fk_time_entries_recurring_meeting
  FOREIGN KEY (recurring_meeting_id) REFERENCES public.recurring_meetings(id) ON DELETE SET NULL;


-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_company ON public.time_entries(company_id);
CREATE INDEX idx_time_entries_date ON public.time_entries(date);
CREATE INDEX idx_time_entries_company_date ON public.time_entries(company_id, date);
CREATE INDEX idx_retainers_company_month ON public.retainers(company_id, month);
CREATE INDEX idx_hourly_rate_user ON public.hourly_rate_history(user_id, effective_from);
CREATE INDEX idx_meeting_participants_user ON public.meeting_participants(user_id);
CREATE INDEX idx_billing_finalizations_month ON public.billing_finalizations(month);


-- ==========================================
-- AUTO-UPDATE TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_retainers_updated BEFORE UPDATE ON public.retainers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_time_entries_updated BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ==========================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ==========================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_scheme_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_finalizations ENABLE ROW LEVEL SECURITY;

-- Helper: is current user admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- PROFILES ----
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (public.is_admin());

-- ---- COMPANIES ----
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "companies_manage" ON public.companies
  FOR ALL USING (public.is_admin());

-- ---- TIME ENTRIES ----
CREATE POLICY "entries_select" ON public.time_entries
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "entries_insert" ON public.time_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "entries_update" ON public.time_entries
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "entries_delete" ON public.time_entries
  FOR DELETE USING (user_id = auth.uid() OR public.is_admin());

-- ---- RETAINERS ----
CREATE POLICY "retainers_select" ON public.retainers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "retainers_manage" ON public.retainers
  FOR ALL USING (public.is_admin());

-- ---- DISCOUNT SCHEMES ----
CREATE POLICY "schemes_select" ON public.discount_schemes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "schemes_manage" ON public.discount_schemes
  FOR ALL USING (public.is_admin());

-- ---- DISCOUNT SCHEME COMPANIES ----
CREATE POLICY "scheme_companies_select" ON public.discount_scheme_companies
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "scheme_companies_manage" ON public.discount_scheme_companies
  FOR ALL USING (public.is_admin());

-- ---- DISCOUNT TIERS ----
CREATE POLICY "tiers_select" ON public.discount_tiers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "tiers_manage" ON public.discount_tiers
  FOR ALL USING (public.is_admin());

-- ---- HOURLY RATE HISTORY ----
CREATE POLICY "rates_select" ON public.hourly_rate_history
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "rates_manage" ON public.hourly_rate_history
  FOR ALL USING (public.is_admin());

-- ---- RECURRING MEETINGS ----
CREATE POLICY "meetings_select" ON public.recurring_meetings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "meetings_insert" ON public.recurring_meetings
  FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY "meetings_update" ON public.recurring_meetings
  FOR UPDATE USING (author_id = auth.uid() OR public.is_admin());

CREATE POLICY "meetings_delete" ON public.recurring_meetings
  FOR DELETE USING (author_id = auth.uid() OR public.is_admin());

-- ---- MEETING COMPANIES ----
CREATE POLICY "meeting_companies_select" ON public.meeting_companies
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "meeting_companies_manage" ON public.meeting_companies
  FOR ALL USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.recurring_meetings rm WHERE rm.id = meeting_id AND rm.author_id = auth.uid()
  ));

-- ---- MEETING PARTICIPANTS ----
CREATE POLICY "meeting_participants_select" ON public.meeting_participants
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "meeting_participants_manage" ON public.meeting_participants
  FOR ALL USING (public.is_admin() OR user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.recurring_meetings rm WHERE rm.id = meeting_id AND rm.author_id = auth.uid()
  ));

-- ---- BILLING LOCKS ----
CREATE POLICY "locks_select" ON public.billing_locks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "locks_manage" ON public.billing_locks
  FOR ALL USING (public.is_admin());

-- ---- BILLING FINALIZATIONS ----
CREATE POLICY "finalizations_select" ON public.billing_finalizations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "finalizations_insert" ON public.billing_finalizations
  FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "finalizations_update" ON public.billing_finalizations
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());


-- ==========================================
-- SEED DATA
-- ==========================================

-- Companies with details (IČ/DIČ can be filled in later via admin UI)
INSERT INTO public.companies (id, name, legal_name, address, ico, dic, is_vat_payer, color) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Campiri',            NULL, NULL, NULL, NULL, FALSE, '#f97316'),
  ('c1000000-0000-0000-0000-000000000002', 'Nomiverse',          NULL, NULL, NULL, NULL, FALSE, '#6366f1'),
  ('c1000000-0000-0000-0000-000000000003', 'Dokempu',            NULL, NULL, NULL, NULL, FALSE, '#10b981'),
  ('c1000000-0000-0000-0000-000000000004', 'Iguana Technology',   NULL, NULL, NULL, NULL, FALSE, '#8b5cf6'),
  ('c1000000-0000-0000-0000-000000000005', 'Nomivans',           NULL, NULL, NULL, NULL, FALSE, '#ec4899');

-- Default discount scheme
INSERT INTO public.discount_schemes (id, name, no_discount) VALUES
  ('ds000000-0000-0000-0000-000000000001', 'Výchozí', FALSE);

-- Link all companies to default scheme
INSERT INTO public.discount_scheme_companies (scheme_id, company_id) VALUES
  ('ds000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001'),
  ('ds000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002'),
  ('ds000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003'),
  ('ds000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004'),
  ('ds000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005');

-- Discount tiers for default scheme
INSERT INTO public.discount_tiers (scheme_id, from_czk, to_czk, discount_pct, sort_order) VALUES
  ('ds000000-0000-0000-0000-000000000001', 0,     15000,   0.2000, 1),
  ('ds000000-0000-0000-0000-000000000001', 15000, 30000,   0.2500, 2),
  ('ds000000-0000-0000-0000-000000000001', 30000, 75000,   0.3000, 3),
  ('ds000000-0000-0000-0000-000000000001', 75000, 1000000, 0.4000, 4);

-- Sample retainers for Feb 2026
INSERT INTO public.retainers (company_id, month, payment_czk, rollover_czk) VALUES
  ('c1000000-0000-0000-0000-000000000001', '2026-02', 80000,  12000),
  ('c1000000-0000-0000-0000-000000000002', '2026-02', 115000, 0),
  ('c1000000-0000-0000-0000-000000000003', '2026-02', 45000,  5000),
  ('c1000000-0000-0000-0000-000000000004', '2026-02', 60000,  0),
  ('c1000000-0000-0000-0000-000000000005', '2026-02', 30000,  8000);


-- ==========================================
-- DONE!
-- ==========================================
-- Po spuštění tohoto skriptu:
-- 1. Zkopíruj Project URL a anon key ze Settings → API
-- 2. Vlož je do trackeru (řekne ti Claude kam)
-- 3. Pozvi kolegy — pošli jim link na www.jokesaside.cz/tracker
--    (nebo přidej uživatele ručně v Authentication → Users)
--
-- Profily se vytváří automaticky při registraci (trigger handle_new_user).
-- Po registraci admina (Lukáše) spusť tento SQL:
--
--   UPDATE public.profiles SET
--     name = 'Lukáš Janoušek',
--     position = 'CMO',
--     division = 'Marketing',
--     hourly_rate = 3500,
--     is_admin = TRUE
--   WHERE email = 'lukas.janousek@gmail.com';
--
-- Po registraci dalších adminů:
--
--   UPDATE public.profiles SET is_admin = TRUE
--   WHERE email IN ('marketa@jokesaside.cz', 'vladimir@jokesaside.cz');
--
-- Po registraci dalších uživatelů aktualizuj jejich profily:
--
--   UPDATE public.profiles SET name='Markéta Brabcová', position='Head of HR & Ops', division='Operations/HR', hourly_rate=1800, is_admin=TRUE WHERE email='marketa@jokesaside.cz';
--   UPDATE public.profiles SET name='Vladimír Prchlík', position='CFO', division='Finance', hourly_rate=2700, is_admin=TRUE WHERE email='vladimir@jokesaside.cz';
--   UPDATE public.profiles SET name='Hana Pultznerová', position='Senior Legal Counsel', division='Legal', hourly_rate=2700 WHERE email='hana@jokesaside.cz';
--   UPDATE public.profiles SET name='Ondřej Synčák', position='Marketing Manager', division='Marketing', hourly_rate=2500 WHERE email='ondrej@jokesaside.cz';
--   UPDATE public.profiles SET name='Veronika Perglová', position='Back Office Coordinator', division='Operations/HR', hourly_rate=1000 WHERE email='veronika@jokesaside.cz';
