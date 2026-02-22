import { client } from './thirdweb-client'
import { createThirdwebClient } from 'thirdweb'
import { createAuth } from 'thirdweb/auth'
import { privateKeyToAccount } from 'thirdweb/wallets'

const privateKey = process.env.THIRDWEB_PRIVATE_KEY!
const thirdwebClient = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
})

export const thirdwebAuth = createAuth({
  domain: `localhost:${process.env.PORT || 8080}`, // your app's domain
  client: thirdwebClient,
  adminAccount: privateKeyToAccount({ client, privateKey }),
})

// // Initialize auth operations in an async function
// async function initializeAuth() {
//   // 1. generate a login payload for a client on the server side
//   const loginPayload = await thirdwebAuth.generatePayload({
//     address: client.clientId,
//   })

//   // 2. send the login payload to the client to sign

//   // 3. verify the login payload and signature that the client sends back later
//   const verifyResult = await thirdwebAuth.verifyPayload({
//     payload: loginPayload,
//     signature: ,
//   })

//   // 4. generate a JWT for the client
//   if (!verifyResult.valid) {
//     throw new Error(verifyResult.error)
//   }
//   const jwt = await thirdwebAuth.generateJWT({ payload: verifyResult.payload })

//   // 5. set the JWT as a cookie or otherwise provide it to the client

//   // 6. authenticate the client based on the JWT on subsequent calls
//   const verifyJWTResult = await thirdwebAuth.verifyJWT({ jwt })
//   if (!verifyJWTResult.valid) {
//     throw new Error(verifyJWTResult.error)
//   }
//   const { parsedJWT } = verifyJWTResult
// }

// initializeAuth()
