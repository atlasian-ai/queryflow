import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { syncUser } from '@/lib/api'
import type { User } from '@/types'
import { useEffect } from 'react'

interface AuthState {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },
}))

export function useAuthInit() {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session?.user) {
        syncUser({ supabase_id: session.user.id, email: session.user.email!, full_name: session.user.user_metadata?.full_name })
          .then((u) => { if (!cancelled) setUser(u) })
          .catch(() => { if (!cancelled) setUser(null) })
          .finally(() => { if (!cancelled) setLoading(false) })
      } else {
        setUser(null)
        setLoading(false)
      }
    }).catch(() => { if (!cancelled) { setUser(null); setLoading(false) } })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (session?.user) {
        syncUser({ supabase_id: session.user.id, email: session.user.email!, full_name: session.user.user_metadata?.full_name })
          .then((u) => { if (!cancelled) setUser(u) })
          .catch(() => { if (!cancelled) setUser(null) })
      } else {
        if (!cancelled) setUser(null)
      }
    })

    return () => { cancelled = true; listener.subscription.unsubscribe() }
  }, [setUser, setLoading])
}
