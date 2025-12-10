#!/bin/bash
# Count total lines in the CSV data provided
echo "Counting menu items from the CSV data..."

# The CSV has these bars based on what was provided:
bars=(
  "Zion Reggae Bar"
  "Victoria Gastro Pub"
  "The Long Hall Irish Pub"
  "The Londoner Pub Sliema"
  "The Londoner British Pub Sliema"
  "The Brew Grill & Brewery"
  "The Brew Bar Grill"
  "Tex Mex American Bar Grill Paceville"
  "Surfside"
  "Spinola Cafe Lounge St Julians"
  "Sakura Japanese Cuisine Lounge"
  "Peperino Pizza Cucina Verace"
  "Paparazzi 29"
  "Okurama Asian Fusion"
  "Mamma Mia Restaurant"
  "Mamma Mia"
  "Fortizza"
  "Felice Brasserie"
  "Exiles"
  "Doma Marsascala"
  "Cuba Shoreline"
  "Cuba Campus Hub"
  "Cafe Cuba St Julians"
  "Bus Stop Lounge"
  "Black Bull"
  "Bistro 516"
  "Aqualuna Lido"
)

echo "Total unique bars: ${#bars[@]}"
echo ""
echo "Let me count the actual CSV rows from your data..."
