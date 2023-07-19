import { UnzippedFile } from '../../interfaces';
import { readJsonFile } from './read-json-file';

export function getTraceWarnings(file: UnzippedFile): Array<string> {
  const data = readJsonFile(file);
  const result: Array<string> = [];

  if (!data) {
    return result;
  }

  if (!('sourcemapped' in data)) {
    result.push(
      `This trace was not sourcemapped, to sourcemap locally use 'npx @tinyspeck/mappy slacktrace' or an older version of Sleuth`,
    );
  } else if (!data.sourcemapped) {
    result.push(`Sourcemapping failed for this trace`);
  }

  return result;
}
