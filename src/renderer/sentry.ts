export function getSentryHref(installationId: string) {
  return `https://sentry.io/organizations/tinyspeck/issues/?project=5277886&query=is%3Aunresolved+uuid%3A${installationId}`;
}
