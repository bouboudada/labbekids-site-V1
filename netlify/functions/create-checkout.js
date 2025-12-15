// netlify/functions/create-checkout.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

// Configuration email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER, // votre email
    pass: process.env.SMTP_PASS  // mot de passe d'application Gmail
  }
});

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { amount, orderData } = JSON.parse(event.body);

    // Validation
    if (!amount || !orderData || !orderData.email || !orderData.accept_cgv) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Données manquantes ou CGV non acceptées' })
      };
    }

    // Créer la session Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Chanson personnalisée - ${orderData.plan}`,
              description: `Pour ${orderData.childName || 'l\'enfant'}`,
            },
            unit_amount: Math.round(amount * 100), // en centimes
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/#commander`,
      customer_email: orderData.email,
      metadata: {
        orderData: JSON.stringify(orderData),
        customerEmail: orderData.email,
        customerName: orderData.nom,
        childName: orderData.childName,
        plan: orderData.plan,
        timestamp: new Date().toISOString()
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: session.id, url: session.url })
    };

  } catch (error) {
    console.error('Erreur création session:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
