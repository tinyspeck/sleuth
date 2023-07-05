export function capitalize(word = ''): string {
  return word.replace(/\w/, (c) => c.toUpperCase());
}
