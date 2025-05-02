import { UnzippedFile } from '../../interfaces';
import { memoize } from 'lodash';

const traceWarnings = memoize(_getTraceWarnings);

export function getTraceWarnings(file: UnzippedFile): Array<string> {
  return traceWarnings(file);
}

function _getTraceWarnings(data: any): Array<string> {
  const result: Array<string> = [];

  if (!data) {
    return result;
  }

  if (!('sourcemapped' in data)) {
    result.push(
      `This trace was not sourcemapped, to sourcemap locally use 'slack sourcemap slacktrace <path>'`,
    );
  } else if (!data.sourcemapped) {
    result.push(`Sourcemapping failed for this trace`);
  }

  return result;
}
