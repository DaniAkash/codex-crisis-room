import { SocketModeClient } from '@slack/socket-mode';

export const createSocketModeClient = (appToken: string) =>
  new SocketModeClient({
    appToken,
  });
