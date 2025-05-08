import { RootState } from '../../interfaces';

export function getRootStateWarnings(data: any): Array<string> {
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
