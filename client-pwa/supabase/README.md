# Supabase Setup for Client PWA

## Quick Setup

### 1. Run the Schema

Execute the schema SQL in your Supabase SQL Editor:

```bash
# Copy the contents of schema.sql and run in Supabase SQL Editor
# https://app.supabase.com/project/YOUR_PROJECT/sql
```

Or use the Supabase CLI:

```bash
supabase db push
```

### 2. Seed the Database

Execute the seed SQL in your Supabase SQL Editor:

```bash
# Copy the contents of seed.sql and run in Supabase SQL Editor
```

Or use the CLI:

```bash
psql $DATABASE_URL < supabase/seed.sql
```

## Tables Created

- `venues` - Restaurant/bar information
- `menu_categories` - Menu categories
- `menu_items` - Food and drink items
- `client_orders` - Customer orders
- `client_payments` - Payment records

## Sample Data

The seed file creates:
- 1 venue: "Heaven Restaurant & Bar"
- 4 categories: Appetizers, Mains, Drinks, Desserts
- 7 menu items with prices in RWF

## Row Level Security

All tables have RLS enabled with public read access for active/available items.

## Verify Setup

Test the setup by visiting:
http://localhost:3002/heaven-bar

You should see the menu with real data from Supabase!
