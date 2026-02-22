// lib/client.ts
import { createThirdwebClient } from 'thirdweb'

const clientId = import.meta.env.VITE_THIRDWEB_SECRET_KEY

export const client = createThirdwebClient({ clientId })
