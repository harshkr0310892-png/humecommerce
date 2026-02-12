-- Add layout configuration to home_sections for deal grids
ALTER TABLE home_sections ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT '{"columns": 5, "rows": 2}';

-- Add comment
COMMENT ON COLUMN home_sections.layout_config IS 'Grid layout configuration: {"columns": 5, "rows": 2} for 5 columns x 2 rows';
