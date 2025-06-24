import { shell } from 'electron';
import { spawn } from 'child_process';
import debug from 'debug';
import { Editor } from '../renderer/components/preferences/preferences-utils';

const d = debug('sleuth:open-line-in-source');

interface OpenSourceOptions {
  defaultEditor: Editor;
}

export function openLineInSource(
  line: number,
  sourceFile: string,
  options: OpenSourceOptions,
) {
  if (options.defaultEditor) {
    const { cmd, args } = options.defaultEditor;
    const mappedArgs = args.map((arg) =>
      arg
        .replace('{filepath}', `${sourceFile}`)
        .replace('{line}', line.toString(10)),
    );

    d(`Executing ${cmd} with args ${mappedArgs}`);
    const spawned = spawn(cmd, mappedArgs);
    spawned.on('error', (err) => {
      d(`Tried to open source file, but failed`, err);
      shell.showItemInFolder(sourceFile);
    });
  } else {
    shell.showItemInFolder(sourceFile);
  }
}
