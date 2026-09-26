const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: 'roi-clone',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/roi-clone',
      max_memory_restart: '850M',
      node_args: '--max-old-space-size=1024',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
