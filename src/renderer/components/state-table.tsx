import React from 'react';
import fs from 'fs-extra';
import { shell } from 'electron';
import { Card, Elevation } from '@blueprintjs/core';
import debug from 'debug';

import { SelectableLogFile, UnzippedFile } from '../../interfaces';
import { SleuthState } from '../state/sleuth';
import { getSettingsInfo } from '../analytics/settings-analytics';
import { getEnvInfo } from '../analytics/environment-analytics';
import { getLocalSettingsInfo } from '../analytics/local-settings-analytics';
import { getNotifWarningsInfo } from '../analytics/notification-warning-analytics';
import { JSONView } from './json-view';
import { parseJSON } from '../../utils/parse-json';
import { getFontForCSS } from './preferences-font';
import { getSentryHref, convertInstallation } from '../sentry';
import isEqual from 'lodash.isequal';

const d = debug('sleuth:statetable');

export interface StateTableProps {
  state: SleuthState;
}

export interface RootData {
  default: object | undefined;
  policies: object | undefined;
}

export interface StateTableState<T extends keyof StateData> {
  data?: StateData[T];
  path?: string;
  raw?: string;
  rootStateData?: StateData[T];
  externalData?: StateData[T];
}

export enum StateType {
  'settings',
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class StateTable extends React.Component<
  StateTableProps,
  StateTableState<any>
> {
  constructor(props: StateTableProps) {
    super(props);

    this.state = {};
  }

  public componentDidMount() {
    const { selectedLogFile } = this.props.state;

    if (this.isStateFile(selectedLogFile)) {
      this.parse(selectedLogFile);
    }

    // Need to find root-state and external-config files when mounted to store data in state
    const files = this.props.state.processedLogFiles?.state;
    if (files) {
      const foundExternalConfigFile = files.find((file) =>
        this.isExternalConfigFile(file),
      );
      const foundRootStateFile = files.find((file) =>
        this.isRootStateFile(file),
      );
      if (foundExternalConfigFile) {
        this.parse(foundExternalConfigFile);
      }
      if (foundRootStateFile) {
        this.parse(foundRootStateFile);
      }
    }
  }

  public UNSAFE_componentWillReceiveProps(nextProps: StateTableProps) {
    const nextFile = nextProps.state.selectedLogFile;

    if (this.isStateFile(nextFile)) {
      this.parse(nextFile);
    }
  }

  public render(): JSX.Element {
    const { data, path, raw } = this.state;
    const { font } = this.props.state;

    const info = this.renderInfo();
    const type = this.getFileType();
    const onIFrameLoad = function (this: HTMLIFrameElement) {
      if (this?.contentWindow) {
        const { document: idoc } = this.contentWindow;
        this.height = `${idoc.body.scrollHeight}px`;
      }
    };

    const content =
      !data && path ? (
        <iframe sandbox="" onLoad={onIFrameLoad} src={path} />
      ) : type === StateType.installation ||
        type === StateType.externalConfig ||
        type === StateType.rootState ? null : (
        <JSONView data={data} raw={raw} state={this.props.state} />
      );
    const contentCard =
      type === StateType.installation ||
      type === StateType.externalConfig ||
      type == StateType.rootState ? (
        <div />
      ) : (
        <Card> {content} </Card>
      );
    return (
      <div className="StateTable" style={{ fontFamily: getFontForCSS(font) }}>
        <div className="StateTable-Content">
          {info}
          {contentCard}
        </div>
      </div>
    );
  }

  private getFileType(): StateType {
    const { selectedLogFile } = this.props.state;

    if (!this.isStateFile(selectedLogFile)) {
      throw new Error('StateTable: No file');
    }

    if (this.isHtmlFile(selectedLogFile)) {
      return StateType.html;
    }

    if (this.isNotifsFile(selectedLogFile)) {
      return StateType.notifs;
    }

    if (this.isInstallationFile(selectedLogFile)) {
      return StateType.installation;
    }

    if (this.isRootStateFile(selectedLogFile)) {
      return StateType.rootState;
    }

    if (this.isExternalConfigFile(selectedLogFile)) {
      return StateType.externalConfig;
    }

    if (selectedLogFile.fileName === 'environment.json') {
      return StateType.environment;
    }

    if (selectedLogFile.fileName === 'local-settings.json') {
      return StateType.localSettings;
    }

    const nameMatch = selectedLogFile.fileName.match(/slack-(\w*)/);
    const type =
      nameMatch && nameMatch.length > 1 ? nameMatch[1] : StateType.unknown;

    return type as unknown as StateType;
  }

  private async parse(file: UnzippedFile) {
    if (!file) {
      return;
    }

    d(`Reading ${file.fullPath}`);

    if (this.isHtmlFile(file)) {
      this.setState({ data: undefined, path: file.fullPath });
    } else if (this.isInstallationFile(file)) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf8');
        this.setState({ data: [content], path: undefined });
      } catch (error) {
        d(error);
      }
    } else if (this.isRootStateFile(file)) {
      try {
        const rawRootState = await fs.readFile(file.fullPath, 'utf8');
        this.setState({
          rootStateData: parseJSON(rawRootState),
          path: undefined,
        });
      } catch (error) {
        d(error);
      }
    } else if (this.isExternalConfigFile(file)) {
      try {
        const raw = await fs.readFile(file.fullPath, 'utf8');
        this.setState({
          externalData: parseJSON(raw),
          path: undefined,
        });
      } catch (error) {
        d(error);
      }
    } else {
      try {
        const raw = await fs.readFile(file.fullPath, 'utf8');
        this.setState({ data: parseJSON(raw), path: undefined, raw });
      } catch (error) {
        d(error);
      }
    }
  }

  private renderSettingsInfo(): JSX.Element | null {
    return (
      <Card className="StateTable-Info" elevation={Elevation.ONE}>
        {...getSettingsInfo(
          (this.state as StateTableState<StateType.settings>).data || {},
        )}
      </Card>
    );
  }

  private renderNotifsInfo(): JSX.Element | null {
    const { data } = this.state;

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
  }

  private renderInstallationInfo(): JSX.Element | null {
    const { data } = this.state;

    if (Array.isArray(data) && data.length > 0) {
      const id = convertInstallation(data[0]);
      const href = getSentryHref(id);

      return (
        <Card className="StateTable-Info">
          See exceptions in Sentry:{' '}
          <a onClick={() => shell.openExternal(href)}>{id}</a>
        </Card>
      );
    }

    return <Card className="StateTable-Info">No installation id found.</Card>;
  }

  private renderEnvironmentInfo(): JSX.Element | null {
    return (
      <Card className="StateTable-Info" elevation={Elevation.ONE}>
        {...getEnvInfo(this.state.data || {})}
      </Card>
    );
  }

  private renderRootState(): JSX.Element | null {
    const content = (
      <JSONView data={this.state.rootStateData} state={this.props.state} />
    );

    return (
      <Card className="StateTable-Content" elevation={Elevation.ONE}>
        {content}
      </Card>
    );
  }

  private renderLocalSettings(): JSX.Element | null {
    return (
      <Card className="StateTable-Info" elevation={Elevation.ONE}>
        {...getLocalSettingsInfo(this.state.data || {})}
      </Card>
    );
  }

  private renderExternalConfig(): JSX.Element | null {
    if (this.state.externalData && this.state.rootStateData) {
      const externalConfigData = this.getPoliciesAndDefaultsExternalConfig();
      const externalConfigDefaultJSON = (
        <JSONView data={externalConfigData.default} state={this.props.state} />
      );
      const externalConfigPolicyJSON = (
        <JSONView data={externalConfigData.policies} state={this.props.state} />
      );
      const rootData = this.getPoliciesAndDefaultsRoot();
      const rootDefaultJSON = (
        <JSONView data={rootData.default} state={this.props.state} />
      );
      const rootPoliciesJSON = (
        <JSONView data={rootData.policies} state={this.props.state} />
      );

      const compareDefaults = isEqual(
        rootData.default,
        externalConfigData.default,
      );
      const comparePolicies = isEqual(
        rootData.policies,
        externalConfigData.policies,
      );

      const message = this.getMessage(compareDefaults, comparePolicies);

      return (
        <div>
          <div id="externalConfigContainerTwo">
            <div id="comparisons">
              <Card className="StateTable-Info" elevation={Elevation.ONE}>
                <div id="externalConfigContainer">
                  <div className="fileDisplay">
                    <p className="fileHeaderStyle">
                      Root-State Policies + Defaults
                    </p>
                    <div className="jsonContainer">
                      <p>{rootDefaultJSON}</p>
                      <p>{rootPoliciesJSON}</p>
                    </div>
                  </div>
                  <div className="fileDisplay">
                    <p className="fileHeaderStyle">
                      External Config Policies + Defaults
                    </p>
                    <div className="jsonContainer">
                      <p>{externalConfigDefaultJSON}</p>
                      <p>{externalConfigPolicyJSON}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
            <div id="resultContainer">
              <Card className="StateTable-Info" elevation={Elevation.ONE}>
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
  }

  private getPoliciesAndDefaultsRoot(): RootData {
    const { settings } = this.state.rootStateData;
    const { itDefaults } = settings;
    const { itPolicy } = settings;

    const data: RootData = {
      default: { defaults: itDefaults },
      policies: { policies: itPolicy },
    };

    return data;
  }

  private getPoliciesAndDefaultsExternalConfig(): RootData {
    const { defaults, ...policies } = this.state.externalData;

    const data: RootData = {
      default: { defaults: defaults },
      policies: { policies: policies },
    };

    return data;
  }

  private getMessage(
    defaultMatch: boolean,
    policiesMatch: boolean,
  ): JSX.Element | null {
    if (defaultMatch && policiesMatch) {
      return (
        <div>
          <p className="matchMessage">No problems detected</p>
          <p>Both files match</p>
        </div>
      );
    } else if (!defaultMatch && policiesMatch) {
      return (
        <div>
          <p className="errorMessage">Problems detected</p>
          <p>
            Files do not match: <strong>defaults</strong> differ
          </p>
        </div>
      );
    } else if (defaultMatch && !policiesMatch) {
      return (
        <div>
          <p className="errorMessage">Problems detected</p>
          <p>
            Files do not match: <strong>policies</strong> differ
          </p>
        </div>
      );
    } else {
      return (
        <div>
          <p className="errorMessage">Problems detected</p>
          <p>
            Files do not match: <strong>policies</strong> and{' '}
            <strong>defaults</strong> differ
          </p>
        </div>
      );
    }
  }

  private renderInfo(): JSX.Element | null {
    const type = this.getFileType();

    if (type === StateType.settings) {
      return this.renderSettingsInfo();
    } else if (type === StateType.notifs) {
      return this.renderNotifsInfo();
    } else if (type === StateType.installation) {
      return this.renderInstallationInfo();
    } else if (type === StateType.environment) {
      return this.renderEnvironmentInfo();
    } else if (type === StateType.localSettings) {
      return this.renderLocalSettings();
    } else if (type === StateType.externalConfig) {
      return this.renderExternalConfig();
    } else if (type === StateType.rootState) {
      return this.renderRootState();
    } else {
      return null;
    }
  }

  private isStateFile(file?: SelectableLogFile): file is UnzippedFile {
    const _file = file as UnzippedFile;
    return !!_file.fullPath;
  }

  private isHtmlFile(file: UnzippedFile) {
    return file.fullPath.endsWith('.html');
  }

  private isNotifsFile(file: UnzippedFile) {
    return file.fullPath.endsWith('notification-warnings.json');
  }

  private isInstallationFile(file: UnzippedFile) {
    return file.fullPath.endsWith('installation');
  }

  private isExternalConfigFile(file: UnzippedFile) {
    return file.fullPath.endsWith('external-config.json');
  }

  private isRootStateFile(file: UnzippedFile) {
    return file.fullPath.endsWith('root-state.json');
  }
}
