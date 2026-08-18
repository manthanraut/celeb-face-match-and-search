import "dotenv/config";

import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  RECOGNITION_PROVIDER: z.literal("aws-rekognition").default("aws-rekognition"),
  AWS_REGION: z.string().min(1).default("us-east-1"),
});

export const environment = environmentSchema.parse(process.env);
