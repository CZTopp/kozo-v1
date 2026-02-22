// client/src/hooks/use-wallet-auth.ts

import { useActiveAccount, useSignMessage } from 'thirdweb/react'
import { useEffect, useRef } from 'react'

export function useWalletAuth() {
  const account = useActiveAccount()
  const { mutateAsync: signMessage } = useSignMessage()
  const alreadyAuthed = useRef(false)

  useEffect(() => {
    if (account && !alreadyAuthed.current) {
      alreadyAuthed.current = true
      ;(async () => {
        try {
          // 1. Fetch challenge ('payload') from the backend
          const payload = await fetch(`/login?address=${account.address}`).then(
            (res) => res.json(),
          )
          // 2. Wallet signs the payload
          const signature = await signMessage({ message: payload.message })
          // 3. Send signature & payload to backend to set JWT
          await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload, signature }),
            credentials: 'include',
          })
        } catch (err) {
          console.error('Thirdweb Auth handshake failed', err)
        }
      })()
    }
    // Reset when wallet disconnects
    if (!account) alreadyAuthed.current = false
  }, [account, signMessage])
}
