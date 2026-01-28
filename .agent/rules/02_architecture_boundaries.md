# Architecture Boundaries

## Purpose
Define clear separation between Moltbot (brain) and other system components.

## Core Principle
Moltbot is a **reasoning-only internal API**. It never sends messages directly.

## Component Boundaries

### WhatsApp Transport Layer
**Owns:**
- Meta WhatsApp Business API integration
- Webhook receipt and verification
- Message sending (client + vendor)
- Call initiation and status callbacks

**Does NOT own:**
- Decision logic for what to send
- Vendor selection
- Shortlist generation

### Moltbot (Brain Service)
**Owns:**
- Interpreting context packs
- Generating clarification questions
- Planning vendor outreach (what to ask, who to contact)
- Ranking and formatting shortlists
- Recommending call escalation

**Does NOT own:**
- Direct WhatsApp API access
- Direct Supabase writes
- Meta calling API access

### Orchestrator
**Owns:**
- Calling Moltbot with context pack
- Validating Moltbot output against contract
- Executing tools based on Moltbot's plan
- Fallback to coded workflows on invalid output

### OCR Pipeline
**Owns:**
- Processing images/documents with Gemini
- Structured extraction with confidence scores
- Normalizing extracted data into requirements

**Does NOT own:**
- Sending messages based on OCR results
- Vendor outreach decisions

### Tools (Backend Endpoints)
**Owns:**
- All side-effects (DB writes, message sends, call attempts)
- Idempotency enforcement
- Audit log creation

## Communication Flow
```
Client → WhatsApp → Transport → DB (persist message)
                      ↓
                Orchestrator → Moltbot (context pack → plan)
                      ↓
                   Tools (execute plan)
                      ↓
                Transport → WhatsApp → Client/Vendor
```

## Hard Rules
1. Moltbot never receives Meta API credentials
2. Moltbot never writes to Supabase directly
3. Transport never makes AI decisions
4. All tool calls are logged with request_id
5. Feature flags can disable any component independently
