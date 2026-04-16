import { createApp } from './app';
import { env } from './config/env';

const { app, slackTransport } = createApp();

console.info(
  `[codex-crisis-room] starting server on port ${env.PORT} (${env.NODE_ENV})`,
);

if (slackTransport && env.NODE_ENV !== 'test') {
  void slackTransport.start().catch((error) => {
    console.error('[codex-crisis-room] failed to start slack transport', error);
  });
}

export default {
  port: env.PORT,
  fetch: app.fetch,
};
