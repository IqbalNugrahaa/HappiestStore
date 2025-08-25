-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_product_id ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_product_name ON transactions(product_name);

-- Add RLS (Row Level Security)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read all transactions
CREATE POLICY "Allow authenticated users to read transactions" ON transactions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create policy to allow authenticated users to insert transactions
CREATE POLICY "Allow authenticated users to insert transactions" ON transactions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create policy to allow authenticated users to update transactions
CREATE POLICY "Allow authenticated users to update transactions" ON transactions
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create policy to allow authenticated users to delete transactions
CREATE POLICY "Allow authenticated users to delete transactions" ON transactions
    FOR DELETE USING (auth.role() = 'authenticated');
