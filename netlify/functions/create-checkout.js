exports.handler = async (event, context) => {
  console.log('=== FONCTION DEMARRE ===');
  console.log('Event:', JSON.stringify(event));
  
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ test: 'ok' })
  };
};
