/**
 * PM2 process file for the reference host (rhcsolutions.com).
 *
 * The site keeps no .env file: `npm start` runs through scripts/env-from-db.mjs,
 * which loads settings from the secrets table of cms-data/cms.db. Only
 * operational, non-secret values (NODE_ENV, PORT, HOSTNAME) are set here.
 */
module.exports = {
  apps: [
    {
      name: 'rhcsolutions',
      script: 'npm',
      args: 'start',
      cwd: '/home/rhcsolutions_com/htdocs/rhcsolutions.com',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOSTNAME: '0.0.0.0'
      },
      error_file: '/home/rhcsolutions_com/.pm2/logs/rhcsolutions-error.log',
      out_file: '/home/rhcsolutions_com/.pm2/logs/rhcsolutions-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
