/**
 * PM2 ecosystem — local development only. Do not use for production deploys.
 *
 *   npm run dev:pm2          start
 *   npm run dev:pm2:stop     stop & remove process
 *   npm run dev:pm2:logs     follow logs
 */
module.exports = {
  apps: [
    {
      name: 'lgus-system-dev',
      cwd: __dirname,
      script: './node_modules/vite/bin/vite.js',
      args: '--port=2510 --host=0.0.0.0',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 15,
      min_uptime: '5s',
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
