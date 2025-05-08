import { UnzippedFile } from '../../interfaces';
import { memoize } from 'lodash';

const traceWarnings = memoize(_getTraceWarnings);

export async function getTraceWarnings(
  file: UnzippedFile,
): Promise<Array<string>> {
  return traceWarnings(file);
}

async function _getTraceWarnings(file: UnzippedFile): Promise<Array<string>> {
  const result = await window.Sleuth.isTraceSourcemapped(file);
  return result;
}
