import { resolve } from 'node:path';

import { env } from '../config/env';
import { CrisisAgentRunner } from '../agent/run-crisis-agent';
import { ScenarioEngine } from './scenario-engine';
import { IncidentStore } from './store';

export const createIncidentServices = () => {
  const dataFilePath = resolve(process.cwd(), env.DATA_DIR, 'incidents.json');
  const store = new IncidentStore(dataFilePath);
  const scenarioEngine = new ScenarioEngine(store);
  const commanderRunner = new CrisisAgentRunner(scenarioEngine);

  return {
    store,
    scenarioEngine,
    commanderRunner,
  };
};
