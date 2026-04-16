import { resolve } from 'node:path';

import { env } from '../config/env';
import { CrisisAgentRunner } from '../agent/run-crisis-agent';
import { createSlackWebClient } from '../slack/client';
import { createSocketModeClient } from '../slack/socket-mode';
import { SlackTransport } from '../slack/transport';
import { ScenarioEngine } from './scenario-engine';
import { IncidentStore } from './store';

export const createIncidentServices = () => {
  const dataFilePath = resolve(process.cwd(), env.DATA_DIR, 'incidents.json');
  const store = new IncidentStore(dataFilePath);
  const scenarioEngine = new ScenarioEngine(store);
  const commanderRunner = new CrisisAgentRunner(scenarioEngine);
  const slackTransport =
    env.SLACK_BOT_TOKEN &&
    env.SLACK_APP_TOKEN &&
    env.SLACK_INCIDENTS_CHANNEL_ID
      ? new SlackTransport({
          appId: env.SLACK_APP_ID ?? null,
          workspaceName: env.SLACK_WORKSPACE_NAME ?? null,
          incidentsChannelId: env.SLACK_INCIDENTS_CHANNEL_ID,
          webClient: createSlackWebClient(env.SLACK_BOT_TOKEN),
          socketClient: createSocketModeClient(env.SLACK_APP_TOKEN),
          commanderRunner,
          incidentStore: store,
        })
      : null;

  return {
    store,
    scenarioEngine,
    commanderRunner,
    slackTransport,
  };
};
