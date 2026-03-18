import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // NextAuth
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),

  // Node environment
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  const errorMessages = _parsed.error.errors
    .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
    .join("\n");

  throw new Error(
    `❌ Invalid or missing environment variables:\n${errorMessages}\n\nPlease check your .env file.`,
  );
}

export const env = _parsed.data;

export type Env = z.infer<typeof envSchema>;
