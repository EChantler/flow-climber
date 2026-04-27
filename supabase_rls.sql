-- ==========================================
-- 1. CLEANUP (Optional - Use if resetting)
-- ==========================================
DROP POLICY IF EXISTS "Allow anonymous bulk insert with valid token" ON telemetry;
DROP FUNCTION IF EXISTS public.is_valid_participant_token(text);
DROP TABLE IF EXISTS telemetry;
DROP TABLE IF EXISTS participants;

-- ==========================================
-- 2. TABLE CREATION
-- ==========================================

-- Gatekeeper table for access tokens
CREATE TABLE public.participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    access_token text UNIQUE NOT NULL,
    group_assignment text, -- Optional: 'Control' or 'Experimental'
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Main telemetry storage
CREATE TABLE public.telemetry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_used text NOT NULL REFERENCES public.participants(access_token),
    event_type text,
    metric_value float,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 3. SECURITY FUNCTION (The "Secret Sauce")
-- ==========================================

-- This function bypasses RLS on 'participants' to check token validity
CREATE OR REPLACE FUNCTION public.is_valid_participant_token(token text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER -- Runs with admin privileges
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM participants
    WHERE access_token = token
      AND is_active = true
  );
$$;

-- Limit execution to the roles that need it
REVOKE ALL ON FUNCTION public.is_valid_participant_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.is_valid_participant_token(text) TO anon, authenticated, service_role;

-- ==========================================
-- 4. RLS CONFIGURATION
-- ==========================================

-- Enable RLS on both tables
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;

-- Telemetry Policy: Allow "Blind Writes" if the function returns true
CREATE POLICY "Allow anonymous bulk insert with valid token"
ON public.telemetry
FOR INSERT 
TO anon 
WITH CHECK (public.is_valid_participant_token(token_used));

-- Participants Policy: No public access (keeps your token list private)
-- No explicit policies needed for 'anon' here, as the default is deny.

-- ==========================================
-- 5. PERFORMANCE OPTIMIZATION
-- ==========================================

-- Index the token column to keep bulk-insert validation near-instant
CREATE INDEX idx_participants_token ON public.participants(access_token);

-- ==========================================
-- 6. SEED DATA (For your test)
-- ==========================================
INSERT INTO public.participants (access_token, group_assignment) 
VALUES ('test_01', 'pilot_study');