import { getStripeSync } from './stripeClient';
import { db } from './db';
import { subscriptions } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const event = JSON.parse(payload.toString());
      await handleSubscriptionEvent(event);
    } catch (err) {
      console.error('Error handling subscription event:', err);
    }
  }
}

async function handleSubscriptionEvent(event: any) {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const customerId = sub.customer;
      const status = sub.status;

      const [existing] = await db.select().from(subscriptions)
        .where(eq(subscriptions.stripeCustomerId, customerId));

      if (existing) {
        const plan = status === 'active' ? 'pro' : 'free';
        const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : null;
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
        const cancelAtEnd = sub.cancel_at_period_end || false;
        const interval = sub.items?.data?.[0]?.plan?.interval;
        const billingCycle = interval === 'year' ? 'annual' : 'monthly';

        await db.update(subscriptions).set({
          plan,
          billingCycle,
          stripeSubscriptionId: sub.id,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: cancelAtEnd,
          updatedAt: new Date(),
        }).where(eq(subscriptions.id, existing.id));
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const customerId = sub.customer;

      const [existing] = await db.select().from(subscriptions)
        .where(eq(subscriptions.stripeCustomerId, customerId));

      if (existing) {
        await db.update(subscriptions).set({
          plan: 'free',
          stripeSubscriptionId: null,
          cancelAtPeriodEnd: false,
          aiCallsUsed: 0,
          pdfParsesUsed: 0,
          updatedAt: new Date(),
        }).where(eq(subscriptions.id, existing.id));
      }
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object;
      const customerId = invoice.customer;

      if (invoice.billing_reason === 'subscription_cycle') {
        const [existing] = await db.select().from(subscriptions)
          .where(eq(subscriptions.stripeCustomerId, customerId));

        if (existing) {
          await db.update(subscriptions).set({
            aiCallsUsed: 0,
            pdfParsesUsed: 0,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
          }).where(eq(subscriptions.id, existing.id));
        }
      }
      break;
    }
  }
}
