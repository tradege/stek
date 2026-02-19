const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const u = await p.user.findUnique({
    where: { email: 'bengab1113@gmail.com' },
    select: { verificationCode: true, verificationCodeExpiry: true, status: true }
  });
  console.log(JSON.stringify(u, null, 2));
  await p.$disconnect();
})();
