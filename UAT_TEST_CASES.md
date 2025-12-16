# User Acceptance Test (UAT) Cases

This document provides comprehensive UAT test cases for all WhatsApp webhook services. These test cases should be executed manually or via automated testing tools to verify user journeys work as expected.

**Last Updated:** 2025-12-16  
**Status:** Comprehensive test case documentation

---

## Table of Contents

1. [Mobility Service UAT](#mobility-service-uat)
2. [Buy & Sell Service UAT](#buy--sell-service-uat)
3. [Profile Service UAT](#profile-service-uat)
4. [Core Router UAT](#core-router-uat)
5. [Cross-Service UAT](#cross-service-uat)

---

## Mobility Service UAT

### UAT-MOB-001: Find Nearby Drivers

**Priority:** Critical  
**Category:** Core Functionality  
**Prerequisites:** User has WhatsApp account, location services enabled

**Test Steps:**
1. User sends "rides" or "menu" to WhatsApp number
2. System responds with mobility menu
3. User selects "Nearby drivers" option
4. System prompts for vehicle type (moto, cab, lifan, truck, others)
5. User selects vehicle type
6. System prompts for location sharing
7. User shares location via WhatsApp
8. System searches for nearby drivers
9. System displays list of nearby drivers with:
   - Driver name/phone (last 4 digits)
   - Distance from user
   - Vehicle type
   - Rating (if available)

**Expected Results:**
- ✅ Menu appears within 2 seconds
- ✅ Vehicle type selection works
- ✅ Location sharing is accepted
- ✅ Driver list appears within 5 seconds
- ✅ Progress indicator shown during search (P2-009 fix)
- ✅ Metric recorded: `mobility.nearby.drivers_initiated` (P2-005 fix)

**Negative Test Cases:**
- No drivers found: System shows "No drivers found nearby" message
- Location not shared: System prompts again after 30 seconds
- Invalid location: System shows error and prompts again

---

### UAT-MOB-002: Find Nearby Passengers

**Priority:** Critical  
**Category:** Core Functionality  
**Prerequisites:** User is a registered driver

**Test Steps:**
1. User sends "rides" to WhatsApp number
2. System responds with mobility menu
3. User selects "Nearby passengers" option
4. System prompts for vehicle type
5. User selects vehicle type
6. System prompts for location sharing
7. User shares location
8. System searches for nearby passengers
9. System displays list of nearby passengers

**Expected Results:**
- ✅ All steps complete successfully
- ✅ Progress indicator shown (P2-009 fix)
- ✅ Metric recorded: `mobility.nearby.passengers_initiated` (P2-005 fix)

---

### UAT-MOB-003: Go Online (Driver)

**Priority:** High  
**Category:** Driver Features  
**Prerequisites:** User is a registered driver with vehicle plate

**Test Steps:**
1. User sends "rides" to WhatsApp number
2. System responds with mobility menu
3. User selects "Go online" option
4. System checks for vehicle plate (if not registered, prompts for it)
5. System prompts for location sharing
6. User shares location
7. System confirms driver is online
8. System shows success message with 30-minute duration

**Expected Results:**
- ✅ Success message: "✅ You're now LIVE! You'll receive ride offers for the next 30 minutes." (P2-008 fix)
- ✅ Driver status set to online in database
- ✅ Location saved to cache
- ✅ Driver appears in nearby search results

**Negative Test Cases:**
- No vehicle plate: System prompts for plate registration first
- Location not shared: System prompts again

---

### UAT-MOB-004: Schedule Trip

**Priority:** High  
**Category:** Trip Planning  
**Prerequisites:** User has WhatsApp account

**Test Steps:**
1. User sends "rides" to WhatsApp number
2. System responds with mobility menu
3. User selects "Schedule trip" option
4. System prompts for role (driver/passenger)
5. User selects role
6. System prompts for vehicle type (if driver)
7. User selects vehicle type
8. System prompts for pickup location
9. User shares pickup location
10. System confirms: "✅ Pickup location saved!" (P2-008 fix)
11. System prompts for drop-off location
12. User shares drop-off location
13. System confirms: "✅ Drop-off location saved!" (P2-008 fix)
14. System prompts for trip date/time
15. User provides date/time
16. System confirms trip scheduled

**Expected Results:**
- ✅ All location saves show confirmation messages (P2-008 fix)
- ✅ Trip saved to database
- ✅ User receives confirmation with trip details

---

### UAT-MOB-005: Text Message Intent Recognition

**Priority:** Medium  
**Category:** Natural Language Processing  
**Prerequisites:** User has WhatsApp account

**Test Steps:**
1. User sends various text messages:
   - "I need a driver"
   - "find me a taxi"
   - "looking for a moto"
   - "I want to schedule a ride"
   - "book a trip for tomorrow"
2. System recognizes intent and routes to appropriate handler

**Expected Results:**
- ✅ "driver", "ride", "taxi", "moto" → Routes to nearby drivers (P2-001 fix)
- ✅ "passenger" → Routes to nearby passengers (P2-001 fix)
- ✅ "schedule", "book", "plan trip" → Routes to schedule trip (P2-001 fix)
- ✅ "menu", "rides" → Shows mobility menu (P2-001 fix)

---

## Buy & Sell Service UAT

### UAT-BS-001: Search for Product (New User)

**Priority:** Critical  
**Category:** Core Functionality  
**Prerequisites:** User has WhatsApp account

**Test Steps:**
1. User sends "buy" or "buy & sell" to WhatsApp number
2. System shows welcome message in user's language (P2-002 fix):
   - English: "👋 Muraho! I'm Kwizera, your easyMO sourcing assistant..."
   - French: "👋 Muraho! Je suis Kwizera, votre assistant d'approvisionnement easyMO..."
3. User sends product request: "I need brake pads for a 2010 RAV4"
4. AI agent (Kwizera) processes request
5. System prompts for location
6. User shares location
7. System searches for nearby businesses
8. System displays list of businesses with:
   - Business name
   - Distance
   - Contact information
   - Product availability

**Expected Results:**
- ✅ Welcome message uses i18n (P2-002 fix)
- ✅ AI agent understands product request
- ✅ Location prompt appears
- ✅ Business list appears within 10 seconds
- ✅ Results are sorted by distance

---

### UAT-BS-002: Search for Product (Returning User)

**Priority:** High  
**Category:** User Experience  
**Prerequisites:** User has used Buy & Sell before

**Test Steps:**
1. User sends "buy" to WhatsApp number
2. System shows greeting message (P2-002 fix):
   - English: "🛒 *Buy & Sell*\n\nHow can I help you today?"
   - French: "🛒 *Acheter & Vendre*\n\nComment puis-je vous aider aujourd'hui ?"
3. User sends product request
4. System processes and shows results

**Expected Results:**
- ✅ Greeting message uses i18n (P2-002 fix)
- ✅ No duplicate welcome message
- ✅ Conversation context maintained

---

### UAT-BS-003: Create Business Listing

**Priority:** High  
**Category:** Business Management  
**Prerequisites:** User has WhatsApp account

**Test Steps:**
1. User sends "buy" to WhatsApp number
2. User sends "I want to list my business"
3. AI agent guides through business creation
4. User provides:
   - Business name
   - Category
   - Description
   - Location
   - Contact information
5. System creates business listing
6. System confirms business created

**Expected Results:**
- ✅ Business saved to database
- ✅ Confirmation message shown
- ✅ Business appears in search results

---

### UAT-BS-004: Update Business Information

**Priority:** Medium  
**Category:** Business Management  
**Prerequisites:** User has a registered business

**Test Steps:**
1. User sends "buy" to WhatsApp number
2. User navigates to "My Business" menu
3. User selects business to edit
4. User selects field to update (name, description, etc.)
5. User provides new value
6. System updates business
7. System confirms update

**Expected Results:**
- ✅ Business updated in database
- ✅ Confirmation message shown
- ✅ Metric recorded: `buy_sell.business.updated` (P2-005 fix)

---

### UAT-BS-005: Vendor Outreach Flow

**Priority:** Medium  
**Category:** AI Agent Features  
**Prerequisites:** User has searched for a product

**Test Steps:**
1. User searches for product: "I need Augmentin 625mg"
2. System finds nearby pharmacies
3. User selects "Contact vendors" option
4. System asks for consent to contact businesses
5. User consents
6. System sends outreach messages to businesses
7. System notifies user when businesses respond

**Expected Results:**
- ✅ Outreach messages sent
- ✅ User receives notifications
- ✅ Conversation context maintained

---

## Profile Service UAT

### UAT-PROF-001: Edit Profile

**Priority:** High  
**Category:** User Management  
**Prerequisites:** User has WhatsApp account

**Test Steps:**
1. User sends "profile" to WhatsApp number
2. System shows profile menu
3. User selects "Edit profile"
4. User selects field to edit (name, email, language)
5. User provides new value
6. System updates profile
7. System confirms update

**Expected Results:**
- ✅ Profile updated in database
- ✅ Confirmation message shown
- ✅ Changes reflected immediately

---

### UAT-PROF-002: Save Location

**Priority:** High  
**Category:** Location Management  
**Prerequisites:** User has WhatsApp account

**Test Steps:**
1. User sends "profile" to WhatsApp number
2. System shows profile menu
3. User selects "Saved locations"
4. User selects "Add location"
5. System prompts for location label
6. User provides label (e.g., "Home", "Work")
7. System prompts for location sharing
8. User shares location
9. System saves location
10. System confirms: "✅ Location saved!" (P2-008 fix)

**Expected Results:**
- ✅ Location saved to database
- ✅ Confirmation message shown (P2-008 fix)
- ✅ Metric recorded: `profile.location.saved` (P2-005 fix)
- ✅ Location appears in saved locations list

---

### UAT-PROF-003: Delete Saved Location

**Priority:** Medium  
**Category:** Location Management  
**Prerequisites:** User has at least one saved location

**Test Steps:**
1. User sends "profile" to WhatsApp number
2. System shows profile menu
3. User selects "Saved locations"
4. System shows list of saved locations
5. User selects location to delete
6. System confirms deletion
7. User confirms
8. System deletes location
9. System confirms deletion

**Expected Results:**
- ✅ Location deleted from database
- ✅ Confirmation message shown
- ✅ Metric recorded: `profile.location.deleted` (P2-005 fix)
- ✅ Location removed from list

---

### UAT-PROF-004: Change Language

**Priority:** Medium  
**Category:** User Preferences  
**Prerequisites:** User has WhatsApp account

**Test Steps:**
1. User sends "profile" to WhatsApp number
2. System shows profile menu
3. User selects "Language" or "Change language"
4. System shows available languages (English, French, Kinyarwanda, Swahili)
5. User selects language
6. System updates language preference
7. System confirms in new language

**Expected Results:**
- ✅ Language preference saved
- ✅ All subsequent messages in new language
- ✅ Confirmation message in new language

---

## Core Router UAT

### UAT-CORE-001: Service Routing

**Priority:** Critical  
**Category:** Core Functionality  
**Prerequisites:** User has WhatsApp account

**Test Steps:**
1. User sends "rides" or "mobility"
2. System routes to mobility service
3. User sends "buy" or "buy & sell"
4. System routes to buy-sell service
5. User sends "profile"
6. System routes to profile service
7. User sends "menu" or "home"
8. System shows home menu

**Expected Results:**
- ✅ Correct service handles each request
- ✅ No routing errors
- ✅ Home menu accessible from any service

---

### UAT-CORE-002: Home Menu Display

**Priority:** Critical  
**Category:** User Experience  
**Prerequisites:** User has WhatsApp account

**Test Steps:**
1. User sends "menu" or "home" to WhatsApp number
2. System fetches home menu items from database
3. System displays menu with:
   - Service icons
   - Service names
   - Descriptions
4. User selects service
5. System routes to selected service

**Expected Results:**
- ✅ Menu appears within 2 seconds
- ✅ All active services shown
- ✅ Menu items in user's language
- ✅ Selection routes correctly

---

## Cross-Service UAT

### UAT-CROSS-001: Multi-Service Session

**Priority:** High  
**Category:** User Experience  
**Prerequisites:** User has WhatsApp account

**Test Steps:**
1. User starts in mobility service (searches for drivers)
2. User sends "buy" to switch to buy-sell service
3. User searches for product
4. User sends "profile" to switch to profile service
5. User edits profile
6. User sends "menu" to return to home
7. User selects different service

**Expected Results:**
- ✅ Service switching works smoothly
- ✅ No context leakage between services
- ✅ Each service maintains its own state
- ✅ Home menu always accessible

---

### UAT-CROSS-002: Error Recovery

**Priority:** High  
**Category:** Error Handling  
**Prerequisites:** User has WhatsApp account

**Test Steps:**
1. User sends invalid command
2. System shows error message
3. User sends "menu" to recover
4. System shows home menu
5. User continues with valid command

**Expected Results:**
- ✅ Error message is user-friendly
- ✅ User can recover from errors
- ✅ System doesn't get stuck in error state

---

## Test Execution Guidelines

### Pre-Test Setup

1. **Environment:**
   - Use staging/test environment
   - Ensure all services are deployed
   - Verify database is accessible
   - Check WhatsApp API credentials

2. **Test Data:**
   - Create test user accounts
   - Seed test businesses
   - Create test locations
   - Set up test drivers/passengers

3. **Monitoring:**
   - Enable structured logging
   - Monitor metrics dashboard
   - Check error tracking
   - Review database queries

### Test Execution

1. **Manual Testing:**
   - Execute each test case step-by-step
   - Document results (pass/fail)
   - Note any issues or unexpected behavior
   - Take screenshots of WhatsApp conversations

2. **Automated Testing:**
   - Use test scripts in `scripts/uat/`
   - Run integration tests
   - Verify metrics are recorded
   - Check logs for errors

### Post-Test

1. **Documentation:**
   - Record test results
   - Document any failures
   - Note performance metrics
   - Update test cases if needed

2. **Cleanup:**
   - Remove test data
   - Reset test user states
   - Clear test conversations

---

## Test Metrics

### Success Criteria

- **Functional:** All critical test cases pass (UAT-MOB-001, UAT-BS-001, UAT-PROF-001, UAT-CORE-001)
- **Performance:** 95% of requests complete within 5 seconds
- **Reliability:** 99% success rate for all operations
- **User Experience:** All confirmation messages appear (P2-008 fix)
- **Observability:** All metrics recorded (P2-005 fix)

### Key Metrics to Monitor

- Response times for each service
- Error rates
- User journey completion rates
- Metric recording success rate
- Cache hit rates (P2-007 fix)

---

## Known Issues

### P2-006: Inconsistent Logging
**Status:** ✅ Fixed  
**Description:** All console.log statements replaced with logStructuredEvent

### P2-008: Missing Confirmation Messages
**Status:** ✅ Fixed  
**Description:** Confirmation messages added for all critical actions

### P2-009: Missing Progress Indicators
**Status:** ✅ Fixed  
**Description:** Progress indicators added for long-running operations

---

## Future Enhancements

1. **Automated UAT Execution:**
   - Create automated test scripts
   - Integrate with CI/CD pipeline
   - Generate test reports

2. **Performance Testing:**
   - Load testing for high traffic
   - Stress testing for error scenarios
   - Endurance testing for long sessions

3. **Accessibility Testing:**
   - Test with different languages
   - Test with different devices
   - Test with slow network connections

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-16  
**Maintained By:** Development Team

