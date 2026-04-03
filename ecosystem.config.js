module.exports = {
  apps: [
    {
      name: 'qv-backend',
      cwd: './server',
      script: 'npm',
      args: 'start',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
    {
      name: 'qv-client',
      cwd: './client',
      script: 'npx',
      args: 'serve -s build -l 3000',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
