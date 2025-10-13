INSERT INTO public.orders (id, order_code, bar_id, customer_id, total_minor, currency, status)
SELECT gen_random_uuid(), 'ORD001', bars.id, customers.id, 15000, 'RWF', 'pending'
FROM public.bars
JOIN public.customers ON customers.wa_id IS NOT NULL
LIMIT 1;
