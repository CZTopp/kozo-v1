import { createThirdwebClient } from 'thirdweb'
import dotenv from 'dotenv'

dotenv.config({ path: ['.env.local', '.env'] })

const secretKey = process.env.THIRDWEB_SECRET_KEY!

export const client = createThirdwebClient({ secretKey })
