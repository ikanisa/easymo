/**
 * Waiter AI Tools
 * 
 * This module provides tools for the Waiter AI agent to interact with
 * restaurant data, manage orders, and provide recommendations.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface WaiterToolContext {
  supabase: SupabaseClient;
  userId: string;
  restaurantId: string;
  language?: string;
  sessionId?: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

/**
 * Tool: search_menu
 * Search menu items by name, category, dietary restrictions
 */
export async function search_menu(
  context: WaiterToolContext,
  params: {
    query?: string;
    category?: string;
    is_vegetarian?: boolean;
    is_vegan?: boolean;
    is_gluten_free?: boolean;
    is_spicy?: boolean;
  }
): Promise<ToolResult> {
  try {
    let query = context.supabase
      .from('menu_items')
      .select(`
        *,
        category:menu_categories(id, name, name_translations)
      `)
      .eq('restaurant_id', context.restaurantId)
      .eq('is_available', true);

    // Text search
    if (params.query) {
      query = query.or(`name.ilike.%${params.query}%,description.ilike.%${params.query}%`);
    }
    
    // Category filter
    if (params.category) {
      query = query.eq('category.name', params.category);
    }
    
    // Dietary filters
    if (params.is_vegetarian) query = query.eq('is_vegetarian', true);
    if (params.is_vegan) query = query.eq('is_vegan', true);
    if (params.is_gluten_free) query = query.eq('is_gluten_free', true);
    if (params.is_spicy) query = query.eq('is_spicy', true);

    const { data, error } = await query
      .order('sort_order')
      .limit(20);
    
    if (error) throw error;

    return {
      success: true,
      data: {
        items: data || [],
        count: data?.length || 0
      },
      message: `Found ${data?.length || 0} menu items`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: get_menu_item_details
 * Get detailed information about a specific menu item
 */
export async function get_menu_item_details(
  context: WaiterToolContext,
  params: { menu_item_id: string }
): Promise<ToolResult> {
  try {
    const { data, error } = await context.supabase
      .from('menu_items')
      .select(`
        *,
        category:menu_categories(name, name_translations)
      `)
      .eq('id', params.menu_item_id)
      .eq('restaurant_id', context.restaurantId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Menu item not found');

    return {
      success: true,
      data: data,
      message: `Retrieved details for ${data.name}`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: add_to_cart
 * Add an item to the current draft order
 */
export async function add_to_cart(
  context: WaiterToolContext,
  params: {
    menu_item_id: string;
    quantity: number;
    special_instructions?: string;
  }
): Promise<ToolResult> {
  try {
    // Validate quantity
    if (params.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    // Get or create draft order
    let { data: existingOrder } = await context.supabase
      .from('orders')
      .select('id, order_number')
      .eq('user_id', context.userId)
      .eq('restaurant_id', context.restaurantId)
      .eq('status', 'draft')
      .maybeSingle();

    let orderId = existingOrder?.id;
    let orderNumber = existingOrder?.order_number;

    if (!orderId) {
      // Create new draft order
      const { data: newOrder, error: orderError } = await context.supabase
        .from('orders')
        .insert({
          user_id: context.userId,
          restaurant_id: context.restaurantId,
          status: 'draft',
          language: context.language || 'en',
          session_id: context.sessionId
        })
        .select('id, order_number')
        .single();

      if (orderError) throw orderError;
      orderId = newOrder.id;
      orderNumber = newOrder.order_number;
    }

    // Get menu item details
    const { data: menuItem, error: itemError } = await context.supabase
      .from('menu_items')
      .select('id, name, name_translations, description, price, currency, is_available')
      .eq('id', params.menu_item_id)
      .single();

    if (itemError) throw itemError;
    if (!menuItem) throw new Error('Menu item not found');
    if (!menuItem.is_available) throw new Error('Menu item is currently unavailable');

    // Check if item already exists in order
    const { data: existingItem } = await context.supabase
      .from('order_items')
      .select('id, quantity')
      .eq('order_id', orderId)
      .eq('menu_item_id', params.menu_item_id)
      .maybeSingle();

    if (existingItem) {
      // Update quantity
      const { error: updateError } = await context.supabase
        .from('order_items')
        .update({
          quantity: existingItem.quantity + params.quantity,
          special_instructions: params.special_instructions || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingItem.id);

      if (updateError) throw updateError;
    } else {
      // Add new item to order
      const { error: insertError } = await context.supabase
        .from('order_items')
        .insert({
          order_id: orderId,
          menu_item_id: params.menu_item_id,
          name: menuItem.name,
          name_translations: menuItem.name_translations,
          description: menuItem.description,
          price: menuItem.price,
          quantity: params.quantity,
          special_instructions: params.special_instructions
        });

      if (insertError) throw insertError;
    }

    // Update order total
    await updateOrderTotal(context.supabase, orderId);

    // Get updated order summary
    const orderSummary = await getOrderSummary(context.supabase, orderId);

    return {
      success: true,
      data: {
        order_id: orderId,
        order_number: orderNumber,
        item_added: menuItem.name,
        quantity: params.quantity,
        order_summary: orderSummary
      },
      message: `Added ${params.quantity}x ${menuItem.name} to your order`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: view_cart
 * Get current cart contents
 */
export async function view_cart(context: WaiterToolContext): Promise<ToolResult> {
  try {
    const { data: order, error } = await context.supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .eq('user_id', context.userId)
      .eq('restaurant_id', context.restaurantId)
      .eq('status', 'draft')
      .maybeSingle();

    if (error) throw error;

    if (!order) {
      return {
        success: true,
        data: { items: [], total: 0, currency: 'USD' },
        message: 'Your cart is empty'
      };
    }

    return {
      success: true,
      data: {
        order_id: order.id,
        order_number: order.order_number,
        items: order.items || [],
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        currency: order.currency,
        item_count: order.items?.length || 0
      },
      message: `You have ${order.items?.length || 0} items in your cart`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: update_cart_item
 * Update quantity or remove an item from cart
 */
export async function update_cart_item(
  context: WaiterToolContext,
  params: {
    order_item_id: string;
    quantity?: number; // Set to 0 to remove
    special_instructions?: string;
  }
): Promise<ToolResult> {
  try {
    if (params.quantity !== undefined && params.quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }

    if (params.quantity === 0) {
      // Remove item
      const { error } = await context.supabase
        .from('order_items')
        .delete()
        .eq('id', params.order_item_id)
        .eq('order.user_id', context.userId);

      if (error) throw error;

      return {
        success: true,
        message: 'Item removed from cart'
      };
    } else {
      // Update item
      const updateData: any = { updated_at: new Date().toISOString() };
      if (params.quantity) updateData.quantity = params.quantity;
      if (params.special_instructions !== undefined) {
        updateData.special_instructions = params.special_instructions;
      }

      const { data, error } = await context.supabase
        .from('order_items')
        .update(updateData)
        .eq('id', params.order_item_id)
        .select('order_id')
        .single();

      if (error) throw error;

      // Update order total
      await updateOrderTotal(context.supabase, data.order_id);

      return {
        success: true,
        message: 'Cart updated successfully'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: send_order
 * Finalize the order for payment
 */
export async function send_order(
  context: WaiterToolContext,
  params?: { notes?: string; tip_amount?: number }
): Promise<ToolResult> {
  try {
    // Get draft order
    const { data: order, error: fetchError } = await context.supabase
      .from('orders')
      .select('id, order_number, total, items:order_items(count)')
      .eq('user_id', context.userId)
      .eq('restaurant_id', context.restaurantId)
      .eq('status', 'draft')
      .single();

    if (fetchError) throw fetchError;
    if (!order) throw new Error('No items in cart. Please add items before placing order.');

    const itemCount = order.items?.[0]?.count || 0;
    if (itemCount === 0) {
      throw new Error('Cannot place an empty order');
    }

    // Update order with tip if provided
    const updateData: any = {
      status: 'pending_payment',
      notes: params?.notes,
      updated_at: new Date().toISOString()
    };

    if (params?.tip_amount && params.tip_amount > 0) {
      updateData.tip = params.tip_amount;
      updateData.total = order.total + params.tip_amount;
    }

    const { data: updatedOrder, error: updateError } = await context.supabase
      .from('orders')
      .update(updateData)
      .eq('id', order.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return {
      success: true,
      data: {
        order_id: updatedOrder.id,
        order_number: updatedOrder.order_number,
        total: updatedOrder.total,
        currency: updatedOrder.currency,
        status: updatedOrder.status
      },
      message: `Order ${updatedOrder.order_number} is ready for payment. Total: ${updatedOrder.total} ${updatedOrder.currency}`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: recommend_wine
 * Get wine recommendations for a dish
 */
export async function recommend_wine(
  context: WaiterToolContext,
  params: { food_item: string }
): Promise<ToolResult> {
  try {
    const { data, error } = await context.supabase
      .from('wine_pairings')
      .select('*')
      .or(`food_item.ilike.%${params.food_item}%,food_category.ilike.%${params.food_item}%`)
      .order('confidence_score', { ascending: false })
      .limit(3);

    if (error) throw error;

    return {
      success: true,
      data: {
        recommendations: data || [],
        count: data?.length || 0
      },
      message: data && data.length > 0 
        ? `Found ${data.length} wine pairing recommendations` 
        : 'No specific wine pairings found, but I can recommend our house wines'
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: book_table
 * Create a table reservation
 */
export async function book_table(
  context: WaiterToolContext,
  params: {
    guest_name: string;
    party_size: number;
    reservation_date: string; // YYYY-MM-DD
    reservation_time: string; // HH:MM
    guest_phone?: string;
    guest_email?: string;
    special_requests?: string;
  }
): Promise<ToolResult> {
  try {
    // Validate inputs
    if (params.party_size <= 0) {
      throw new Error('Party size must be greater than 0');
    }

    // Check if date is in the future
    const reservationDateTime = new Date(`${params.reservation_date}T${params.reservation_time}`);
    if (reservationDateTime < new Date()) {
      throw new Error('Reservation must be in the future');
    }

    const { data, error } = await context.supabase
      .from('reservations')
      .insert({
        user_id: context.userId,
        restaurant_id: context.restaurantId,
        guest_name: params.guest_name,
        guest_phone: params.guest_phone,
        guest_email: params.guest_email,
        party_size: params.party_size,
        reservation_date: params.reservation_date,
        reservation_time: params.reservation_time,
        special_requests: params.special_requests,
        status: 'pending',
        language: context.language || 'en'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: {
        reservation_id: data.id,
        reservation_number: data.reservation_number,
        guest_name: data.guest_name,
        party_size: data.party_size,
        date: data.reservation_date,
        time: data.reservation_time,
        status: data.status
      },
      message: `Reservation ${data.reservation_number} created for ${params.party_size} guests on ${params.reservation_date} at ${params.reservation_time}`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: get_order_status
 * Check the status of an order
 */
export async function get_order_status(
  context: WaiterToolContext,
  params: { order_id: string }
): Promise<ToolResult> {
  try {
    const { data, error } = await context.supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .eq('id', params.order_id)
      .eq('user_id', context.userId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Order not found');

    return {
      success: true,
      data: {
        order_number: data.order_number,
        status: data.status,
        total: data.total,
        currency: data.currency,
        created_at: data.created_at,
        updated_at: data.updated_at,
        items: data.items
      },
      message: `Order ${data.order_number} status: ${data.status}`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

// Helper Functions
// ============================================================================

/**
 * Update order total by summing order items
 */
async function updateOrderTotal(supabase: SupabaseClient, orderId: string): Promise<void> {
  const { data: items } = await supabase
    .from('order_items')
    .select('price, quantity')
    .eq('order_id', orderId);

  const subtotal = items?.reduce((sum, item) => 
    sum + (parseFloat(String(item.price)) * item.quantity), 0) || 0;
  
  const tax = subtotal * 0.1; // 10% tax
  const { data: order } = await supabase
    .from('orders')
    .select('tip')
    .eq('id', orderId)
    .single();
  
  const tip = parseFloat(String(order?.tip || 0));
  const total = subtotal + tax + tip;

  await supabase
    .from('orders')
    .update({ 
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId);
}

/**
 * Get order summary
 */
async function getOrderSummary(supabase: SupabaseClient, orderId: string): Promise<any> {
  const { data } = await supabase
    .from('orders')
    .select('subtotal, tax, tip, total, currency')
    .eq('id', orderId)
    .single();

  return data;
}

// Payment Tools
// ============================================================================

/**
 * Tool: initiate_payment
 * Initiate a payment for an order (MoMo, Revolut, or Cash)
 */
export async function initiate_payment(
  context: WaiterToolContext,
  params: {
    order_id: string;
    payment_method: 'mtn_momo' | 'airtel_money' | 'revolut' | 'cash';
    phone_number?: string; // Required for MoMo
    revolut_link?: string; // Required for Revolut
  }
): Promise<ToolResult> {
  try {
    // Get order details
    const { data: order, error: orderError } = await context.supabase
      .from('orders')
      .select('id, order_number, total, currency, restaurant_id, status')
      .eq('id', params.order_id)
      .eq('user_id', context.userId)
      .single();

    if (orderError) throw orderError;
    if (!order) throw new Error('Order not found');
    
    if (order.status !== 'pending_payment') {
      throw new Error('Order is not ready for payment. Please finalize your order first.');
    }

    // Get restaurant payment settings
    const { data: restaurant } = await context.supabase
      .from('restaurants')
      .select('payment_settings')
      .eq('id', order.restaurant_id)
      .single();

    const paymentSettings = restaurant?.payment_settings || {};
    const acceptedMethods = paymentSettings.accepted_methods || ['mtn_momo', 'revolut', 'cash'];

    if (!acceptedMethods.includes(params.payment_method)) {
      throw new Error(`Payment method ${params.payment_method} is not accepted by this restaurant`);
    }

    let paymentData: any = {
      order_id: order.id,
      user_id: context.userId,
      provider: params.payment_method,
      amount: order.total,
      currency: order.currency,
      status: 'pending'
    };

    let instructions = '';
    let paymentUrl = null;
    let ussdCode = null;

    // Handle different payment methods
    switch (params.payment_method) {
      case 'mtn_momo':
      case 'airtel_money':
        if (!params.phone_number) {
          throw new Error('Phone number is required for mobile money payment');
        }
        
        ussdCode = params.payment_method === 'mtn_momo' 
          ? (paymentSettings.momo_ussd_code || '*182*7*1#')
          : '*185*9#';
        
        paymentData.phone_number = params.phone_number;
        paymentData.ussd_code = ussdCode;
        paymentData.payment_instructions = 
          `1. Dial ${ussdCode}\n2. Select "Send Money" or "Pay"\n3. Enter amount: ${order.total} ${order.currency}\n4. Approve the payment\n5. Click "I've Paid" below`;
        
        instructions = paymentData.payment_instructions;
        break;

      case 'revolut':
        if (!params.revolut_link) {
          // Try to get from user's saved payment methods
          const { data: savedMethod } = await context.supabase
            .from('user_payment_methods')
            .select('revolut_link')
            .eq('user_id', context.userId)
            .eq('provider', 'revolut')
            .eq('is_active', true)
            .maybeSingle();

          params.revolut_link = savedMethod?.revolut_link || paymentSettings.revolut_merchant_link;
        }

        if (!params.revolut_link) {
          throw new Error('Revolut payment link is required. Please provide your Revolut.me link.');
        }

        // Build payment URL
        paymentUrl = `${params.revolut_link}/${order.total}${order.currency}?description=Order%20${order.order_number}`;
        
        paymentData.payment_link = paymentUrl;
        paymentData.payment_instructions = 
          `1. Click "Open Revolut" below\n2. Review the payment amount\n3. Approve the payment in Revolut\n4. Return here and click "I've Paid"`;
        
        instructions = paymentData.payment_instructions;
        break;

      case 'cash':
        paymentData.payment_instructions = 
          'Please prepare cash payment. Staff will confirm when payment is received.';
        instructions = paymentData.payment_instructions;
        break;
    }

    // Create payment record
    const { data: payment, error: paymentError } = await context.supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Log payment event
    await context.supabase.rpc('log_payment_event', {
      p_payment_id: payment.id,
      p_event_type: 'initiated',
      p_event_data: { payment_method: params.payment_method }
    });

    // Update order with payment method
    await context.supabase
      .from('orders')
      .update({
        payment_method: params.payment_method,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    return {
      success: true,
      data: {
        payment_id: payment.id,
        order_id: order.id,
        order_number: order.order_number,
        amount: order.total,
        currency: order.currency,
        payment_method: params.payment_method,
        payment_url: paymentUrl,
        ussd_code: ussdCode,
        instructions: instructions,
        status: 'pending'
      },
      message: `Payment initiated. ${instructions.split('\n')[0]}`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: confirm_payment
 * User confirms they have completed the payment
 */
export async function confirm_payment(
  context: WaiterToolContext,
  params: {
    payment_id: string;
    confirmation_code?: string;
  }
): Promise<ToolResult> {
  try {
    // Get payment details
    const { data: payment, error: paymentError } = await context.supabase
      .from('payments')
      .select('*, order:orders(id, order_number, status)')
      .eq('id', params.payment_id)
      .eq('user_id', context.userId)
      .single();

    if (paymentError) throw paymentError;
    if (!payment) throw new Error('Payment not found');

    if (payment.status === 'successful') {
      return {
        success: true,
        message: 'Payment already confirmed',
        data: { status: 'successful' }
      };
    }

    if (payment.status === 'cancelled' || payment.status === 'failed') {
      throw new Error(`Cannot confirm ${payment.status} payment`);
    }

    // Update payment status to user_confirmed
    const { error: updateError } = await context.supabase
      .from('payments')
      .update({
        status: 'user_confirmed',
        confirmed_by_user_at: new Date().toISOString(),
        confirmation_method: 'manual',
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) throw updateError;

    // Log event
    await context.supabase.rpc('log_payment_event', {
      p_payment_id: payment.id,
      p_event_type: 'user_confirmed',
      p_event_data: { confirmation_code: params.confirmation_code }
    });

    // Update order status
    await context.supabase
      .from('orders')
      .update({
        status: 'paid',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.order_id);

    return {
      success: true,
      data: {
        payment_id: payment.id,
        order_id: payment.order_id,
        order_number: payment.order?.order_number,
        status: 'user_confirmed'
      },
      message: 'Payment confirmed! Your order is now being prepared.'
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: cancel_payment
 * Cancel a pending payment
 */
export async function cancel_payment(
  context: WaiterToolContext,
  params: {
    payment_id: string;
    reason?: string;
  }
): Promise<ToolResult> {
  try {
    const { data: payment, error: paymentError } = await context.supabase
      .from('payments')
      .select('id, status, order_id')
      .eq('id', params.payment_id)
      .eq('user_id', context.userId)
      .single();

    if (paymentError) throw paymentError;
    if (!payment) throw new Error('Payment not found');

    if (payment.status === 'successful') {
      throw new Error('Cannot cancel a successful payment');
    }

    // Update payment
    await context.supabase
      .from('payments')
      .update({
        status: 'cancelled',
        error_message: params.reason || 'Cancelled by user',
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    // Log event
    await context.supabase.rpc('log_payment_event', {
      p_payment_id: payment.id,
      p_event_type: 'cancelled',
      p_event_data: { reason: params.reason }
    });

    // Revert order to pending_payment
    await context.supabase
      .from('orders')
      .update({
        status: 'pending_payment',
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.order_id);

    return {
      success: true,
      message: 'Payment cancelled. You can try a different payment method.'
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: get_payment_status
 * Check status of a payment
 */
export async function get_payment_status(
  context: WaiterToolContext,
  params: {
    payment_id: string;
  }
): Promise<ToolResult> {
  try {
    const { data: payment, error } = await context.supabase
      .from('payments')
      .select(`
        *,
        order:orders(order_number, status),
        events:payment_events(event_type, created_at)
      `)
      .eq('id', params.payment_id)
      .eq('user_id', context.userId)
      .single();

    if (error) throw error;
    if (!payment) throw new Error('Payment not found');

    return {
      success: true,
      data: {
        payment_id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        created_at: payment.created_at,
        confirmed_at: payment.confirmed_by_user_at,
        order_number: payment.order?.order_number,
        order_status: payment.order?.status,
        events: payment.events
      },
      message: `Payment status: ${payment.status}`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: save_payment_method
 * Save a payment method for future use
 */
export async function save_payment_method(
  context: WaiterToolContext,
  params: {
    provider: 'mtn_momo' | 'airtel_money' | 'revolut';
    phone_number?: string;
    revolut_link?: string;
    is_default?: boolean;
  }
): Promise<ToolResult> {
  try {
    if (params.provider === 'revolut' && !params.revolut_link) {
      throw new Error('Revolut link is required');
    }
    if ((params.provider === 'mtn_momo' || params.provider === 'airtel_money') && !params.phone_number) {
      throw new Error('Phone number is required for mobile money');
    }

    const { data, error } = await context.supabase
      .from('user_payment_methods')
      .upsert({
        user_id: context.userId,
        provider: params.provider,
        phone_number: params.phone_number,
        revolut_link: params.revolut_link,
        is_default: params.is_default || false,
        is_active: true
      }, {
        onConflict: 'user_id,provider,phone_number'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: data,
      message: `Payment method saved successfully`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: get_saved_payment_methods
 * Get user's saved payment methods
 */
export async function get_saved_payment_methods(
  context: WaiterToolContext
): Promise<ToolResult> {
  try {
    const { data, error } = await context.supabase
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', context.userId)
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      data: {
        payment_methods: data || [],
        count: data?.length || 0
      },
      message: `Found ${data?.length || 0} saved payment methods`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

// Export all tools
export const waiterTools = {
  search_menu,
  get_menu_item_details,
  add_to_cart,
  view_cart,
  update_cart_item,
  send_order,
  recommend_wine,
  book_table,
  get_order_status,
  // Payment tools
  initiate_payment,
  confirm_payment,
  cancel_payment,
  get_payment_status,
  save_payment_method,
  get_saved_payment_methods
};

// Payment Tools
// ============================================================================

/**
 * Tool: initiate_payment
 * Initiate a payment for an order (MoMo, Revolut, or Cash)
 */
export async function initiate_payment(
  context: WaiterToolContext,
  params: {
    order_id: string;
    payment_method: 'mtn_momo' | 'airtel_money' | 'revolut' | 'cash';
    phone_number?: string; // Required for MoMo
    revolut_link?: string; // Required for Revolut
  }
): Promise<ToolResult> {
  try {
    // Get order details
    const { data: order, error: orderError } = await context.supabase
      .from('orders')
      .select('id, order_number, total, currency, restaurant_id, status')
      .eq('id', params.order_id)
      .eq('user_id', context.userId)
      .single();

    if (orderError) throw orderError;
    if (!order) throw new Error('Order not found');
    
    if (order.status !== 'pending_payment') {
      throw new Error('Order is not ready for payment. Please finalize your order first.');
    }

    // Get restaurant payment settings
    const { data: restaurant } = await context.supabase
      .from('restaurants')
      .select('payment_settings')
      .eq('id', order.restaurant_id)
      .single();

    const paymentSettings = restaurant?.payment_settings || {};
    const acceptedMethods = paymentSettings.accepted_methods || ['mtn_momo', 'revolut', 'cash'];

    if (!acceptedMethods.includes(params.payment_method)) {
      throw new Error(`Payment method ${params.payment_method} is not accepted by this restaurant`);
    }

    let paymentData: any = {
      order_id: order.id,
      user_id: context.userId,
      provider: params.payment_method,
      amount: order.total,
      currency: order.currency,
      status: 'pending'
    };

    let instructions = '';
    let paymentUrl = null;
    let ussdCode = null;

    // Handle different payment methods
    switch (params.payment_method) {
      case 'mtn_momo':
      case 'airtel_money':
        if (!params.phone_number) {
          throw new Error('Phone number is required for mobile money payment');
        }
        
        ussdCode = params.payment_method === 'mtn_momo' 
          ? (paymentSettings.momo_ussd_code || '*182*7*1#')
          : '*185*9#';
        
        paymentData.phone_number = params.phone_number;
        paymentData.ussd_code = ussdCode;
        paymentData.payment_instructions = 
          `1. Dial ${ussdCode}\n2. Select "Send Money" or "Pay"\n3. Enter amount: ${order.total} ${order.currency}\n4. Approve the payment\n5. Click "I've Paid" below`;
        
        instructions = paymentData.payment_instructions;
        break;

      case 'revolut':
        if (!params.revolut_link) {
          // Try to get from user's saved payment methods
          const { data: savedMethod } = await context.supabase
            .from('user_payment_methods')
            .select('revolut_link')
            .eq('user_id', context.userId)
            .eq('provider', 'revolut')
            .eq('is_active', true)
            .maybeSingle();

          params.revolut_link = savedMethod?.revolut_link || paymentSettings.revolut_merchant_link;
        }

        if (!params.revolut_link) {
          throw new Error('Revolut payment link is required. Please provide your Revolut.me link.');
        }

        // Build payment URL
        paymentUrl = `${params.revolut_link}/${order.total}${order.currency}?description=Order%20${order.order_number}`;
        
        paymentData.payment_link = paymentUrl;
        paymentData.payment_instructions = 
          `1. Click "Open Revolut" below\n2. Review the payment amount\n3. Approve the payment in Revolut\n4. Return here and click "I've Paid"`;
        
        instructions = paymentData.payment_instructions;
        break;

      case 'cash':
        paymentData.payment_instructions = 
          'Please prepare cash payment. Staff will confirm when payment is received.';
        instructions = paymentData.payment_instructions;
        break;
    }

    // Create payment record
    const { data: payment, error: paymentError } = await context.supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Log payment event
    await context.supabase.rpc('log_payment_event', {
      p_payment_id: payment.id,
      p_event_type: 'initiated',
      p_event_data: { payment_method: params.payment_method }
    });

    // Update order with payment method
    await context.supabase
      .from('orders')
      .update({
        payment_method: params.payment_method,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    return {
      success: true,
      data: {
        payment_id: payment.id,
        order_id: order.id,
        order_number: order.order_number,
        amount: order.total,
        currency: order.currency,
        payment_method: params.payment_method,
        payment_url: paymentUrl,
        ussd_code: ussdCode,
        instructions: instructions,
        status: 'pending'
      },
      message: `Payment initiated. ${instructions.split('\n')[0]}`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: confirm_payment
 * User confirms they have completed the payment
 */
export async function confirm_payment(
  context: WaiterToolContext,
  params: {
    payment_id: string;
    confirmation_code?: string;
  }
): Promise<ToolResult> {
  try {
    // Get payment details
    const { data: payment, error: paymentError } = await context.supabase
      .from('payments')
      .select('*, order:orders(id, order_number, status)')
      .eq('id', params.payment_id)
      .eq('user_id', context.userId)
      .single();

    if (paymentError) throw paymentError;
    if (!payment) throw new Error('Payment not found');

    if (payment.status === 'successful') {
      return {
        success: true,
        message: 'Payment already confirmed',
        data: { status: 'successful' }
      };
    }

    if (payment.status === 'cancelled' || payment.status === 'failed') {
      throw new Error(`Cannot confirm ${payment.status} payment`);
    }

    // Update payment status to user_confirmed
    const { error: updateError } = await context.supabase
      .from('payments')
      .update({
        status: 'user_confirmed',
        confirmed_by_user_at: new Date().toISOString(),
        confirmation_method: 'manual',
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) throw updateError;

    // Log event
    await context.supabase.rpc('log_payment_event', {
      p_payment_id: payment.id,
      p_event_type: 'user_confirmed',
      p_event_data: { confirmation_code: params.confirmation_code }
    });

    // Update order status
    await context.supabase
      .from('orders')
      .update({
        status: 'paid',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.order_id);

    return {
      success: true,
      data: {
        payment_id: payment.id,
        order_id: payment.order_id,
        order_number: payment.order?.order_number,
        status: 'user_confirmed'
      },
      message: 'Payment confirmed! Your order is now being prepared.'
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: cancel_payment
 * Cancel a pending payment
 */
export async function cancel_payment(
  context: WaiterToolContext,
  params: {
    payment_id: string;
    reason?: string;
  }
): Promise<ToolResult> {
  try {
    const { data: payment, error: paymentError } = await context.supabase
      .from('payments')
      .select('id, status, order_id')
      .eq('id', params.payment_id)
      .eq('user_id', context.userId)
      .single();

    if (paymentError) throw paymentError;
    if (!payment) throw new Error('Payment not found');

    if (payment.status === 'successful') {
      throw new Error('Cannot cancel a successful payment');
    }

    // Update payment
    await context.supabase
      .from('payments')
      .update({
        status: 'cancelled',
        error_message: params.reason || 'Cancelled by user',
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    // Log event
    await context.supabase.rpc('log_payment_event', {
      p_payment_id: payment.id,
      p_event_type: 'cancelled',
      p_event_data: { reason: params.reason }
    });

    // Revert order to pending_payment
    await context.supabase
      .from('orders')
      .update({
        status: 'pending_payment',
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.order_id);

    return {
      success: true,
      message: 'Payment cancelled. You can try a different payment method.'
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: get_payment_status
 * Check status of a payment
 */
export async function get_payment_status(
  context: WaiterToolContext,
  params: {
    payment_id: string;
  }
): Promise<ToolResult> {
  try {
    const { data: payment, error } = await context.supabase
      .from('payments')
      .select(`
        *,
        order:orders(order_number, status),
        events:payment_events(event_type, created_at)
      `)
      .eq('id', params.payment_id)
      .eq('user_id', context.userId)
      .single();

    if (error) throw error;
    if (!payment) throw new Error('Payment not found');

    return {
      success: true,
      data: {
        payment_id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        created_at: payment.created_at,
        confirmed_at: payment.confirmed_by_user_at,
        order_number: payment.order?.order_number,
        order_status: payment.order?.status,
        events: payment.events
      },
      message: `Payment status: ${payment.status}`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: save_payment_method
 * Save a payment method for future use
 */
export async function save_payment_method(
  context: WaiterToolContext,
  params: {
    provider: 'mtn_momo' | 'airtel_money' | 'revolut';
    phone_number?: string;
    revolut_link?: string;
    is_default?: boolean;
  }
): Promise<ToolResult> {
  try {
    if (params.provider === 'revolut' && !params.revolut_link) {
      throw new Error('Revolut link is required');
    }
    if ((params.provider === 'mtn_momo' || params.provider === 'airtel_money') && !params.phone_number) {
      throw new Error('Phone number is required for mobile money');
    }

    const { data, error } = await context.supabase
      .from('user_payment_methods')
      .upsert({
        user_id: context.userId,
        provider: params.provider,
        phone_number: params.phone_number,
        revolut_link: params.revolut_link,
        is_default: params.is_default || false,
        is_active: true
      }, {
        onConflict: 'user_id,provider,phone_number'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: data,
      message: `Payment method saved successfully`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Tool: get_saved_payment_methods
 * Get user's saved payment methods
 */
export async function get_saved_payment_methods(
  context: WaiterToolContext
): Promise<ToolResult> {
  try {
    const { data, error } = await context.supabase
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', context.userId)
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      data: {
        payment_methods: data || [],
        count: data?.length || 0
      },
      message: `Found ${data?.length || 0} saved payment methods`
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

// Update exports
export const waiterTools = {
  search_menu,
  get_menu_item_details,
  add_to_cart,
  view_cart,
  update_cart_item,
  send_order,
  recommend_wine,
  book_table,
  get_order_status,
  // Payment tools
  initiate_payment,
  confirm_payment,
  cancel_payment,
  get_payment_status,
  save_payment_method,
  get_saved_payment_methods
};
