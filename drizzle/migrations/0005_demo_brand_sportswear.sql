CREATE OR REPLACE FUNCTION public.seed_demo_brand(_workspace_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE b uuid;
BEGIN
  INSERT INTO public.brands (workspace_id, name, description, website, industry, language, spelling_variant, number_format,
    emoji_policy, exclamation_channels, default_sliders, voice_adjectives, sound_like, brand_story, is_demo)
  VALUES (_workspace_id, 'Fieldline',
    'A running and training apparel brand for everyday athletes.',
    'https://fieldline.example', 'Sportswear', 'English', 'en-US', '25,000', 'moderate',
    '{"linkedin":false,"instagram":true,"tiktok":true,"x":true,"facebook":true,"blog":false,"newsletter":true,"case_study":false,"email":false}'::jsonb,
    '{"formality":2,"playfulness":3,"boldness":4,"emotion":3,"length":2,"cta":3,"emoji":2}'::jsonb,
    ARRAY['energetic','direct','inclusive','honest'],
    '[{"we":"A coach who believes in you","never":"A drill sergeant"},{"we":"Talks about real runs and real people","never":"Only talks about elite athletes"},{"we":"Confident about the gear","never":"Promises miracles"}]'::jsonb,
    'Fieldline started with three friends who ran before work and could not find kit that lasted. Today we design running and training gear tested by a community of 12,000 everyday runners.',
    true)
  RETURNING id INTO b;

  INSERT INTO public.brand_rules (brand_id, type, text, replaces) VALUES
    (b, 'do', 'Talk to every athlete, not just the fastest ones.', NULL),
    (b, 'do', 'Back product claims with a test or a number from the facts list.', NULL),
    (b, 'dont', 'Don''t body-shame or talk about "beach bodies".', NULL),
    (b, 'dont', 'Don''t promise performance gains we can''t prove.', NULL),
    (b, 'banned', 'no pain no gain', NULL),
    (b, 'banned', 'beast mode', NULL),
    (b, 'banned', 'revolutionary', NULL),
    (b, 'banned', 'world-class', NULL),
    (b, 'banned', 'game-changer', NULL),
    (b, 'preferred', 'athletes', 'customers'),
    (b, 'preferred', 'kit', 'merchandise'),
    (b, 'preferred', 'community', 'users'),
    (b, 'formatting', 'Write distances as 5K, 10K, half marathon.', NULL),
    (b, 'formatting', 'Write numbers one to nine in words.', NULL),
    (b, 'needs_source', 'fastest', NULL),
    (b, 'needs_source', 'lightest', NULL),
    (b, 'needs_source', '#1', NULL),
    (b, 'needs_source', 'clinically proven', NULL);

  INSERT INTO public.facts (brand_id, fact, value, source, checked_at) VALUES
    (b, 'Runners in the Fieldline test community', '12,000', 'Community database', '2026-01-15'),
    (b, 'Weight of the Tempo 2 running shoe (US 9)', '221 g', 'Product spec sheet', '2026-01-10'),
    (b, 'Miles logged by testers on the Tempo 2 before launch', '48,000', 'Test programme report', '2025-12-01'),
    (b, 'Share of the Loop collection made from recycled polyester', '78%', 'Materials report 2025', '2026-01-20'),
    (b, 'Free community runs hosted in 2025', '310', 'Events tracker', '2026-02-01');

  INSERT INTO public.names (brand_id, name, kind, status) VALUES
    (b, 'Tempo 2', 'product', 'allowed'),
    (b, 'Loop collection', 'product', 'allowed'),
    (b, 'Project Summit', 'product', 'never'),
    (b, '@fieldline', 'handle', 'tag_allowed'),
    (b, '@fieldlinerunclub', 'handle', 'tag_allowed');

  INSERT INTO public.personas (brand_id, name, role, company_type, goals, pain_points, cares_about, preferred_channels, language_level) VALUES
    (b, 'Everyday runner', 'Runs three times a week', 'Recreational runners aged 25 to 45',
     'Stay consistent, finish a first half marathon.',
     'Gear that wears out fast, ads that only show elite athletes.',
     'Comfort, durability and honest reviews.',
     ARRAY['instagram','tiktok','newsletter'], 'Casual and encouraging'),
    (b, 'Gym regular', 'Trains four times a week', 'Strength and HIIT fans',
     'Kit that handles any workout and still looks good after.',
     'Fabric that smells after one session, unclear sizing.',
     'Fit, breathability and sustainability.',
     ARRAY['instagram','x','facebook'], 'Direct and upbeat');

  INSERT INTO public.goals (brand_id, name, description, cta_type, success_measure) VALUES
    (b, 'Drive product sales', 'Get athletes to try new Fieldline kit.', 'Shop now', 'Product page visits and orders'),
    (b, 'Grow the community', 'Bring more people to free Fieldline community runs.', 'Join a run', 'Run club sign-ups');

  INSERT INTO public.examples (brand_id, channel, title, body, label, notes) VALUES
    (b, 'instagram', 'Tempo 2 launch',
     E'48,000 miles of testing. 221 g on your foot.\n\nThe Tempo 2 was built with our run club, not just for it. If it didn''t survive their Monday intervals, it didn''t ship.\n\nWhere will your first run in them be? 👟\n\n#Fieldline #Tempo2 #RunClub',
     'great', 'Two sourced numbers, credits the community, ends on a question.'),
    (b, 'x', 'Community run',
     E'Saturday, 8:00. 5K, every pace welcome. Coffee after. Find your nearest Fieldline run in our bio.',
     'great', 'Short, inclusive, clear call to action.'),
    (b, 'instagram', 'Hype-heavy post',
     E'BEAST MODE ACTIVATED!!! Our revolutionary, world-class shoe is a total game-changer. No pain no gain 🔥🔥🔥🔥',
     'avoid', 'Banned phrases, unproven claims, too many emoji.');
  RETURN b;
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_demo_content(_brand uuid, _user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  p_run uuid; p_gym uuid; g_sales uuid; g_comm uuid; r uuid; i uuid;
  s jsonb := '{"formality":2,"playfulness":3,"boldness":4,"emotion":3,"length":2,"cta":3,"emoji":2}'::jsonb;
BEGIN
  PERFORM set_config('app.demo_seed', 'on', true);
  SELECT id INTO p_run FROM personas WHERE brand_id = _brand AND name = 'Everyday runner';
  SELECT id INTO p_gym FROM personas WHERE brand_id = _brand AND name = 'Gym regular';
  SELECT id INTO g_sales FROM goals WHERE brand_id = _brand AND name = 'Drive product sales';
  SELECT id INTO g_comm FROM goals WHERE brand_id = _brand AND name = 'Grow the community';

  INSERT INTO content_requests (brand_id, created_by, brief, persona_id, goal_id, channels, sliders, created_at)
  VALUES (_brand, _user, 'Launch post for the Tempo 2 running shoe: 221 g, tested for 48,000 miles by our run club.',
    p_run, g_sales, ARRAY['instagram'], s, now() - interval '3 days') RETURNING id INTO r;
  INSERT INTO content_items (request_id, brand_id, channel, fields, status, brand_score, created_by, approved_by, approved_at, created_at, updated_at)
  VALUES (r, _brand, 'instagram', demo_fields(
    'Our run club tested these for 48,000 miles so you don''t have to.',
    E'Our run club tested these for 48,000 miles so you don''t have to.\n\nThe Tempo 2 weighs 221 g and kept its bounce through every Monday interval session we threw at it.\n\nWhere will your first run in them be? 👟',
    'Where will your first run in them be?',
    ARRAY['Fieldline','Tempo2','RunClub'],
    'A runner lacing up a pair of bright Tempo 2 shoes on a city pavement.'),
    'approved', 95, _user, _user, now() - interval '1 day', now() - interval '3 days', now() - interval '1 day') RETURNING id INTO i;
  INSERT INTO activity_log (brand_id, content_item_id, actor, action, details, created_at) VALUES
    (_brand, i, _user, 'generated', jsonb_build_object('sliders', s, 'persona_id', p_run, 'goal_id', g_sales, 'brand_score', 95, 'flagged', '[]'::jsonb), now() - interval '3 days'),
    (_brand, i, _user, 'submitted', '{"from":"draft","to":"in_review","comment":null}'::jsonb, now() - interval '2 days'),
    (_brand, i, _user, 'approved', '{"from":"in_review","to":"approved","comment":"Great energy. Ship it."}'::jsonb, now() - interval '1 day');

  INSERT INTO content_requests (brand_id, created_by, brief, persona_id, goal_id, channels, sliders, created_at)
  VALUES (_brand, _user, 'Invite people to our free Saturday community 5K, every pace welcome.',
    p_run, g_comm, ARRAY['x'], s, now() - interval '2 days') RETURNING id INTO r;
  INSERT INTO content_items (request_id, brand_id, channel, fields, status, brand_score, created_by, created_at, updated_at)
  VALUES (r, _brand, 'x', demo_fields(
    'Saturday, 8:00. 5K, every pace welcome.',
    'Saturday, 8:00. 5K, every pace welcome, and the coffee is on us after. Last year we hosted 310 free runs. Find yours in our bio.',
    'Find yours in our bio.', ARRAY['RunClub'], NULL),
    'in_review', 88, _user, now() - interval '2 days', now() - interval '20 hours') RETURNING id INTO i;
  INSERT INTO activity_log (brand_id, content_item_id, actor, action, details, created_at) VALUES
    (_brand, i, _user, 'generated', jsonb_build_object('sliders', s, 'persona_id', p_run, 'goal_id', g_comm, 'brand_score', 88, 'flagged', '[]'::jsonb), now() - interval '2 days'),
    (_brand, i, _user, 'submitted', '{"from":"draft","to":"in_review","comment":null}'::jsonb, now() - interval '20 hours');

  INSERT INTO content_requests (brand_id, created_by, brief, persona_id, goal_id, channels, sliders, created_at)
  VALUES (_brand, _user, 'Facebook post about the Loop training collection, made with 78% recycled polyester.',
    p_gym, g_sales, ARRAY['facebook'], s, now() - interval '30 hours') RETURNING id INTO r;
  INSERT INTO content_items (request_id, brand_id, channel, fields, status, brand_score, created_by, created_at, updated_at)
  VALUES (r, _brand, 'facebook', demo_fields(
    'The Loop collection is the most sustainable training kit ever made.',
    E'The Loop collection is the most sustainable training kit ever made.\n\n78% recycled polyester, cut for lifting, HIIT and everything in between.',
    NULL, ARRAY['Fieldline','LoopCollection'], NULL),
    'changes_requested', 72, _user, now() - interval '30 hours', now() - interval '6 hours') RETURNING id INTO i;
  INSERT INTO activity_log (brand_id, content_item_id, actor, action, details, created_at) VALUES
    (_brand, i, _user, 'generated', jsonb_build_object('sliders', s, 'persona_id', p_gym, 'goal_id', g_sales, 'brand_score', 72, 'flagged', '[]'::jsonb), now() - interval '30 hours'),
    (_brand, i, _user, 'submitted', '{"from":"draft","to":"in_review","comment":null}'::jsonb, now() - interval '12 hours'),
    (_brand, i, _user, 'changes_requested', '{"from":"in_review","to":"changes_requested","comment":"We can''t prove \"most sustainable ever\". Lead with the 78% fact and add a call to action."}'::jsonb, now() - interval '6 hours');

  INSERT INTO content_requests (brand_id, created_by, brief, persona_id, goal_id, channels, sliders, created_at)
  VALUES (_brand, _user, 'Newsletter intro for runners training for their first half marathon.',
    p_run, g_comm, ARRAY['newsletter'], s, now() - interval '2 hours') RETURNING id INTO r;
  INSERT INTO content_items (request_id, brand_id, channel, fields, status, brand_score, created_by, created_at, updated_at)
  VALUES (r, _brand, 'newsletter', demo_fields(
    'Your first half marathon starts with a slow 5K.',
    E'Your first half marathon starts with a slow 5K.\n\nThis month our coaches share a simple 12-week plan, three runs a week, built with runners from our community who did it for the first time last spring.\n\nJoin a free Saturday run to meet people training for the same race.',
    'Join a free Saturday run to meet people training for the same race.',
    NULL, NULL),
    'draft', 80, _user, now() - interval '2 hours', now() - interval '2 hours') RETURNING id INTO i;
  INSERT INTO activity_log (brand_id, content_item_id, actor, action, details, created_at) VALUES
    (_brand, i, _user, 'generated', jsonb_build_object('sliders', s, 'persona_id', p_run, 'goal_id', g_comm, 'brand_score', 80, 'flagged', '[]'::jsonb), now() - interval '2 hours');

  PERFORM set_config('app.demo_seed', 'off', true);
END;
$function$;