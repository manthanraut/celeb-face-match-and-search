import "dotenv/config";

import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  RECOGNITION_PROVIDER: z.literal("aws-rekognition").default("aws-rekognition"),
  AWS_REGION: z.string().min(1).default("us-east-1"),
  LOCAL_DATA_DIRECTORY: z.string().min(1).default("data"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  RECOGNITION_AUTO_APPROVE_THRESHOLD: z.coerce.number().min(0).max(100).default(99),
});

export const environment = environmentSchema.parse(process.env);
