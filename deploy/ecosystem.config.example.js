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
        DATABASE_URL: 'postgresql://USER:PASSWORD@HOST:PORT/defaultdb?sslmode=require',
        JWT_SECRET: 'your-jwt-secret-here',
        INTEGRATION_API_KEY: 'your-integration-api-key-here'
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
        NEXT_PUBLIC_API_URL: 'http://YOUR_SERVER_IP:3000',
        NEXT_PUBLIC_SOCKET_URL: 'http://YOUR_SERVER_IP:3000'
      }
    }
  ]
};
