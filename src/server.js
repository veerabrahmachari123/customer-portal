const { createApp } = require('./app');
const config = require('./config');

const server = createApp().listen(config.port, config.host, () =>
  console.log(`${config.appName} (${config.nodeEnv}) listening on ${config.host}:${config.port}`)
);
['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => server.close(() => process.exit(0))));
