# UAT Checklist - Ibimina Staff Console

## Overview
This document provides a comprehensive User Acceptance Testing (UAT) checklist for the Ibimina Staff Console Android and web applications.

---

## Pre-UAT Setup

### Environment Verification
- [ ] Production Supabase instance configured
- [ ] All environment variables set correctly
- [ ] Backend Edge Functions deployed
- [ ] Database migrations applied
- [ ] Test data seeded (sample SACCOs, groups, members)
- [ ] Test user accounts created (staff, manager roles)

### Test Devices
- [ ] Android device (API 26+) for mobile testing
- [ ] Desktop browser (Chrome/Edge) for web testing
- [ ] Mobile browser for PWA testing
- [ ] Network connectivity verified

---

## 1. Authentication & Authorization

### Login/Logout
- [ ] Login with valid credentials succeeds
- [ ] Login with invalid credentials fails with clear error
- [ ] Password reset flow works
- [ ] Session persists across app restarts
- [ ] Logout clears session completely
- [ ] Session timeout works after inactivity

### Multi-Factor Authentication (MFA)
- [ ] MFA enrollment flow works
- [ ] Passkey registration succeeds on supported devices
- [ ] Passkey authentication works
- [ ] MFA backup codes generated and downloadable
- [ ] MFA recovery flow works with backup codes

### Device Authentication (Android)
- [ ] Device key generation succeeds
- [ ] Biometric prompt appears for enrollment
- [ ] Challenge signing works with fingerprint/face
- [ ] Device binding persists across app restarts
- [ ] Device removal/re-enrollment works

---

## 2. Core SACCO Management

### SACCO Operations
- [ ] View list of assigned SACCOs
- [ ] Filter SACCOs by district
- [ ] Search SACCOs by name
- [ ] View SACCO details (name, location, statistics)
- [ ] View SACCO balance summary

### Group (Ikimina) Management
- [ ] Create new group with valid data
- [ ] Edit group settings (amount, frequency, cycle)
- [ ] View group member list
- [ ] Archive/deactivate group
- [ ] Search groups by name
- [ ] Filter groups by status

### Member Management
- [ ] Add new member to group
- [ ] View member details
- [ ] Edit member information
- [ ] Remove member from group
- [ ] View member payment history
- [ ] Search members across groups

---

## 3. Payment Processing

### Manual Payment Entry
- [ ] Record cash deposit
- [ ] Record mobile money payment
- [ ] Edit payment details before confirmation
- [ ] Cancel payment entry
- [ ] Validation prevents negative amounts
- [ ] Validation prevents future dates

### Payment Reference System
- [ ] Generate payment reference for member
- [ ] Copy reference to clipboard
- [ ] Share reference via messaging
- [ ] Reference format matches expected pattern
- [ ] Reference validation works

### Payment Allocation
- [ ] View unallocated payments
- [ ] Allocate payment to correct group/member
- [ ] Match payment by reference code
- [ ] Handle multiple payments for same member
- [ ] Reject invalid allocations

---

## 4. SMS Ingestion (Android Only)

### Setup & Permissions
- [ ] SMS consent screen displays correctly
- [ ] Privacy policy link works
- [ ] SMS permission request appears
- [ ] Permission grant enables feature
- [ ] Permission denial handled gracefully

### Automatic SMS Processing
- [ ] MTN MoMo SMS captured automatically
- [ ] Airtel Money SMS captured automatically
- [ ] Non-payment SMS ignored
- [ ] SMS parsed correctly (amount, reference, phone)
- [ ] Payment auto-allocated to correct member
- [ ] Duplicate SMS detected and ignored

### SMS Settings Management
- [ ] Toggle SMS ingestion on/off
- [ ] Background sync status displayed
- [ ] Last sync timestamp shown
- [ ] Manual sync trigger works
- [ ] Test SMS read functionality works

---

## 5. NFC TapMoMo (Android Only)

### Payee Mode (Receive Payment)
- [ ] "Get Paid" screen loads
- [ ] Amount and network selection work
- [ ] Merchant ID pre-filled correctly
- [ ] NFC activation countdown starts
- [ ] "Ready to scan" status displays
- [ ] One-time payload sent indicator
- [ ] Expiration after 60 seconds
- [ ] Reactivation works after expiry

### Payer Mode (Make Payment)
- [ ] "Scan to Pay" screen loads
- [ ] NFC scan starts on tap
- [ ] Merchant details displayed after scan
- [ ] HMAC validation shown
- [ ] TTL validation shown (not expired)
- [ ] Dual-SIM picker appears (if applicable)
- [ ] USSD code sent automatically (Android)
- [ ] Fallback to dialer if auto-USSD blocked

### Security Validations
- [ ] Expired payload rejected with clear message
- [ ] Replay attack detected
- [ ] Invalid signature rejected
- [ ] Expired timestamp rejected (>2 minutes)

---

## 6. Reporting & Exports

### Dashboard
- [ ] SACCO statistics displayed correctly
- [ ] Group statistics accurate
- [ ] Payment statistics up-to-date
- [ ] Charts/graphs render properly
- [ ] Date range filters work

### Exports
- [ ] Export member list to CSV
- [ ] Export payment history to Excel
- [ ] Export group summary report
- [ ] Downloaded files open correctly
- [ ] Exported data matches displayed data

---

## 7. Offline Capabilities

### Data Caching
- [ ] App works with slow network
- [ ] Recent data cached for offline viewing
- [ ] Offline indicator shown when disconnected
- [ ] Data syncs when connection restored
- [ ] Conflict resolution works correctly

### Background Sync (Android)
- [ ] SMS sync continues in background
- [ ] Notifications appear for new payments
- [ ] Battery optimization respected
- [ ] Sync resumes after device restart

---

## 8. User Interface & Experience

### Accessibility
- [ ] Screen reader compatibility (VoiceOver/TalkBack)
- [ ] Sufficient color contrast (WCAG AA)
- [ ] Touch targets minimum 48dp
- [ ] Form labels properly associated
- [ ] Error messages announced to screen readers

### Responsiveness
- [ ] Works on mobile (320px-480px)
- [ ] Works on tablet (768px-1024px)
- [ ] Works on desktop (1920px+)
- [ ] Layout adapts smoothly
- [ ] No horizontal scrolling issues

### Performance
- [ ] App loads in <3 seconds
- [ ] Navigation transitions smooth
- [ ] No visible lag on interactions
- [ ] Images load progressively
- [ ] Large lists paginated/virtualized

### Design Consistency
- [ ] Atlas Blue color scheme applied
- [ ] Typography consistent
- [ ] Icons consistent
- [ ] Spacing/padding consistent
- [ ] Button styles consistent

---

## 9. Error Handling

### Network Errors
- [ ] Clear error message for no internet
- [ ] Retry mechanism works
- [ ] Offline mode activated gracefully
- [ ] Timeout errors handled

### Validation Errors
- [ ] Form validation messages clear
- [ ] Required fields marked clearly
- [ ] Invalid input prevented/warned
- [ ] Error messages actionable

### System Errors
- [ ] 500 errors show user-friendly message
- [ ] Error details logged (not shown to user)
- [ ] Support contact information provided
- [ ] App doesn't crash on unexpected errors

---

## 10. Security & Privacy

### Data Protection
- [ ] Phone numbers encrypted in database
- [ ] Sensitive data not logged
- [ ] HTTPS used for all requests
- [ ] No secrets in client code
- [ ] HMAC authentication on sensitive APIs

### Permissions
- [ ] Minimum permissions requested
- [ ] Permission rationale shown before request
- [ ] App works with denied optional permissions
- [ ] Permission revocation handled gracefully

### Session Security
- [ ] Session expires after timeout
- [ ] Re-authentication required for sensitive actions
- [ ] Logout clears all local data
- [ ] Device binding prevents account takeover

---

## 11. Notifications (Android)

### Push Notifications
- [ ] Notifications appear for new payments
- [ ] Notifications appear for group updates
- [ ] Notification channels properly labeled
- [ ] Priority notifications show heads-up
- [ ] Notification actions work (View, Dismiss)
- [ ] Deep links open correct screen
- [ ] Notifications persist across reboots

### In-App Notifications
- [ ] Toast messages appear for actions
- [ ] Success messages clear and timely
- [ ] Warning messages attention-grabbing
- [ ] Error messages actionable

---

## 12. Integration Testing

### Supabase Integration
- [ ] Real-time updates work (new payments)
- [ ] Database queries return correct data
- [ ] RLS policies enforced correctly
- [ ] Edge Functions respond correctly
- [ ] Storage uploads work

### External Services
- [ ] OpenAI SMS parsing works (fallback)
- [ ] Mobile money provider detection accurate
- [ ] Telco detection from phone numbers

---

## 13. Regression Testing

### Critical Paths
- [ ] End-to-end payment processing still works
- [ ] Group creation and member addition still works
- [ ] SMS ingestion still works after updates
- [ ] Device authentication still works after updates

### Known Issues
- [ ] Verify previously fixed bugs haven't returned
- [ ] Check release notes for specific items to test

---

## 14. User Acceptance Criteria

### Staff Feedback
- [ ] Interface intuitive for non-technical users
- [ ] Common tasks completable in <1 minute
- [ ] Help/documentation easily accessible
- [ ] Terminology familiar to SACCO staff

### Business Requirements
- [ ] Payment reconciliation 99%+ faster
- [ ] Manual entry reduced by 90%+
- [ ] Member satisfaction improved
- [ ] Staff training time reduced

---

## Post-UAT Sign-Off

### Stakeholder Approval
- [ ] SACCO staff representative approval
- [ ] District manager approval
- [ ] Technical lead approval
- [ ] Project manager approval

### Documentation
- [ ] All issues logged with severity
- [ ] Critical/high severity issues resolved
- [ ] Medium/low issues triaged for future releases
- [ ] UAT report generated and distributed

### Deployment Readiness
- [ ] Production environment prepared
- [ ] Rollback plan documented
- [ ] Support team briefed
- [ ] Monitoring/alerting configured

---

## UAT Execution Notes

### Test Session Information
- **Date:** _______________
- **Tester Name:** _______________
- **Device/Browser:** _______________
- **App Version:** _______________

### Issue Tracking
Use the following severity levels:

- **Critical:** Prevents core functionality, data loss risk
- **High:** Major feature doesn't work, workaround difficult
- **Medium:** Feature works but with issues, workaround available
- **Low:** Cosmetic issue, minor inconvenience

### Sign-Off
- **Tester Signature:** _______________
- **Date:** _______________
- **Status:** [ ] Pass [ ] Pass with Issues [ ] Fail
- **Comments:** _______________

---

**Last Updated:** December 2024  
**Version:** 1.0  
**Maintained by:** Ibimina QA Team
