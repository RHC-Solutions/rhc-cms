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
    },
    {
      name: 'web-check',
      script: 'node',
      args: 'server.js',
      cwd: '/home/rhcsolutions_com/htdocs/rhcsolutions.com/web-check',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: '/home/rhcsolutions_com/.pm2/logs/web-check-error.log',
      out_file: '/home/rhcsolutions_com/.pm2/logs/web-check-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
