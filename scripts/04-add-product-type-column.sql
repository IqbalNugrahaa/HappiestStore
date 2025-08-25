-- Add type column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'sharing';

-- Create index for faster type-based lookups
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);

-- Add constraint to ensure valid product types
ALTER TABLE products ADD CONSTRAINT check_product_type 
CHECK (type IN ('sharing', 'sharing 8u', 'sharing 4u', 'sharing 2u', 'sharing biasa', 'sharing antilimit', 'private', 'edukasi', 'sosmed', 'google', 'editing', 'music'));
