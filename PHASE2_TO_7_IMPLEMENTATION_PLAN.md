# AI Agents Implementation: Phases 2-7

## Phase 2: Nearby Pharmacies ✅ Ready to Implement

**Status**: Handlers already exist, just need menu integration

**Files to modify**:
- Add "Nearby Pharmacies" to home menu (`flows/home.ts`)
- Create flow handler in router (`router/interactive_list.ts`)
- Ensure pharmacy handlers are called correctly

**Flow**: User → Menu → Pharmacy → Location → (Optional) Medicine → AI Agent

---

## Phase 3: Nearby Quincailleries ✅ Ready to Implement

**Status**: Handlers already exist, just need menu integration

**Files to modify**:
- Add "Nearby Quincailleries" to home menu
- Create flow handler in router
- Ensure quincaillerie handlers are called correctly

**Flow**: User → Menu → Quincaillerie → Location → (Optional) Items → AI Agent

---

## Phase 4: Shops ⚠️ Partial (Add flow exists)

**Status**: "View Shops" needs AI agent integration

**Files to modify**:
- Marketplace already has "Browse" option
- Add AI agent call after location + items collected
- Keep "Add Shop" flow as-is (no AI)

**Flow**: 
- **Add**: User → Menu → Add Shop → Location → Name → Description → Done (NO AI)
- **View**: User → Menu → View Shops → Location → (Optional) Items → AI Agent

---

## Phase 5: Property Rentals ⚠️ Partial

**Status**: Need to add to menu and create flows

**Files to modify**:
- Add "Property Rentals" to home menu
- Create add/find property flows
- Integrate AI agent for "Find" flow only

**Flow**:
- **Add**: Collect criteria → Save to DB (NO AI)
- **Find**: Collect search criteria → AI Agent

---

## Phase 6: Schedule Trip Background Agent 🔄 Complex

**Status**: Requires background job system

**Complexity**: HIGH - needs:
- Background job infrastructure
- Pattern learning algorithm
- Notification system
- Database schema for recurring trips

**Approach**: Defer to later phase, focus on simpler integrations first

---

## Phase 7: Dine-In AI Waiter 🍽️ Complex

**Status**: Requires QR code system + conversational AI

**Complexity**: HIGH - needs:
- QR code generation per table
- Conversational agent (different from negotiation agent)
- Real-time order dashboard
- Menu integration

**Approach**: Defer to later phase

---

## Recommended Order

### Immediate (Simple integrations):
1. **Phase 2**: Pharmacies (30 min)
2. **Phase 3**: Quincailleries (30 min)
3. **Phase 4**: Shops View (45 min)

### Next Sprint:
4. **Phase 5**: Property Rentals (2 hours)

### Future Sprints:
5. **Phase 6**: Schedule Trip Background (1 week)
6. **Phase 7**: Dine-In Waiter (1 week)

---

## Starting with Phase 2: Pharmacies

Let's add "Nearby Pharmacies" to the home menu and wire it up!
