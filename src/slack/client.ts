import { WebClient } from '@slack/web-api';

export const createSlackWebClient = (token: string) => new WebClient(token);
