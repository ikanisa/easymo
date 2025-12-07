#!/usr/bin/env python3
"""
Direct database fix - connects to PostgreSQL and fixes ALL phone numbers
"""
import psycopg2
import re

# Database connection
DB_URL = "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

def format_phone(phone):
    """Format phone to +250XXXXXXXXX"""
    if not phone:
        return None
    
    # Remove all non-digit characters except +
    phone = re.sub(r'[^\d+]', '', phone)
    
    # Remove leading zeros
    phone = phone.lstrip('0')
    
    # If already has +250, return it
    if phone.startswith('+250') and len(phone) == 13:
        return phone
    
    # If starts with 250, add +
    if phone.startswith('250') and len(phone) == 12:
        return '+' + phone
    
    # If 9 digits, add +250
    if len(phone) == 9 and phone[0] in ['7', '8', '2']:
        return '+250' + phone
    
    # Invalid
    return None

print("="*70)
print("FIXING ALL BUSINESSES - PHONE NUMBERS & OWNER_WHATSAPP")
print("="*70)
print("")

# Connect to database
print("Connecting to database...")
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Get all businesses with phone numbers
print("Fetching businesses with phone numbers...")
cur.execute("SELECT id, phone, owner_whatsapp FROM businesses WHERE phone IS NOT NULL")
businesses = cur.fetchall()

print(f"Found {len(businesses)} businesses with phone numbers")
print("")

fixed = 0
already_good = 0
invalid = 0

for i, (business_id, phone, owner_whatsapp) in enumerate(businesses, 1):
    # Format phone
    formatted = format_phone(phone)
    
    if formatted:
        # Check if needs update
        if phone != formatted or not owner_whatsapp:
            cur.execute(
                "UPDATE businesses SET phone = %s, owner_whatsapp = %s WHERE id = %s",
                (formatted, formatted, business_id)
            )
            
            if phone != formatted:
                print(f"  {i}/{len(businesses)} ✓ Fixed: '{phone}' → '{formatted}'")
                fixed += 1
            else:
                print(f"  {i}/{len(businesses)} ✓ Populated owner_whatsapp: '{formatted}'")
                fixed += 1
        else:
            already_good += 1
            if i % 500 == 0:
                print(f"  {i}/{len(businesses)} already correct")
    else:
        # Invalid phone number
        cur.execute(
            "UPDATE businesses SET phone = NULL, owner_whatsapp = NULL WHERE id = %s",
            (business_id,)
        )
        print(f"  {i}/{len(businesses)} ✗ Invalid: '{phone}' (removed)")
        invalid += 1
    
    # Commit every 100 records
    if i % 100 == 0:
        conn.commit()

# Final commit
conn.commit()

print("")
print("="*70)
print("RESULTS:")
print(f"  ✓ Fixed/Updated: {fixed}")
print(f"  ✓ Already correct: {already_good}")
print(f"  ✗ Invalid (removed): {invalid}")
print("="*70)
print("")

# Verify results
print("VERIFICATION:")
cur.execute("SELECT COUNT(*) FROM businesses WHERE phone LIKE '+250%'")
valid_phones = cur.fetchone()[0]
print(f"  Total with +250 prefix: {valid_phones}")

cur.execute("SELECT COUNT(*) FROM businesses WHERE owner_whatsapp IS NOT NULL")
with_whatsapp = cur.fetchone()[0]
print(f"  Total with owner_whatsapp: {with_whatsapp}")

cur.execute("SELECT COUNT(*) FROM businesses WHERE phone IS NOT NULL AND owner_whatsapp IS NULL")
still_null = cur.fetchone()[0]
print(f"  Still NULL owner_whatsapp: {still_null}")

print("")
print("Sample of fixed records:")
cur.execute("""
    SELECT name, phone, owner_whatsapp, city 
    FROM businesses 
    WHERE phone IS NOT NULL 
    ORDER BY id DESC 
    LIMIT 10
""")
samples = cur.fetchall()
for name, phone, whatsapp, city in samples:
    print(f"  {name[:30]:30} | {phone:15} | {whatsapp:15} | {city}")

cur.close()
conn.close()

print("")
print("="*70)
print("✅ ALL PHONE NUMBERS FIXED!")
print("="*70)
