#!/usr/bin/env node
/*
  Malta Menu Importer

  - Parses a pasted TSV/plain-text list of menu items
  - De-duplicates per bar (case/whitespace-normalized names)
  - Checks existing rows in public.restaurant_menu_items
  - Inserts only missing items for those bars

  Usage:
    DATABASE_URL=postgresql://... node scripts/menu/import-malta-menu.mjs

  Notes:
  - Currency is set to EUR for Malta bars
  - Runs inserts in batches inside a single transaction
*/

import process from 'node:process';
import { Client } from 'pg';

// Raw input. Keep header as first line.
const INPUT = `bar name	bar_id	item name	price	category
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Americano	1.6	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Aperol Spritz	8	Apéritifs
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Asahi	4.5	Bottled Beer & Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Avocado Sauce	1.5	Burger Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Bajtra Spritz	8	Apéritifs
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Barbera D'Alba Superiore   Italy	26.5	Red Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Beef Carpaccio	11.5	Starters to Share Crudités & Carpaccio
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Beef Rib Eye	28.5	Mains
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Beef Teriyaki	13.5	Salads
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Beef Teriyaki Wrap	10	Wraps Served Until 6PM)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Beer Tower 3L)	25	Tap Beer & Beer Tower
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Beetroot Carpaccio	8.5	Starters to Share Crudités & Carpaccio
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Berry Mule	10	Signature Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Black Tea with Fresh Milk	1	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Blooming Rose	6	Mocktails Non Alcoholic Cocktails)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Blueberry Dream	6.5	Smoothies & Fresh Juices
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Boost Your Smoothie	0.5	Smoothies & Fresh Juices
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Bruschetta Mare e Monti	13	Starters to Share   Sharing Platters
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Caponata	3	Sides & Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cappuccino	2.5	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Capricciosa	12	Pizza   Al Pomodoro Tomato Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Caravaggio Chenin Blanc   Malta	19.5	White Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cerasuolo di Abruzzo Rosé Agronika   Italy	16.5	Rosé Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cheese Burger	10	Burgers Home Made)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cheval Franc   Marsovin, Malta	36	Red Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Chianti   Il Palazzo, Italy	23	Red Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Chicken & Mushroom Pasta	13.5	Pasta & Risotto
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Chicken Nuggets	7.5	Kids Menu
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Chicken Thigh Burger	13.5	Burgers Home Made)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Chicken Thigh Wrap	10	Wraps Served Until 6PM)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Chicken Tzatziki	13.5	Salads
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Chicken Wings	7	Kids Menu
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Chill Lemon	2.4	Bottled Beer & Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Chocolate Milkshake	5	Milkshakes
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cisk Excel Half Pint	2.4	Tap Beer & Beer Tower
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cisk Excel Pint	4.8	Tap Beer & Beer Tower
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cisk Lager Half Pint	2.4	Tap Beer & Beer Tower
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cisk Lager Pint	4.8	Tap Beer & Beer Tower
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cold Cuts & Cheese	16	Starters to Share   Sharing Platters
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cookies Milkshake	6	Milkshakes
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Coral Cave	4.9	Craft & Seasonal Beer
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Coral Cave   Small	3.7	Craft & Seasonal Beer
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Corona	3.5	Bottled Beer & Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cuban Mojito	8	Classic Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cuban Virgin Mojito	6	Mocktails Non Alcoholic Cocktails)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Cynar Spritz	8	Apéritifs
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Daiquiri	8.5	Classic Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Dell’Etna	15	Pizza   Bianca White Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Disfrutando 0.0, VG   Spain	19	Non Alcoholic Wine
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Double Espresso	2.2	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Drappier Carte D'Or Brut Champagne   France	55	Sparkling & Champagne
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Espresso	1.5	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Espresso Lungo	1.5	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Exotic Punch	6	Mocktails Non Alcoholic Cocktails)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Falafel Balls	6.5	Tapas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Falafel Halloumi Burger	13.5	Burgers Home Made)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Falanghina   Corteregia, Italy	21.5	White Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Farsons Blue Label Half Pint	3.5	Tap Beer & Beer Tower
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Farsons Blue Label Pint	5.5	Tap Beer & Beer Tower
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Focaccia	8	Pizza   Focaccia
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Fresh Lemonade	4	Smoothies & Fresh Juices
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Fresh Orange Juice	4	Smoothies & Fresh Juices
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Fresh Salad	3	Sides & Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Fried Calamari	13	Tapas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Fries	3	Sides & Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Fritto Misto	18	Starters to Share   Sharing Platters
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Frutti di Mare Tagliolini or Risotto)	17	Pasta & Risotto
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Garganelli Maltese	13.5	Pasta & Risotto
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Garganelli Norma	12.5	Pasta & Risotto
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Gavi di Gavi   Picollo, Italy	24	White Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Gavi di Gavi White)	6	Wine by the Glass 175ml)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Gin Blossom Spritz	9	Signature Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Gingered Peach Punch	9	Signature Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Golden Bay	4.9	Craft & Seasonal Beer
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Golden Bay   Small	3.7	Craft & Seasonal Beer
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Gorgonzola Cream Souce	2	Sides & Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Greca	12.5	Salads
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Greco di Tufo   Torricino, Italy	22.5	White Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Greek Focaccia	15	Pizza   Focaccia
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Grilled Salmon in Asparagus Sauce	21.5	Mains
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Grilled Vegetables	3	Sides & Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Guinness	4.8	Bottled Beer & Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Heineken Half Pint	2.4	Tap Beer & Beer Tower
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Heineken Pint	4.8	Tap Beer & Beer Tower
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Herbal Teas	2.5	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Hobgoblin Ruby Beer	5.8	Bottled Beer & Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Homemade Ginger, Honey, Lemon & Mint Tea	3	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Hot Chocolate	3	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Iced Coffee	3.5	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Instant Coffee	1	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Jack at Zion	10	Classic Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Jamaican Burger	14.5	Burgers Home Made)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Kids Burger	8.5	Kids Menu
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Kids Pasta	7.5	Kids Menu
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Kids Pizza	10	Kids Menu
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Kombucha	3.5	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	La Torre Gellewza Shiraz   Malta	16	Red Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	La Torre Girgentina   Malta	16	White Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	La Torre White)	4.5	Wine by the Glass 175ml)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Lady in Purple	10	Classic Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Latte	3	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Limoncello Spritz	8	Apéritifs
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Long Island Iced Tea	12	Classic Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Macchiato	1.7	Coffees & Teas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Maltese	13	Pizza   Bianca White Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Maltese Rabbit To Share)	41.5	Mains
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Mango Sangria	11	Signature Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Margarita	8.5	Classic Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Margherita	10	Pizza   Al Pomodoro Tomato Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Marittima	14.5	Pizza   Al Pomodoro Tomato Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Mediterranean Chicken Breast	18	Mains
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Mediterranean Halloumi	6.5	Tapas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Mexican Burro	11	Signature Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Mexican Sauce	1.5	Burger Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Micro Greens	12.5	Salads
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Moretti	3.8	Bottled Beer & Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Moscato D'Asti   Fabio Perrone, Italy	22	Sweet Sparkling Wine
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Mushrooms souce	2	Sides & Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Negroni	8	Classic Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Non Alcoholic Beer	2.5	Bottled Beer & Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Norma	12	Pizza   Al Pomodoro Tomato Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	One Love	12	Pizza   Al Pomodoro Tomato Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Oreo Milkshake	6	Milkshakes
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Palatino Rosé   Cassar Camilleri, Malta	17.5	Rosé Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Palatino Sauvignon Blanc   Malta	17.5	White Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Pappardelle Beef Ragu	16	Pasta & Risotto
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Pecorino Cheese Focaccia	10.5	Pizza   Focaccia
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Pepper Mayo	1.5	Burger Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Pepper Sounce	2	Sides & Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Piccante	12	Pizza   Bianca White Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Piña Colada	10	Classic Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Pomelo Paloma	11	Signature Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Popeye	12.5	Pizza   Bianca White Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Primitivo   Cantina Museo Albea, Italy	20	Red Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Primitivo Red)	6	Wine by the Glass 175ml)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Prosecco di Treviso   Moletto, Italy	20	Sparkling & Champagne
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Prosecco Rosé Treviso Millesimato   Moletto, Italy	20	Sparkling & Champagne
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Quattro Formaggi	12	Pizza   Bianca White Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Red Devil Long Island	12	Classic Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Regina Margherita	13.5	Salads
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Ricotta & Caponata	8.5	Tapas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Risotto Mushrooms & Truffle	13.5	Pasta & Risotto
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Roasted Potatoes	3	Sides & Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Rosemary Focaccia	8.5	Pizza   Focaccia
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	San Blas	4.9	Craft & Seasonal Beer
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	San Blas   Small	3.7	Craft & Seasonal Beer
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Seabass	20	Mains
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Seasonal Beer	4.9	Craft & Seasonal Beer
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Seasonal Beer   Small	3.7	Craft & Seasonal Beer
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Sex on the Beach	9	Classic Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Shandy	2.4	Bottled Beer & Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Sicilian Arancini	7.5	Tapas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Sicilian Parmigiana	16	Mains
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Siciliana	10.5	Pizza   Al Pomodoro Tomato Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Spiced Old Fashioned	11	Signature Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Sriracha Mayo	1.5	Burger Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Strawbanana Madness	6.5	Smoothies & Fresh Juices
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Tagliata 1KG To Share)	60	Mains
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Tagliolini Aglio, Olio e Peperoncino	11.5	Pasta & Risotto
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Tagliolini Vongole	13.5	Pasta & Risotto
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Thai Prawns	7	Tapas
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Thatchers Apple & Blackcurrant	4	Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Thatchers Blood Orange	4	Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Thatchers Cloudy Lemon	4	Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Thatchers Gold	4	Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Thatchers Haze	4	Ciders
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Tropical	13.5	Salads
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Tropical Mojito	9	Signature Cocktails
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Tropical Sunshine	6.5	Smoothies & Fresh Juices
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Tuna Carpaccio	11.5	Starters to Share   Crudités & Carpaccio
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Tuna Salad	14	Salads
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Tutti Frutti	6	Mocktails Non Alcoholic Cocktails)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Upgrade Bun Gluten Free Bun)	2	Burger Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Upgrade Bun Wholegrain Bun)	1	Burger Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Vanilla Milkshake	5	Milkshakes
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Vegan Pizza	13	Pizza   Bianca White Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Vegana	12	Pizza   Al Pomodoro Tomato Base)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Vegetarian Maltese	13	Starters to Share   Sharing Platters
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Viognier   Delas Frères, France	18.5	White Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Virgin Colada	6	Mocktails Non Alcoholic Cocktails)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Zinfandel   Eagle Creek, California, USA	18.5	Rosé Wines
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Zinfandel Rosé)	6	Wine by the Glass 175ml)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Zion Burger	14	Burgers Home Made)
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Zion Calzone	14	Zion Calzone
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Zion Chimichurri sounce	2	Sides & Extras
Zion Reggae Bar	4d514423-222a-4b51-83ed-5202d3bf005b	Zion House Sauce	1.5	Burger Extras
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Aljotta	8.5	Soup
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Bacon Jam Burger	14.5	Burgers
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Baked Feta	10.5	Starters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	BBQ Ribs	24.5	Mains
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Beef Brisket Salad	16.5	Salads
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Beef Tagliata (300g)	26.5	Mains
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Black Mussels	14.5	Starters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Blue Label Smooth & Creamy (5% vol)	6.2	Beers
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Bragioli	21.5	Mains
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Brisket Ciabatta	11.5	Light Bites
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Bruschetta Feta	5.5	Starters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Calamari Fritti	14.5	Starters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Calzone Victoria	15.5	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Capricciosa	12.5	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Carne	15.5	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Char Sui Chicken	21.5	Mains
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Chicken Caesar Salad	13.5	Salads
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Chicken Ciabatta	9.5	Light Bites
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Chicken Lollipops	14.5	Starters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Chicken Nuggets & Chips	6.5	Kids Menu
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Chicken Roulade	24.5	Mains
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Chicken Sandwich	13.5	Burgers
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Cisk Chill Lemon (5% vol)	3.2	Beers
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Cisk Excel (5% vol)	3.2	Beers
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Coca Cola	4	Beverages
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Coca Cola Zero	4	Beverages
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Country Risotto	14.5	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Crispy Pork Belly	22.5	Mains
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Deep Fried Burrata	13.5	Starters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Fanta	4	Beverages
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Fish & Chips	19.5	Mains
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Focaccia	13.5	Mini Bites & Platters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	French Fries	3	Sides
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Frutti Di Mare	16.5	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Garganelli Bosco	16.9	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Garganelli Maltese	15.5	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Garlic Bread	5.5	Starters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Gnocchi Zucchini & Pancetta	14.5	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Greek Salad	15.5	Salads
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Habanero Burger	14.5	Burgers
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Honest Burger	13.5	Burgers
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Hopleaf Pale Ale (5% vol)	3.2	Beers
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Hot & Spicy Wings	14.5	Mini Bites & Platters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Kale & Halloumi Salad	15.5	Salads
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Kids Penne Pasta	6.5	Kids Menu
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Kids Pizza	6.5	Kids Menu
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Large Sparkling Water	4.7	Beverages
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Large Still Water	4.7	Beverages
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Lasagna	14.5	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Linguini Burrata	12.9	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Linguini de La Casa	14.5	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Linguini Marisco	16.5	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Linguini Vongole	15.5	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Louisiana Platter	28.5	Mini Bites & Platters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Maltese	12.5	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Maltese Bruschetta	6.5	Starters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Maltese Style Rabbit	22.5	Mains
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Margherita	8.95	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Mini Cheeseburger	6.5	Kids Menu
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Napolitana	10.5	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Orecchiette Ricotta	12.5	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Parma e Rucola	15.5	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Pepperoni	10.5	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Piccante	12.5	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Prosciutto e Funghi	12.5	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Pulled Pork Ciabatta	14.5	Burgers
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Quattro Formaggi	14.5	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Rib Eye Steak (300g)	28.5	Mains
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Risotto Funghi Secchi & Salsiccia	14.5	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Risotto Gamberi & Chorizo	16	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Rosé D’Anjou (5% vol)	19.1	Wine
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Salmon Steak	21.5	Mains
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Seabass Involtini	21.5	Mains
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Shrimp Bruschetta	8.5	Starters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Spaghetti Bolognese	12.9	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Spaghetti Carbonara	14.5	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Spaghetti Rabbit	15.5	Pasta & Rice
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Sparkling Water	2.7	Beverages
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Sprite	4	Beverages
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Still Water	2.7	Beverages
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Sweet Pea & Chorizo Croquettes	9.5	Starters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Trio of Dips	13.5	Mini Bites & Platters
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Vegan Cobb Salad	16.5	Salads
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Vegetariana	11.5	Pizza
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Veggie Omelette	7.9	Victoria Gastro Pub
Victoria Gastro Pub	46105fa8-efc7-422a-afa8-a5188eb2f5ed	Victoria Truffle Burger	15.5	Burgers
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	Aglio E Olio	13.95	Pasta & Risotto
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	Aqua Panna Still Water (250ml)	2.35	Beverages
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	Aqua Panna Still Water (750ml)	4.1	Beverages
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	Asian Platter	29	PLATTERS
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	Avery Spring Roll	10.95	New Style Special Rolls
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	Avocado & Cucumber Roll	6.95	Hosomaki Rolls
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	Avocado Roll	6.95	Hosomaki Rolls
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	Bacon Cheese Burger	12.5	Burgers
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	Bacon Cheese Burger Deal	13.5	Combo Deals
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	Bacon, Cheese & Egg Toast	4.5	TOASTIE
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	Baked Salmon	22	MAIN COURSES
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	Bangkok Chicken	19.95	Hot Pots & Curries
The Long Hall Irish Pub	96bb748e-e827-4b04-9d18-e7b1df0c0f82	BBQ Sauce	0.75	Sauces
... (truncated for brevity)
`;

// Simple UUID v4-ish test
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function normalizeQuotes(s) {
  return s
    .replace(/[’‘‛ʻ]/g, "'")
    .replace(/[“”]/g, '"');
}

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function normName(s) {
  return normalizeWhitespace(normalizeQuotes(s)).toLowerCase();
}

function parseLine(line) {
  if (!line || !line.trim()) return null;
  if (/^bar\s+name/i.test(line)) return null; // header

  // Prefer TSV split
  let parts = line.split('\t');
  if (parts.length !== 5) {
    // Fallback: regex capturing groups: barName, uuid, itemName, price, category
    const m = line.match(/^(.+?)\s+([0-9a-fA-F-]{36})\s+(.+?)\s+([0-9]+(?:\.[0-9]+)?)\s+(.+)$/);
    if (!m) return null;
    parts = [m[1], m[2], m[3], m[4], m[5]];
  }
  const [barName, barIdRaw, itemNameRaw, priceRaw, categoryRaw] = parts;
  const bar_id = (barIdRaw || '').trim();
  if (!UUID_RE.test(bar_id)) return null;
  const name = normalizeWhitespace(normalizeQuotes(itemNameRaw || ''));
  const category = normalizeWhitespace(normalizeQuotes(categoryRaw || ''));
  const price = Number((priceRaw || '').toString().trim());
  if (!Number.isFinite(price)) return null;
  return { bar_name: normalizeWhitespace(barName || ''), bar_id, name, price, category };
}

function dedupeInput(items) {
  const seen = new Map(); // bar_id -> Set(normName)
  const out = [];
  for (const it of items) {
    if (!seen.has(it.bar_id)) seen.set(it.bar_id, new Set());
    const s = seen.get(it.bar_id);
    const key = normName(it.name);
    if (s.has(key)) continue; // drop duplicate within import set for same bar
    s.add(key);
    out.push(it);
  }
  return out;
}

async function main() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL env var.');
    process.exit(2);
  }

  // 1) Parse
  const rawLines = INPUT.split('\n');
  const parsed = rawLines.map(parseLine).filter(Boolean);
  const deduped = dedupeInput(parsed);

  // 2) Connect
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // 3) Ensure bars exist and are Malta
    const barIds = Array.from(new Set(deduped.map((x) => x.bar_id)));
    const barsRes = await client.query(
      'SELECT id, name, country FROM public.bars WHERE id = ANY($1::uuid[])',
      [barIds]
    );
    const barsById = new Map(barsRes.rows.map((r) => [r.id, r]));
    const missingBars = barIds.filter((id) => !barsById.has(id));
    if (missingBars.length) {
      console.warn(`Warning: ${missingBars.length} bars not found; items for these bars will be skipped.`);
    }
    const allowedBars = new Set(
      barsRes.rows
        .filter((r) => (r.country || '').toLowerCase() === 'malta')
        .map((r) => r.id)
    );

    const filtered = deduped.filter((it) => allowedBars.has(it.bar_id));

    // 4) Load existing items to avoid duplicates per bar
    const allowList = Array.from(allowedBars);
    const existRes = await client.query(
      'SELECT bar_id, name FROM public.restaurant_menu_items WHERE bar_id = ANY($1::uuid[])',
      [allowList]
    );
    const existingByBar = new Map(); // bar_id -> Set(normName)
    for (const row of existRes.rows) {
      const { bar_id, name } = row;
      if (!existingByBar.has(bar_id)) existingByBar.set(bar_id, new Set());
      existingByBar.get(bar_id).add(normName(name || ''));
    }

    const toInsert = [];
    for (const it of filtered) {
      const set = existingByBar.get(it.bar_id) || new Set();
      if (set.has(normName(it.name))) continue; // already deployed for this bar
      toInsert.push(it);
    }

    // 5) Insert in batches within a single transaction
    await client.query('BEGIN');

    const batchSize = 200;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      if (batch.length === 0) continue;
      const cols = ['bar_id', 'name', 'category', 'price', 'currency', 'is_available', 'created_by'];
      const values = [];
      const placeholders = batch
        .map((it, idx) => {
          const base = idx * cols.length;
          values.push(it.bar_id, it.name, it.category, it.price, 'EUR', true, 'import-malta-menu');
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
        })
        .join(',');
      const sql = `INSERT INTO public.restaurant_menu_items (${cols.join(',')}) VALUES ${placeholders}`;
      await client.query(sql, values);
      inserted += batch.length;
    }

    await client.query('COMMIT');

    // 6) Report
    const barsCount = allowedBars.size;
    console.log('--- Malta Menu Import Summary ---');
    console.log(`Parsed lines: ${rawLines.length}`);
    console.log(`Parsed items: ${parsed.length}`);
    console.log(`Unique per bar (input): ${deduped.length}`);
    console.log(`Bars in dataset: ${new Set(parsed.map((x) => x.bar_id)).size}`);
    console.log(`Bars found (Malta): ${barsCount}`);
    console.log(`Already present items skipped: ${filtered.length - toInsert.length}`);
    console.log(`Inserted new items: ${inserted}`);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Import failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

