import "dotenv/config";

import { z } from "zod";

const mongoUriSchema = z
  .string()
  .trim()
  .regex(/^mongodb(?:\+srv)?:\/\//, "MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme.");

const configurablePercentageSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().min(0).max(100).default(90),
);

export const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  RECOGNITION_PROVIDER: z.literal("aws-rekognition").default("aws-rekognition"),
  AWS_REGION: z.string().min(1).default("us-east-1"),
  MONGODB_URI: mongoUriSchema.default("mongodb://127.0.0.1:27017"),
  MONGODB_DATABASE: z
    .string()
    .trim()
    .min(1)
    .max(63)
    .regex(/^[a-zA-Z0-9_-]+$/, "MONGODB_DATABASE may contain only letters, numbers, underscores and hyphens.")
    .default("celeb_face_match"),
  UPLOAD_DIR: z.string().trim().min(1).default("data/uploads"),
  RECOGNITION_APPROVAL_THRESHOLD: configurablePercentageSchema,
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: NodeJS.ProcessEnv): Environment {
  return environmentSchema.parse(input);
}

export const environment = parseEnvironment(process.env);
