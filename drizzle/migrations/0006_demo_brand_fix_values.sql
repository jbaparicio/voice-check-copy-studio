DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.seed_demo_brand(uuid)'::regprocedure);
  d := replace(d, '''moderate''', '''sparing''');
  d := replace(d, '''product''', '''other''');
  EXECUTE d;
END
$do$;