export function isIntelligenceV2Enabled(
  environment: Pick<NodeJS.ProcessEnv, "INTELLIGENCE_V2_ENABLED"> = process.env,
): boolean {
  return environment.INTELLIGENCE_V2_ENABLED?.trim().toLowerCase() !== "false";
}
