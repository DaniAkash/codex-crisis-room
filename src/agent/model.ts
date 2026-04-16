import { openai } from '@ai-sdk/openai';

import { env } from '../config/env';

export const commanderModel = () => openai(env.OPENAI_MODEL);
