"use client"

import type { SupabaseClient } from '@supabase/supabase-js'
import { createContext, useContext, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const Context = createContext<SupabaseClient | null>(null)

export function SupabaseProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [supabase] = useState(() => createClient())

  return (
    <Context.Provider value={supabase}>
      {children}
    </Context.Provider>
  )
}

export const useSupabase = (): SupabaseClient => {
  const supabase = useContext(Context)
  
  if (supabase === null) {
    throw new Error('useSupabase must be used within a SupabaseProvider with a valid client')
  }

  return supabase
}
