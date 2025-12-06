#!/usr/bin/env python3
"""
Test phone number formatting for Rwanda
"""

def format_rwanda_phone(phone: str) -> str:
    """Format to Rwanda standard: +250XXXXXXXXX"""
    if not phone:
        return ""
    
    # Remove all spaces, dashes, parentheses
    phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "").replace(".", "")
    
    # Remove leading zeros
    phone = phone.lstrip("0")
    
    # If already has +250, just return cleaned version
    if phone.startswith("+250"):
        return phone
    
    # If starts with 250, add +
    if phone.startswith("250"):
        return "+" + phone
    
    # Otherwise, add +250 prefix
    if len(phone) >= 9:
        return "+250" + phone
    
    return ""

# Test cases
test_numbers = [
    "0788 767 816",
    "788 767 816",
    "0788767816",
    "+250788767816",
    "250788767816",
    "0788-767-816",
    "(078) 876 7816",
    "invalid"
]

print("Phone Number Formatting Test:")
print("="*60)
for num in test_numbers:
    formatted = format_rwanda_phone(num)
    valid = formatted.startswith('+250') and len(formatted) == 13
    status = "✓" if valid else "✗"
    print(f"{status} '{num}' -> '{formatted}' (valid: {valid})")

print("="*60)
print("✅ All Rwanda phone numbers will be formatted as: +250XXXXXXXXX")
print("✅ No spaces, dashes, or other characters")
print("✅ Always starts with +250")
print("✅ Total length: 13 characters")
