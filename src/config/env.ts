import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_INCIDENTS_CHANNEL_ID: z.string().optional(),
  SLACK_APP_ID: z.string().optional(),
  SLACK_WORKSPACE_NAME: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.4'),
  DEMO_GITHUB_REPO: z.string().optional(),
  DEMO_REVIEWER_SLACK_ID: z.string().optional(),
  DEMO_OWNER_SLACK_ID: z.string().optional(),
  DEMO_STAKEHOLDER_SLACK_IDS: z.string().optional(),
  DEMO_REPORT_BASE_URL: z.string().optional(),
  FAST_DEMO_MODE: z
    .enum(['true', 'false'])
    .optional(),
  DATA_DIR: z.string().default('./data'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsedEnv = envSchema.safeParse(Bun.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsedEnv.data;
