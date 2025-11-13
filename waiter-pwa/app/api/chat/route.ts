import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This API route acts as a proxy to the Supabase Edge Function
// which handles the AI agent logic
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, conversation_id, metadata } = body

    if (!content || !conversation_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Get conversation to get language
    const { data: conversation } = await supabase
      .from('conversations')
      .select('language')
      .eq('id', conversation_id)
      .single()

    // Call the waiter-ai edge function
    const { data, error } = await supabase.functions.invoke('waiter-ai', {
      body: {
        conversation_id,
        user_message: content,
        language: conversation?.language || 'en',
        metadata,
      },
    })

    if (error) {
      console.error('Edge function error:', error)
      // Return a fallback response if edge function fails
      const fallbackResponse = getFallbackResponse(content, conversation?.language || 'en')
      
      // Save fallback message to database
      const { data: assistantMessage } = await supabase
        .from('messages')
        .insert({
          conversation_id,
          role: 'assistant',
          content: fallbackResponse,
          metadata: { fallback: true },
        })
        .select()
        .single()

      return NextResponse.json({
        success: true,
        assistant_reply: assistantMessage,
        fallback: true,
      })
    }

    return NextResponse.json({
      success: true,
      assistant_reply: data.assistant_message,
      tool_results: data.tool_results,
    })
  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Fallback responses when edge function is unavailable
function getFallbackResponse(userMessage: string, language: string): string {
  const lowerMessage = userMessage.toLowerCase()

  // Detect intent
  if (lowerMessage.includes('menu') || lowerMessage.includes('carte')) {
    return getFallbackByLang(language, {
      en: "I'd be happy to show you our menu! However, I'm currently experiencing a technical issue. You can view our full menu by tapping the 'Menu' button at the top of the screen.",
      fr: "Je serais ravi de vous montrer notre carte! Cependant, je rencontre actuellement un problème technique. Vous pouvez consulter notre carte complète en appuyant sur le bouton 'Menu' en haut de l'écran.",
      es: "¡Me encantaría mostrarte nuestro menú! Sin embargo, estoy experimentando un problema técnico. Puedes ver nuestro menú completo tocando el botón 'Menú' en la parte superior de la pantalla.",
      pt: "Eu adoraria mostrar-lhe o nosso menu! No entanto, estou tendo um problema técnico. Você pode ver nosso menu completo tocando no botão 'Menu' na parte superior da tela.",
      de: "Ich würde Ihnen gerne unsere Speisekarte zeigen! Ich habe jedoch derzeit ein technisches Problem. Sie können unsere vollständige Speisekarte anzeigen, indem Sie oben auf dem Bildschirm auf die Schaltfläche 'Menü' tippen.",
    })
  }

  if (lowerMessage.includes('order') || lowerMessage.includes('commande')) {
    return getFallbackByLang(language, {
      en: "I'm ready to take your order! However, I'm experiencing a brief technical issue. Could you please try again in a moment?",
      fr: "Je suis prêt à prendre votre commande! Cependant, je rencontre un problème technique. Pourriez-vous réessayer dans un instant?",
      es: "¡Estoy listo para tomar tu pedido! Sin embargo, estoy experimentando un problema técnico. ¿Podrías intentarlo de nuevo en un momento?",
      pt: "Estou pronto para anotar seu pedido! No entanto, estou tendo um problema técnico. Você poderia tentar novamente daqui a pouco?",
      de: "Ich bin bereit, Ihre Bestellung aufzunehmen! Ich habe jedoch ein technisches Problem. Könnten Sie es bitte in einem Moment noch einmal versuchen?",
    })
  }

  // Default fallback
  return getFallbackByLang(language, {
    en: "I apologize, but I'm experiencing a temporary technical issue. Please try again in a moment, or feel free to browse our menu in the meantime.",
    fr: "Je m'excuse, mais je rencontre un problème technique temporaire. Veuillez réessayer dans un instant ou consultez notre carte en attendant.",
    es: "Lo siento, pero estoy experimentando un problema técnico temporal. Por favor, inténtalo de nuevo en un momento o explora nuestro menú mientras tanto.",
    pt: "Peço desculpas, mas estou tendo um problema técnico temporário. Por favor, tente novamente daqui a pouco ou sinta-se à vontade para navegar em nosso menu enquanto isso.",
    de: "Entschuldigung, aber ich habe ein vorübergehendes technisches Problem. Bitte versuchen Sie es in einem Moment noch einmal oder durchsuchen Sie in der Zwischenzeit unsere Speisekarte.",
  })
}

function getFallbackByLang(
  language: string,
  translations: Record<string, string>
): string {
  return translations[language] || translations.en
}
