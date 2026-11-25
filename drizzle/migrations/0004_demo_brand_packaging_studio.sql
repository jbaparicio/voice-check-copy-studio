CREATE OR REPLACE FUNCTION public.seed_demo_brand(_workspace_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE b uuid;
BEGIN
  INSERT INTO public.brands (workspace_id, name, description, website, industry, language, spelling_variant, number_format,
    emoji_policy, exclamation_channels, default_sliders, voice_adjectives, sound_like, brand_story, is_demo)
  VALUES (_workspace_id, 'Northlight Studio',
    'An independent brand and packaging design studio for food and drink makers.',
    'https://northlight.example', 'Brand and packaging design', 'English', 'en-GB', '25,000', 'sparing',
    '{"linkedin":false,"instagram":true,"tiktok":true,"x":false,"facebook":true,"blog":false,"newsletter":false,"case_study":false,"email":false}'::jsonb,
    '{"formality":3,"playfulness":2,"boldness":3,"emotion":3,"length":3,"cta":2,"emoji":2}'::jsonb,
    ARRAY['clear','warm','curious','crafted'],
    '[{"we":"A designer explaining a choice over coffee","never":"A pitch deck read aloud"},{"we":"Specific about the work","never":"Vague and corporate"},{"we":"Proud of our makers","never":"Boastful about ourselves"}]'::jsonb,
    'Northlight began at a kitchen table in Bristol, redesigning a friend''s jam label. Today a team of 14 designs brands and packaging for independent food and drink makers, from bakeries to small breweries.',
    true)
  RETURNING id INTO b;

  INSERT INTO public.brand_rules (brand_id, type, text, replaces) VALUES
    (b, 'do', 'Explain why a design choice helps the maker sell, not just how it looks.', NULL),
    (b, 'do', 'Name the maker only when they have agreed to be credited.', NULL),
    (b, 'dont', 'Don''t promise sales results we can''t measure.', NULL),
    (b, 'dont', 'Don''t use exclamation marks on LinkedIn.', NULL),
    (b, 'banned', 'synergy', NULL),
    (b, 'banned', 'game-changer', NULL),
    (b, 'banned', 'world-class', NULL),
    (b, 'banned', 'elevate', NULL),
    (b, 'banned', 'cutting-edge', NULL),
    (b, 'preferred', 'makers', 'clients'),
    (b, 'preferred', 'shelf', 'point of sale'),
    (b, 'preferred', 'brief', 'ask'),
    (b, 'formatting', 'Write numbers one to nine in words.', NULL),
    (b, 'formatting', 'Use the 24-hour clock, e.g. 18:30.', NULL),
    (b, 'needs_source', '#1', NULL),
    (b, 'needs_source', 'best-selling', NULL),
    (b, 'needs_source', 'first ever', NULL),
    (b, 'needs_source', 'award-winning', NULL),
    (b, 'needs_source', 'leading', NULL);

  INSERT INTO public.facts (brand_id, fact, value, source, checked_at) VALUES
    (b, 'Brands designed in 2025', '31', 'Internal project tracker', '2026-01-15'),
    (b, 'Products redesigned across all projects in 2025', '140', 'Project tracker', '2026-01-15'),
    (b, 'Stockists carrying Fern & Fig after the redesign', '62', 'Fern & Fig sales report', '2025-11-02'),
    (b, 'Average maker satisfaction score', '4.8 out of 5', 'End-of-project surveys, 2025', '2026-01-20'),
    (b, 'Studio team size', '14 people', 'Team headcount', '2026-02-01');

  INSERT INTO public.names (brand_id, name, kind, status) VALUES
    (b, 'Fern & Fig Bakery', 'client', 'allowed'),
    (b, 'Hollow Oak Brewing', 'client', 'allowed'),
    (b, 'Marlowe Dairy', 'client', 'never'),
    (b, '@northlightstudio', 'handle', 'tag_allowed'),
    (b, '@fernandfig', 'handle', 'tag_allowed');

  INSERT INTO public.personas (brand_id, name, role, company_type, goals, pain_points, cares_about, preferred_channels, language_level) VALUES
    (b, 'Brand Marketing Director', 'Head of Marketing', 'Growing food and drink brands with 20 to 200 staff',
     'Get into more shops and stand out on a crowded shelf.',
     'Studios that overpromise. Redesigns that look nice but confuse loyal customers.',
     'Design reasons backed by evidence, and a partner who listens.',
     ARRAY['linkedin','newsletter','email'], 'Professional, no jargon'),
    (b, 'Event Manager', 'Founder and maker', 'Independent bakeries, breweries and small producers',
     'A brand that feels like them and works on the shelf.',
     'Unclear costs, long timelines, being talked down to.',
     'Clear steps, honest pricing and practical advice.',
     ARRAY['instagram','email'], 'Plain and friendly');

  INSERT INTO public.goals (brand_id, name, description, cta_type, success_measure) VALUES
    (b, 'Generate leads', 'Bring in new enquiries from makers planning a new brand or redesign.', 'Book a discovery call', 'Discovery calls booked'),
    (b, 'Build employer brand', 'Show what it''s like to work at Northlight so great designers want to join.', 'View open roles', 'Applications and careers page visits');

  INSERT INTO public.examples (brand_id, channel, title, body, label, notes) VALUES
    (b, 'linkedin', 'Fern & Fig redesign',
     E'Most bakery packaging is designed for the bakery, not the shelf.\n\nWhen Fern & Fig asked us to redesign their loaf bags, we spent a morning in three local shops first. From two metres away, every bag looked the same.\n\nSo we kept their hand-drawn fig, made it four times bigger and moved the name to the top. They are now stocked in 62 shops.\n\nWhen did you last look at your packaging from across the room?',
     'great', 'Opens with an opinion, one sourced number, ends on a real question.'),
    (b, 'instagram', 'Behind the labels',
     E'Thirty label proofs, one table 🖍️\n\nHollow Oak''s new cans, the morning before print. Swipe to see the colour we almost chose.\n\n#PackagingDesign #CraftBeer #Northlight',
     'great', 'Short, specific, one emoji, focused hashtags.'),
    (b, 'linkedin', 'Hype-heavy post',
     E'We are SO excited to unveil our game-changer, world-class rebrand!!! Elevating packaging to the next level. Synergy at its finest 🚀🚀🚀',
     'avoid', 'Banned words, exclamation marks, too many emoji and no real detail.');
  RETURN b;
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_demo_content(_brand uuid, _user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  p_dir uuid; p_evt uuid; g_lead uuid; g_emp uuid; r uuid; i uuid;
  s jsonb := '{"formality":3,"playfulness":2,"boldness":3,"emotion":3,"length":3,"cta":2,"emoji":2}'::jsonb;
BEGIN
  PERFORM set_config('app.demo_seed', 'on', true);
  SELECT id INTO p_dir FROM personas WHERE brand_id = _brand AND name = 'Brand Marketing Director';
  SELECT id INTO p_evt FROM personas WHERE brand_id = _brand AND name = 'Event Manager';
  SELECT id INTO g_lead FROM goals WHERE brand_id = _brand AND name = 'Generate leads';
  SELECT id INTO g_emp FROM goals WHERE brand_id = _brand AND name = 'Build employer brand';

  INSERT INTO content_requests (brand_id, created_by, brief, persona_id, goal_id, channels, sliders, created_at)
  VALUES (_brand, _user, 'Look back on our year: 31 brands and 140 products redesigned, and invite makers planning a redesign to talk to us.',
    p_dir, g_lead, ARRAY['linkedin'], s, now() - interval '3 days') RETURNING id INTO r;
  INSERT INTO content_items (request_id, brand_id, channel, fields, status, brand_score, created_by, approved_by, approved_at, created_at, updated_at)
  VALUES (r, _brand, 'linkedin', demo_fields(
    'A good label should still make sense from across the shop.',
    E'A good label should still make sense from across the shop.\n\nThis year our team of 14 redesigned 140 products for 31 food and drink makers. The work we are proudest of is usually the simplest: a bigger name, one clear colour, less text on the front.\n\nMakers gave us an average score of 4.8 out of 5, and most of the credit goes to the makers who let us test ideas in real shops.\n\nWhat would your packaging say to someone two metres away?',
    'What would your packaging say to someone two metres away?',
    ARRAY['PackagingDesign','BrandDesign','FoodAndDrink'],
    'Shelves of redesigned jars and loaf bags in a small shop.'),
    'approved', 94, _user, _user, now() - interval '1 day', now() - interval '3 days', now() - interval '1 day') RETURNING id INTO i;
  INSERT INTO activity_log (brand_id, content_item_id, actor, action, details, created_at) VALUES
    (_brand, i, _user, 'generated', jsonb_build_object('sliders', s, 'persona_id', p_dir, 'goal_id', g_lead, 'brand_score', 94, 'flagged', '[]'::jsonb), now() - interval '3 days'),
    (_brand, i, _user, 'submitted', '{"from":"draft","to":"in_review","comment":null}'::jsonb, now() - interval '2 days'),
    (_brand, i, _user, 'approved', '{"from":"in_review","to":"approved","comment":"Clear and warm. Good to go."}'::jsonb, now() - interval '1 day');

  INSERT INTO content_requests (brand_id, created_by, brief, persona_id, goal_id, channels, sliders, created_at)
  VALUES (_brand, _user, 'Behind the scenes of the Hollow Oak Brewing can labels, showing the team choosing colours.',
    p_evt, g_emp, ARRAY['instagram'], s, now() - interval '2 days') RETURNING id INTO r;
  INSERT INTO content_items (request_id, brand_id, channel, fields, status, brand_score, created_by, created_at, updated_at)
  VALUES (r, _brand, 'instagram', demo_fields(
    'Thirty label proofs, one table, one colour left standing.',
    E'Thirty label proofs, one table, one colour left standing. 🖍️\n\nThe morning before Hollow Oak''s new cans went to print, the whole studio voted. Swipe to see the green we almost chose.\n\nWant to design labels like these with us? Our open roles are in the bio.',
    'Our open roles are in the bio.',
    ARRAY['BehindTheScenes','PackagingDesign','CraftBeer','Northlight'],
    'Designers comparing printed can labels on a large studio table.'),
    'in_review', 88, _user, now() - interval '2 days', now() - interval '20 hours') RETURNING id INTO i;
  INSERT INTO activity_log (brand_id, content_item_id, actor, action, details, created_at) VALUES
    (_brand, i, _user, 'generated', jsonb_build_object('sliders', s, 'persona_id', p_evt, 'goal_id', g_emp, 'brand_score', 88, 'flagged', '[]'::jsonb), now() - interval '2 days'),
    (_brand, i, _user, 'submitted', '{"from":"draft","to":"in_review","comment":null}'::jsonb, now() - interval '20 hours');

  INSERT INTO content_requests (brand_id, created_by, brief, persona_id, goal_id, channels, sliders, created_at)
  VALUES (_brand, _user, 'Short post about the Fern & Fig redesign, now stocked in 62 shops.',
    p_dir, g_lead, ARRAY['x'], s, now() - interval '30 hours') RETURNING id INTO r;
  INSERT INTO content_items (request_id, brand_id, channel, fields, status, brand_score, created_by, created_at, updated_at)
  VALUES (r, _brand, 'x', demo_fields(
    'One hand-drawn fig, four times bigger.',
    'One hand-drawn fig, four times bigger. That was most of the Fern & Fig redesign. Their loaves are now in 62 shops.',
    NULL, ARRAY['PackagingDesign'], NULL),
    'changes_requested', 82, _user, now() - interval '30 hours', now() - interval '6 hours') RETURNING id INTO i;
  INSERT INTO activity_log (brand_id, content_item_id, actor, action, details, created_at) VALUES
    (_brand, i, _user, 'generated', jsonb_build_object('sliders', s, 'persona_id', p_dir, 'goal_id', g_lead, 'brand_score', 82, 'flagged', '[]'::jsonb), now() - interval '30 hours'),
    (_brand, i, _user, 'submitted', '{"from":"draft","to":"in_review","comment":null}'::jsonb, now() - interval '12 hours'),
    (_brand, i, _user, 'changes_requested', '{"from":"in_review","to":"changes_requested","comment":"Please end on a question for other makers."}'::jsonb, now() - interval '6 hours');

  INSERT INTO content_requests (brand_id, created_by, brief, persona_id, goal_id, channels, sliders, created_at)
  VALUES (_brand, _user, 'Short outreach email to a bakery founder thinking about new packaging.',
    p_evt, g_lead, ARRAY['email'], s, now() - interval '2 hours') RETURNING id INTO r;
  INSERT INTO content_items (request_id, brand_id, channel, fields, status, brand_score, created_by, created_at, updated_at)
  VALUES (r, _brand, 'email', demo_fields(
    'Hi [NEEDS CONFIRMATION: first name], I heard you''re thinking about new packaging.',
    E'Hi [NEEDS CONFIRMATION: first name],\n\nI heard you''re thinking about new packaging, and I thought of the Fern & Fig redesign our team did last year. We started by looking at their bags in three local shops, and kept the parts their customers already loved.\n\nWe share clear steps and prices before any design work starts.\n\nWould a 20-minute call next week be useful to talk it through?\n\nBest wishes,\nThe Northlight team',
    'Would a 20-minute call next week be useful to talk it through?',
    NULL, NULL),
    'draft', 76, _user, now() - interval '2 hours', now() - interval '2 hours') RETURNING id INTO i;
  UPDATE content_items SET fields = fields || '{"subject_line":"An idea for your new packaging"}'::jsonb WHERE id = i;
  INSERT INTO activity_log (brand_id, content_item_id, actor, action, details, created_at) VALUES
    (_brand, i, _user, 'generated', jsonb_build_object('sliders', s, 'persona_id', p_evt, 'goal_id', g_lead, 'brand_score', 76, 'flagged', '[]'::jsonb), now() - interval '2 hours');

  PERFORM set_config('app.demo_seed', 'off', true);
END;
$function$;