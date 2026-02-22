// client/src/hooks/use-auth.ts

import {
  useActiveAccount,
  useActiveWallet,
  useDisconnect,
  useActiveWalletConnectionStatus,
} from 'thirdweb/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { User } from '@shared/models/auth'

async function fetchUser(): Promise<User | null> {
  const response = await fetch('/api/me', { credentials: 'include' })
  if (response.status === 401) return null
  if (!response.ok)
    throw new Error(`${response.status}: ${response.statusText}`)
  return response.json()
}

export function useAuth() {
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const { disconnect } = useDisconnect()
  const status = useActiveWalletConnectionStatus()
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['/api/me'],
    queryFn: fetchUser,
    enabled: !!account, // Only fetch when wallet is connected
    retry: false,
    staleTime: 1000 * 60 * 5,
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch('/logout', { method: 'POST', credentials: 'include' })
      if (wallet) disconnect(wallet) // 🔑 v4: Pass wallet object!
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/me'], null)
    },
  })

  return {
    user,
    isLoading: status === 'connecting' || isLoading,
    isAuthenticated: !!account && !!user,
    walletAddress: account?.address,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  }
}
