import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import { SelectableLogFile, UnzippedFile } from '../../interfaces';
import { SleuthState } from '../state/sleuth';
import { getEnvInfo } from '../analytics/environment-analytics';
import { getLocalSettingsInfo } from '../analytics/local-settings-analytics';
import { getNotifWarningsInfo } from '../analytics/notification-warning-analytics';
import { JSONView } from './json-view';
import { getFontForCSS } from './preferences/preferences-utils';
import { getSentryHref } from '../sentry';

import {
  getMessage,
  getPoliciesAndDefaultsExternalConfig,
  getPoliciesAndDefaultsRootState,
} from '../analytics/external-config-analytics';
import { Card } from 'antd';

export interface StateTableProps {
  state: SleuthState;
}

export interface StateTableState<T extends keyof StateData> {
  data?: StateData[T];
  path?: string;
  raw?: string;
}

enum StateType {
  'html',
  'notifs',
  'installation',
  'environment',
  'localSettings',
  'rootState',
  'externalConfig',
  'unknown',
}

export type StateData = {
  [T in StateType]: T extends StateType.notifs | StateType.installation
    ? string[]
    : Record<string, unknown>;
};

function isStateFile(file?: SelectableLogFile): file is UnzippedFile {
  const _file = file as UnzippedFile;
  return !!_file.fullPath;
}

function isHtmlFile(file: UnzippedFile) {
  return file.fullPath.endsWith('.html');
}

function isNotifsFile(file: UnzippedFile) {
  return file.fullPath.endsWith('notification-warnings.json');
}

function isInstallationFile(file: UnzippedFile) {
  return file.fullPath.endsWith('installation');
}

function isExternalConfigFile(file: UnzippedFile) {
  return file.fullPath.endsWith('external-config.json');
}

function isRootStateFile(file: UnzippedFile) {
  return file.fullPath.endsWith('root-state.json');
}

function getFileType(selectedFile: SelectableLogFile | undefined): StateType {
  if (!isStateFile(selectedFile)) {
    throw new Error('StateTable: No file');
  }

  if (isHtmlFile(selectedFile)) {
    return StateType.html;
  }

  if (isNotifsFile(selectedFile)) {
    return StateType.notifs;
  }

  if (isInstallationFile(selectedFile)) {
    return StateType.installation;
  }

  if (isRootStateFile(selectedFile)) {
    return StateType.rootState;
  }

  if (isExternalConfigFile(selectedFile)) {
    return StateType.externalConfig;
  }

  if (selectedFile.fileName === 'environment.json') {
    return StateType.environment;
  }

  if (selectedFile.fileName === 'local-settings.json') {
    return StateType.localSettings;
  }

  return StateType.unknown;
}

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export const StateTable = observer(({ state }: StateTableProps) => {
  const fileState = useMemo(() => {
    const { selectedFile } = state;
    if (isStateFile(selectedFile)) {
      return state.stateFiles[selectedFile.fileName] ?? {};
    }
    return {};
  }, [state, state.selectedFile]);

  const { data, path, raw } = fileState;
  const { font, selectedFile } = state;

  const type = getFileType(selectedFile);

  const renderNotifsInfo = (): JSX.Element | null => {
    if (!Array.isArray(data) || data.length === 0) {
      return (
        <Card className="StateTable-Info">
          No notification warnings were found!
        </Card>
      );
    }

    return (
      <Card className="StateTable-Info">
        {...getNotifWarningsInfo(data || {})}
      </Card>
    );
  };

  const renderInstallationInfo = (): JSX.Element | null => {
    if (Array.isArray(data) && data.length > 0) {
      const id = atob(data[0]);
      const href = getSentryHref(id);

      return (
        <Card className="StateTable-Info">
          See exceptions in Sentry:{' '}
          <a onClick={() => window.Sleuth.openExternal(href)}>{id}</a>
        </Card>
      );
    }

    return <Card className="StateTable-Info">No installation id found.</Card>;
  };

  const renderEnvironmentInfo = (): JSX.Element | null => {
    return <Card className="StateTable-Info">{...getEnvInfo(data || {})}</Card>;
  };

  const renderLocalSettings = (): JSX.Element | null => {
    return (
      <Card className="StateTable-Info">
        {...getLocalSettingsInfo(data || {})}
      </Card>
    );
  };

  const renderExternalConfig = (): JSX.Element | null => {
    if (data?.externalConfig && data?.rootState) {
      const externalConfigData = getPoliciesAndDefaultsExternalConfig(
        data.externalConfig,
      );
      const rootStateData = getPoliciesAndDefaultsRootState(data.rootState);

      const externalConfigJSON = (
        <JSONView data={externalConfigData} state={state} />
      );
      const rootStateJSON = <JSONView data={rootStateData} state={state} />;

      const message = getMessage(rootStateData, externalConfigData);

      return (
        <div>
          <div id="externalConfigContainerTwo">
            <div id="comparisons">
              <Card className="StateTable-Info">
                <div id="externalConfigContainer">
                  <div className="fileDisplay">
                    <p className="fileHeaderStyle">
                      Root-State Policies + Defaults
                    </p>
                    <div className="jsonContainer">{rootStateJSON}</div>
                  </div>
                  <div className="fileDisplay">
                    <p className="fileHeaderStyle">
                      External Config Policies + Defaults
                    </p>
                    <div className="jsonContainer">{externalConfigJSON}</div>
                  </div>
                </div>
              </Card>
            </div>
            <div id="resultContainer">
              <Card className="StateTable-Info">
                <div id="matchDisplay">{message}</div>
              </Card>
            </div>
          </div>
          <div id="descriptionExternalConfig">
            <p>
              {' '}
              <code>external-config.json</code> is created during the collection
              of logs to see what defaults and policies are set. The data
              contained in <code>root-state.json</code> should be the same, but
              can be modified by more codepaths.
            </p>
            <p>
              If there is a bug with External Config policies, comparing
              discrepancies between the two may be useful.
            </p>
          </div>
        </div>
      );
    } else {
      return null;
    }
  };

  const renderInfo = (): JSX.Element | null => {
    if (type === StateType.notifs) {
      return renderNotifsInfo();
    } else if (type === StateType.installation) {
      return renderInstallationInfo();
    } else if (type === StateType.environment) {
      return renderEnvironmentInfo();
    } else if (type === StateType.localSettings) {
      return renderLocalSettings();
    } else if (type === StateType.externalConfig) {
      return renderExternalConfig();
    } else {
      return null;
    }
  };

  const onIFrameLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const iframe = e.currentTarget;
    if (iframe?.contentWindow) {
      const { document: idoc } = iframe.contentWindow;
      iframe.height = `${idoc.body.scrollHeight}px`;
    }
  };

  const info = renderInfo();

  const content =
    !data && path ? (
      <iframe sandbox="" onLoad={onIFrameLoad} src={`logfile://${path}`} />
    ) : type === StateType.installation ||
      type === StateType.externalConfig ? null : (
      <JSONView data={data} raw={raw} state={state} />
    );
  const contentCard =
    type === StateType.installation || type === StateType.externalConfig ? (
      <div />
    ) : (
      <Card>{content}</Card>
    );
  return (
    <div
      className="StateTable"
      style={{
        fontFamily: getFontForCSS(font),
      }}
    >
      <div className="StateTable-Content">
        {info}
        {contentCard}
      </div>
    </div>
  );
});
