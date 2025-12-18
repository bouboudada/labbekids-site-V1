// netlify/functions/stripe-webhook.js
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

exports.handler = async (event, context) => {
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Erreur webhook:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Traiter uniquement les paiements réussis
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    
    try {
      console.log('🔔 Webhook reçu pour session:', session.id);
      
      // Récupérer les données de commande depuis les métadonnées
      const orderData = JSON.parse(session.metadata.orderData);
      const orderId = session.id;
      const paymentId = session.payment_intent;

      console.log('📧 Préparation emails pour:', orderData.email);

      // Construire le détail de la commande
      const orderDetails = `
🎵 NOUVELLE COMMANDE LABBE KIDS
═══════════════════════════════

📋 Informations commande:
- Numéro: ${orderId}
- Date: ${new Date().toLocaleString('fr-FR')}
- Paiement ID: ${paymentId}
- Montant: ${(session.amount_total / 100).toFixed(2)}€

👤 Client:
- Nom: ${orderData.nom}
- Email: ${orderData.email}

🎶 Détails de la chanson:
- Formule: ${orderData.plan}
- Enfant: ${orderData.childName || 'Non spécifié'}
- Âge: ${orderData.age || 'Non spécifié'}
- Thème: ${orderData.theme || 'Non spécifié'}
- Occasion: ${orderData.occasion || 'Non spécifié'}
- Langue: ${orderData.langue || 'Non spécifié'}
- Style: ${orderData.style || 'Non spécifié'}
${orderData.secondLangue ? '- 2ème langue: Oui' : ''}
${orderData.instrumental ? '- Version instrumentale: Oui' : ''}

📝 Message/Anecdotes:
${orderData.anecdotes || orderData.message || 'Aucun'}

👥 Personnages additionnels:
${getCharactersList(orderData)}
      `.trim();

      // EMAIL 1: Confirmation au CLIENT
      console.log('📧 Envoi email au client...');
      await transporter.sendMail({
        from: `"LABBE Kids" <${process.env.SMTP_USER}>`,
        to: orderData.email,
        subject: '🎉 Confirmation de votre commande LABBE Kids',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #9b59b6 0%, #5dade2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #e0e0e0; }
              .order-box { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #9b59b6; }
              .footer { text-align: center; padding: 20px; color: #777; font-size: 0.9em; }
              h2 { color: #9b59b6; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎵 Merci pour votre commande !</h1>
              </div>
              <div class="content">
                <h2>Bonjour ${orderData.nom},</h2>
                <p>Nous avons bien reçu votre commande et votre paiement de <strong>${(session.amount_total / 100).toFixed(2)}€</strong>.</p>
                
                <div class="order-box">
                  <h3>📋 Récapitulatif de votre commande</h3>
                  <p><strong>Numéro de commande:</strong> ${orderId}</p>
                  <p><strong>Formule:</strong> ${getFormuleName(orderData.plan)}</p>
                  <p><strong>Enfant:</strong> ${orderData.childName || 'Non spécifié'}</p>
                  <p><strong>Thème:</strong> ${orderData.theme || 'Non spécifié'}</p>
                  ${orderData.instrumental ? '<p>✅ Version instrumentale incluse</p>' : ''}
                  ${orderData.secondLangue ? '<p>✅ 2ème langue incluse</p>' : ''}
                </div>

                <h3>📅 Prochaines étapes</h3>
                <ol>
                  <li>Notre équipe commence la création de votre chanson personnalisée</li>
                  <li>Vous recevrez votre chanson par email sous <strong>2-3 jours ouvrables</strong></li>
                  <li>Vous pourrez la télécharger et l'écouter autant de fois que vous le souhaitez</li>
                </ol>

                <p style="margin-top: 30px;">Si vous avez des questions, n'hésitez pas à nous contacter à <a href="mailto:${process.env.SMTP_USER}">${process.env.SMTP_USER}</a></p>

                <p style="margin-top: 30px;">À très bientôt,<br><strong>L'équipe LABBE Kids</strong></p>
              </div>
              <div class="footer">
                <p>© 2025 LABBE Kids - Tous droits réservés</p>
                <p><a href="${process.env.SITE_URL}/cgv.html">Conditions Générales de Vente</a></p>
              </div>
            </div>
          </body>
          </html>
        `
      });
      console.log('✅ Email client envoyé');

      // EMAIL 2: Notification à L'ADMIN (vous)
      console.log('📧 Envoi email à l\'admin...');
      await transporter.sendMail({
        from: `"LABBE Kids System" <${process.env.SMTP_USER}>`,
        to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
        subject: `🎵 NOUVELLE COMMANDE - ${orderData.childName} - ${(session.amount_total / 100).toFixed(2)}€`,
        text: orderDetails,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: monospace; background: #f5f5f5; padding: 20px; }
              .container { background: white; padding: 30px; border-radius: 10px; max-width: 800px; margin: 0 auto; }
              .alert { background: #4CAF50; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
              .info-block { background: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #9b59b6; }
              pre { background: #f0f0f0; padding: 15px; border-radius: 5px; overflow-x: auto; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="alert">
                <h2>🎉 NOUVELLE COMMANDE REÇUE</h2>
              </div>
              <pre>${orderDetails}</pre>
              <div class="info-block">
                <p><strong>Action requise:</strong> Créer la chanson personnalisée pour ${orderData.childName}</p>
                <p><strong>Délai:</strong> 2-3 jours ouvrables</p>
                <p><strong>Envoyer à:</strong> ${orderData.email}</p>
              </div>
            </div>
          </body>
          </html>
        `
      });
      console.log('✅ Email admin envoyé');

      console.log('✅ Emails envoyés avec succès pour la commande:', orderId);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Commande traitée avec succès' })
      };

    } catch (error) {
      console.error('❌ Erreur traitement commande:', error);
      console.error('Stack:', error.stack);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  return { statusCode: 200, body: 'OK' };
};

// Fonctions utilitaires
function getCharactersList(orderData) {
  const characters = [];
  for (let i = 1; i <= 10; i++) {
    const name = orderData[`character${i}Name`];
    const role = orderData[`character${i}Role`];
    if (name) {
      characters.push(`- ${name}${role ? ` (${role})` : ''}`);
    }
  }
  return characters.length > 0 ? characters.join('\n') : 'Aucun personnage additionnel';
}

function getFormuleName(plan) {
  const names = {
    'découverte': '🌟 Découverte (9.90€)',
    'standard': '⭐ Standard (14.90€)',
    'premium': '💎 Premium (19.90€)'
  };
  return names[plan] || plan;
}
