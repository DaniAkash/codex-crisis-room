import type { ToolSet } from 'ai';

import type { ScenarioEngine } from '../incidents/scenario-engine';
import { createCommanderTools } from './tool-factory';

export type CommanderTools = ReturnType<typeof createCommanderTools>;

export const getCommanderTools = (scenarioEngine: ScenarioEngine) =>
  createCommanderTools(scenarioEngine) satisfies ToolSet;
