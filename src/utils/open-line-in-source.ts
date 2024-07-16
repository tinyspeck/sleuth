import { shell } from 'electron';
import { exec } from 'child_process';
import debug from 'debug';

const d = debug('sleuth:open-line-in-source');

interface OpenSourceOptions {
  defaultEditor: string;
}

export function openLineInSource(
  line: number,
  sourceFile: string,
  options: OpenSourceOptions,
) {
  if (options.defaultEditor) {
    const cmd = options.defaultEditor
      .replace('{filepath}', `"${sourceFile}"`)
      .replace('{line}', line.toString(10));

    d(`Executing ${cmd}`);
    exec(cmd, (error: Error) => {
      if (!error) return;
      d(`Tried to open source file, but failed`, error);
      shell.showItemInFolder(sourceFile);
    });
  } else {
    shell.showItemInFolder(sourceFile);
  }
}
