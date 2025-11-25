-- Ensure all home menu items are present
INSERT INTO public.whatsapp_home_menu_items (id, title, description, display_order, is_active)
VALUES 
    ('rides_agent', '🚗 Rides & Delivery', 'Request a ride or delivery', 1, true),
    ('insurance_agent', '🛡️ Insurance', 'Get insurance quotes', 2, true),
    ('jobs_agent', '💼 Jobs', 'Find work or hire', 3, true),
    ('real_estate_agent', '🏠 Property', 'Buy or rent property', 4, true),
    ('business_broker_agent', '🏪 Marketplace', 'Buy and sell businesses', 5, true),
    ('profile', '👤 Profile', 'Manage wallet and settings', 6, true),
    ('waiter_agent', '🍽️ Waiter', 'Order food and drinks', 7, true)
ON CONFLICT (id) DO UPDATE 
SET 
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    is_active = true;
