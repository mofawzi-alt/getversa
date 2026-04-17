-- 1. Add batch_slot column
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS batch_slot text NOT NULL DEFAULT 'none';

-- 2. Update validation function FIRST (so it accepts 'campaign')
CREATE OR REPLACE FUNCTION public.validate_poll_expiry_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.expiry_type NOT IN ('evergreen', 'trending', 'campaign') THEN
    RAISE EXCEPTION 'Invalid expiry_type: %. Must be one of: evergreen, trending, campaign', NEW.expiry_type;
  END IF;
  IF NEW.batch_slot NOT IN ('morning', 'afternoon', 'evening', 'none') THEN
    RAISE EXCEPTION 'Invalid batch_slot: %. Must be one of: morning, afternoon, evening, none', NEW.batch_slot;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_poll_expiry_type_trigger ON public.polls;
CREATE TRIGGER validate_poll_expiry_type_trigger
BEFORE INSERT OR UPDATE ON public.polls
FOR EACH ROW EXECUTE FUNCTION public.validate_poll_expiry_type();

-- 3. Now safe to migrate brand_battle -> campaign
UPDATE public.polls SET expiry_type = 'campaign' WHERE expiry_type = 'brand_battle';

-- 4. Hot takes always evergreen
CREATE OR REPLACE FUNCTION public.enforce_hot_take_evergreen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_hot_take = true THEN
    NEW.expiry_type := 'evergreen';
    NEW.ends_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_hot_take_evergreen_trigger ON public.polls;
CREATE TRIGGER enforce_hot_take_evergreen_trigger
BEFORE INSERT OR UPDATE ON public.polls
FOR EACH ROW EXECUTE FUNCTION public.enforce_hot_take_evergreen();

-- 5. Helper function
CREATE OR REPLACE FUNCTION public.is_poll_expired(p_expiry_type text, p_ends_at timestamptz)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_expiry_type = 'evergreen' THEN false
    WHEN p_ends_at IS NULL THEN false
    ELSE p_ends_at <= now()
  END;
$$;

-- 6. Campaign sync trigger
CREATE OR REPLACE FUNCTION public.sync_campaign_poll_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    UPDATE public.polls
    SET ends_at = NEW.expires_at
    WHERE campaign_id = NEW.id
      AND expiry_type = 'campaign'
      AND is_hot_take = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_campaign_poll_expiry_trigger ON public.poll_campaigns;
CREATE TRIGGER sync_campaign_poll_expiry_trigger
AFTER UPDATE ON public.poll_campaigns
FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_poll_expiry();

-- 7. Migrate Coca-Cola polls to campaign expiry
UPDATE public.polls p
SET expiry_type = 'campaign',
    ends_at = pc.expires_at
FROM public.poll_campaigns pc
WHERE p.campaign_id = pc.id
  AND pc.id = '663dde25-4351-445e-8095-d9d15a90e55a'
  AND p.is_hot_take = false;