-- Insert sample products
INSERT INTO products (name, price) VALUES
    ('Laptop Dell XPS 13', 15000000.00),
    ('Mouse Wireless Logitech', 250000.00),
    ('Keyboard Mechanical', 750000.00),
    ('Monitor 24 inch', 2500000.00),
    ('Headphone Sony WH-1000XM4', 4500000.00)
ON CONFLICT DO NOTHING;

-- Insert sample transactions
INSERT INTO transactions (product_name, quantity, unit_price, total_amount, transaction_date)
SELECT 
    p.name,
    CASE 
        WHEN p.name = 'Laptop Dell XPS 13' THEN 2
        WHEN p.name = 'Mouse Wireless Logitech' THEN 5
        ELSE 3
    END as quantity,
    p.price,
    CASE 
        WHEN p.name = 'Laptop Dell XPS 13' THEN p.price * 2
        WHEN p.name = 'Mouse Wireless Logitech' THEN p.price * 5
        ELSE p.price * 3
    END as total_amount,
    CURRENT_DATE - INTERVAL '1 day' * (RANDOM() * 30)::int as transaction_date
FROM products p
ON CONFLICT DO NOTHING;
