import express, { type Request, Response, NextFunction } from 'express'
import { registerRoutes } from './routes'
import { serveStatic } from './static'
import { createServer } from 'http'
import { seedDatabase } from './seed'
import { migrateOrphanedData } from './migrate-data'
import { runMigrations } from 'stripe-replit-sync'
import { getStripeSync } from './stripeClient'
import { WebhookHandlers } from './webhookHandlers'
import { users } from '../shared/models/auth'
import { db } from './db'
import { eq } from 'drizzle-orm'
import cookieParser from 'cookie-parser'
import { createAuth, type VerifyLoginPayloadParams } from 'thirdweb/auth'
import { privateKeyToAccount } from 'thirdweb/wallets'
import cors from 'cors'
import { thirdwebAuth } from './thirdweb_auth'

const app = express()
const httpServer = createServer(app)

app.use(express.json())
app.use(cookieParser())
app.use(
  cors({
    origin: `${
      process.env.NODE_ENV === 'development' ? 'http' : 'https'
    }://${process.env.CLIENT_DOMAIN}`,
    credentials: true,
  }),
)

// app.get('/', (req, res) => {
//   return res.send('Auth server is live')
// })

app.get('/login', async (req, res) => {
  const address = req.query.address
  const chainId = req.query.chainId as string | undefined

  if (typeof address !== 'string') {
    return res.status(400).send('Address is required')
  }

  return res.send(
    await thirdwebAuth.generatePayload({
      address,
      chainId: chainId ? parseInt(chainId) : undefined,
    }),
  )
})

app.post('/login', async (req, res) => {
  const payload: VerifyLoginPayloadParams = req.body

  const verifiedPayload = await thirdwebAuth.verifyPayload(payload)

  if (verifiedPayload.valid) {
    const jwt = await thirdwebAuth.generateJWT({
      payload: verifiedPayload.payload,
    })
    res.cookie('jwt', jwt)
    return res.status(200).send({ token: jwt })
  }

  res.status(400).send('Failed to login')
})

app.get('/isLoggedIn', async (req, res) => {
  const jwt = req.cookies?.jwt

  if (!jwt) {
    return res.send(false)
  }

  const authResult = await thirdwebAuth.verifyJWT({ jwt })

  if (!authResult.valid) {
    return res.send(false)
  }

  return res.send(true)
})

app.post('/logout', (req, res) => {
  res.clearCookie('jwt')
  return res.send(true)
})

app.get('/api/me', async (req, res) => {
  const jwt = req.cookies?.jwt
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' })

  const authResult = await thirdwebAuth.verifyJWT({ jwt })
  if (!authResult.valid) return res.status(401).json({ error: 'Unauthorized' })

  const walletAddress = authResult.parsedJWT.sub

  let user = (
    await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddress))
      .limit(1)
  )[0]
  if (!user) {
    user = await db
      .insert(users)
      .values({ walletAddress })
      .returning()
      .then((r) => r[0])
  }

  return res.json(user)
})

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

async function initStripe() {
  if (
    process.env.BYPASS_AUTH === '1' ||
    process.env.NODE_ENV !== 'production'
  ) {
    console.warn('Skipping Stripe init in development/bypass mode')
    return
  }
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.warn('DATABASE_URL not set, skipping Stripe init')
    return
  }
  try {
    console.log('Initializing Stripe schema...')
    await runMigrations({ databaseUrl })
    console.log('Stripe schema ready')

    const stripeSync = await getStripeSync()

    const replitDomains = process.env.REPLIT_DOMAINS
    if (replitDomains) {
      const webhookBaseUrl = `https://${replitDomains.split(',')[0]}`
      try {
        const result = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`,
        )
        console.log('Stripe webhook configured:', result?.webhook?.url || 'ok')
      } catch (whErr: any) {
        console.warn('Stripe webhook setup skipped:', whErr.message)
      }
    } else {
      console.log('REPLIT_DOMAINS not set, skipping webhook registration')
    }

    stripeSync
      .syncBackfill()
      .then(() => console.log('Stripe data synced'))
      .catch((err: any) => console.error('Stripe sync error:', err))
  } catch (error) {
    console.error('Failed to initialize Stripe:', error)
  }
}

initStripe().catch((err) => console.error('Stripe init failed:', err))

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature']
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' })
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature
      if (!Buffer.isBuffer(req.body)) {
        console.error('Stripe webhook: req.body is not a Buffer')
        return res.status(500).json({ error: 'Webhook processing error' })
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig)
      res.status(200).json({ received: true })
    } catch (error: any) {
      console.error('Webhook error:', error.message)
      res.status(400).json({ error: 'Webhook processing error' })
    }
  },
)

app.use(
  express.json({
    limit: '15mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf
    },
  }),
)

app.use(express.urlencoded({ extended: false }))

export function log(message: string, source = 'express') {
  const formattedTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  console.log(`${formattedTime} [${source}] ${message}`)
}

app.use((req, res, next) => {
  const start = Date.now()
  const path = req.path
  let capturedJsonResponse: Record<string, any> | undefined = undefined

  const originalResJson = res.json
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson
    return originalResJson.apply(res, [bodyJson, ...args])
  }

  res.on('finish', () => {
    const duration = Date.now() - start
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`
      }

      log(logLine)
    }
  })

  next()
})
;(async () => {
  // await seedDatabase()
  await migrateOrphanedData()
  await registerRoutes(httpServer, app)

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500
    const message = err.message || 'Internal Server Error'

    console.error('Internal Server Error:', err)

    if (res.headersSent) {
      return next(err)
    }

    return res.status(status).json({ message })
  })

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === 'production') {
    serveStatic(app)
  } else {
    const { setupVite } = await import('./vite')
    await setupVite(httpServer, app)
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10)
  // httpServer.listen(
  //   {
  //     port,
  //     host: '0.0.0.0',
  //     reusePort: true,
  //   },
  //   () => {
  //     log(`serving on port ${port}`)
  //   },
  // )
  httpServer.listen({ port }, () => {
    log(`serving on port ${port}`)
  })
})()
