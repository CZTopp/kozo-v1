import { getUncachableStripeClient } from './stripeClient';

async function seedStripeProducts() {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.products.search({ query: "name:'Kozo Pro'" });
  if (existing.data.length > 0) {
    console.log('Kozo Pro product already exists:', existing.data[0].id);

    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    for (const p of prices.data) {
      console.log(`  Price: ${p.id} - $${(p.unit_amount || 0) / 100}/${p.recurring?.interval}`);
    }
    return;
  }

  const product = await stripe.products.create({
    name: 'Kozo Pro',
    description: 'Professional financial modeling & valuation platform. 10 models, 20 crypto projects, 50 AI calls/month, SEC EDGAR import, AI Copilot, and more.',
    metadata: {
      plan: 'pro',
      tier: 'pro',
    },
  });
  console.log('Created product:', product.id);

  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 2900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { cycle: 'monthly' },
  });
  console.log('Created monthly price:', monthlyPrice.id, '- $29/month');

  const annualPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 29000,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { cycle: 'annual' },
  });
  console.log('Created annual price:', annualPrice.id, '- $290/year');
}

seedStripeProducts().catch(console.error);
