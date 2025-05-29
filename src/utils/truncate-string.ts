/**
 * Truncate a string, maybe add an ellipsis
 */
export function truncate(input: string, length = 40) {
  const trimmed = input.trim();
  return trimmed.length > length
    ? trimmed.substring(0, length - 1) + '…'
    : trimmed;
}
