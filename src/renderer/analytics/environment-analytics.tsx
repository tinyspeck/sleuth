import React from 'react';
import { getOSInfo } from '../../utils/settings-data-helper';

export function getEnvInfo(data: any): Array<JSX.Element> {
  const result: Array<JSX.Element> = [];
  result.push(
    <p>
      📋 This user is running Slack <strong>{data.appVersion}</strong> on{' '}
      {getOSInfo(data)}
    </p>,
  );
  result.push(<p>🖼️ GPU Composition is {getGPUComposition(data)}.</p>);
  return result;
}

function getGPUComposition({ isGpuCompositionAvailable }: any): string {
  return isGpuCompositionAvailable === true ? 'available' : 'unavailable';
}

/**
 * If `environment.json` has any red flags, point them out in the sidebar
 * via warnings. This function should be used in `src/components/sidebar.tsx`.
 * @param file
 */
export function getEnvironmentWarnings(data: any) {
  const result: Array<string> = [];

  if (
    typeof data?.resourcePath === 'string' &&
    data.resourcePath.startsWith(`/Volumes/`)
  ) {
    result.push(`Slack.app resources are being run from ${data.resourcePath}`);
  }

  return result;
}
