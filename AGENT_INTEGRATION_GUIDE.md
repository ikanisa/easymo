# WhatsApp Agent Integration Guide

## Quick Integration Steps

### 1. Intent Detection in wa-webhook

Add these intent patterns to your `wa-webhook` function:

```typescript
// In wa-webhook/index.ts - Intent detection section

async function detectIntent(message: string, interactive?: any): Promise<string> {
  const lowerMessage = message.toLowerCase();
  
  // Property Rental patterns
  if (lowerMessage.includes('property') || 
      lowerMessage.includes('rent') || 
      lowerMessage.includes('house') ||
      lowerMessage.includes('apartment')) {
    return 'property_rental';
  }
  
  // Schedule Trip patterns  
  if (lowerMessage.includes('schedule') || 
      lowerMessage.includes('book later') ||
      lowerMessage.includes('recurring trip') ||
      lowerMessage.includes('tomorrow') ||
      lowerMessage.includes('everyday')) {
    return 'schedule_trip';
  }
  
  // Quincaillerie patterns
  if (lowerMessage.includes('hardware') || 
      lowerMessage.includes('quincaillerie') ||
      lowerMessage.includes('construction') ||
      lowerMessage.includes('tools')) {
    return 'quincaillerie';
  }
  
  // General Shops patterns
  if (lowerMessage.includes('shop') || 
      lowerMessage.includes('buy') ||
      lowerMessage.includes('product') ||
      lowerMessage.includes('store')) {
    return 'shops';
  }
  
  return 'unknown';
}
```

### 2. Agent Invocation

```typescript
// After intent detection

const AGENT_ENDPOINTS = {
  property_rental: 'agents/property-rental',
  schedule_trip: 'agents/schedule-trip',
  quincaillerie: 'agents/quincaillerie',
  shops: 'agents/shops',
};

async function invokeAgent(intent: string, payload: any) {
  const endpoint = AGENT_ENDPOINTS[intent];
  if (!endpoint) return null;
  
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  
  return await response.json();
}
```

### 3. Message Flow Examples

#### Property Rental Flow:
```typescript
// User message: "I need a 2-bedroom apartment near Kigali"
const payload = {
  userId: user.id,
  action: 'find',
  rentalType: 'long_term',
  bedrooms: 2,
  location: {
    latitude: user.location.lat,
    longitude: user.location.lng,
  },
  maxBudget: extractBudget(message) || undefined,
};

const result = await invokeAgent('property_rental', payload);
await sendWhatsAppMessage(user.phone, result.message);
```

#### Schedule Trip Flow:
```typescript
// User message: "Schedule a trip to work tomorrow at 8am"
const payload = {
  userId: user.id,
  action: 'schedule',
  pickupLocation: user.currentLocation,
  dropoffLocation: extractLocation(message),
  scheduledTime: parseTime('tomorrow 8am'),
  vehiclePreference: 'Moto',
  recurrence: 'weekdays', // if user says "every weekday"
};

const result = await invokeAgent('schedule_trip', payload);
```

#### Quincaillerie Flow:
```typescript
// User sends image of shopping list
const payload = {
  userId: user.id,
  location: user.currentLocation,
  itemImage: mediaUrl, // from WhatsApp webhook
  items: [], // or text items if provided
};

const result = await invokeAgent('quincaillerie', payload);
```

#### Shops Flow:
```typescript
// Add shop
const payload = {
  userId: user.id,
  action: 'add',
  location: extractLocation(message),
  shopData: {
    name: 'My Shop Name',
    description: 'Supermarket selling groceries',
    categories: ['supermarket', 'groceries'],
    whatsappCatalogUrl: extractUrl(message),
  },
};

// Search shops
const payload = {
  userId: user.id,
  action: 'search',
  location: user.currentLocation,
  products: extractProducts(message),
  shopCategory: 'supermarket', // optional
};
```

### 4. Response Handling

```typescript
async function handleAgentResponse(result: any, userPhone: string) {
  if (!result.success) {
    await sendWhatsAppMessage(userPhone, result.message || 'Sorry, something went wrong.');
    return;
  }
  
  // Send formatted message
  await sendWhatsAppMessage(userPhone, result.message);
  
  // If there are options (quotes), store them for follow-up
  if (result.options) {
    await storeUserContext(userId, {
      sessionId: result.searchId || result.tripId,
      options: result.options,
      awaitingSelection: true,
    });
  }
}
```

### 5. Follow-up Handler

```typescript
// When user replies with option number
async function handleOptionSelection(userPhone: string, selection: number) {
  const context = await getUserContext(userId);
  
  if (!context.awaitingSelection) return;
  
  const selectedOption = context.options[selection - 1];
  if (!selectedOption) {
    await sendWhatsAppMessage(userPhone, 'Invalid selection. Please choose 1, 2, or 3.');
    return;
  }
  
  // Update quote status
  await supabase
    .from('agent_quotes')
    .update({ status: 'accepted' })
    .eq('id', selectedOption.id);
  
  // Send vendor contact info
  const message = `Great choice! Here's the contact information:\n\n` +
                 `📞 Phone: ${selectedOption.vendor_phone}\n` +
                 `📍 Location: ${selectedOption.offer_data.location}\n\n` +
                 `Feel free to contact them directly for your order!`;
  
  await sendWhatsAppMessage(userPhone, message);
  
  // Clear context
  await clearUserContext(userId);
}
```

## Helper Functions

### Location Extraction:
```typescript
function extractLocation(message: string, userLocation: any): Location {
  // Try to extract from message first
  const coordinates = extractCoordinates(message);
  if (coordinates) return coordinates;
  
  // Fall back to user's current location
  return userLocation;
}

function extractCoordinates(text: string): Location | null {
  const pattern = /-?\d+\.\d+,\s*-?\d+\.\d+/;
  const match = text.match(pattern);
  if (match) {
    const [lat, lng] = match[0].split(',').map(n => parseFloat(n.trim()));
    return { latitude: lat, longitude: lng };
  }
  return null;
}
```

### Time Parsing:
```typescript
function parseTime(timeStr: string): string {
  const now = new Date();
  
  // Handle relative times
  if (timeStr.includes('tomorrow')) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const hour = extractHour(timeStr) || 8;
    tomorrow.setHours(hour, 0, 0, 0);
    return tomorrow.toISOString();
  }
  
  if (timeStr.includes('evening')) {
    const evening = new Date(now);
    evening.setHours(18, 0, 0, 0);
    if (evening < now) evening.setDate(evening.getDate() + 1);
    return evening.toISOString();
  }
  
  // Parse absolute time
  return parseAbsoluteTime(timeStr);
}
```

### Budget Extraction:
```typescript
function extractBudget(message: string): number | undefined {
  const patterns = [
    /budget:\s*(\d+)/i,
    /max:\s*(\d+)/i,
    /up to\s*(\d+)/i,
    /(\d+)\s*rwf/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return parseInt(match[1]);
  }
  
  return undefined;
}
```

## Testing Checklist

### Property Rental:
- [ ] User says "I need an apartment" → property_rental detected
- [ ] User provides bedrooms → included in payload
- [ ] Location shared → used for search
- [ ] Budget mentioned → included as maxBudget
- [ ] Results displayed as formatted message
- [ ] User selects option → contact info sent

### Schedule Trip:
- [ ] User says "schedule trip tomorrow" → schedule_trip detected
- [ ] Time extracted correctly
- [ ] Recurrence detected ("every weekday")
- [ ] Confirmation message sent
- [ ] Pattern stored in database
- [ ] Predictions generated

### Quincaillerie:
- [ ] Image upload → OCR triggered
- [ ] Text items → parsed correctly
- [ ] Multiple stores checked
- [ ] Prices negotiated
- [ ] Top 3 presented

### Shops:
- [ ] Add shop → shop created
- [ ] Search products → shops found
- [ ] Category filter works
- [ ] Image OCR works
- [ ] WhatsApp catalog detected

## Error Handling

```typescript
try {
  const result = await invokeAgent(intent, payload);
  
  if (!result) {
    await sendWhatsAppMessage(userPhone, 
      'Sorry, this service is temporarily unavailable. Please try again later.'
    );
    return;
  }
  
  await handleAgentResponse(result, userPhone);
  
} catch (error) {
  console.error('Agent invocation error:', error);
  
  await sendWhatsAppMessage(userPhone,
    'Oops! Something went wrong. Our team has been notified. Please try again in a moment.'
  );
  
  // Log to monitoring
  await logError({
    type: 'agent_invocation_error',
    intent,
    userId,
    error: error.message,
  });
}
```

## Monitoring & Analytics

Track these metrics:
- Agent invocation count per type
- Success/failure rates
- Average response time
- User satisfaction (based on selections)
- Session completion rates

```typescript
// Log agent metrics
await supabase.from('agent_metrics').insert({
  agent_type: intent,
  user_id: userId,
  success: result.success,
  duration_ms: Date.now() - startTime,
  session_id: result.searchId,
});
```

## Production Checklist

- [ ] All migrations applied (`supabase db push`)
- [ ] All functions deployed
- [ ] Agent registry populated
- [ ] Environment variables set
- [ ] OpenAI API key configured
- [ ] Rate limiting configured
- [ ] Error monitoring enabled
- [ ] User feedback collection setup
- [ ] Analytics dashboard created

## Support & Troubleshooting

### Common Issues:

**Issue**: Agent not responding
- Check function logs: `supabase functions logs agents/property-rental`
- Verify environment variables
- Check database connectivity

**Issue**: OCR not working
- Verify OpenAI API key
- Check image URL accessibility
- Ensure proper content-type headers

**Issue**: Geo-search not working
- Verify PostGIS extension enabled
- Check location data format
- Ensure indexes are created

**Issue**: Pattern learning not working
- Check `travel_patterns` table
- Verify trigger execution
- Ensure sufficient data points (>3)

---

**Next Steps**: Implement Nearby Drivers and Pharmacy agents for complete marketplace functionality.
