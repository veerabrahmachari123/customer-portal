// Settings come from environment variables (with defaults)
module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  appName: process.env.APP_NAME || 'customer-portal',
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  nodeEnv: process.env.NODE_ENV || 'development',
};
