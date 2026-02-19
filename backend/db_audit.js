const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const users = await p.user.count();
    const roles = await p.user.groupBy({ by: ['role'], _count: true });
    const statuses = await p.user.groupBy({ by: ['status'], _count: true });
    console.log('=== USERS ===');
    console.log('Total:', users);
    console.log('By role:', JSON.stringify(roles));
    console.log('By status:', JSON.stringify(statuses));
    
    const bengab = await p.user.findUnique({ where: { email: 'bengab1113@gmail.com' }, include: { wallets: true } });
    console.log('\n=== bengab1113@gmail.com ===');
    console.log('Found:', !!bengab);
    if (bengab) {
      console.log('Status:', bengab.status);
      console.log('Role:', bengab.role);
      console.log('emailVerified:', bengab.emailVerified);
      console.log('twoFactorEnabled:', bengab.twoFactorEnabled);
      console.log('Wallets:', JSON.stringify(bengab.wallets?.map(w => ({ id: w.id, currency: w.currency, balance: Number(w.balance), depositAddress: w.depositAddress }))));
    }
    
    const admin = await p.user.findUnique({ where: { email: 'marketedgepros@gmail.com' }, include: { wallets: true } });
    console.log('\n=== marketedgepros@gmail.com ===');
    if (admin) {
      console.log('Status:', admin.status, 'Role:', admin.role);
      console.log('Wallets:', JSON.stringify(admin.wallets?.map(w => ({ currency: w.currency, balance: Number(w.balance) }))));
    }

    console.log('\n=== TABLE COUNTS ===');
    console.log('User:', await p.user.count());
    console.log('Wallet:', await p.wallet.count());
    console.log('Transaction:', await p.transaction.count());
    console.log('Bet:', await p.bet.count());
    try { console.log('AuditLog:', await p.auditLog.count()); } catch(e) { console.log('AuditLog: ERROR', e.message.substring(0,60)); }
    try { console.log('UserSession:', await p.userSession.count()); } catch(e) { console.log('UserSession: ERROR', e.message.substring(0,60)); }
    try { console.log('SiteConfig:', await p.siteConfig.count()); } catch(e) { console.log('SiteConfig: ERROR', e.message.substring(0,60)); }
    try { console.log('ChatMessage:', await p.chatMessage.count()); } catch(e) { console.log('ChatMessage: ERROR', e.message.substring(0,60)); }
    try { console.log('SupportTicket:', await p.supportTicket.count()); } catch(e) { console.log('SupportTicket: ERROR', e.message.substring(0,60)); }
    try { console.log('Promotion:', await p.promotion.count()); } catch(e) { console.log('Promotion: ERROR', e.message.substring(0,60)); }

    try {
      const audits = await p.auditLog.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
      console.log('\n=== RECENT AUDIT LOGS ===');
      audits.forEach(a => console.log(a.action, '-', a.entityType, '-', new Date(a.createdAt).toISOString()));
      if (audits.length === 0) console.log('(no audit logs found)');
    } catch(e) { console.log('\n=== AUDIT LOGS ERROR ===', e.message.substring(0,80)); }

    try {
      const sessions = await p.userSession.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
      console.log('\n=== RECENT SESSIONS ===');
      sessions.forEach(s => console.log(s.ipAddress, '-', new Date(s.createdAt).toISOString()));
      if (sessions.length === 0) console.log('(no sessions found)');
    } catch(e) { console.log('\n=== SESSIONS ERROR ===', e.message.substring(0,80)); }

    const txTypes = await p.transaction.groupBy({ by: ['type'], _count: true });
    console.log('\n=== TRANSACTION TYPES ===');
    console.log(JSON.stringify(txTypes));

    // Check env vars
    console.log('\n=== ENV VARS CHECK ===');
    console.log('NOWPAYMENTS_API_KEY set:', !!process.env.NOWPAYMENTS_API_KEY);
    console.log('NOWPAYMENTS_IPN_SECRET set:', !!process.env.NOWPAYMENTS_IPN_SECRET);
    console.log('GMAIL_USER set:', !!process.env.GMAIL_USER);
    console.log('GMAIL_APP_PASSWORD set:', !!process.env.GMAIL_APP_PASSWORD);
    console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);
    console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);

  } catch(e) {
    console.error('FATAL ERROR:', e.message);
  } finally {
    await p.$disconnect();
  }
})();
