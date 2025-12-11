/**
 * Waiter AI Agent
 * Handles restaurant/bar ordering, table booking, recommendations
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 * 
 * NOW DATABASE-DRIVEN:
 * - System prompt loaded from ai_agent_system_instructions table
 * - Persona loaded from ai_agent_personas table
 * - Tools loaded from ai_agent_tools table (via AgentConfigLoader)
 */

import { BaseAgent, type AgentProcessParams, type AgentResponse } from '../core/base-agent.ts';
import { DualAIProvider } from '../core/providers/dual-ai-provider.ts';
import { logStructuredEvent } from '../../_shared/observability.ts';
import {
  searchBarsNearby,
  searchBarsByName,
  getBarById,
  parseLocationMessage,
  parseSelectionNumber,
  formatBarList,
  type BarSearchResult
} from './bar-search.ts';

export class WaiterAgent extends BaseAgent {
  type = 'waiter_agent';
  name = '🍽️ Waiter AI';
  description = 'Restaurant and bar service assistant';

  private aiProvider: DualAIProvider;

  constructor() {
    super();
    this.aiProvider = new DualAIProvider();
  }

  async process(params: AgentProcessParams): Promise<AgentResponse> {
    const { message, session, supabase } = params;

    try {
      // DISCOVERY FLOW: Check if we have bar/restaurant context
      const barId = session.context?.barId || session.context?.restaurantId;
      const discoveryState = session.context?.discoveryState;

      // If no bar context and not already in discovery, start discovery
      if (!barId && !discoveryState) {
        return await this.startDiscoveryFlow(session, supabase);
      }

      // Handle discovery flow states
      if (discoveryState) {
        return await this.handleDiscoveryState(params);
      }

      // Normal flow: We have bar context, proceed with AI chat
      // Load database config and build conversation history with DB-driven prompt
      const messages = await this.buildConversationHistoryAsync(session, supabase);
      
      // Add current user message
      messages.push({
        role: 'user',
        content: message,
      });

      // Log config source for debugging
      await logStructuredEvent('WAITER_AGENT_PROCESSING', {
        sessionId: session.id,
        barId,
        configSource: this.cachedConfig?.loadedFrom || 'not_loaded',
        toolsAvailable: this.cachedConfig?.tools.length || 0,
      });

      // Generate AI response
      const aiResponse = await this.aiProvider.chat(messages, {
        temperature: 0.8, // Slightly creative for friendly service
        maxTokens: 500,
      });

      // Update conversation history
      await this.updateConversationHistory(session, message, aiResponse, supabase);

      // Log interaction
      await this.logInteraction(session, message, aiResponse, supabase, {
        agentType: this.type,
        barId,
      });

      await logStructuredEvent('WAITER_AGENT_RESPONSE', {
        sessionId: session.id,
        responseLength: aiResponse.length,
        barId,
        configSource: this.cachedConfig?.loadedFrom,
      });

      return {
        message: aiResponse,
        agentType: this.type,
        metadata: {
          model: 'gpt-5/gemini-3 (dual provider)',
          configLoadedFrom: this.cachedConfig?.loadedFrom,
          barId,
        },
      };

    } catch (error) {
      await logStructuredEvent('WAITER_AGENT_ERROR', {
        error: error instanceof Error ? error.message : String(error),
      }, 'error');

      return {
        message: "Sorry, I'm having trouble right now. Please try again or type 'menu' to go back.",
        agentType: this.type,
        metadata: {
          error: true,
        },
      };
    }
  }

  /**
   * Start the bar/restaurant discovery flow
   */
  private async startDiscoveryFlow(session: any, supabase: any): Promise<AgentResponse> {
    await logStructuredEvent('WAITER_DISCOVERY_STARTED', {
      sessionId: session.id,
    });

    return {
      message: `🍽️ Welcome to Waiter AI!

To serve you, I need to know which bar or restaurant you're at.

How would you like to find your location?

1️⃣ Share your location (I'll find nearby places)
2️⃣ Type the bar/restaurant name
3️⃣ Scan the bar's QR code

Reply with 1, 2, or 3 to continue.`,
      agentType: this.type,
      nextState: 'awaiting_discovery_choice',
      metadata: {
        discoveryState: 'awaiting_discovery_choice',
      },
    };
  }

  /**
   * Handle discovery flow state machine
   */
  private async handleDiscoveryState(params: AgentProcessParams): Promise<AgentResponse> {
    const { message, session, supabase } = params;
    const state = session.context?.discoveryState;

    switch (state) {
      case 'awaiting_discovery_choice':
        return await this.handleDiscoveryChoice(message, session, supabase);
      
      case 'awaiting_location':
        return await this.handleLocationShare(message, session, supabase);
      
      case 'awaiting_name':
        return await this.handleNameSearch(message, session, supabase);
      
      case 'awaiting_bar_selection':
        return await this.handleBarSelection(message, session, supabase);
      
      default:
        // Unknown state, restart discovery
        return await this.startDiscoveryFlow(session, supabase);
    }
  }

  /**
   * Handle user's choice of discovery method
   */
  private async handleDiscoveryChoice(message: string, session: any, supabase: any): Promise<AgentResponse> {
    const choice = message.trim();

    if (choice === '1' || choice.toLowerCase().includes('location') || choice.toLowerCase().includes('share')) {
      // Update session state
      session.context.discoveryState = 'awaiting_location';
      
      return {
        message: `📍 Great! Please share your location using the WhatsApp attachment button (📎).

Or you can type your area (e.g., "Kimihurura" or "Kigali City").`,
        agentType: this.type,
        nextState: 'awaiting_location',
        metadata: {
          discoveryState: 'awaiting_location',
        },
      };
    }

    if (choice === '2' || choice.toLowerCase().includes('name') || choice.toLowerCase().includes('type')) {
      // Update session state
      session.context.discoveryState = 'awaiting_name';
      
      return {
        message: `✏️ Please type the name of the bar or restaurant you're at.

For example: "Heaven Bar" or "Meze Fresh"`,
        agentType: this.type,
        nextState: 'awaiting_name',
        metadata: {
          discoveryState: 'awaiting_name',
        },
      };
    }

    if (choice === '3' || choice.toLowerCase().includes('qr') || choice.toLowerCase().includes('scan')) {
      return {
        message: `📷 To scan a QR code:

1. Look for the easyMO QR code at your table
2. Use your phone camera to scan it
3. Open the link that appears

The QR code will automatically connect you to this bar's menu!

If you don't have a QR code, please choose option 1 or 2 instead.`,
        agentType: this.type,
        nextState: 'awaiting_discovery_choice',
        metadata: {
          discoveryState: 'awaiting_discovery_choice',
        },
      };
    }

    // Invalid choice
    return {
      message: `Please reply with 1, 2, or 3 to choose how you'd like to find your bar/restaurant.`,
      agentType: this.type,
      nextState: 'awaiting_discovery_choice',
      metadata: {
        discoveryState: 'awaiting_discovery_choice',
      },
    };
  }

  /**
   * Handle location share or area name
   */
  private async handleLocationShare(message: string, session: any, supabase: any): Promise<AgentResponse> {
    // Try to parse coordinates from WhatsApp location message
    const coords = parseLocationMessage(message);

    if (coords) {
      // Search nearby bars
      const nearbyBars = await searchBarsNearby(supabase, coords.lat, coords.lng, 10, 5);

      if (nearbyBars.length === 0) {
        return {
          message: `😔 I couldn't find any bars or restaurants near your location.

Try typing the bar name instead, or contact support for help.`,
          agentType: this.type,
          nextState: 'awaiting_name',
          metadata: {
            discoveryState: 'awaiting_name',
          },
        };
      }

      // Store search results in session
      session.context.searchResults = nearbyBars;
      session.context.discoveryState = 'awaiting_bar_selection';
      session.context.location = coords;

      const barList = formatBarList(nearbyBars);

      return {
        message: `🍺 Found ${nearbyBars.length} bars/restaurants near you:

${barList}

Reply with the number (1-${nearbyBars.length}) to select your location.`,
        agentType: this.type,
        nextState: 'awaiting_bar_selection',
        metadata: {
          discoveryState: 'awaiting_bar_selection',
          searchResults: nearbyBars,
        },
      };
    }

    // No coordinates - treat as area name search
    return await this.handleNameSearch(message, session, supabase);
  }

  /**
   * Handle bar name search
   */
  private async handleNameSearch(message: string, session: any, supabase: any): Promise<AgentResponse> {
    const searchTerm = message.trim();

    if (searchTerm.length < 2) {
      return {
        message: `Please enter at least 2 characters to search for a bar/restaurant name.`,
        agentType: this.type,
        nextState: 'awaiting_name',
        metadata: {
          discoveryState: 'awaiting_name',
        },
      };
    }

    const matchingBars = await searchBarsByName(supabase, searchTerm, 5);

    if (matchingBars.length === 0) {
      return {
        message: `🔍 No bars or restaurants found matching "${searchTerm}".

Try:
• A different spelling
• Just the first part of the name
• Sharing your location instead (reply "location")`,
        agentType: this.type,
        nextState: 'awaiting_name',
        metadata: {
          discoveryState: 'awaiting_name',
        },
      };
    }

    if (matchingBars.length === 1) {
      // Auto-select single match
      return await this.selectBar(matchingBars[0].id, matchingBars[0].name, session, supabase);
    }

    // Multiple matches - let user choose
    session.context.searchResults = matchingBars;
    session.context.discoveryState = 'awaiting_bar_selection';

    const barList = formatBarList(matchingBars);

    return {
      message: `🔍 Found ${matchingBars.length} matches:

${barList}

Reply with the number (1-${matchingBars.length}) to select.`,
      agentType: this.type,
      nextState: 'awaiting_bar_selection',
      metadata: {
        discoveryState: 'awaiting_bar_selection',
        searchResults: matchingBars,
      },
    };
  }

  /**
   * Handle bar selection from search results
   */
  private async handleBarSelection(message: string, session: any, supabase: any): Promise<AgentResponse> {
    const selectionNum = parseSelectionNumber(message);

    if (!selectionNum) {
      return {
        message: `Please reply with a number (1-5) to select your bar/restaurant.`,
        agentType: this.type,
        nextState: 'awaiting_bar_selection',
        metadata: {
          discoveryState: 'awaiting_bar_selection',
        },
      };
    }

    const searchResults = session.context?.searchResults || [];

    if (selectionNum < 1 || selectionNum > searchResults.length) {
      return {
        message: `Please select a number between 1 and ${searchResults.length}.`,
        agentType: this.type,
        nextState: 'awaiting_bar_selection',
        metadata: {
          discoveryState: 'awaiting_bar_selection',
        },
      };
    }

    const selectedBar = searchResults[selectionNum - 1];
    return await this.selectBar(selectedBar.id, selectedBar.name, session, supabase);
  }

  /**
   * Select a bar and initialize session
   */
  private async selectBar(barId: string, barName: string, session: any, supabase: any): Promise<AgentResponse> {
    // Get full bar details
    const bar = await getBarById(supabase, barId);

    if (!bar) {
      return {
        message: `Sorry, I couldn't load the details for that bar. Please try again or contact support.`,
        agentType: this.type,
        nextState: 'awaiting_name',
        metadata: {
          discoveryState: 'awaiting_name',
        },
      };
    }

    // Update session with bar context
    session.context = {
      barId: bar.id,
      restaurantId: bar.id, // Use same ID for both
      barName: bar.name,
      entryMethod: 'discovery',
      discoveryState: null, // Clear discovery state
      searchResults: null, // Clear search results
    };

    await logStructuredEvent('WAITER_BAR_SELECTED', {
      sessionId: session.id,
      barId: bar.id,
      barName: bar.name,
      entryMethod: 'discovery',
    });

    const area = bar.city_area ? ` in ${bar.city_area}` : '';
    const location = bar.location_text ? `\n📍 ${bar.location_text}` : '';

    return {
      message: `🍽️ Welcome to **${bar.name}**${area}!${location}

I'm your virtual waiter. How can I help you today?

You can:
• Ask about the menu
• Place an order
• Get recommendations
• Check what's popular

What would you like to know?`,
      agentType: this.type,
      nextState: null,
      metadata: {
        barId: bar.id,
        barName: bar.name,
        discoveryState: null,
      },
    };
  }

  /**
   * Default system prompt - fallback if database config not available
   */
  getDefaultSystemPrompt(): string {
    return `You are a friendly and professional waiter AI assistant at easyMO restaurants and bars.

Your role:
- Help customers browse menus and place food/drink orders
- Provide recommendations based on preferences
- Answer questions about dishes, ingredients, prices
- Handle table reservations and bookings
- Process orders and confirm details
- Provide excellent customer service

Guidelines:
- Be warm, friendly, and professional
- Ask clarifying questions when needed
- Suggest popular items or chef specials
- Mention any promotions or deals
- Confirm order details before finalizing
- Provide estimated preparation/delivery times
- Handle allergies and dietary restrictions carefully

Current capabilities:
- Browse restaurant menus
- Place orders (food & drinks)
- Make table reservations
- Get recommendations
- Check order status
- Process payments via mobile money

Keep responses concise and helpful. Always end with a clear next step or question.
Type "menu" to return to main services menu.`;
  }
}
