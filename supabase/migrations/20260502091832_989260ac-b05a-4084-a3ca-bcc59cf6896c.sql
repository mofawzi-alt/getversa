UPDATE auth.users 
SET email_confirmed_at = now(),
    updated_at = now()
WHERE email IN ('apple-review@getversa.app', 'google-review@getversa.app')
  AND email_confirmed_at IS NULL;