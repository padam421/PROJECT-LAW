module.exports = {
  apps: [
    {
      name: "nyaysetu-ai",
      cwd: "./ai-service",
      script: "src/app.py",
      interpreter: "python",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        PYTHONIOENCODING: "utf-8"
      }
    },
    {
      name: "nyaysetu-backend",
      cwd: "./backend",
      script: "src/server.js",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
