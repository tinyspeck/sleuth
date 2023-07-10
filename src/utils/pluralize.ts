export function plural(
  text: string,
  input: Array<unknown> | number,
  pluralText?: string,
): string {
  let pluralize = false;

  if (typeof input === 'number' && input > 1) {
    pluralize = true;
  } else if (Array.isArray(input) && input.length > 1) {
    pluralize = true;
  }

  const pluralized = pluralText ? pluralText : `${text}s`;

  return pluralize ? pluralized : text;
}
