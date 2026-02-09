const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.user.findMany({select:{email:true,role:true,status:true},take:10})
  .then(u => console.log(JSON.stringify(u)))
  .catch(e => console.error(e.message))
  .finally(() => p.());
