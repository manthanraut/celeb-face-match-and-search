import type { RecognitionProviderName } from "../../../shared/contracts/recognition.js";
import { AwsRekognitionProvider } from "./AwsRekognitionProvider.js";
import { FakeRecognitionProvider } from "./FakeRecognitionProvider.js";
import type { RecognitionProvider } from "./RecognitionProvider.js";

export function createRecognitionProvider(
  providerName: RecognitionProviderName,
  awsRegion: string,
): RecognitionProvider {
  return providerName === "fake"
    ? new FakeRecognitionProvider()
    : new AwsRekognitionProvider({ region: awsRegion });
}
