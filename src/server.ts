import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

console.info(
  `[codex-crisis-room] starting server on port ${env.PORT} (${env.NODE_ENV})`,
);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
