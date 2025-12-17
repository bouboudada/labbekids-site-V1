// netlify/functions/create-checkout.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

// Configuration email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Fonction pour nettoyer les chaînes de caractères
function cleanString(str) {
  if (!str) return '';
  return str
    .replace(/[\t\n\r]/g, ' ')  // Remplace tabs, newlines par des espaces
    .replace(/\s+/g, ' ')        // Remplace multiples espaces par un seul
    .trim();                      // Enlève espaces début/fin
}

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
    console.log('=== DEBUT CREATE-CHECKOUT ===');
    
    const { amount, orderData } = JSON.parse(event.body);
    
    console.log('Amount reçu:', amount);
    console.log('OrderData reçu:', JSON.stringify(orderData));

    // Validation
    if (!amount || !orderData || !orderData.email || !orderData.accept_cgv) {
      console.error('Validation échouée');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Données manquantes ou CGV non acceptées' })
      };
    }

    // 🔥 NETTOYAGE DES DONNÉES (crucial pour éviter les erreurs)
    const cleanedData = {
      ...orderData,
      nom: cleanString(orderData.nom),
      email: cleanString(orderData.email),
      childName: cleanString(orderData.childName),
      prenomEnfants: cleanString(orderData.prenomEnfants),
      message: cleanString(orderData.message || ''),
      anecdotes: cleanString(orderData.anecdotes || '')
    };

    console.log('Données nettoyées:', JSON.stringify(cleanedData));

    // Vérification variables d'environnement
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY manquante !');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Configuration Stripe manquante' })
      };
    }

    if (!process.env.SITE_URL) {
      console.error('SITE_URL manquante !');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Configuration site manquante' })
      };
    }

    console.log('Création session Stripe...');
    
    // Créer la session Stripe avec support 3D Secure
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Chanson personnalisée - ${cleanedData.plan}`,
              description: `Pour ${cleanedData.childName || cleanedData.prenomEnfants || 'l\'enfant'}`,
            },
            unit_amount: Math.round(amount * 100), // en centimes
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/#commander`,
      customer_email: cleanedData.email,
      
      // ✅ Configuration pour France et international
      billing_address_collection: 'required',
      
      // ✅ Support 3D Secure
      payment_intent_data: {
        capture_method: 'automatic'
      },
      
      // ✅ Force authentification 3D Secure
      payment_method_options: {
        card: {
          request_three_d_secure: 'any'
        }
      },
      
      // ✅ Désactive taxes automatiques
      automatic_tax: {
        enabled: false
      },
      
      metadata: {
        orderData: JSON.stringify(cleanedData),
        customerEmail: cleanedData.email,
        customerName: cleanedData.nom,
        childName: cleanedData.childName || cleanedData.prenomEnfants,
        plan: cleanedData.plan,
        timestamp: new Date().toISOString()
      }
    });

    console.log('Session créée avec succès:', session.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: session.id, url: session.url })
    };
    
  } catch (error) {
    // Gestion d'erreur détaillée
    console.error('=== ERREUR CREATE-CHECKOUT ===');
    console.error('Message:', error.message);
    console.error('Type:', error.type);
    console.error('Code:', error.code);
    console.error('Param:', error.param);
    console.error('Stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        type: error.type || 'unknown_error'
      })
    };
  }
};
