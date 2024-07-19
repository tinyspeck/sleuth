import React from 'react';
import path from 'path';

import { Button, List, Result, Spin, Tooltip, Typography } from 'antd';
import {
  DeleteOutlined,
  FolderOpenTwoTone,
  LinuxOutlined,
  WindowsFilled,
  AppleFilled,
  MobileFilled,
  AndroidFilled,
  SlackCircleFilled,
} from '@ant-design/icons';
import { observer } from 'mobx-react';

import { getSleuth } from '../sleuth';
import { deleteSuggestion, deleteSuggestions } from '../suggestions';
import { SleuthState } from '../state/sleuth';
import { isToday, isThisWeek } from 'date-fns';
import { Suggestion } from '../../interfaces';

import fs from 'fs-extra';
import { getPath } from '../ipc';
import { FSWatcher } from 'fs';

export interface WelcomeState {
  sleuth: string;
  watcher?: FSWatcher;
  downloadsDir?: string;
}

export interface WelcomeProps {
  sleuth?: string;
  state: SleuthState;
}

const iconStyle = {
  fontSize: 36,
};

@observer
export class Welcome extends React.Component<
  WelcomeProps,
  Partial<WelcomeState>
> {
  constructor(props: WelcomeProps) {
    super(props);

    this.state = {
      sleuth: props.sleuth || getSleuth(),
      watcher: undefined,
    };
  }

  public async componentDidMount(): Promise<void> {
    const downloadsDir = await getPath('downloads');
    this.setState({
      watcher: fs.watch(downloadsDir, async () => {
        await this.props.state.getSuggestions();
      }),
      downloadsDir,
    });
  }

  public componentWillUnmount(): void {
    this.state.watcher?.close();
    this.setState({ watcher: undefined });
  }

  public async deleteSuggestion(filePath: string) {
    await deleteSuggestion(filePath);
    await this.props.state.getSuggestions();
  }

  public async deleteSuggestions(filePaths: Array<string>) {
    await deleteSuggestions(filePaths);
    await this.props.state.getSuggestions();
  }

  private logFileDescription(item: Suggestion): React.ReactNode {
    let appVersionToUse = item.appVersion;
    if (item.platform === 'android') {
      appVersionToUse = appVersionToUse.split('.', 3).join('.');
    }

    let appVersionElem = <>Slack@{appVersionToUse}</>;
    if (appVersionToUse !== item.appVersion) {
      appVersionElem = (
        <Tooltip title={`Slack@${item.appVersion}`}>
          <span className="welcome__suggestion-details">{appVersionElem}</span>
        </Tooltip>
      );
    }

    if (item.platform !== 'unknown') {
      return (
        <>
          {this.prettyPlatform(item.platform)} logs from {appVersionElem},{' '}
          {item.age} old
        </>
      );
    }

    if (item.appVersion !== '0.0.0') {
      return (
        <>
          Logs from {appVersionElem} on an unknown platform, {item.age} old
        </>
      );
    }

    return `Unknown logs, ${item.age} old`;
  }

  private prettyPlatform = (platform: string) => {
    switch (platform) {
      case 'win32':
        return 'Windows';
      case 'darwin':
        return 'macOS';
      case 'linux':
        return 'Linux';
      case 'ios':
        return 'iOS';
      case 'android':
        return 'Android';
      default:
        return 'Unknown';
    }
  };

  private platformIcon = (platform: string) => {
    switch (platform) {
      case 'win32':
        return <WindowsFilled style={iconStyle} />;
      case 'darwin':
        return <AppleFilled style={iconStyle} />;
      case 'linux':
        return <LinuxOutlined style={iconStyle} />;
      case 'ios':
        return <MobileFilled style={iconStyle} />;
      case 'android':
        return <AndroidFilled style={iconStyle} />;
      default:
        return <SlackCircleFilled style={iconStyle} />;
    }
  };

  public renderSuggestions(): JSX.Element | null {
    const { openFile } = this.props.state;

    const today: Suggestion[] = [];
    const thisWeek: Suggestion[] = [];
    const stale: Suggestion[] = [];

    const { suggestions } = this.props.state;

    for (const item of suggestions) {
      if (isToday(item.mtimeMs)) {
        today.push(item);
      } else if (isThisWeek(item.mtimeMs)) {
        thisWeek.push(item);
      } else {
        stale.push(item);
      }
    }

    const list = (data: Suggestion[]) => {
      return (
        <List
          itemLayout="horizontal"
          dataSource={data}
          renderItem={(item) => {
            const openItem = (e: React.MouseEvent) => {
              e.preventDefault();
              openFile(item.filePath);
            };
            const deleteItem = (e: React.MouseEvent) => {
              e.stopPropagation();
              this.deleteSuggestion(item.filePath);
            };

            return (
              <List.Item
                className="welcome__suggestion-list-item"
                actions={[
                  <Button
                    danger={true}
                    key="list-delete"
                    onClick={deleteItem}
                    icon={<DeleteOutlined />}
                  >
                    Delete
                  </Button>,
                ]}
                onClick={openItem}
              >
                <List.Item.Meta
                  avatar={this.platformIcon(item.platform)}
                  title={<span>{path.basename(item.filePath)}</span>}
                  description={this.logFileDescription(item)}
                />
              </List.Item>
            );
          }}
        />
      );
    };

    if (suggestions.length > 0) {
      return (
        <div className="welcome__suggestion-list">
          {today.length > 0 && (
            <>
              <p className="welcome__suggestion-span">Today</p>
              {list(today)}
            </>
          )}
          {thisWeek.length > 0 && (
            <>
              <p className="welcome__suggestion-span">Earlier this week</p>
              {list(thisWeek)}
            </>
          )}

          {stale.length > 0 && (
            <>
              <p className="welcome__suggestion-span">Stale</p>
              {list(stale)}
            </>
          )}
          {this.renderDeleteStale(stale)}
        </div>
      );
    }

    return null;
  }

  public renderDeleteStale(staleFiles: Suggestion[]): JSX.Element | null {
    if (staleFiles.length > 0) {
      const stalePaths = staleFiles.map((f) => f.filePath);
      return (
        <Button
          className="welcome__delete-stale"
          type="primary"
          danger={true}
          icon={<DeleteOutlined />}
          onClick={() => this.deleteSuggestions(stalePaths)}
        >
          Delete stale logs
        </Button>
      );
    }

    return null;
  }

  public render() {
    const { sleuth } = this.state;

    const suggestions = this.renderSuggestions();

    return (
      <div className="welcome css-var-">
        <div>
          <Typography.Title level={1} className="welcome__title">
            <span className="welcome__title-emoji">{sleuth}</span> Sleuth
          </Typography.Title>
        </div>

        {suggestions ? (
          <div className="welcome__suggestion-container">
            <div className="welcome__suggestion-drag-and-drop-reminder">
              (or drag and drop logs)
            </div>
            <div className="welcome__downloads-dir">
              <code>{this.state.downloadsDir}</code>
            </div>
            {suggestions}
          </div>
        ) : this.props.state.suggestionsLoaded ? (
          <div className="welcome__drag-and-drop">
            <Result
              icon={<FolderOpenTwoTone />}
              title="You have no log bundles in your Downloads folder"
              subTitle="
            Drag and drop a ZIP archive or folder anywhere on this window"
            />
          </div>
        ) : (
          <Spin className="welcome__spinner" />
        )}
      </div>
    );
  }
}
