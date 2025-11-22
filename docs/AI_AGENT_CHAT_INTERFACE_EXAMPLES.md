# AI Agent Chat Interface - Implementation Examples

This document provides concrete examples of how to use the AI chat interface utilities in agent implementations.

## Overview

All 8 AI agents MUST use natural language chat interfaces with:
- ✅ Emoji-numbered lists (1️⃣, 2️⃣, 3️⃣)
- ✅ Action buttons for quick responses
- ✅ Concise messages with emojis
- ✅ Clear call-to-action prompts

## Import Required Utilities

```typescript
import { 
  sendAgentListResponse, 
  sendAgentMessageWithActions, 
  sendAgentMessage,
  AGENT_TEMPLATES,
  formatEmojiNumberedList,
  parseEmojiNumber,
  createQuickReplyInstruction
} from "../../utils/ai-chat-interface.ts";
```

## Example 1: Showing Search Results (Waiter Agent - Menu Items)

### Before (Plain Text)
```typescript
const response = `Found 3 menu items:
- Pizza Margherita - 5000 RWF
- Burger Classic - 3000 RWF
- Pasta Carbonara - 4000 RWF

Reply with the item name to order.`;

await sendText(ctx.from, response);
```

### After (Emoji-Numbered List with Action Buttons)
```typescript
const menuItems = [
  { text: 'Pizza Margherita - 5000 RWF', description: 'Italian pizza, 30 min prep' },
  { text: 'Burger Classic - 3000 RWF', description: 'Beef burger with fries' },
  { text: 'Pasta Carbonara - 4000 RWF', description: 'Creamy pasta, 25 min' }
];

await sendAgentListResponse(ctx, {
  emoji: '🍕',
  message: 'Found 3 menu items:',
  items: menuItems,
  actions: [
    { id: 'select_menu_item', title: 'Select Item', emoji: '✅' },
    { id: 'search_again', title: 'Search Again', emoji: '🔍' }
  ]
});
```

**Result on WhatsApp:**
```
🍕 Found 3 menu items:

1️⃣ Pizza Margherita - 5000 RWF
   Italian pizza, 30 min prep

2️⃣ Burger Classic - 3000 RWF
   Beef burger with fries

3️⃣ Pasta Carbonara - 4000 RWF
   Creamy pasta, 25 min

[✅ Select Item] [🔍 Search Again] [🏠 Home]
```

## Example 2: Showing Driver Options (Rides Agent)

```typescript
const drivers = await findNearbyDrivers(latitude, longitude);

if (drivers.length === 0) {
  await sendAgentMessage(ctx, '❌', 
    'No drivers available nearby right now. Please try again in a few minutes.'
  );
  return;
}

const driverList = drivers.map(driver => ({
  text: `${driver.name} - ${driver.eta_minutes} min`,
  description: `${driver.vehicle_type} • Rating: ${driver.rating}/5 • ${driver.distance_km}km away`
}));

await sendAgentListResponse(ctx, {
  emoji: '🚗',
  message: `Found ${drivers.length} drivers near you:`,
  items: driverList,
  actions: [
    { id: 'request_ride', title: 'Request Ride', emoji: '✅' },
    { id: 'see_more', title: 'See More Drivers', emoji: '👀' }
  ]
});
```

**Result:**
```
🚗 Found 2 drivers near you:

1️⃣ John - 3 min
   Toyota Corolla • Rating: 4.8/5 • 1.2km away

2️⃣ Mary - 5 min
   Honda Fit • Rating: 4.9/5 • 2.1km away

[✅ Request Ride] [👀 See More Drivers] [🏠 Home]
```

## Example 3: Simple Success Message with Actions

```typescript
await sendAgentMessageWithActions(ctx, {
  emoji: '✅',
  message: 'Order placed successfully! Your food will be ready in 30 minutes.',
  actions: [
    { id: 'track_order', title: 'Track Order', emoji: '📍' },
    { id: 'view_receipt', title: 'View Receipt', emoji: '🧾' }
  ]
});
```

**Result:**
```
✅ Order placed successfully! Your food will be ready in 30 minutes.

[📍 Track Order] [🧾 View Receipt] [🏠 Home]
```

## Example 4: Handling User Input (Number Selection)

```typescript
// User replies: "1" or "1️⃣"
const selectedNumber = parseEmojiNumber(userInput);

if (selectedNumber !== null && selectedNumber >= 1 && selectedNumber <= menuItems.length) {
  const selectedItem = menuItems[selectedNumber - 1];
  await sendAgentMessageWithActions(ctx, {
    emoji: '✅',
    message: `You selected: ${selectedItem.name}`,
    actions: [
      { id: 'confirm_order', title: 'Confirm Order', emoji: '✅' },
      { id: 'change_selection', title: 'Change', emoji: '🔄' }
    ]
  });
} else {
  await sendAgentMessage(ctx, '❌', 
    `Invalid selection. ${createQuickReplyInstruction(['number 1-3', "'search' to search again"])}`
  );
}
```

## Example 5: Using Templates

```typescript
// Searching message
await sendAgentMessage(ctx, '🔍', AGENT_TEMPLATES.searching('properties'));

// Not found with suggestion
await sendAgentMessage(ctx, '', 
  AGENT_TEMPLATES.notFound('properties', 
    'Try widening your search area or adjusting your budget.'
  )
);

// Success message
await sendAgentMessage(ctx, '', 
  AGENT_TEMPLATES.success('Property shortlisted')
);

// Error message
await sendAgentMessage(ctx, '', 
  AGENT_TEMPLATES.error('Search failed', 'Please try again or contact support.')
);
```

## Example 6: Multi-Step Flow (Property Search)

### Step 1: Initial Query
```typescript
await sendAgentMessage(ctx, '🏠', 
  'Hi! I can help you find properties. What are you looking for?'
);
```

### Step 2: Show Results
```typescript
const properties = await searchProperties(criteria);

const propertyList = properties.map(p => ({
  text: `${p.bedrooms} bed ${p.property_type} - ${p.price.toLocaleString()} RWF/month`,
  description: `${p.location} • ${p.amenities.join(', ')}`
}));

await sendAgentListResponse(ctx, {
  emoji: '🏠',
  message: `Found ${properties.length} properties matching your criteria:`,
  items: propertyList,
  actions: [
    { id: 'view_details', title: 'View Details', emoji: '📋' },
    { id: 'schedule_viewing', title: 'Schedule Viewing', emoji: '📅' },
    { id: 'refine_search', title: 'Refine Search', emoji: '🔍' }
  ]
});
```

### Step 3: Confirmation
```typescript
await sendAgentMessageWithActions(ctx, {
  emoji: '📅',
  message: 'Viewing scheduled for tomorrow at 2 PM. The owner will contact you shortly.',
  actions: [
    { id: 'view_other_properties', title: 'View More', emoji: '🏠' },
    { id: 'done', title: 'Done', emoji: '✅' }
  ]
});
```

## Example 7: Error Handling

```typescript
try {
  const results = await agentTool.execute(params);
  
  if (results.length === 0) {
    await sendAgentMessage(ctx, '', 
      AGENT_TEMPLATES.notFound('jobs', 'Try different search terms or location.')
    );
  } else {
    // Show results...
  }
} catch (error) {
  console.error('Agent error:', error);
  await sendAgentMessageWithActions(ctx, {
    emoji: '❌',
    message: 'Something went wrong. Please try again.',
    actions: [
      { id: 'retry', title: 'Retry', emoji: '🔄' },
      { id: 'contact_support', title: 'Get Help', emoji: '💬' }
    ]
  });
}
```

## Best Practices

### ✅ DO:
- Use emoji-numbered lists for 2+ options
- Keep messages concise (< 160 chars when possible)
- Use relevant emojis for context (🍕 food, 🚗 transport, etc.)
- Provide clear next steps with action buttons
- Handle both emoji (1️⃣) and plain (1) number inputs
- Include helpful descriptions in list items

### ❌ DON'T:
- Use plain numbered lists (1., 2., 3.)
- Send long paragraphs without breaks
- Use too many emojis (1-2 per message is ideal)
- Create more than 3 action buttons (WhatsApp limit)
- Forget to handle user input parsing
- Use technical jargon without explanation

## Integration with Agent Classes

When implementing in agent tool responses, format data before returning:

```typescript
// Inside an agent tool's execute() method
execute: async (params) => {
  const results = await this.supabase
    .from('menu_items')
    .select('*')
    .limit(5);
  
  if (!results.data || results.data.length === 0) {
    return { 
      success: false,
      message: AGENT_TEMPLATES.notFound('menu items')
    };
  }
  
  // Format for emoji-numbered display
  return {
    success: true,
    items: results.data.map(item => ({
      id: item.id,
      text: `${item.name} - ${item.price} RWF`,
      description: item.description,
      // Include raw data for selection handling
      raw: item
    })),
    count: results.data.length
  };
}
```

Then in the agent's main response handler:

```typescript
const toolResult = await tool.execute(params);

if (toolResult.success && toolResult.items) {
  await sendAgentListResponse(ctx, {
    emoji: '🍕',
    message: `Found ${toolResult.count} options:`,
    items: toolResult.items,
    actions: [
      { id: 'select_item', title: 'Select', emoji: '✅' },
      { id: 'refine', title: 'Refine', emoji: '🔍' }
    ]
  });
}
```

## Emoji Reference

Common emojis by domain:

- **Food/Waiter**: 🍕, 🍔, 🍝, ☕, 🍰, 🥗
- **Transportation**: 🚗, 🏍️, 🚕, 📍, ⏱️, 🛣️
- **Real Estate**: 🏠, 🏢, 🛏️, 🏗️, 🔑, 📍
- **Jobs**: 💼, 🏗️, 🚗, 🍽️, 💰, ⏰
- **Insurance**: 🚗, 🏥, 🏠, 📄, ✅, 💼
- **Farming**: 🌱, 🚜, 🌾, 📦, 💰, 🥕
- **Business**: 🏪, 🛠️, 📞, 📍, ⭐, 💼
- **Sales**: 🎯, 📊, 💼, 📞, ✉️, 🚀
- **Actions**: ✅, ❌, 🔍, 🔄, 📋, 📅
- **Status**: ⏳, ✅, ❌, ⚠️, 📍, 💬
