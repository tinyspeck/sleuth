import { SelectableLogFile } from '../interfaces';

export function getIdForLogFiles(input: Array<SelectableLogFile>): string {
  return input.map(getIdForLogFile).join();
}

export function getIdForLogFile(input: SelectableLogFile): string {
  // All other files do
  return input.id;
}
