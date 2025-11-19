WITH catalog AS (
  SELECT * FROM (VALUES
    ('tomato', 'Tomato', 'vegetable', 'kg', 'RWF', '{"color":"red","shelf_life_days":5}'::jsonb),
    ('onion', 'Onion', 'vegetable', 'kg', 'RWF', '{"color":"yellow","shelf_life_days":14}'::jsonb),
    ('potato', 'Potato', 'tuber', 'kg', 'RWF', '{"variety":"irish","shelf_life_days":21}'::jsonb),
    ('cabbage', 'Cabbage', 'vegetable', 'kg', 'RWF', '{"size":"medium","shelf_life_days":10}'::jsonb),
    ('chili-pepper', 'Chili Pepper', 'spice', 'kg', 'RWF', '{"heat":"medium","shelf_life_days":12}'::jsonb)
  ) AS t(slug, display_name, category, unit_type, currency, metadata)
), upserted AS (
  INSERT INTO public.produce_catalog (slug, display_name, category, unit_type, default_currency, metadata)
  SELECT slug, display_name, category, unit_type, currency, metadata
  FROM catalog
  ON CONFLICT (slug) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        category = EXCLUDED.category,
        unit_type = EXCLUDED.unit_type,
        default_currency = EXCLUDED.default_currency,
        metadata = EXCLUDED.metadata
  RETURNING id, slug
)
INSERT INTO public.produce_catalog_translations (produce_id, locale, display_name, metadata)
SELECT up.id,
       translations.locale,
       translations.display_name,
       jsonb_build_object('source', 'seed')
FROM upserted up
JOIN (
  VALUES
    ('tomato', 'en', 'Tomato'),
    ('tomato', 'fr', 'Tomate'),
    ('tomato', 'rw', 'Inyanya'),
    ('onion', 'en', 'Onion'),
    ('onion', 'fr', 'Oignon'),
    ('onion', 'rw', 'Igitunguru'),
    ('potato', 'en', 'Potato'),
    ('potato', 'fr', 'Pomme de terre'),
    ('potato', 'rw', 'Ibirayi'),
    ('cabbage', 'en', 'Cabbage'),
    ('cabbage', 'fr', 'Chou'),
    ('cabbage', 'rw', 'Ikabange'),
    ('chili-pepper', 'en', 'Chili Pepper'),
    ('chili-pepper', 'fr', 'Piment'),
    ('chili-pepper', 'rw', 'Urusenda')
) AS translations(slug, locale, display_name)
  ON translations.slug = up.slug
ON CONFLICT (produce_id, locale) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      metadata = EXCLUDED.metadata;
