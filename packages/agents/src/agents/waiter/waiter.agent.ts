/**
 * Waiter AI Agent
 * Handles restaurant dine-in orders via WhatsApp
 * Features: QR code session, menu display, order management
 * No SLA - conversational flow
 */

import { BaseAgent } from '../base/agent.base';
import type { AgentInput, AgentResult, AgentContext, Tool } from '../../types/agent.types';

interface MenuItem {
  id: string;
  number: number;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  isVegetarian?: boolean;
  isSpicy?: boolean;
}

interface Order {
  orderId: string;
  tableNumber: string;
  items: Array<{
    menuItem: MenuItem;
    quantity: number;
    specialInstructions?: string;
  }>;
  totalPrice: number;
  status: 'draft' | 'confirmed' | 'preparing' | 'served';
  timestamp: number;
}

export class WaiterAgent extends BaseAgent {
  name = 'waiter';
  
  instructions = `You are a professional AI waiter for restaurants using EasyMO.
Your role is to:
1. Welcome guests warmly when they scan the QR code at their table
2. Present the menu in a clear, numbered format
3. Take orders by accepting item numbers (e.g., "1,4,9" or "1 and 4 and 9")
4. Handle modifications and special requests
5. Summarize orders and confirm before sending to kitchen
6. Provide excellent conversational service throughout the meal

Personality:
- Warm, friendly, and professional
- Patient with customer questions
- Helpful with recommendations
- Attentive to special dietary needs
- Natural conversational style (like a real waiter)

IMPORTANT:
- Always confirm orders before sending to kitchen
- Handle "not available" items gracefully with alternatives
- Keep responses concise for WhatsApp
- Use emojis appropriately to enhance experience`;

  tools: Tool[] = [
    {
      name: 'get_restaurant_menu',
      description: 'Get the menu for a restaurant',
      parameters: {
        type: 'object',
        properties: {
          restaurant_id: { type: 'string' },
          category: { 
            type: 'string',
            enum: ['all', 'appetizers', 'mains', 'drinks', 'desserts']
          }
        },
        required: ['restaurant_id']
      },
      execute: async (params, context) => {
        return await this.getRestaurantMenu(params);
      }
    },
    {
      name: 'create_order',
      description: 'Create a new order for a table',
      parameters: {
        type: 'object',
        properties: {
          table_number: { type: 'string' },
          restaurant_id: { type: 'string' },
          items: { 
            type: 'array',
            items: { type: 'object' }
          }
        },
        required: ['table_number', 'restaurant_id', 'items']
      },
      execute: async (params, context) => {
        return await this.createOrder(params);
      }
    },
    {
      name: 'update_order',
      description: 'Update an existing order',
      parameters: {
        type: 'object',
        properties: {
          order_id: { type: 'string' },
          items: { type: 'array' },
          action: { 
            type: 'string',
            enum: ['add', 'remove', 'modify']
          }
        },
        required: ['order_id', 'action']
      },
      execute: async (params, context) => {
        return await this.updateOrder(params);
      }
    },
    {
      name: 'check_item_availability',
      description: 'Check if menu items are available',
      parameters: {
        type: 'object',
        properties: {
          restaurant_id: { type: 'string' },
          item_ids: { 
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['restaurant_id', 'item_ids']
      },
      execute: async (params, context) => {
        return await this.checkItemAvailability(params);
      }
    },
    {
      name: 'request_bill',
      description: 'Request the bill for a table',
      parameters: {
        type: 'object',
        properties: {
          table_number: { type: 'string' },
          restaurant_id: { type: 'string' }
        },
        required: ['table_number', 'restaurant_id']
      },
      execute: async (params, context) => {
        return await this.requestBill(params);
      }
    }
  ];

  async execute(input: AgentInput): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      // Parse context from QR code or session
      const restaurantId = input.context?.restaurantId;
      const tableNumber = input.context?.tableNumber;

      if (!restaurantId || !tableNumber) {
        return {
          success: false,
          finalOutput: "Please scan the QR code at your table to start ordering.",
          toolsInvoked: [],
          duration: Date.now() - startTime,
        };
      }

      // Check if this is initial greeting
      if (input.context?.isNewSession) {
        return await this.handleInitialGreeting(restaurantId, tableNumber, input);
      }

      // Handle different user intents
      const query = input.query.toLowerCase();

      if (query.includes('menu') || query.includes('see') || query.includes('show')) {
        return await this.handleMenuRequest(restaurantId, input);
      }

      if (query.includes('order') || this.isOrderInput(query)) {
        return await this.handleOrderInput(restaurantId, tableNumber, query, input);
      }

      if (query.includes('bill') || query.includes('check') || query.includes('pay')) {
        return await this.handleBillRequest(restaurantId, tableNumber, input);
      }

      if (query.includes('help') || query.includes('waiter')) {
        return await this.handleHelpRequest(restaurantId, tableNumber, input);
      }

      // General conversational response
      return await this.handleConversation(restaurantId, tableNumber, query, input);

    } catch (error) {
      console.error('WaiterAgent error:', error);
      return {
        success: false,
        finalOutput: "I'm having trouble processing your request. Could you please try again or call for a human waiter?",
        toolsInvoked: [],
        duration: Date.now() - startTime,
      };
    }
  }

  private async handleInitialGreeting(
    restaurantId: string,
    tableNumber: string,
    input: AgentInput
  ): Promise<AgentResult> {
    const restaurant = await this.getRestaurantInfo(restaurantId);
    const timeOfDay = new Date().getHours();
    const greeting = timeOfDay < 12 ? 'Good morning' : 
                    timeOfDay < 17 ? 'Good afternoon' : 'Good evening';

    const message = `${greeting}! 🌟 Welcome to *${restaurant.name}*!\n\n` +
                   `I'm your AI waiter today. You're seated at *Table ${tableNumber}*.\n\n` +
                   `Here's what I can help you with:\n` +
                   `📋 View menu - Type "menu"\n` +
                   `🍽️ Place order - Type item numbers (e.g., "1, 5, 9")\n` +
                   `❓ Ask questions - I'm here to help!\n` +
                   `💳 Request bill - Type "bill"\n\n` +
                   `Would you like to see our menu?`;

    return {
      success: true,
      finalOutput: message,
      toolsInvoked: [],
      duration: Date.now() - input.context!.startTime,
    };
  }

  private async handleMenuRequest(
    restaurantId: string,
    input: AgentInput
  ): Promise<AgentResult> {
    const menu = await this.getRestaurantMenu({
      restaurant_id: restaurantId,
      category: 'all'
    });

    const formatted = this.formatMenu(menu);

    return {
      success: true,
      finalOutput: formatted,
      data: { menu },
      toolsInvoked: ['get_restaurant_menu'],
      duration: Date.now() - (input.context?.startTime || Date.now()),
    };
  }

  private async handleOrderInput(
    restaurantId: string,
    tableNumber: string,
    query: string,
    input: AgentInput
  ): Promise<AgentResult> {
    // Parse item numbers from query
    const itemNumbers = this.parseItemNumbers(query);

    if (itemNumbers.length === 0) {
      return {
        success: false,
        finalOutput: "I didn't catch which items you'd like to order. Could you please provide the item numbers? (e.g., '1, 4, 9')",
        toolsInvoked: [],
        duration: Date.now() - (input.context?.startTime || Date.now()),
      };
    }

    // Get menu items
    const menu = await this.getRestaurantMenu({
      restaurant_id: restaurantId,
      category: 'all'
    });

    const selectedItems = menu.items.filter((item: MenuItem) => 
      itemNumbers.includes(item.number)
    );

    if (selectedItems.length === 0) {
      return {
        success: false,
        finalOutput: "I couldn't find those menu items. Could you check the numbers and try again?",
        toolsInvoked: ['get_restaurant_menu'],
        duration: Date.now() - (input.context?.startTime || Date.now()),
      };
    }

    // Check availability
    const availability = await this.checkItemAvailability({
      restaurant_id: restaurantId,
      item_ids: selectedItems.map((i: MenuItem) => i.id)
    });

    const availableItems = selectedItems.filter((item: MenuItem) => 
      availability.available_items.includes(item.id)
    );

    if (availableItems.length === 0) {
      return {
        success: false,
        finalOutput: "Unfortunately, none of those items are currently available. Would you like to see alternative options?",
        toolsInvoked: ['get_restaurant_menu', 'check_item_availability'],
        duration: Date.now() - (input.context?.startTime || Date.now()),
      };
    }

    // Create order summary
    const orderSummary = this.createOrderSummary(availableItems);

    return {
      success: true,
      finalOutput: orderSummary,
      data: {
        items: availableItems,
        restaurantId,
        tableNumber
      },
      toolsInvoked: ['get_restaurant_menu', 'check_item_availability'],
      duration: Date.now() - (input.context?.startTime || Date.now()),
      requiresConfirmation: true
    };
  }

  private async handleBillRequest(
    restaurantId: string,
    tableNumber: string,
    input: AgentInput
  ): Promise<AgentResult> {
    const bill = await this.requestBill({
      restaurant_id: restaurantId,
      table_number: tableNumber
    });

    const message = `💳 *Your Bill*\n\n` +
                   `Table ${tableNumber}\n` +
                   `─────────────\n\n` +
                   bill.items.map((item: any) => 
                     `${item.quantity}x ${item.name} - ${item.total} RWF`
                   ).join('\n') +
                   `\n\n─────────────\n` +
                   `Subtotal: ${bill.subtotal} RWF\n` +
                   `Service (10%): ${bill.service_fee} RWF\n` +
                   `*Total: ${bill.total} RWF*\n\n` +
                   `Payment methods: Cash, MoMo, Card\n` +
                   `_A waiter will be with you shortly to process your payment._`;

    return {
      success: true,
      finalOutput: message,
      data: { bill },
      toolsInvoked: ['request_bill'],
      duration: Date.now() - (input.context?.startTime || Date.now()),
    };
  }

  private async handleHelpRequest(
    restaurantId: string,
    tableNumber: string,
    input: AgentInput
  ): Promise<AgentResult> {
    // Alert human staff
    this.emit('staff_alert', {
      restaurantId,
      tableNumber,
      reason: 'assistance_requested',
      priority: 'high'
    });

    return {
      success: true,
      finalOutput: "👋 I've notified our staff. A waiter will be with you shortly!",
      toolsInvoked: [],
      duration: Date.now() - (input.context?.startTime || Date.now()),
    };
  }

  private async handleConversation(
    restaurantId: string,
    tableNumber: string,
    query: string,
    input: AgentInput
  ): Promise<AgentResult> {
    // Use OpenAI for natural conversation
    const messages: any[] = [
      {
        role: 'system',
        content: this.instructions
      },
      {
        role: 'user',
        content: query
      }
    ];

    const response = await this.runCompletion(messages);
    const content = response.choices[0].message.content || "I'm here to help! What would you like?";

    return {
      success: true,
      finalOutput: content,
      toolsInvoked: [],
      duration: Date.now() - (input.context?.startTime || Date.now()),
    };
  }

  // Helper methods
  private formatMenu(menu: any): string {
    let formatted = "📋 *Our Menu*\n\n";

    const categories = this.groupByCategory(menu.items);

    for (const [category, items] of Object.entries(categories)) {
      formatted += `*${category.toUpperCase()}*\n`;
      (items as MenuItem[]).forEach(item => {
        formatted += `${item.number}. ${item.name} - ${item.price} RWF\n`;
        if (item.description) {
          formatted += `   _${item.description}_\n`;
        }
        if (item.isVegetarian) formatted += `   🥬 Vegetarian\n`;
        if (item.isSpicy) formatted += `   🌶️ Spicy\n`;
      });
      formatted += '\n';
    }

    formatted += "_To order, type the item numbers (e.g., '1, 4, 9')_";
    return formatted;
  }

  private groupByCategory(items: MenuItem[]): Record<string, MenuItem[]> {
    return items.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }

  private parseItemNumbers(query: string): number[] {
    const matches = query.match(/\d+/g);
    return matches ? matches.map(Number) : [];
  }

  private isOrderInput(query: string): boolean {
    return /^\d+([,\s]+\d+)*$/.test(query.trim());
  }

  private createOrderSummary(items: MenuItem[]): string {
    const total = items.reduce((sum, item) => sum + item.price, 0);

    let summary = "📝 *Order Summary:*\n\n";
    items.forEach(item => {
      summary += `• ${item.name} - ${item.price} RWF\n`;
    });
    summary += `\n*Total: ${total} RWF*\n\n`;
    summary += "_Reply 'confirm' to place this order or 'cancel' to start over._";

    return summary;
  }

  // Stub methods - to be implemented with database
  private async getRestaurantInfo(restaurantId: string): Promise<any> {
    return { id: restaurantId, name: 'Restaurant EasyMO' };
  }

  private async getRestaurantMenu(params: any): Promise<any> {
    // TODO: Query database
    return {
      items: [
        { id: '1', number: 1, name: 'Ugali & Fish', description: 'Traditional dish', price: 5000, category: 'Mains', available: true },
        { id: '2', number: 2, name: 'Brochettes', description: 'Grilled meat skewers', price: 3000, category: 'Mains', available: true },
        { id: '3', number: 3, name: 'Isombe', description: 'Cassava leaves', price: 2500, category: 'Sides', available: true, isVegetarian: true },
        { id: '4', number: 4, name: 'Primus', description: 'Local beer', price: 1500, category: 'Drinks', available: true },
      ]
    };
  }

  private async checkItemAvailability(params: any): Promise<any> {
    return { available_items: params.item_ids };
  }

  private async createOrder(params: any): Promise<any> {
    return { order_id: `order_${Date.now()}`, status: 'confirmed' };
  }

  private async updateOrder(params: any): Promise<any> {
    return { order_id: params.order_id, status: 'updated' };
  }

  private async requestBill(params: any): Promise<any> {
    return {
      items: [
        { name: 'Ugali & Fish', quantity: 1, total: 5000 },
        { name: 'Primus', quantity: 2, total: 3000 }
      ],
      subtotal: 8000,
      service_fee: 800,
      total: 8800
    };
  }

  protected formatSingleOption(option: any): string {
    return `${option.name} - ${option.price} RWF`;
  }

  protected calculateScore(option: any, criteria: any): number {
    return 100;
  }
}
