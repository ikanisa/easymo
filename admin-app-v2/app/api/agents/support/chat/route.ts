import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message, conversationId } = await req.json();

    if (!message || !conversationId) {
      return NextResponse.json(
        { error: "Message and conversationId are required" },
        { status: 400 }
      );
    }

    // Get Supabase credentials from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase credentials");
      return NextResponse.json(
        { error: "Service configuration error" },
        { status: 500 }
      );
    }

    // Call the unified AI agent webhook
    const webhookUrl = `${supabaseUrl}/functions/v1/wa-webhook-unified`;
    
    // Create a simulated WhatsApp message payload for the support agent
    const phoneNumber = conversationId.replace(/[^0-9]/g, ''); // Extract just numbers
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "admin-desktop-app",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "+250788123456",
                  phone_number_id: "admin-desktop"
                },
                messages: [
                  {
                    from: phoneNumber.length > 5 ? phoneNumber : "250788000000",
                    id: `admin_msg_${Date.now()}`,
                    timestamp: timestamp,
                    type: "text",
                    text: {
                      body: message
                    },
                    context: {
                      from_admin_panel: true,
                      force_agent: "support"
                    }
                  }
                ]
              },
              field: "messages"
            }
          ]
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "X-Admin-Panel": "true",
        "X-Force-Agent": "support",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Webhook error:", errorText);
      throw new Error(`Webhook failed: ${response.status}`);
    }

    const data = await response.json();

    // Extract the assistant's response from various possible response formats
    let assistantMessage: string;
    
    if (data.agentResponse) {
      assistantMessage = data.agentResponse;
    } else if (data.response) {
      assistantMessage = data.response;
    } else if (data.message) {
      assistantMessage = data.message;
    } else if (data.reply) {
      assistantMessage = data.reply;
    } else if (data.text) {
      assistantMessage = data.text;
    } else {
      // Fallback to generated response
      assistantMessage = generateFallbackResponse(message);
    }

    return NextResponse.json({
      message: assistantMessage,
      conversationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in support chat:", error);
    return NextResponse.json(
      { 
        error: "Failed to process message",
        message: generateFallbackResponse("error")
      },
      { status: 500 }
    );
  }
}

function generateFallbackResponse(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("price") || lowerMessage.includes("cost") || lowerMessage.includes("pricing")) {
    return `Thank you for your interest in easyMO pricing!

Our platform offers flexible pricing based on your needs:

**For Users:**
- Property search & rental: Free to search, small booking fee
- Job board: Free for job seekers
- Marketplace: Free listing, small transaction fee
- Rides: Pay-per-ride, competitive rates

**For Businesses:**
- Property owners: Commission on successful rentals
- Employers: Per-job posting or subscription plans
- Vendors: Marketplace commission
- Restaurant partners: Per-order fee

For detailed pricing and enterprise packages, please contact:
📧 sales@easymo.rw
📱 WhatsApp: +250 788 123 456`;
  }

  if (lowerMessage.includes("partner") || lowerMessage.includes("marketing") || lowerMessage.includes("advertise")) {
    return `Great to hear you're interested in partnering with easyMO!

We offer several partnership opportunities:

**Partnership Types:**
1. **Business Integration** - Add your services to our platform
2. **Referral Program** - Earn commissions referring users/businesses
3. **Marketing Collaboration** - Co-marketing opportunities
4. **API Access** - Integrate easyMO into your systems
5. **White Label** - Custom-branded solutions

**Next Steps:**
Let's schedule a call to discuss your specific needs!

📧 partnerships@easymo.rw
📱 WhatsApp: +250 788 123 456
🌐 Visit: www.easymo.rw/partners`;
  }

  if (lowerMessage.includes("marketplace") || lowerMessage.includes("sell") || lowerMessage.includes("buy")) {
    return `The easyMO Marketplace connects buyers and sellers across Rwanda!

**What You Can Trade:**
- Electronics & gadgets
- Furniture & home goods
- Vehicles & auto parts
- Fashion & accessories
- Services & skills

**How It Works:**
1. List your item/service via WhatsApp
2. We verify and publish your listing
3. Buyers find you through search
4. Complete transaction safely
5. Rate each other

To list an item or browse marketplace, message us on WhatsApp: +250 788 123 456`;
  }

  return `Thank you for reaching out to easyMO Support!

I can help you with:
• **Sales** - Pricing, packages, and subscriptions
• **Marketing** - Partnerships and advertising
• **Support** - Technical help and account issues
• **Marketplace** - Buying and selling on our platform

Please provide more details about what you need help with, or contact us directly:

📧 support@easymo.rw
📱 WhatsApp: +250 788 123 456
🕐 Available 24/7`;
}
