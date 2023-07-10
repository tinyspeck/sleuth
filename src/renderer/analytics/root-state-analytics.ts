import { RootState, UnzippedFile } from '../../interfaces';
import { readJsonFile } from './read-json-file';

export function getRootStateWarnings(file: UnzippedFile): Array<string> {
  const data = readJsonFile(file);
  const result: Array<string> = [];

  if (!data) {
    return result;
  }

  if (data.settings) {
    const { settings } = data as RootState;
    if (
      settings?.releaseChannelOverride &&
      settings.releaseChannelOverride !== 'prod'
    ) {
      result.push(
        `Release channel is set to ${settings.releaseChannelOverride}`,
      );
    }
  }

  return result;
}
