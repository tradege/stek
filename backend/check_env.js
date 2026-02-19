require('dotenv').config();
console.log('BREVO_API_KEY:', process.env.BREVO_API_KEY ? 'SET (' + process.env.BREVO_API_KEY.substring(0,20) + '...)' : 'NOT SET');
console.log('NOWPAYMENTS_API_KEY:', process.env.NOWPAYMENTS_API_KEY ? 'SET' : 'NOT SET');
console.log('NOWPAYMENTS_IPN_SECRET:', process.env.NOWPAYMENTS_IPN_SECRET ? 'SET' : 'NOT SET');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
