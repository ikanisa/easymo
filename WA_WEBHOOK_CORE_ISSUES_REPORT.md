# wa-webhook-core Full-Stack Review & Issues Report
**Date:** 2025-12-18  
**Scope:** Complete code review of wa-webhook-core function

---

## 🔴 CRITICAL ISSUES

### 1. **Request Body Consumed Twice (Critical)**
**Location:** `index.ts:200, 345`  
**Issue:** Request body is read with `req.text()` at line 200, then in catch block at line 345 we try `req.clone().text()`. If body was already fully consumed or stream was closed, `clone()` may not work correctly.  
**Impact:** DLQ storage may fail silently when errors occur, losing error context.  
**Severity:** 🔴 Critical

### 2. **Schema Mismatch in help-support.ts (Critical)**
**Location:** `handlers/help-support.ts:34`  
**Issue:** Code tries to select `id, channel, destination` but the table schema is `phone, display_name, is_active` (no `channel` or `destination` columns).  
**Impact:** Help requests will fail with database errors.  
**Severity:** 🔴 Critical

### 3. **Missing Import: handleInsuranceAgentRequest (Critical)**
**Location:** `handlers/home-menu.ts:130`  
**Issue:** `handleInsuranceAgentRequest` is called but not imported. It's defined in `router.ts` but not exported.  
**Impact:** Insurance menu selection will crash with "not defined" error.  
**Severity:** 🔴 Critical

---

## 🟡 HIGH PRIORITY ISSUES

### 4. **JSON.parse Without Error Handling**
**Location:** `index.ts:232`  
**Issue:** `JSON.parse(rawBody)` has no try-catch. Malformed JSON will throw unhandled error.  
**Impact:** Malformed payloads will cause 500 errors instead of proper error handling.  
**Severity:** 🟡 High

### 5. **Missing Null Check in handleInsuranceAgentRequest**
**Location:** `router.ts:56, 81, 91, 118, 134`  
**Issue:** Function accepts `phoneNumber: string` but doesn't validate it's not null/empty before using in `sendText()`.  
**Impact:** If called with null/undefined, will throw error.  
**Severity:** 🟡 High

### 6. **Missing Correlation ID in Referral Code Logging**
**Location:** `router.ts:195`  
**Issue:** Uses `crypto.randomUUID()` instead of passing correlationId from context.  
**Impact:** Breaks request tracing - logs won't be correlated properly.  
**Severity:** 🟡 High

### 7. **Unhandled Promise Rejection in Insurance Handler**
**Location:** `router.ts:225`  
**Issue:** `handleInsuranceAgentRequest` is called with `await` but if it throws, error is not caught.  
**Impact:** If insurance handler fails, it could crash the routing logic.  
**Severity:** 🟡 High

### 8. **Missing Error Handling in Home Menu Forward**
**Location:** `handlers/home-menu.ts:148-166`  
**Issue:** Fetch to target service has no timeout, and error handling doesn't return response.  
**Impact:** If fetch hangs or fails, no proper error response is returned.  
**Severity:** 🟡 High

---

## 🟢 MEDIUM PRIORITY ISSUES

### 9. **Duplicate getFirstMessage Function**
**Location:** `router.ts:141`, `handlers/home-menu.ts:34`  
**Issue:** Same function defined in multiple places (code duplication).  
**Impact:** Maintenance burden, potential for divergence.  
**Severity:** 🟢 Medium

### 10. **Inconsistent Error Response Format**
**Location:** Multiple locations  
**Issue:** Some errors return structured responses, others return plain text.  
**Impact:** Inconsistent API responses.  
**Severity:** 🟢 Medium

### 11. **Missing Timeout in Home Menu Forward**
**Location:** `handlers/home-menu.ts:149`  
**Issue:** Fetch call has no timeout or AbortController.  
**Impact:** Could hang indefinitely.  
**Severity:** 🟢 Medium

### 12. **Race Condition: Request Counter**
**Location:** `index.ts:50, 54, 258`  
**Issue:** `requestCounter` is a module-level variable, but edge functions can have multiple instances. This could cause cleanup to run more/less frequently than intended.  
**Impact:** Minor - cleanup frequency may vary, but functionality should still work.  
**Severity:** 🟢 Medium

---

## 🔵 LOW PRIORITY / CODE QUALITY

### 13. **Type Safety: Any Types**
**Location:** `handlers/intent-opt-out.ts:20`  
**Issue:** Function parameter uses `any` instead of proper type.  
**Impact:** Reduced type safety.  
**Severity:** 🔵 Low

### 14. **Magic Numbers**
**Location:** Multiple  
**Issue:** Hard-coded values like `100`, `4000`, etc. without constants.  
**Impact:** Reduced maintainability.  
**Severity:** 🔵 Low

### 15. **Incomplete JSDoc Comments**
**Location:** Multiple functions  
**Issue:** Some functions lack proper documentation.  
**Impact:** Reduced code clarity.  
**Severity:** 🔵 Low

---

## 📋 SUMMARY

**Total Issues Found:** 15
- 🔴 Critical: 3
- 🟡 High: 5
- 🟢 Medium: 4
- 🔵 Low: 3

**Estimated Impact:**
- Critical issues will cause production failures
- High priority issues will cause intermittent errors
- Medium/Low issues affect maintainability and edge cases

