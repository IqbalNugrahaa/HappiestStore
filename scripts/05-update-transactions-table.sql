-- Add new columns to transactions table to match the required fields
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS item_purchase VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS store_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100),
ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS selling_price DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS revenue DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS month INTEGER,
ADD COLUMN IF NOT EXISTS year INTEGER;

-- Update existing records to populate new fields
UPDATE transactions SET 
    date = transaction_date,
    item_purchase = product_name,
    selling_price = unit_price,
    revenue = total_amount,
    month = EXTRACT(MONTH FROM transaction_date),
    year = EXTRACT(YEAR FROM transaction_date)
WHERE date IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_month_year ON transactions(month, year);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_name);
CREATE INDEX IF NOT EXISTS idx_transactions_store ON transactions(store_name);
