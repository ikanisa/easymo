#!/usr/bin/env python3
"""
Test script to verify Google Maps scraper setup
Checks dependencies, environment, and can run a small test scrape
"""

import sys
import os

def check_dependencies():
    """Check if all required Python packages are installed"""
    print("📦 Checking Python dependencies...")
    
    missing = []
    
    try:
        import selenium
        print(f"  ✓ selenium {selenium.__version__}")
    except ImportError:
        print("  ✗ selenium (missing)")
        missing.append("selenium")
    
    try:
        import supabase
        print(f"  ✓ supabase")
    except ImportError:
        print("  ✗ supabase (missing)")
        missing.append("supabase")
    
    if missing:
        print(f"\n❌ Missing packages: {', '.join(missing)}")
        print(f"   Install with: pip3 install {' '.join(missing)}")
        return False
    
    print("  ✓ All dependencies installed\n")
    return True


def check_chromedriver():
    """Check if ChromeDriver is available"""
    print("🚗 Checking ChromeDriver...")
    
    import subprocess
    try:
        result = subprocess.run(['chromedriver', '--version'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            version = result.stdout.strip()
            print(f"  ✓ {version}\n")
            return True
    except FileNotFoundError:
        print("  ✗ ChromeDriver not found in PATH")
        print("    Install: brew install chromedriver (macOS)")
        print("    Or: sudo apt install chromium-chromedriver (Ubuntu)\n")
        return False
    except Exception as e:
        print(f"  ⚠️  Could not check ChromeDriver: {e}\n")
        return False


def check_environment():
    """Check if required environment variables are set"""
    print("🔐 Checking environment variables...")
    
    supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url:
        print("  ✗ SUPABASE_URL not set")
        print("    Export: export SUPABASE_URL='https://your-project.supabase.co'")
        return False
    else:
        print(f"  ✓ SUPABASE_URL: {supabase_url[:30]}...")
    
    if not supabase_key:
        print("  ✗ SUPABASE_SERVICE_ROLE_KEY not set")
        print("    Export: export SUPABASE_SERVICE_ROLE_KEY='eyJhbG...'")
        return False
    else:
        print(f"  ✓ SUPABASE_SERVICE_ROLE_KEY: {supabase_key[:20]}... ({len(supabase_key)} chars)")
    
    print("")
    return True


def test_supabase_connection():
    """Test connection to Supabase"""
    print("🔗 Testing Supabase connection...")
    
    try:
        from supabase import create_client
        
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        client = create_client(supabase_url, supabase_key)
        
        # Try to query businesses table
        response = client.table("businesses").select("id").limit(1).execute()
        
        print("  ✓ Connected to Supabase successfully")
        print(f"  ✓ 'businesses' table accessible\n")
        return True
        
    except Exception as e:
        print(f"  ✗ Connection failed: {e}\n")
        return False


def test_businesses_table():
    """Check businesses table structure"""
    print("🗄️  Checking 'businesses' table structure...")
    
    try:
        from supabase import create_client
        
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        client = create_client(supabase_url, supabase_key)
        
        # Query with all expected columns
        response = client.table("businesses").select(
            "id,name,category,city,address,country,lat,lng,phone,website,rating,review_count,external_id"
        ).limit(1).execute()
        
        print("  ✓ All required columns exist")
        
        # Count existing pharmacies
        count_response = client.table("businesses")\
            .select("id", count="exact")\
            .eq("category", "Pharmacy")\
            .execute()
        
        count = count_response.count if hasattr(count_response, 'count') else 0
        print(f"  ℹ️  Existing pharmacies: {count}\n")
        
        return True
        
    except Exception as e:
        print(f"  ✗ Table check failed: {e}")
        print("     Ensure migration 20251205213000_unify_business_registry.sql is applied\n")
        return False


def main():
    """Run all checks"""
    print("=" * 60)
    print("GOOGLE MAPS SCRAPER - SETUP VERIFICATION")
    print("=" * 60)
    print("")
    
    checks = [
        ("Dependencies", check_dependencies),
        ("ChromeDriver", check_chromedriver),
        ("Environment", check_environment),
        ("Supabase Connection", test_supabase_connection),
        ("Businesses Table", test_businesses_table),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            results.append((name, check_func()))
        except Exception as e:
            print(f"  ✗ {name} check crashed: {e}\n")
            results.append((name, False))
    
    # Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
    
    all_passed = all(passed for _, passed in results)
    
    print("")
    if all_passed:
        print("🎉 All checks passed! You're ready to scrape.")
        print("")
        print("Next steps:")
        print("  1. Run example: ./scripts/example-scrape-kigali.sh")
        print("  2. Or manual: ./scripts/scrape-pharmacies.sh 'YOUR_URL' --dry-run")
        print("")
        return 0
    else:
        print("⚠️  Some checks failed. Fix the issues above before scraping.")
        print("")
        print("Quick fixes:")
        print("  - Dependencies: pip3 install -r scripts/requirements-scraper.txt")
        print("  - ChromeDriver: brew install chromedriver (macOS)")
        print("  - Environment: export SUPABASE_URL='...' SUPABASE_SERVICE_ROLE_KEY='...'")
        print("  - Migration: supabase db push")
        print("")
        return 1


if __name__ == "__main__":
    sys.exit(main())
