'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export type PaymentMethod = 'momo' | 'revolut' | 'card'
export type PaymentStatus = 'idle' | 'processing' | 'successful' | 'failed' | 'pending'

interface Payment {
  id: string
  order_id: string
  amount: number
  currency: string
  method: PaymentMethod
  status: PaymentStatus
  provider_transaction_id?: string
  created_at: string
}

interface PaymentContextType {
  currentPayment: Payment | null
  isProcessing: boolean
  error: string | null
  initiateMoMoPayment: (orderId: string, amount: number, phoneNumber: string, currency?: string) => Promise<Payment | null>
  initiateRevolutPayment: (orderId: string, amount: number, currency?: string) => Promise<{ checkoutUrl?: string; widgetId?: string } | null>
  checkPaymentStatus: (paymentId: string) => Promise<PaymentStatus>
  clearError: () => void
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined)

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [currentPayment, setCurrentPayment] = useState<Payment | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initiateMoMoPayment = useCallback(async (
    orderId: string,
    amount: number,
    phoneNumber: string,
    currency = 'XAF'
  ): Promise<Payment | null> => {
    setIsProcessing(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Call MoMo charge function
      const { data, error: functionError } = await supabase.functions.invoke('momo_charge', {
        body: {
          orderId,
          userId: user.id,
          phoneNumber,
          amount,
          currency
        }
      })

      if (functionError) throw functionError

      if (data.payment) {
        setCurrentPayment(data.payment)
        return data.payment
      }

      throw new Error('Failed to initiate MoMo payment')
    } catch (err: any) {
      console.error('MoMo payment error:', err)
      setError(err.message || 'Failed to process MoMo payment')
      return null
    } finally {
      setIsProcessing(false)
    }
  }, [supabase])

  const initiateRevolutPayment = useCallback(async (
    orderId: string,
    amount: number,
    currency = 'EUR'
  ): Promise<{ checkoutUrl?: string; widgetId?: string } | null> => {
    setIsProcessing(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Call Revolut charge function
      const { data, error: functionError } = await supabase.functions.invoke('revolut_charge', {
        body: {
          orderId,
          userId: user.id,
          amount,
          currency
        }
      })

      if (functionError) throw functionError

      if (data.payment) {
        setCurrentPayment(data.payment)
      }

      return {
        checkoutUrl: data.checkoutUrl,
        widgetId: data.widgetId
      }
    } catch (err: any) {
      console.error('Revolut payment error:', err)
      setError(err.message || 'Failed to process Revolut payment')
      return null
    } finally {
      setIsProcessing(false)
    }
  }, [supabase])

  const checkPaymentStatus = useCallback(async (paymentId: string): Promise<PaymentStatus> => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('status')
        .eq('id', paymentId)
        .single()

      if (error) throw error

      return data.status as PaymentStatus
    } catch (err: any) {
      console.error('Failed to check payment status:', err)
      return 'failed'
    }
  }, [supabase])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <PaymentContext.Provider
      value={{
        currentPayment,
        isProcessing,
        error,
        initiateMoMoPayment,
        initiateRevolutPayment,
        checkPaymentStatus,
        clearError,
      }}
    >
      {children}
    </PaymentContext.Provider>
  )
}

export function usePayment() {
  const context = useContext(PaymentContext)
  if (context === undefined) {
    throw new Error('usePayment must be used within a PaymentProvider')
  }
  return context
}
