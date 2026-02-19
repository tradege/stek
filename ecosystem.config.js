module.exports = {
  apps: [
    {
      name: 'stek-backend',
      cwd: '/var/www/stek/backend',
      script: 'dist/main.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        INTEGRATION_API_KEY: '1de51fcb05661780cd7f41a5313b9513042c837d5e88372be452851b8c45b657'
      }
    },
    {
      name: 'stek-frontend',
      cwd: '/var/www/stek/frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'http://167.172.174.75',
        NEXT_PUBLIC_SOCKET_URL: 'http://167.172.174.75'
      }
    }
  ]
};
