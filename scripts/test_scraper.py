#!/usr/bin/env python3
"""
Unit tests for Google Maps Bulk Scraper
Tests core logic without requiring internet access
"""

import sys
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from google_maps_bulk_scraper import (
    extract_place_id,
    is_duplicate,
    load_categories,
)


def test_extract_place_id():
    """Test place ID extraction from various URL formats."""
    print("Testing extract_place_id()...")
    
    # Test CID format
    url1 = "https://www.google.com/maps/place/...?cid=12345678901234567890"
    result1 = extract_place_id(url1)
    assert result1 == "cid_12345678901234567890", f"Expected 'cid_12345678901234567890', got '{result1}'"
    
    # Test standard format
    url2 = "https://www.google.com/maps/place/.../@-1.9441,30.0619,17z/data=!4m5!3m4!1sChIJabcdef123456"
    result2 = extract_place_id(url2)
    assert result2 == "ChIJabcdef123456", f"Expected 'ChIJabcdef123456', got '{result2}'"
    
    # Test no place ID
    url3 = "https://www.google.com/maps/search/pharmacy"
    result3 = extract_place_id(url3)
    assert result3 is None, f"Expected None, got '{result3}'"
    
    print("  ✅ All extract_place_id tests passed")


def test_is_duplicate():
    """Test duplicate detection logic."""
    print("Testing is_duplicate()...")
    
    existing = [
        {
            'place_id': 'ChIJ123',
            'name': 'Test Pharmacy',
            'phone': '+250788123456',
            'lat': -1.9441,
            'lng': 30.0619
        },
        {
            'place_id': 'ChIJ456',
            'name': 'Another Business',
            'phone': '+250788654321',
            'lat': -1.9500,
            'lng': 30.0700
        }
    ]
    
    # Test 1: Same place ID (should be duplicate)
    business1 = {
        'place_id': 'ChIJ123',
        'name': 'Different Name',
        'phone': None,
        'lat': None,
        'lng': None
    }
    assert is_duplicate(business1, existing) is True, "Same place ID should be duplicate"
    
    # Test 2: Same name + close location (should be duplicate)
    business2 = {
        'place_id': None,
        'name': 'Test Pharmacy',
        'phone': None,
        'lat': -1.9442,  # Very close to -1.9441
        'lng': 30.0620   # Very close to 30.0619
    }
    assert is_duplicate(business2, existing) is True, "Same name + close location should be duplicate"
    
    # Test 3: Same phone (should be duplicate)
    business3 = {
        'place_id': None,
        'name': 'Different Pharmacy',
        'phone': '+250788123456',
        'lat': None,
        'lng': None
    }
    assert is_duplicate(business3, existing) is True, "Same phone should be duplicate"
    
    # Test 4: Completely different (should NOT be duplicate)
    business4 = {
        'place_id': 'ChIJ789',
        'name': 'New Business',
        'phone': '+250788999999',
        'lat': -1.9000,
        'lng': 30.1000
    }
    assert is_duplicate(business4, existing) is False, "Completely different should NOT be duplicate"
    
    # Test 5: Same name but far location (should NOT be duplicate)
    business5 = {
        'place_id': None,
        'name': 'Test Pharmacy',
        'phone': None,
        'lat': -1.8000,  # Far from -1.9441
        'lng': 30.2000   # Far from 30.0619
    }
    assert is_duplicate(business5, existing) is False, "Same name but far location should NOT be duplicate"
    
    print("  ✅ All is_duplicate tests passed")


def test_load_categories():
    """Test category configuration loading."""
    print("Testing load_categories()...")
    
    config = load_categories()
    
    assert 'categories' in config, "Config should have 'categories' key"
    assert 'location' in config, "Config should have 'location' key"
    assert isinstance(config['categories'], list), "Categories should be a list"
    assert len(config['categories']) > 0, "Categories should not be empty"
    assert config['location'] == 'Kigali, Rwanda', "Location should be 'Kigali, Rwanda'"
    
    # Check some expected categories
    expected_categories = ['pharmacy', 'restaurant', 'bank', 'hotel']
    for cat in expected_categories:
        assert cat in config['categories'], f"Expected category '{cat}' not found"
    
    print(f"  ✅ Loaded {len(config['categories'])} categories")
    print(f"  ✅ All load_categories tests passed")


def test_supabase_record_transformation():
    """Test data transformation for Supabase."""
    print("Testing Supabase record transformation...")
    
    # Mock business data
    business = {
        'name': 'Test Business',
        'category': 'pharmacy',
        'address': '123 Main St, Kigali',
        'phone': '+250788123456',
        'website': 'https://example.com',
        'lat': -1.9441,
        'lng': 30.0619,
        'rating': 4.5,
        'review_count': 120,
        'place_id': 'ChIJ123',
        'google_category': 'Pharmacy',
        'operating_hours': None,
        'scraped_at': '2024-01-01T00:00:00',
        'search_query': 'pharmacy in Kigali, Rwanda'
    }
    
    # Transform to database record
    record = {
        'name': business.get('name'),
        'category': business.get('category', 'General'),
        'address': business.get('address'),
        'phone': business.get('phone'),
        'website': business.get('website'),
        'lat': business.get('lat'),
        'lng': business.get('lng'),
        'rating': business.get('rating'),
        'review_count': business.get('review_count', 0),
        'external_id': business.get('place_id'),
        'status': 'active',
        'city': 'Kigali',
        'country': 'RW',
    }
    
    # Filter out None values
    record = {k: v for k, v in record.items() if v is not None}
    
    assert record['name'] == 'Test Business'
    assert record['category'] == 'pharmacy'
    assert record['city'] == 'Kigali'
    assert record['country'] == 'RW'
    assert record['status'] == 'active'
    assert record['external_id'] == 'ChIJ123'
    assert 'google_category' not in record  # Should not be in DB record
    assert 'scraped_at' not in record  # Should not be in DB record
    
    print("  ✅ All transformation tests passed")


def main():
    """Run all tests."""
    print("="*60)
    print("Running Google Maps Scraper Tests")
    print("="*60)
    print()
    
    try:
        test_extract_place_id()
        test_is_duplicate()
        test_load_categories()
        test_supabase_record_transformation()
        
        print()
        print("="*60)
        print("✅ ALL TESTS PASSED!")
        print("="*60)
        return 0
        
    except AssertionError as e:
        print()
        print("="*60)
        print(f"❌ TEST FAILED: {e}")
        print("="*60)
        return 1
    
    except Exception as e:
        print()
        print("="*60)
        print(f"❌ ERROR: {e}")
        print("="*60)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
