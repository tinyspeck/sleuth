import React from 'react';
import { getOSInfo, getVersionInfo } from '../../utils/settings-data-helper';
import { getChannelInfo } from './settings-analytics';
import { UnzippedFile } from '../../interfaces';
import { readJsonFile } from '../../renderer/analytics/read-json-file';

export function getEnvInfo(data: any): Array<JSX.Element> {
  const result: Array<JSX.Element> = [];
  result.push(
    <p>
      📋 This user is running Slack <span>{getVersionInfo(data)}</span> on{' '}
      {getOSInfo(data)}
    </p>,
  );
  result.push(<p>📡 {getChannelInfo(data)}</p>);
  result.push(<p>🖥 GPU Composition is {getGPUComposition(data)}.</p>);
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
export function getEnvironmentWarnings(file: UnzippedFile) {
  const data = readJsonFile(file);
  const result: Array<string> = [];

  if (
    typeof data?.resourcePath === 'string' &&
    data.resourcePath.startsWith(`/Volumes/`)
  ) {
    result.push(`Slack.app resources are being run from ${data.resourcePath}`);
  }

  return result;
}
