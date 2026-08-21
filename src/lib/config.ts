import { z } from 'zod';

const configSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, { message: 'DATABASE_URL is required for database connections.' }),
  RAZORPAY_KEY_ID: z
    .string()
    .min(1, { message: 'RAZORPAY_KEY_ID is required for Razorpay API integrations.' }),
  RAZORPAY_KEY_SECRET: z
    .string()
    .min(1, { message: 'RAZORPAY_KEY_SECRET is required for Razorpay API authentication.' }),
  RAZORPAY_WEBHOOK_SECRET: z
    .string()
    .min(1, { message: 'RAZORPAY_WEBHOOK_SECRET is required for verifying webhook signatures.' }),
  GEMINI_API_KEY: z
    .string()
    .min(1, { message: 'GEMINI_API_KEY is required for @google/genai orchestration.' }),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url({ message: 'NEXT_PUBLIC_APP_URL must be a valid URL.' })
    .default('http://localhost:3000'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

type Config = z.infer<typeof configSchema>;

function parseEnv(): Config {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ CRITICAL: Invalid environment configuration variables:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('Environment configuration validation failed. Process execution halted.');
  }

  return result.data;
}

export const env = parseEnv();
