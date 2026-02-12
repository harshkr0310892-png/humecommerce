-- Migration: add a top_deals home_sections entry and ensure product is active
-- Adds a home_sections row with content.product_ids containing the given product id

-- Replace product id as needed
DO $$
BEGIN
  -- Make sure the product exists and is active
  UPDATE public.products
  SET is_active = true
  WHERE id = 'a21120c0-58a5-4193-ab24-c4ab63b8f6f1';

  -- Insert a top_deals section if one doesn't already exist
  IF NOT EXISTS (SELECT 1 FROM public.home_sections WHERE section_type = 'top_deals') THEN
    INSERT INTO public.home_sections (section_type, title, content, sort_order, is_active)
    VALUES (
      'top_deals',
      'Top Deals',
      jsonb_build_object('product_ids', jsonb_build_array('a21120c0-58a5-4193-ab24-c4ab63b8f6f1')),
      0,
      true
    );
  ELSE
    -- If a top_deals section exists but doesn't include this product, append it to product_ids
    UPDATE public.home_sections
    SET content = (
      CASE
        WHEN (content->'product_ids') IS NULL THEN jsonb_set(content, '{product_ids}', jsonb_build_array('a21120c0-58a5-4193-ab24-c4ab63b8f6f1'))
        WHEN (content->'product_ids') @> to_jsonb(array['a21120c0-58a5-4193-ab24-c4ab63b8f6f1']::text[]) THEN content
        ELSE jsonb_set(content, '{product_ids}', (content->'product_ids') || jsonb_build_array('a21120c0-58a5-4193-ab24-c4ab63b8f6f1'))
      END
    )
    WHERE section_type = 'top_deals';
  END IF;
END$$;
