import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.18.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId, amountCents, description, metadata: extraMeta } = await req.json();
    if (!jobId || !amountCents) {
      return Response.json({ error: 'jobId and amountCents required' }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountCents),
      currency: 'usd',
      description: description || `Payment for job ${jobId}`,
      metadata: {
        jobId,
        createdBy: user.email,
        ...(extraMeta || {}),
        // Ensure numeric metadata is stringified for Stripe
        basePaymentAmount: String(extraMeta?.basePaymentAmount || ''),
        adjustmentAmount: String(extraMeta?.adjustmentAmount || 0),
        finalChargedAmount: String(extraMeta?.finalChargedAmount || ''),
        paymentMethod: extraMeta?.paymentMethod || 'card',
      }
    });

    return Response.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});