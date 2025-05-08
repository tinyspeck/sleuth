import fs from 'node:fs';
import { UnzippedFile } from '../../interfaces';
import debug from 'debug';

const d = debug('sleuth:filesystem:is-trace-sourcemapped');

/**
 * Checks if the trace is sourcemapped by checking for the presence of `sourcemapped: true` in
 * the last `chunkSize` bytes of the file.
 *
 * This method relies on the assumption that the `sourcemapped` property is appended at the end
 * of any `.trace` file by the symbolicator.
 *
 * @param file - The file to check
 * @param chunkSize - The size of the chunk to read from the end of the file
 */
export async function isTraceSourcemapped(
  { fullPath }: UnzippedFile,
  chunkSize = 1024,
) {
  const { size } = await fs.promises.stat(fullPath);

  if (size === 0) {
    d('File is empty: returning false');
    return false;
  }

  const position = size - chunkSize;
  let result = false;

  // Open file for reading
  const fileHandle = await fs.promises.open(fullPath, 'r');

  try {
    const buffer = Buffer.alloc(chunkSize);
    const { bytesRead } = await fileHandle.read(buffer, 0, chunkSize, position);

    const bufferStr = buffer.subarray(0, bytesRead).toString();

    if (bufferStr.includes('}')) {
      // Matches any `sourcemapped` property: https://regex101.com/r/NKDZ8e/2
      const booleanMatch = bufferStr.match(
        /"(sourcemapped)"[\s\n]*:[\s\n]*(true|false)[\s\n]*\}[\s\n]*$/i,
      );
      if (booleanMatch) {
        d(
          `Found "sourcemapped" value ${booleanMatch[2]} within the last ${chunkSize} bytes of the file`,
        );
        result = booleanMatch[2] === 'true';
      } else {
        d(
          `Did not find "sourcemapped" value within the last ${chunkSize} bytes of the file`,
        );
      }
    }

    return result;
  } finally {
    await fileHandle.close();
  }
}
