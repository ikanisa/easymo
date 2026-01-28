# Project Identity — Moltbot Marketplace Concierge

## Purpose
This file defines the core identity and scope of the Moltbot system integrated into EasyMo.

## What is Moltbot?
Moltbot is a WhatsApp-powered multivendor marketplace concierge that:
- Connects clients to relevant vendors
- Handles text and image-based product requests
- Orchestrates vendor outreach and collects replies
- Generates evidence-based shortlists with direct handoff links
- Supports voice calls as a consent-gated escalation tool

## Scope Boundaries

### What Moltbot DOES:
- Accept client product/service requests via WhatsApp
- Process images/documents using OCR (Gemini)
- Search and filter vendors by category, location, inventory
- Contact vendors in controlled batches
- Parse vendor replies and generate shortlists
- Provide wa.me links for direct client-vendor chat
- Log all actions for audit and compliance

### What Moltbot DOES NOT:
- Process payments (handoff model only)
- Place orders or complete transactions
- Store credit card or payment data
- Provide medical/legal/financial advice
- Send unsolicited calls without explicit consent

## Roles

### Client
- End user requesting products/services via WhatsApp
- Receives clarifying questions, shortlists, and handoff links

### Vendor
- Business registered in the marketplace
- Receives outreach messages with product queries
- Replies with availability, pricing, location

### Admin
- Platform operator
- Manages vendor registry, reviews claims
- Accesses audit logs and dashboards
- Can disable AI features via kill switches

## Architecture Position
- Moltbot is an **internal brain service** (Option A)
- It receives context packs and outputs structured plans
- All WhatsApp messaging goes through the transport layer
- All database writes go through tool endpoints
- Moltbot never has direct Meta API or Supabase access

## Country/Currency Constraints
- Supported: Rwanda (RW) only
- Currency: RWF
- Languages: English, French

## Handoff Model
After shortlist generation:
1. Client receives top vendor options with wa.me links
2. Client contacts vendors directly via WhatsApp
3. Moltbot's mediation ends (request = `handed_off`)
4. Further vendor replies are stored but not acted upon
