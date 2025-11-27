/**
 * USSD Payment Integration for Farmer Transactions
 * Primary payment method using tel: links for MTN Mobile Money
 */

interface USSDPaymentRequest {
  buyerPhone: string;
  farmerPhone: string;
  amount: number;
  listingId: string;
  commodity: string;
  quantity: number;
  unit: string;
}

interface USSDPaymentResponse {
  success: boolean;
  ussdCode: string;
  telLink: string;
  instructions: string;
  paymentId: string;
  expiresAt: string;
}

interface PaymentStatus {
  id: string;
  status: 'pending' | 'initiated' | 'completed' | 'failed' | 'expired';
  amount: number;
  buyerPhone: string;
  farmerPhone: string;
  listingId: string;
  createdAt: string;
  completedAt?: string;
}

export class USSDPaymentService {
  /**
   * Generate USSD payment request for produce purchase
   */
  async initiateProducePayment(
    request: USSDPaymentRequest,
  ): Promise<USSDPaymentResponse> {
    const { buyerPhone, farmerPhone, amount, listingId, commodity, quantity, unit } = request;

    // Generate unique payment ID
    const paymentId = crypto.randomUUID();

    // MTN Mobile Money USSD code format: *182*8*1*AMOUNT#
    const ussdCode = `*182*8*1*${amount}#`;

    // tel: link for automatic dialing
    const telLink = `tel:${encodeURIComponent(ussdCode)}`;

    // Calculate expiry (30 minutes from now)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Instructions in Kinyarwanda and English
    const instructions = this.formatPaymentInstructions(
      amount,
      commodity,
      quantity,
      unit,
      ussdCode,
    );

    // Store pending payment in database
    await this.storePendingPayment({
      id: paymentId,
      listingId,
      buyerPhone,
      farmerPhone,
      amount,
      ussdCode,
      status: 'pending',
      expiresAt,
    });

    return {
      success: true,
      ussdCode,
      telLink,
      instructions,
      paymentId,
      expiresAt,
    };
  }

  /**
   * Format payment instructions for WhatsApp
   */
  private formatPaymentInstructions(
    amount: number,
    commodity: string,
    quantity: number,
    unit: string,
    ussdCode: string,
  ): string {
    return `💰 *Payment for ${commodity}*

📦 Quantity: ${quantity} ${unit}
💵 Amount: ${amount.toLocaleString()} RWF

*To complete payment:*

*Option 1: Automatic (Click to Dial)*
👆 Click the link below to automatically dial:
${ussdCode}

*Option 2: Manual Dial*
📱 Dial: ${ussdCode}
   1. Enter your MTN Mobile Money PIN
   2. Confirm the payment

*Kinyarwanda:*
📱 Kanda: ${ussdCode}
   1. Injiza PIN yawe ya Mobile Money
   2. Emeza kwishyura

⏱️ Payment expires in 30 minutes
✅ Farmer will be notified once payment is confirmed`;
  }

  /**
   * Store pending payment in database
   */
  private async storePendingPayment(payment: any): Promise<void> {
    // This would integrate with Supabase
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    await supabase.from('farmer_payments').insert({
      id: payment.id,
      listing_id: payment.listingId,
      buyer_phone: payment.buyerPhone,
      farmer_phone: payment.farmerPhone,
      amount: payment.amount,
      ussd_code: payment.ussdCode,
      status: payment.status,
      expires_at: payment.expiresAt,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Manual payment confirmation by buyer
   */
  async confirmPayment(paymentId: string, reference: string): Promise<boolean> {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    // Update payment status
    const { error } = await supabase
      .from('farmer_payments')
      .update({
        status: 'completed',
        payment_reference: reference,
        completed_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (error) {
      console.error('Payment confirmation error:', error);
      return false;
    }

    // Notify farmer
    const { data: payment } = await supabase
      .from('farmer_payments')
      .select('*, listing:farmer_listings(*)')
      .eq('id', paymentId)
      .single();

    if (payment) {
      await this.notifyFarmerPaymentReceived(payment);
    }

    return true;
  }

  /**
   * Notify farmer of payment received
   */
  private async notifyFarmerPaymentReceived(payment: any): Promise<void> {
    const message = `✅ *Payment Received!*

💰 Amount: ${payment.amount.toLocaleString()} RWF
📦 Commodity: ${payment.listing.commodity}
📱 Buyer: ${payment.buyer_phone}

*Kinyarwanda:*
✅ Amafaranga yashyizwe!
💰 Amafaranga: ${payment.amount.toLocaleString()} RWF

Next step: Prepare produce for pickup/delivery.`;

    // Send WhatsApp message to farmer
    // This would integrate with your WhatsApp sending function
    console.log('Farmer notification:', message);
  }

  /**
   * Check payment status
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    const { data, error } = await supabase
      .from('farmer_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      status: data.status,
      amount: data.amount,
      buyerPhone: data.buyer_phone,
      farmerPhone: data.farmer_phone,
      listingId: data.listing_id,
      createdAt: data.created_at,
      completedAt: data.completed_at,
    };
  }

  /**
   * Generate clickable tel: link for WhatsApp
   */
  generateTelLink(amount: number): string {
    const ussdCode = `*182*8*1*${amount}#`;
    return `tel:${encodeURIComponent(ussdCode)}`;
  }

  /**
   * Alternative USSD codes for different operators
   */
  getUSSDCodeByOperator(operator: 'mtn' | 'airtel' | 'tigo', amount: number): string {
    const codes = {
      mtn: `*182*8*1*${amount}#`, // MTN Mobile Money
      airtel: `*500*1*1*${amount}#`, // Airtel Money
      tigo: `*150*00*${amount}#`, // Tigo Cash
    };

    return codes[operator] || codes.mtn;
  }

  /**
   * Format complete transaction message with tel: link
   */
  formatTransactionMessage(
    commodity: string,
    quantity: number,
    unit: string,
    pricePerUnit: number,
    farmerName: string,
    farmerPhone: string,
  ): string {
    const totalAmount = quantity * pricePerUnit;
    const telLink = this.generateTelLink(totalAmount);

    return `🌾 *Confirm Purchase*

📦 ${commodity} - ${quantity} ${unit}
💵 Price: ${pricePerUnit.toLocaleString()} RWF/${unit}
💰 Total: ${totalAmount.toLocaleString()} RWF

👨‍🌾 Farmer: ${farmerName}
📱 Contact: ${farmerPhone}

*Payment Method: MTN Mobile Money*

👇 *Click to pay now:*
${telLink}

Or manually dial: *182*8*1*${totalAmount}#

*Amakuru mu Kinyarwanda:*
Kanda kugirango wishyure: ${telLink}
Cyangwa kanda: *182*8*1*${totalAmount}#

After payment, reply with:
"PAID [reference number]"

Example: PAID MP123456`;
  }
}
