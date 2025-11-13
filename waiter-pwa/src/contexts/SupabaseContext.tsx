import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

const log = console

interface SupabaseContextType {
  supabase: SupabaseClient
  userId: string | null
  isAnonymous: boolean
  realtimeChannel: RealtimeChannel | null
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined)

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() =>
    createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    )
  )

  const [userId, setUserId] = useState<string | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null)

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          const { data, error } = await supabase.auth.signInAnonymously()
          if (error) throw error
          
          log.info('[Auth] Anonymous sign in success', data.user?.id)
          setUserId(data.user?.id || null)
        } else {
          setUserId(session.user.id)
          setIsAnonymous(session.user.is_anonymous === true)
        }

        const channel = supabase.channel('app-updates')
        setRealtimeChannel(channel)

      } catch (error) {
        log.error('[Auth] Error', error)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        log.info('[Auth] State change', event)
        setUserId(session?.user?.id || null)
        setIsAnonymous(session?.user?.is_anonymous === true)
      }
    )

    return () => {
      subscription.unsubscribe()
      realtimeChannel?.unsubscribe()
    }
  }, [supabase])

  return (
    <SupabaseContext.Provider value={{ supabase, userId, isAnonymous, realtimeChannel }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase must be used within SupabaseProvider')
  }
  return context
}
