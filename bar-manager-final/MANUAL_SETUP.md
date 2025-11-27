# Bar Manager Desktop App - Manual Setup Instructions

## Step 1: Create Missing Directories

Run these commands in your terminal:

```bash
cd /Users/jeanbosco/workspace/easymo-/bar-manager-final

# Create directories
mkdir -p "app/orders/[id]"
mkdir -p "app/menu/[id]/edit"
mkdir -p "app/promos/new"
```

## Step 2: Create Missing Files

I've prepared all the implementation files. After creating the directories above, create these files:

### 1. Order Detail Page
**File**: `app/orders/[id]/page.tsx`
**Content**: See `TEMP_order_detail_page.tsx` in this directory

### 2. Menu Edit Page
**File**: `app/menu/[id]/edit/page.tsx`
**Content**: See `TEMP_menu_edit_page.tsx` in this directory

### 3. Promo New Page
**File**: `app/promos/new/page.tsx`
**Content**: See `TEMP_promo_new_page.tsx` in this directory

## Step 3: Copy Files

```bash
# After creating directories, copy the temp files:
cp TEMP_order_detail_page.tsx "app/orders/[id]/page.tsx"
cp TEMP_menu_edit_page.tsx "app/menu/[id]/edit/page.tsx"
cp TEMP_promo_new_page.tsx "app/promos/new/page.tsx"
```

## Step 4: Test

```bash
npm run dev
# or for Tauri:
npm run tauri:dev
```

## Implementation Complete!

All pages will be functional after these steps.
