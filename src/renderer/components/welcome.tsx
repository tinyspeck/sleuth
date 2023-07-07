import React from 'react';
import path from 'path';

import { Button, List, Result, Spin, Typography } from 'antd';
import { WindowsOutlined, AppleOutlined, QqOutlined, SlackOutlined, DeleteOutlined } from '@ant-design/icons';
import { observer } from 'mobx-react';

import { getSleuth } from '../sleuth';
import { deleteSuggestion, deleteSuggestions } from '../suggestions';
import { SleuthState } from '../state/sleuth';
import { isBefore } from 'date-fns';
import { Suggestion } from '../../interfaces';

export interface WelcomeState {
  sleuth: string;
}

export interface WelcomeProps {
  sleuth?: string;
  state: SleuthState;
}

const iconStyle = {
  fontSize: 36,
};

@observer
export class Welcome extends React.Component<WelcomeProps, Partial<WelcomeState>> {
  constructor(props: WelcomeProps) {
    super(props);

    this.state = {
      sleuth: props.sleuth || getSleuth(),
    };
  }

  public async deleteSuggestion(filePath: string) {
    await deleteSuggestion(filePath);
    await this.props.state.getSuggestions();
  }

  public async deleteSuggestions(filePaths: Array<string>) {
    await deleteSuggestions(filePaths);
    await this.props.state.getSuggestions();
  }

  private logFileDescription(item: Suggestion) {
    if (item.platform !== 'unknown') {
      return `${this.prettyPlatform(item.platform)} logs from Slack@${item.appVersion}, ${item.age} old`;
    }

    if (item.appVersion !== '0.0.0') {
      return `Logs from Slack@${item.appVersion} on an unknown platform, ${item.age} old`;
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
      default:
        return 'Unknown';
    }
  }

  private platformIcon = (platform: string) => {
    switch (platform) {
      case 'win32':
        return <WindowsOutlined style={iconStyle} />;
      case 'darwin':
        return <AppleOutlined style={iconStyle} />;
      case 'linux':
        return <QqOutlined style={iconStyle} />;
      default:
        return <SlackOutlined style={iconStyle} />;
    }
  }

  public renderSuggestions(): JSX.Element | null {
    const { openFile } = this.props.state;

    if (this.props.state.suggestions?.length) {
      return (
        <div className='Suggestions'>
          <List
            itemLayout="horizontal"
            dataSource={this.props.state.suggestions || []}
            renderItem={(item) => (
              <List.Item
                actions={[
                  // <a key="list-loadmore-edit">edit</a>,
                  <a key="list-loadmore-more"><DeleteOutlined style={{ marginRight: 8 }} />Delete</a>
                ]}
              >
                <List.Item.Meta
                  avatar={this.platformIcon(item.platform)}
                  title={<a href="#" onClick={(e) => { e.preventDefault(); openFile(item.filePath); }}>{path.basename(item.filePath)}</a>}
                  description={this.logFileDescription(item)}
                />
              </List.Item>
            )}
          />
          {this.renderDeleteAll()}
        </div>
      );
    }

    return null;
  }

  public renderDeleteAll(): JSX.Element | null {
    const suggestions = this.props.state.suggestions || [];

    // Do we have any files older than 48 hours?
    const twoDaysAgo = Date.now() - 172800000;
    const toDeleteAll: Array<string> = [];

    suggestions.forEach((item) => {
      if (isBefore(item.mtimeMs, twoDaysAgo)) {
        toDeleteAll.push(item.filePath);
      }
    });

    if (toDeleteAll.length > 0) {
      return (
        <div style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            icon={<DeleteOutlined />}
            onClick={() => this.deleteSuggestions(toDeleteAll)}
          >
            Delete files older than 2 days
          </Button>
        </div>
      );
    }

    return null;
  }

  public render() {
    const { sleuth } = this.state;
    const scrollStyle: React.CSSProperties = {
      marginBottom: 24,
      overflowY: 'auto',
      minWidth: 480,
      width: '60%'
    };

    const suggestions = this.renderSuggestions();

    return (
      <div className='Welcome' style={{ justifyContent: suggestions ? undefined : 'end' }}>
        <div>
          <h1 className='Title'>
            <span className='Emoji'>{sleuth}</span>
            <span>Sleuth</span>
          </h1>
          <Typography.Title level={4}>Drop a logs zip file or folder anywhere on this window to open it.</Typography.Title>
        </div>

        {
          suggestions ? (
            <div style={scrollStyle}>
              <Typography.Title level={5}>From your Downloads folder, may we suggest:</Typography.Title>
              <div style={{ textAlign: 'initial' }}>
                {suggestions}
              </div>
            </div>
          ) : this.props.state.suggestionsLoaded ? (
            <Result
              subTitle="You have no logs in your Downloads folder"
              style={{ marginTop: 48 }}
            />
          ) : (
            <Spin className="loading-indicator" tip="Loading Suggestions" size="large">
              <div style={{ padding: 100 }} />
            </Spin>
          )
        }
      </div>
    );
  }
}
