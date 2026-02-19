const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const user = await p.user.update({
      where: { email: 'bengab1113@gmail.com' },
      data: { status: 'ACTIVE' }
    });
    console.log('DONE - Updated bengab1113:', user.status, user.email);
  } catch(e) {
    console.error('ERROR:', e.message);
  } finally {
    await p.$disconnect();
  }
})();
