// netlify/functions/create-checkout.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    // amount envoyé par le front = total en EUROS (9.9, 12.9, 19.9…)
    const amountEuro = Number(body.amount);
    const orderData = body.orderData || {};

    if (!amountEuro || Number.isNaN(amountEuro)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or missing amount' }),
      };
    }

    // Stripe attend un montant en CENTIMES (entier)
    const amountCents = Math.round(amountEuro * 100);

    const plan = orderData.plan || 'Découverte';
    const prenom = orderData.prenomEnfants || 'Enfant';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Chanson personnalisée LABBE kids - Formule ${plan}`,
              description: `Pour ${prenom}`,
            },
            unit_amount: amountCents, // ex : 1290 pour 12,90 €
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.URL || 'https://bouboudada.com'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL || 'https://bouboudada.com'}/#commander`,
      metadata: {
        orderData: JSON.stringify(orderData),
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: session.id }),
    };
  } catch (error) {
    console.error('Stripe create-checkout error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
