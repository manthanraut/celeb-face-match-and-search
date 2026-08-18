import { z } from "zod";

export const boundingBoxSchema = z.object({
  left: z.number().min(0).max(1),
  top: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export const recognizedFaceSchema = z.object({
  candidateName: z.string().nullable(),
  providerPersonId: z.string().nullable(),
  confidence: z.number().min(0).max(100).nullable(),
  confidenceKind: z.enum(["provider-score", "model-estimate"]),
  recognitionStatus: z.enum(["recognized", "uncertain", "unknown"]),
  boundingBox: boundingBoxSchema.nullable(),
});

export const recognitionResultSchema = z.object({
  schemaVersion: z.literal("1.0"),
  provider: z.literal("aws-rekognition"),
  model: z.string(),
  faces: z.array(recognizedFaceSchema),
  unrecognizedFaceCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
});

export type RecognitionResult = z.infer<typeof recognitionResultSchema>;
