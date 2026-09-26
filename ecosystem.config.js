const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: 'roi-clone',
      script: '.next/standalone/server.js',
      cwd: '/var/www/roi-clone',
      max_memory_restart: '500M',
      node_args: '--max-old-space-size=400',
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=400',
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
};
