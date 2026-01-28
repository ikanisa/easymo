# Mobility Service

Mobility is a button-driven WhatsApp workflow (no AI agent).

## Key Rules
- Button-driven interactions only
- No payments handled in mobility
- Trips auto-expire after 30 minutes
- Recent locations are cached for 30 minutes
- Users connect directly via WhatsApp links

## Vehicle Types
- veh_moto: Moto
- veh_cab: Cab
- veh_lifan: Lifan
- veh_truck: Truck
- veh_others: Other

## Matching
Matching uses nearby open trips and simple distance checks. Results return direct contact details
rather than mediated messaging.
