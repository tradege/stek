const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function promoteToAdmin() {
  try {
    console.log('🔍 Looking for user: admin...');
    
    // Find the admin user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: 'admin' },
          { email: 'admin@stakepro.com' },
        ],
      },
    });
    
    if (!user) {
      console.error('❌ User "admin" not found!');
      return;
    }
    
    console.log(`✅ Found user: ${user.username} (${user.email})`);
    console.log(`📋 Current role: ${user.role}`);
    
    if (user.role === 'ADMIN') {
      console.log('✅ User is already an ADMIN!');
      return;
    }
    
    // Promote to ADMIN
    console.log('🚀 Promoting to ADMIN...');
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });
    
    console.log('✅ SUCCESS! User promoted to ADMIN!');
    console.log(`📋 New role: ${updatedUser.role}`);
    console.log('');
    console.log('🎉 You can now access the Admin Panel at:');
    console.log('   http://146.190.21.113:3001/admin/dashboard');
    console.log('');
    console.log('⚠️  Please refresh your browser to see the changes!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

promoteToAdmin();
