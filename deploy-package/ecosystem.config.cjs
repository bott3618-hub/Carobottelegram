module.exports = {
  apps: [
    {
      name: "caro-bot",
      script: "./index.mjs",
      cwd: __dirname,
      node_args: "--enable-source-maps",
      env: {
        NODE_ENV: "production",
      },
      // Tự khởi động lại nếu bot bị crash
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      // Log ra file để dễ kiểm tra sau này
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      time: true,
    },
  ],
};
