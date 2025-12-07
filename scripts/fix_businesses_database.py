#!/usr/bin/env python3
"""
FIX EXISTING BUSINESSES IN DATABASE
1. Format phone numbers to +250XXXXXXXXX
2. Populate owner_whatsapp column with formatted phone
3. Geocode missing lat/lng using addresses
"""
import os
import sys
import re
import time
from typing import Optional, Tuple

from supabase import create_client
import requests

# Set environment
SUPABASE_URL = "https://lhbowpbcpwoiparwnwgt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"
GOOGLE_MAPS_API_KEY = "AIzaSyB8B8N2scJAWMs05f-xGRVzQAb4MQIuNEU"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("""
╔═══════════════════════════════════════════════════════════════╗
║  FIX BUSINESSES DATABASE - PHONE NUMBERS & COORDINATES       ║
╚═══════════════════════════════════════════════════════════════╝
""")

def format_rwanda_phone(phone: str) -> str:
    """Format phone to +250XXXXXXXXX"""
    if not phone:
        return ""
    
    # Remove all non-digit characters except +
    phone = re.sub(r'[^\d+]', '', phone)
    
    # Remove leading zeros
    phone = phone.lstrip("0")
    
    # If already has +250, return it
    if phone.startswith("+250"):
        return phone
    
    # If starts with 250, add +
    if phone.startswith("250"):
        return "+" + phone
    
    # Add +250 prefix (Rwanda)
    if len(phone) >= 9:
        return "+250" + phone
    
    return ""

def geocode_address(address: str, city: str) -> Optional[Tuple[float, float]]:
    """Get lat/lng from address using Google Geocoding API"""
    if not address or not city:
        return None
    
    try:
        # Build full address
        full_address = f"{address}, {city}, Rwanda"
        
        # Call Google Geocoding API
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            "address": full_address,
            "key": GOOGLE_MAPS_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if data["status"] == "OK" and len(data["results"]) > 0:
            location = data["results"][0]["geometry"]["location"]
            return (location["lat"], location["lng"])
        
        return None
        
    except Exception as e:
        print(f"  Geocoding error: {e}")
        return None

# STEP 1: Fix phone numbers and populate owner_whatsapp
print("STEP 1: Fixing phone numbers and populating owner_whatsapp...")
print("="*70)

try:
    # Get all businesses with phone numbers
    response = supabase.table("businesses")\
        .select("id, phone, owner_whatsapp")\
        .not_.is_("phone", "null")\
        .execute()
    
    total = len(response.data)
    print(f"Found {total} businesses with phone numbers")
    print("")
    
    fixed = 0
    already_good = 0
    invalid = 0
    
    for i, business in enumerate(response.data, 1):
        phone = business.get("phone", "")
        business_id = business["id"]
        
        # Format phone
        formatted_phone = format_rwanda_phone(phone)
        
        # Validate: must be +250XXXXXXXXX (13 chars)
        if formatted_phone and formatted_phone.startswith("+250") and len(formatted_phone) == 13:
            # Check if needs updating
            if phone != formatted_phone:
                # Update both phone and owner_whatsapp
                supabase.table("businesses").update({
                    "phone": formatted_phone,
                    "owner_whatsapp": formatted_phone
                }).eq("id", business_id).execute()
                
                print(f"  {i}/{total} ✓ Fixed: '{phone}' → '{formatted_phone}'")
                fixed += 1
            else:
                # Already good, just populate owner_whatsapp if empty
                if not business.get("owner_whatsapp"):
                    supabase.table("businesses").update({
                        "owner_whatsapp": formatted_phone
                    }).eq("id", business_id).execute()
                
                already_good += 1
                if i % 100 == 0:
                    print(f"  {i}/{total} already formatted correctly")
        else:
            print(f"  {i}/{total} ✗ Invalid: '{phone}' (skipped)")
            invalid += 1
        
        # Rate limiting
        if i % 50 == 0:
            time.sleep(0.5)
    
    print("")
    print("="*70)
    print(f"Phone Numbers Fixed:")
    print(f"  ✓ Fixed: {fixed}")
    print(f"  ✓ Already good: {already_good}")
    print(f"  ✗ Invalid: {invalid}")
    print("="*70)
    
except Exception as e:
    print(f"Error fixing phone numbers: {e}")

# STEP 2: Geocode missing coordinates
print("")
print("STEP 2: Geocoding missing lat/lng...")
print("="*70)

try:
    # Get businesses without coordinates but with addresses
    response = supabase.table("businesses")\
        .select("id, name, address, city")\
        .is_("lat", "null")\
        .not_.is_("address", "null")\
        .limit(500)\
        .execute()
    
    total = len(response.data)
    print(f"Found {total} businesses missing coordinates (processing max 500)")
    print("")
    
    if total == 0:
        print("✓ All businesses have coordinates!")
    else:
        geocoded = 0
        failed = 0
        
        for i, business in enumerate(response.data, 1):
            name = business.get("name", "Unknown")
            address = business.get("address", "")
            city = business.get("city", "")
            business_id = business["id"]
            
            # Try to geocode
            coords = geocode_address(address, city)
            
            if coords:
                lat, lng = coords
                
                # Update database
                supabase.table("businesses").update({
                    "lat": lat,
                    "lng": lng
                }).eq("id", business_id).execute()
                
                print(f"  {i}/{total} ✓ {name}: {lat}, {lng}")
                geocoded += 1
            else:
                print(f"  {i}/{total} ✗ {name}: Could not geocode")
                failed += 1
            
            # Rate limiting (Google API has limits)
            time.sleep(0.2)
            
            if i % 10 == 0:
                print(f"    Progress: {geocoded} geocoded, {failed} failed")
        
        print("")
        print("="*70)
        print(f"Geocoding Results:")
        print(f"  ✓ Geocoded: {geocoded}")
        print(f"  ✗ Failed: {failed}")
        print("="*70)

except Exception as e:
    print(f"Error geocoding: {e}")

print("")
print("╔═══════════════════════════════════════════════════════════════╗")
print("║  DATABASE CLEANUP COMPLETE!                                  ║")
print("╚═══════════════════════════════════════════════════════════════╝")
print("")
print("Summary:")
print("  ✓ Phone numbers formatted to +250XXXXXXXXX")
print("  ✓ owner_whatsapp column populated")
print("  ✓ Missing coordinates geocoded (up to 500)")
print("")
print("Verify with:")
print("  SELECT COUNT(*) FROM businesses WHERE phone LIKE '+250%';")
print("  SELECT COUNT(*) FROM businesses WHERE lat IS NOT NULL;")
