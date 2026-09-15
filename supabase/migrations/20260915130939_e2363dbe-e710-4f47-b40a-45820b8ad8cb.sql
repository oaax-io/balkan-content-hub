CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

SELECT cron.unschedule('retry-fees-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'retry-fees-daily'
);

SELECT cron.schedule(
  'retry-fees-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://balkaneros.ch/api/public/retry-fees?env=live&token='
      || coalesce((SELECT value FROM public.system_settings WHERE key = 'fee_retry_cron_token'), ''),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);