BEGIN;

-- Bar Menu Items Integration
-- This seed file populates the restaurant_menu_items table with a shared menu
-- for all 97 bars listed. Each bar gets the same menu items.

-- Menu data source: Bars and Restaurants standard menu
-- Total items: 184
-- Total bars: 97
-- Total records to insert: 17,848

-- Helper function to generate UUID v4
-- Uses gen_random_uuid() which is available via pgcrypto extension

-- Insert menu items for each bar
-- Structure: Class (Drinks/Food), Category (subcategory), Item Name, Description

-- Define the bar IDs that will receive the menu
DO $$
DECLARE
  bar_ids UUID[] := ARRAY[
    '00710229-f8b1-4903-980f-ddcb3580dcf2',
    '01c7812c-b553-4594-a598-52641f057952',
    '0243b1c6-f563-42c8-9058-6b52b53c4f64',
    '04744ebb-710f-46ee-a008-23c30e121b95',
    '04bf7b7d-4505-4f8e-869e-84e14e7369da',
    '05f0d0e7-23f9-48a3-aca9-d5bbc42dd78c',
    '0ab91c97-09a6-4eb5-977b-6dfb423134f6',
    '0b26972a-ab54-4822-982a-ddbb0cef22d0',
    '0b3e467d-76b2-49d3-abfb-1d2d06e00f37',
    '0d23f024-ab68-4757-bbbe-cc539291dab9',
    '0e656e54-3f5d-4d2b-b9eb-3a4c75f82451',
    '0f2fa567-d68b-4fa9-abef-384ccba21d56',
    '0fcd1bf5-cb3d-4c8d-a439-0607de737ad2',
    '106aedce-e8fa-4fd0-ac7f-d2fb323e5627',
    '13324d55-1765-4003-9faf-dae320539de0',
    '1781f20e-0644-4e2b-a06a-b99376d8c127',
    '1c98b9df-5d20-4b9c-b2d2-b954e6fd677d',
    '203e007b-165a-4cd2-86fc-828e814a0c5f',
    '21b1858c-728e-4043-b1e3-93c81cd83e70',
    '2794f06c-e969-40a2-a968-4929e19aec6f',
    '3511b999-0fc5-4160-8d14-0c77c245584b',
    '3cf7166e-861e-470b-abcb-3c612ed0c184',
    '3d9f523b-03f9-4cac-9807-de2b1f2665ff',
    '3ecfc5d1-14f0-407d-98b5-cdf09dd7d161',
    '3f66d51c-9eb2-440c-b97e-07451a62e396',
    '3fd845e7-7b5c-4acb-b32f-c7d5be494f11',
    '43616971-c6e4-4fef-af38-348d34654cf3',
    '475b97df-4a8b-4c85-bac0-51d6b032acb9',
    '4a796727-0994-467a-9dcd-eb8a1cbd1eff',
    '4c1977fa-448b-4c79-a40a-67f23e958d53',
    '504c24ce-7a1f-4294-877d-7fb0bfd778c9',
    '53273d0f-7623-419f-a84d-ce15b29b493f',
    '532aafea-a82e-43b7-8840-104e116dd28e',
    '5edf6628-7368-4d07-b6e3-d418ac339d69',
    '6024870f-715b-4e01-8a60-94b660941aad',
    '61235d49-977c-4903-b05b-8dbb283b6eb6',
    '61f8e7ec-0a60-48cc-851c-9acad8524cf8',
    '637e8e6a-6737-4209-82e8-a62b74e42136',
    '69b60e3c-9cbe-4cc9-a8c7-0bf01b4e8382',
    '6a391b95-05e1-4947-bf55-a82f1491070a',
    '6a52f85a-ef9a-4d96-9b0f-f81867b27ddb',
    '6fdc98e1-d5d4-4528-8dd6-a4fca1aaf48f',
    '6fe2bcae-dfa5-4baf-8eb7-6fb218793e41',
    '7117b303-4b6c-479d-b15a-e6424448e9e4',
    '75a00065-4748-4114-97a4-113b2a926056',
    '76d1740d-bd03-4194-bb19-e7fcc1fecae6',
    '7a0418fa-2d9a-4fe2-8032-5c6a4ea3679b',
    '7d005476-a910-437b-bd92-9176e1b65a14',
    '8039b5f0-d355-400a-8f35-04bb8460fcf6',
    '80652495-0a35-411e-a874-d8ded1ecebde',
    '88351597-f850-4d45-bc5c-1744bd6026fd',
    '89b95ae4-7a13-490e-9388-99dcc2541026',
    '8a5477e8-ae8f-48e9-9da3-e50c6fe51120',
    '8acbc8ef-5bbc-4df6-9bd0-b3886d066799',
    '8ce8a373-1c77-4433-bbd6-f67b0844a34e',
    '8e3c959f-f57c-480e-a941-9df13d97e111',
    '91e834c5-0c9b-4eb2-aac8-fd48d0e34b8b',
    '92b838c9-7fe7-4a2b-9e78-67963e7cd8e5',
    '950e951e-7e59-4750-8b64-f4365e56b1c5',
    '95960fbc-ac9b-48ac-a574-e9ee1cd570af',
    '95c43b6c-8021-4d55-917e-4bc4a1e2c776',
    '97b2e1ce-3afb-4465-8acc-8a23d0c969b7',
    '97c53497-59ae-4b26-a4a4-d4bd094a2d1b',
    '983996ec-6aba-44f8-bd6e-9f5abd987879',
    '997964a8-b7fc-4fc4-b283-9eeb29ce3974',
    '9ce7870a-48ef-450a-b828-3e3f63227942',
    'ac6c1b74-cd36-4be5-a825-19707592777e',
    'aecc2b56-1735-4fb6-a9fb-9202bd3e5490',
    'af08a959-7f2d-42c8-bc4b-569e74336940',
    'b0edb4ce-8975-4a0d-80b1-adb7ed5f22ea',
    'b6515b7e-f70f-45bd-b350-b0a198476eeb',
    'b6e470dd-99a1-452a-9a40-fec627678424',
    'b8690d98-db5e-428a-bd9b-dc8dd22c8ff8',
    'bdeb2122-8d27-4a31-9f28-1cef838c09fd',
    'c029d824-0bfc-4901-af30-ffdad853984e',
    'c1b59ce6-d870-401c-8673-8533cccf7522',
    'c5a0a4e4-5a81-4f62-9b2e-e5f89002629e',
    'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    'd87c3e7d-79bc-4054-9703-c7f94cdc4002',
    'd8ffb2d3-a280-48fb-be4b-e962676bd6c4',
    'dd68dab1-0380-479b-8195-6e840cacb360',
    'de9b346a-a97f-4d35-899a-e5304f0cbe40',
    'ded63293-1877-4324-a3dc-b07d38a41f51',
    'e2ba9cec-6cf5-4021-a67f-dc1a9836c6ab',
    'e347fe11-e6e7-49c1-910a-f0d2c873ca33',
    'ec177463-ad8e-4426-9060-d9b2d67bdd5d',
    'ed71f465-dd62-40b9-8c95-936cedef77bd',
    'f28fc401-db8c-4db4-a0fd-855726fd903b',
    'f2a57867-0210-4748-91bf-61d2ca9f5795',
    'f307e0ff-dbb6-4e8f-89b4-23e9450b16b6',
    'f4ca9413-2ad1-4dbb-80e9-38a6dd56929f',
    'f5217115-65e5-443f-80bd-285a7b02c735',
    'f7d76ee1-7e49-47b4-b2b3-18fc151bf7de',
    'f80450f9-b051-4e63-ac9c-8c452fc353bc',
    'fb3ca7c3-0bb6-44e6-8658-6e0a71e8cbf6',
    'fbc9d9fa-c98c-4872-b2a0-8d5c9ef29898'
  ]::UUID[];
  bar_id UUID;
BEGIN
  -- Loop through each bar and insert all menu items
  FOREACH bar_id IN ARRAY bar_ids
  LOOP
    -- BEERS (21 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Amstel 33cl', 'BEERS', '5%', 0.00, 'RWF', true, false),
      (bar_id, 'Corona 33cl', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Desperados 33cl', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Guinness 33cl', 'BEERS', '6.50%', 0.00, 'RWF', true, false),
      (bar_id, 'Heineken 33cl', 'BEERS', '5%', 0.00, 'RWF', true, false),
      (bar_id, 'Leffe Blonde 30cl', 'BEERS', '7%', 0.00, 'RWF', true, false),
      (bar_id, 'Legend 30 cl', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Mutzig 33cl', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Mutzig 50cl', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Primus 50cl', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'SKOL GATANU 50 CL', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Skol Lager 33cl', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Skol Malt 33cl', 'BEERS', '5.10%', 0.00, 'RWF', true, false),
      (bar_id, 'Skol Maltona 33 CL', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Skol Panache Lemon 33 CL', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Turbo King 50 CL', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Tusker Lager', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Tusker Malt', 'BEERS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Virunga Gold 33 CL', 'BEERS', '6.50%', 0.00, 'RWF', true, false),
      (bar_id, 'Virunga Mist 33 CL', 'BEERS', '6.50%', 0.00, 'RWF', true, false),
      (bar_id, 'Virunga Silver 33 CL', 'BEERS', '5%', 0.00, 'RWF', true, false);

    -- BREAKFAST (1 item)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Omelette', 'BREAKFAST', 'Omelette with vegetables and sometimes meat, commonly eaten for breakfast.', 0.00, 'RWF', true, false);

    -- CIDERSS (3 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Savanna Cider', 'CIDERSS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Smirnoff Guarana', 'CIDERSS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Smirnoff Ice', 'CIDERSS', '', 0.00, 'RWF', true, false);

    -- COCKTAILS (25 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Americano', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Aperol Spritz', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Black Russian', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Caipirinha', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Cosmopolitan', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Cuba libre', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Espresso martini', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Gin and Tonic', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Kamikaze', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Last word', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Long island', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Mai Tai', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Manhattan', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Margarita', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Martini (Classic)', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Mimosa', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Mojito', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Moscow Mule', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Negroni', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Old fashioned', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Pina colada', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Sex on the beach', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Sidecar', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Singapore sling', 'COCKTAILS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Tequila sunrise', 'COCKTAILS', '', 0.00, 'RWF', true, false);

    -- COFFEE (6 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Americano Coffee', 'COFFEE', '', 0.00, 'RWF', true, false),
      (bar_id, 'Cappuccino', 'COFFEE', '', 0.00, 'RWF', true, false),
      (bar_id, 'Espresso', 'COFFEE', '', 0.00, 'RWF', true, false),
      (bar_id, 'Latte', 'COFFEE', '', 0.00, 'RWF', true, false),
      (bar_id, 'Macchiato', 'COFFEE', '', 0.00, 'RWF', true, false),
      (bar_id, 'Mocha', 'COFFEE', '', 0.00, 'RWF', true, false);

    -- DESSERTS (4 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Avocado Smoothie', 'DESSERTS', 'A rich and creamy smoothie made from blended avocado.', 0.00, 'RWF', true, false),
      (bar_id, 'Carrot Cake', 'DESSERTS', 'A spiced cake made with grated carrots and cinnamon.', 0.00, 'RWF', true, false),
      (bar_id, 'Chocolate Cake', 'DESSERTS', 'A rich and moist chocolate-flavored cake.', 0.00, 'RWF', true, false),
      (bar_id, 'Fruit Salad', 'DESSERTS', 'A refreshing mix of fresh seasonal fruits.', 0.00, 'RWF', true, false);

    -- ENERGY DRINKS (3 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Cheetah Energy drink 30 CL', 'ENERGY DRINKS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Monster Energy', 'ENERGY DRINKS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Red Bull', 'ENERGY DRINKS', '', 0.00, 'RWF', true, false);

    -- FAST FOOD (6 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Beef Burger', 'FAST FOOD', 'A classic burger with a beef patty, cheese, and toppings.', 0.00, 'RWF', true, false),
      (bar_id, 'Chapati', 'FAST FOOD', 'A soft, pan-fried flatbread, served with various fillings.', 0.00, 'RWF', true, false),
      (bar_id, 'Chicken Burger', 'FAST FOOD', 'A grilled or crispy chicken burger with lettuce and sauce.', 0.00, 'RWF', true, false),
      (bar_id, 'Chips and Chicken', 'FAST FOOD', 'Fries served with a portion of grilled or fried chicken.', 0.00, 'RWF', true, false),
      (bar_id, 'Samosas', 'FAST FOOD', 'Deep-fried pastries filled with beef, chicken, or vegetables.', 0.00, 'RWF', true, false),
      (bar_id, 'Shawarma', 'FAST FOOD', 'Spiced and grilled meat wrapped in flatbread with sauces.', 0.00, 'RWF', true, false);

    -- GIN (6 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Bombay Sapphire Gin', 'GIN', '', 0.00, 'RWF', true, false),
      (bar_id, 'Bond 7 20Cl', 'GIN', '', 0.00, 'RWF', true, false),
      (bar_id, 'Gilbey''S 20Cl', 'GIN', '', 0.00, 'RWF', true, false),
      (bar_id, 'Gordon''s London Dry Gin', 'GIN', '1L 37.50%', 0.00, 'RWF', true, false),
      (bar_id, 'Hendrick''s Gin', 'GIN', '700ml 41.40%', 0.00, 'RWF', true, false),
      (bar_id, 'Konyagi 200Ml', 'GIN', '', 0.00, 'RWF', true, false);

    -- GRILL (9 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'BBQ Pork Ribs', 'GRILL', 'Slow-cooked pork ribs, finished on the grill with a BBQ glaze.', 0.00, 'RWF', true, false),
      (bar_id, 'Beef Brochettes', 'GRILL', 'Skewered and grilled meat (goat, beef, chicken, or fish), marinated in spices.', 0.00, 'RWF', true, false),
      (bar_id, 'Beef Steak', 'GRILL', 'Grilled beef steak, often served with fries or mashed potatoes.', 0.00, 'RWF', true, false),
      (bar_id, 'Chicken Brochettes', 'GRILL', '', 0.00, 'RWF', true, false),
      (bar_id, 'Fish Brochettes', 'GRILL', '', 0.00, 'RWF', true, false),
      (bar_id, 'Goat brochettes', 'GRILL', '', 0.00, 'RWF', true, false),
      (bar_id, 'Nyama Choma', 'GRILL', 'East African-style grilled beef or goat, served with a spicy sauce.', 0.00, 'RWF', true, false),
      (bar_id, 'Pork Steak', 'GRILL', 'Pork chop grilled to perfection, usually with a side of greens.', 0.00, 'RWF', true, false),
      (bar_id, 'Zingalo Brochettes', 'GRILL', '', 0.00, 'RWF', true, false);

    -- JUICES (9 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Fresh Orange Juice', 'JUICES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Inyange Apple 50 CL', 'JUICES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Inyange Mango 50 CL', 'JUICES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Inyange Mineral Water 50 CL', 'JUICES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Inyange Orange 50 CL', 'JUICES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Inyange Passion Fruits 50 CL', 'JUICES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Inyange Pineapple 50 CL', 'JUICES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Mango Juice', 'JUICES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Tree Tomato Juice', 'JUICES', '', 0.00, 'RWF', true, false);

    -- LIQUORS (9 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Amarula Cream Liq. 375Ml', 'LIQUORS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Baileys Irish Cream', 'LIQUORS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Beefeater London', 'LIQUORS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Campari', 'LIQUORS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Jagermeister', 'LIQUORS', '700ml 40%', 0.00, 'RWF', true, false),
      (bar_id, 'Limoncello', 'LIQUORS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Martini Rosso', 'LIQUORS', '1L 15%', 0.00, 'RWF', true, false),
      (bar_id, 'Tia Maria', 'LIQUORS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Triple Sec', 'LIQUORS', '', 0.00, 'RWF', true, false);

    -- MAIN COURSES (3 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'BBQ Chicken', 'MAIN COURSES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Beef Stew', 'MAIN COURSES', 'Slow-cooked beef in a rich sauce, commonly served with rice or plantains.', 0.00, 'RWF', true, false),
      (bar_id, 'Chicken Curry', 'MAIN COURSES', 'Chicken cooked in a fragrant and mildly spicy curry sauce.', 0.00, 'RWF', true, false);

    -- PASTA (3 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Lasagna', 'PASTA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Spaghetti Bolognese', 'PASTA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Spaghetti Carbonara', 'PASTA', '', 0.00, 'RWF', true, false);

    -- PIZZA (7 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Capricciosa', 'PIZZA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Cheese Pizza', 'PIZZA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Chicken Feast', 'PIZZA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Margherita', 'PIZZA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Meat Lovers', 'PIZZA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Pepperoni', 'PIZZA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Vegetarian', 'PIZZA', '', 0.00, 'RWF', true, false);

    -- RUM (5 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Aperol', 'RUM', '', 0.00, 'RWF', true, false),
      (bar_id, 'Bacardi Spiced Rum', 'RUM', '', 0.00, 'RWF', true, false),
      (bar_id, 'Captain Morgan White', 'RUM', '', 0.00, 'RWF', true, false),
      (bar_id, 'Havana Club', 'RUM', '700ml 40%', 0.00, 'RWF', true, false),
      (bar_id, 'Malibu', 'RUM', '700ml 5%', 0.00, 'RWF', true, false);

    -- SIDE DISHES (3 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'French Fries', 'SIDE DISHES', 'Classic deep-fried potato fries, served as a side or snack.', 0.00, 'RWF', true, false),
      (bar_id, 'Fried Bananas', 'SIDE DISHES', 'Ripe bananas deep-fried and sprinkled with sugar.', 0.00, 'RWF', true, false),
      (bar_id, 'Meat Pie', 'SIDE DISHES', 'A flaky pastry filled with minced meat.', 0.00, 'RWF', true, false);

    -- SODA (9 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Coca-Cola 30cl', 'SODA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Coca-Cola Zero 30cl', 'SODA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Fanta Citron 30 CL', 'SODA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Fanta Fiesta 30 CL', 'SODA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Fanta Orange 30cl', 'SODA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Fanta Pineapple 30cl', 'SODA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Krest Tonic 30 CL', 'SODA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Sprite 30 CL', 'SODA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Tonic Water', 'SODA', '', 0.00, 'RWF', true, false);

    -- SOUP (4 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Mushroom Soup', 'SOUP', 'A creamy soup made from blended mushrooms.', 0.00, 'RWF', true, false),
      (bar_id, 'Peanut Soup', 'SOUP', 'A creamy soup made with ground peanuts and mild spices.', 0.00, 'RWF', true, false),
      (bar_id, 'Rwandan Pumpkin Soup', 'SOUP', 'A creamy soup made from blended pumpkin and mild spices.', 0.00, 'RWF', true, false),
      (bar_id, 'Vegetable Soup', 'SOUP', 'A hearty broth filled with mixed vegetables.', 0.00, 'RWF', true, false);

    -- SPIRITS (9 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Abk6 Vs Pure Single 100Cl 40%', 'SPIRITS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Absolut Vodka', 'SPIRITS', '1L', 0.00, 'RWF', true, false),
      (bar_id, 'Ramy Martin xo', 'SPIRITS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Russian Standard Gold', 'SPIRITS', '700ml 40%', 0.00, 'RWF', true, false),
      (bar_id, 'Skyy Infusion Passion Fruit 1L', 'SPIRITS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Skyy Vodka 1L', 'SPIRITS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Tequila (Blanco)', 'SPIRITS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Uganda Waragi', 'SPIRITS', '', 0.00, 'RWF', true, false),
      (bar_id, 'Vodka', 'SPIRITS', '', 0.00, 'RWF', true, false);

    -- TEA (3 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Black Tea', 'TEA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Ginger Tea', 'TEA', '', 0.00, 'RWF', true, false),
      (bar_id, 'Green Tea', 'TEA', '', 0.00, 'RWF', true, false);

    -- TRADITIONAL (7 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Agatogo', 'TRADITIONAL', 'A thick plantain stew with meat, cooked with tomatoes and spices.', 0.00, 'RWF', true, false),
      (bar_id, 'Akabenzi', 'TRADITIONAL', 'Fried or grilled pork, crispy and well-seasoned, popular in bars.', 0.00, 'RWF', true, false),
      (bar_id, 'Ibihaza', 'TRADITIONAL', 'Pumpkin cooked with beans, a nutritious and filling dish.', 0.00, 'RWF', true, false),
      (bar_id, 'Igisafuria', 'TRADITIONAL', 'A one-pot dish with plantains, chicken, and vegetables, slow-cooked together.', 0.00, 'RWF', true, false),
      (bar_id, 'Isombe', 'TRADITIONAL', 'Mashed cassava leaves cooked with onions, peanuts, and sometimes fish.', 0.00, 'RWF', true, false),
      (bar_id, 'Matoke', 'TRADITIONAL', 'Steamed or boiled plantains, often mashed or served as a side dish.', 0.00, 'RWF', true, false),
      (bar_id, 'Ugali', 'TRADITIONAL', 'A dense porridge made from maize or cassava flour, commonly served with stews.', 0.00, 'RWF', true, false);

    -- VEGETARIAN (3 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Avocado Salad', 'VEGETARIAN', 'Sliced avocado served with tomatoes, onions, and a light dressing.', 0.00, 'RWF', true, false),
      (bar_id, 'Kachumbari', 'VEGETARIAN', 'A fresh salad made from diced tomatoes, onions, and chili.', 0.00, 'RWF', true, false),
      (bar_id, 'Peanut Sauce Vegetables', 'VEGETARIAN', 'A mix of vegetables cooked in a creamy peanut sauce.', 0.00, 'RWF', true, false);

    -- WATER (3 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Nile Mineral Water 50 CL', 'WATER', '', 0.00, 'RWF', true, false),
      (bar_id, 'Virunga Sparkling water 33 CL', 'WATER', '', 0.00, 'RWF', true, false),
      (bar_id, 'Vital''O 50 CL', 'WATER', '', 0.00, 'RWF', true, false);

    -- WHISKEY (16 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Bourbon', 'WHISKEY', '', 0.00, 'RWF', true, false),
      (bar_id, 'Chivas Regal 12 Year Old', 'WHISKEY', '', 0.00, 'RWF', true, false),
      (bar_id, 'Cointreau', 'WHISKEY', '', 0.00, 'RWF', true, false),
      (bar_id, 'Creama Whisky Airisbei 17% 70Cl', 'WHISKEY', '', 0.00, 'RWF', true, false),
      (bar_id, 'Dewar''s 12 Year Old', 'WHISKEY', '', 0.00, 'RWF', true, false),
      (bar_id, 'Famous Grouse Scotch Whisky', 'WHISKEY', '700ml 5%', 0.00, 'RWF', true, false),
      (bar_id, 'Hennessy', 'WHISKEY', '', 0.00, 'RWF', true, false),
      (bar_id, 'Highland Park 12Y 70Cl 40%', 'WHISKEY', '', 0.00, 'RWF', true, false),
      (bar_id, 'J&B Whiskey', 'WHISKEY', '700ml 5%', 0.00, 'RWF', true, false),
      (bar_id, 'Jack Daniel''s', 'WHISKEY', '1L 40%', 0.00, 'RWF', true, false),
      (bar_id, 'Jameson Black Barrel', 'WHISKEY', '700ml 40%', 0.00, 'RWF', true, false),
      (bar_id, 'Jameson Irish Whiskey', 'WHISKEY', '', 0.00, 'RWF', true, false),
      (bar_id, 'Jim Beam White Label', 'WHISKEY', '', 0.00, 'RWF', true, false),
      (bar_id, 'Johnnie Walker Black Label', 'WHISKEY', '700ml 40%', 0.00, 'RWF', true, false),
      (bar_id, 'Johnnie Walker Blue Label', 'WHISKEY', '', 0.00, 'RWF', true, false),
      (bar_id, 'Johnnie Walker Red Label', 'WHISKEY', '', 0.00, 'RWF', true, false);

    -- WINES (7 items)
    INSERT INTO public.restaurant_menu_items (bar_id, name, category, description, price, currency, is_available, ocr_extracted)
    VALUES
      (bar_id, 'Cellar Cask Select Johannisberger Red', 'WINES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Cellar Cask Select Johannisberger White', 'WINES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Drostdy Hof Claret 750Ml', 'WINES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Drostdy-Hof Grand Cru 375Ml', 'WINES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Four Cousins Dry Red 1.5L', 'WINES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Four Cousins Natural Sweet Rose 750Ml', 'WINES', '', 0.00, 'RWF', true, false),
      (bar_id, 'Four Cousins Natural Sweet White 750Ml', 'WINES', '', 0.00, 'RWF', true, false);

  END LOOP;

  RAISE NOTICE 'Successfully inserted menu items for % bars', array_length(bar_ids, 1);
END;
$$;

COMMIT;
