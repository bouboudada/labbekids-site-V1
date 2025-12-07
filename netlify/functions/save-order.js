// netlify/functions/save-order.js
// Fonction pour sauvegarder les commandes dans Google Sheets

const { google } = require('googleapis');
const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
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
    const { orderData, paymentDetails } = JSON.parse(event.body);

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const date = new Date().toLocaleString('fr-FR');
    const characters = orderData.characters.map(c => `${c.name} (${c.relation})`).join(', ');
    
    const rowData = [
      date,
      orderData.nom,
      orderData.email,
      orderData.plan,
      orderData.total + '€',
      orderData.langue,
      orderData.prenomEnfants,
      orderData.ages || '',
      orderData.theme,
      orderData.style || '',
      characters,
      orderData.anecdotes || '',
      orderData.instrumental ? 'Oui' : 'Non',
      orderData.secondLangue ? 'Oui' : 'Non',
      paymentDetails.id || paymentDetails.orderID || 'N/A',
      paymentDetails.status || 'COMPLETED'
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Commandes!A:P',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [rowData],
      },
    });

    await sendNotificationEmail(orderData, paymentDetails);
    await sendConfirmationEmail(orderData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function sendNotificationEmail(orderData, paymentDetails) {
  const transporter = nodemailer.createTransport({
    host: 'mail.privateemail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const characters = orderData.characters.map(c => `• ${c.name} (${c.relation})`).join('\n');

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'contact@bouboudada.com',
    subject: `🎵 Nouvelle commande LABBE kids - ${orderData.nom}`,
    html: `
      <h2>🎉 Nouvelle commande reçue !</h2>
      
      <h3>Informations client :</h3>
      <ul>
        <li><strong>Nom :</strong> ${orderData.nom}</li>
        <li><strong>Email :</strong> ${orderData.email}</li>
        <li><strong>Formule :</strong> ${orderData.plan}</li>
        <li><strong>Montant :</strong> ${orderData.total}€</li>
      </ul>

      <h3>Détails de la chanson :</h3>
      <ul>
        <li><strong>Langue :</strong> ${orderData.langue}</li>
        <li><strong>Prénom(s) enfant(s) :</strong> ${orderData.prenomEnfants}</li>
        <li><strong>Âge(s) :</strong> ${orderData.ages || 'Non spécifié'}</li>
        <li><strong>Thème :</strong> ${orderData.theme}</li>
        <li><strong>Style musical :</strong> ${orderData.style || 'Non spécifié'}</li>
        <li><strong>Version instrumentale :</strong> ${orderData.instrumental ? 'Oui' : 'Non'}</li>
        <li><strong>Seconde langue :</strong> ${orderData.secondLangue ? 'Oui' : 'Non'}</li>
      </ul>

      <h3>Personnages :</h3>
      <pre>${characters}</pre>

      <h3>Anecdotes :</h3>
      <p>${orderData.anecdotes || 'Aucune'}</p>

      <h3>Paiement :</h3>
      <ul>
        <li><strong>ID Transaction :</strong> ${paymentDetails.id || paymentDetails.orderID}</li>
        <li><strong>Statut :</strong> ${paymentDetails.status || 'COMPLETED'}</li>
      </ul>

      <hr>
      <p><em>Cette commande a été automatiquement enregistrée dans Google Sheets.</em></p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

async function sendConfirmationEmail(orderData) {
  const transporter = nodemailer.createTransport({
    host: 'mail.privateemail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: orderData.email,
    subject: '🎉 Confirmation de commande - LABBE kids',
    html: `
      <div style="font-family: 'Comic Sans MS', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #9b59b6 0%, #5dade2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🌍 LABBE kids 🌍</h1>
          <p style="color: white; font-style: italic; margin: 10px 0 0 0;">Culture et jeux pour petits curieux</p>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #9b59b6;">Merci pour votre commande ! 🎵</h2>
          
          <p>Bonjour <strong>${orderData.nom}</strong>,</p>
          
          <p>Nous avons bien reçu votre paiement et votre commande de chanson personnalisée !</p>

          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #5dade2; margin-top: 0;">Récapitulatif de votre commande :</h3>
            <ul style="line-height: 1.8;">
              <li><strong>Formule :</strong> ${orderData.plan}</li>
              <li><strong>Montant payé :</strong> ${orderData.total}€</li>
              <li><strong>Pour :</strong> ${orderData.prenomEnfants}</li>
              <li><strong>Langue :</strong> ${orderData.langue}</li>
              <li><strong>Thème :</strong> ${orderData.theme}</li>
            </ul>
          </div>

          <h3 style="color: #9b59b6;">Et maintenant ? 🎨</h3>
          <p>Boubou et Dada vont se mettre au travail pour créer une chanson magique spécialement pour vous !</p>
          
          <p><strong>Vous recevrez votre chanson personnalisée par email sous 3 à 5 jours ouvrés.</strong></p>

          <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0;"><strong>💡 Conseil :</strong> Ajoutez contact@bouboudada.com à vos contacts pour ne pas manquer notre email !</p>
          </div>

          <p>Si vous avez des questions, n'hésitez pas à nous contacter à <a href="mailto:contact@bouboudada.com">contact@bouboudada.com</a></p>

          <p style="margin-top: 30px;">À très bientôt ! 💜💙</p>
          <p><strong>L'équipe LABBE kids</strong><br>Boubou et Dada</p>
        </div>

        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>© 2024 LABBE kids - Tous droits réservés</p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}