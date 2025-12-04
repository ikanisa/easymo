/**
 * Commerce Agent Base Class
 *
 * Base class for all commerce-related agents including:
 * - Marketplace Agent
 * - Waiter Agent (restaurant ordering)
 * - Farmer Agent (agricultural marketplace)
 * - Buy & Sell Agent
 *
 * Provides common commerce functionality:
 * - Product search and inventory
 * - Order creation and management
 * - Payment processing
 * - Delivery tracking
 *
 * @packageDocumentation
 */

import { AgentBase, AgentConfig, AgentInput, AgentResult } from '../core/agent-base.js';
import type { Tool, ToolContext } from '../types/index.js';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Product query parameters
 */
export interface ProductQuery {
  /** Search query text */
  query: string;
  /** Category filter */
  category?: string;
  /** Minimum price */
  minPrice?: number;
  /** Maximum price */
  maxPrice?: number;
  /** Location for local products */
  location?: string;
  /** Maximum results */
  limit?: number;
}

/**
 * Product information
 */
export interface Product {
  /** Product ID */
  id: string;
  /** Product name */
  name: string;
  /** Description */
  description?: string;
  /** Price */
  price: number;
  /** Currency code */
  currency: string;
  /** Category */
  category?: string;
  /** Available quantity */
  quantity: number;
  /** Seller ID */
  sellerId?: string;
  /** Image URL */
  imageUrl?: string;
  /** Unit of measure */
  unit?: string;
}

/**
 * Order item
 */
export interface OrderItem {
  /** Product ID */
  productId: string;
  /** Quantity */
  quantity: number;
  /** Unit price */
  unitPrice: number;
  /** Special notes */
  notes?: string;
}

/**
 * Order information
 */
export interface Order {
  /** Order ID */
  id: string;
  /** Customer ID */
  customerId: string;
  /** Order items */
  items: OrderItem[];
  /** Total amount */
  total: number;
  /** Currency */
  currency: string;
  /** Order status */
  status: OrderStatus;
  /** Delivery address */
  deliveryAddress?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Estimated delivery */
  estimatedDelivery?: Date;
}

/**
 * Order status
 */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'in_delivery'
  | 'delivered'
  | 'cancelled';

/**
 * Payment result
 */
export interface PaymentResult {
  /** Whether payment succeeded */
  success: boolean;
  /** Transaction ID */
  transactionId?: string;
  /** Error message if failed */
  error?: string;
  /** Payment method used */
  paymentMethod?: string;
}

// ============================================================================
// COMMERCE AGENT BASE CLASS
// ============================================================================

/**
 * Base class for commerce-related agents
 *
 * Provides common functionality for marketplace, waiter, farmer,
 * and buy & sell agents.
 */
export abstract class CommerceAgentBase extends AgentBase {
  // Commerce-specific tools - to be populated by subclasses
  protected inventoryTools: Tool[] = [];
  protected orderTools: Tool[] = [];
  protected paymentTools: Tool[] = [];

  constructor(config?: AgentConfig) {
    super(config);
  }

  /**
   * Default execute implementation using ReAct pattern
   */
  async execute(input: AgentInput): Promise<AgentResult> {
    this.log('COMMERCE_EXECUTE_START', {
      userId: input.userId,
      conversationId: input.conversationId,
    });

    // Load memory
    const memoryContext = await this.loadMemory(
      input.userId,
      input.conversationId,
      input.message,
    );

    // Build messages
    const messages = this.buildMessages(input, memoryContext);

    // Create context
    const context = {
      userId: input.userId,
      conversationId: input.conversationId,
      agentName: this.name,
      variables: input.context,
      correlationId: this.correlationId,
    };

    // Execute with ReAct pattern
    const result = await this.executeReAct(messages, context);

    // Save to memory
    await this.saveMemory(
      input.userId,
      input.conversationId,
      input.message,
      result.message,
    );

    return result;
  }

  // ========================================================================
  // COMMERCE-SPECIFIC METHODS
  // ========================================================================

  /**
   * Search for products
   */
  protected async searchProducts(
    query: ProductQuery,
    context: ToolContext,
  ): Promise<Product[]> {
    this.log('SEARCH_PRODUCTS', { query });

    try {
      // This would typically call a Supabase or API endpoint
      // Subclasses can override for specific implementations
      const products = await this.doProductSearch(query, context);

      this.log('SEARCH_PRODUCTS_RESULT', { count: products.length });
      return products;
    } catch (error) {
      this.log('SEARCH_PRODUCTS_ERROR', { error: String(error) });
      return [];
    }
  }

  /**
   * Create an order
   */
  protected async createOrder(
    items: OrderItem[],
    customerId: string,
    context: ToolContext,
  ): Promise<Order | null> {
    this.log('CREATE_ORDER', { itemCount: items.length, customerId });

    try {
      // Calculate total
      const total = items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );

      // Create order - this would call Supabase
      const order = await this.doCreateOrder(
        {
          customerId,
          items,
          total,
        },
        context,
      );

      this.log('CREATE_ORDER_SUCCESS', { orderId: order.id });
      return order;
    } catch (error) {
      this.log('CREATE_ORDER_ERROR', { error: String(error) });
      return null;
    }
  }

  /**
   * Process payment for an order
   */
  protected async processPayment(
    orderId: string,
    amount: number,
    paymentMethod: string,
    context: ToolContext,
  ): Promise<PaymentResult> {
    this.log('PROCESS_PAYMENT', { orderId, amount, paymentMethod });

    try {
      // Process payment - would integrate with MoMo, etc.
      const result = await this.doProcessPayment(
        { orderId, amount, paymentMethod },
        context,
      );

      this.log('PROCESS_PAYMENT_RESULT', {
        success: result.success,
        transactionId: result.transactionId,
      });
      return result;
    } catch (error) {
      this.log('PROCESS_PAYMENT_ERROR', { error: String(error) });
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Track order status
   */
  protected async trackOrder(
    orderId: string,
    context: ToolContext,
  ): Promise<OrderStatus | null> {
    this.log('TRACK_ORDER', { orderId });

    try {
      const status = await this.doTrackOrder(orderId, context);
      this.log('TRACK_ORDER_RESULT', { orderId, status });
      return status;
    } catch (error) {
      this.log('TRACK_ORDER_ERROR', { error: String(error) });
      return null;
    }
  }

  /**
   * Check inventory for a product
   */
  protected async checkInventory(
    productId: string,
    context: ToolContext,
  ): Promise<number> {
    try {
      const quantity = await this.doCheckInventory(productId, context);
      return quantity;
    } catch (error) {
      this.log('CHECK_INVENTORY_ERROR', { productId, error: String(error) });
      return 0;
    }
  }

  /**
   * Format price for display
   */
  protected formatPrice(amount: number, currency: string = 'RWF'): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    });
    return formatter.format(amount);
  }

  /**
   * Calculate order subtotal
   */
  protected calculateSubtotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  // ========================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ========================================================================

  /**
   * Perform actual product search
   */
  protected abstract doProductSearch(
    query: ProductQuery,
    context: ToolContext,
  ): Promise<Product[]>;

  /**
   * Perform actual order creation
   */
  protected abstract doCreateOrder(
    orderData: {
      customerId: string;
      items: OrderItem[];
      total: number;
      deliveryAddress?: string;
    },
    context: ToolContext,
  ): Promise<Order>;

  /**
   * Perform actual payment processing
   */
  protected abstract doProcessPayment(
    paymentData: {
      orderId: string;
      amount: number;
      paymentMethod: string;
    },
    context: ToolContext,
  ): Promise<PaymentResult>;

  /**
   * Perform actual order tracking
   */
  protected abstract doTrackOrder(
    orderId: string,
    context: ToolContext,
  ): Promise<OrderStatus>;

  /**
   * Perform actual inventory check
   */
  protected abstract doCheckInventory(
    productId: string,
    context: ToolContext,
  ): Promise<number>;
}
