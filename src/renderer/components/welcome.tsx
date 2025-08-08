import React, { useState, useEffect, useCallback } from 'react';

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
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { observer } from 'mobx-react';

import { getSleuth } from '../sleuth';
import { SleuthState } from '../state/sleuth';
import { isToday, isThisWeek } from 'date-fns';
import { Suggestion, ValidSuggestion } from '../../interfaces';

import classNames from 'classnames';

export interface WelcomeProps {
  sleuth?: string;
  state: SleuthState;
}

const iconStyle = {
  fontSize: 36,
};

export const Welcome = observer((props: WelcomeProps) => {
  const sleuth = props.sleuth || getSleuth();
  const [downloadsDir, setDownloadsDir] = useState<string | undefined>();

  const deleteSuggestion = useCallback(
    async (filePath: string) => {
      await window.Sleuth.deleteSuggestion(filePath);
      await props.state.getSuggestions();
    },
    [props.state],
  );

  const deleteSuggestions = useCallback(
    async (filePaths: string[]) => {
      await window.Sleuth.deleteSuggestions(filePaths);
      await props.state.getSuggestions();
    },
    [props.state],
  );

  const logFileDescription = (item: ValidSuggestion): React.ReactNode => {
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
          {prettyPlatform(item.platform)} logs from {appVersionElem}, {item.age}{' '}
          old
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
  };

  const prettyPlatform = (platform: string) => {
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

  const platformIcon = (platform: string) => {
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

  const renderDeleteStale = (staleFiles: Suggestion[]): JSX.Element | null => {
    if (staleFiles.length > 0) {
      const stalePaths = staleFiles.map((f) => f.filePath);
      return (
        <Button
          className="welcome__delete-stale"
          type="primary"
          danger={true}
          icon={<DeleteOutlined />}
          onClick={() => deleteSuggestions(stalePaths)}
        >
          Delete stale logs
        </Button>
      );
    }

    return null;
  };

  const renderSuggestions = (): JSX.Element | null => {
    const today: Suggestion[] = [];
    const thisWeek: Suggestion[] = [];
    const stale: Suggestion[] = [];

    const { suggestions } = props.state;

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
              props.state.openFile(item.filePath);
            };

            const deleteItem = (e: React.MouseEvent) => {
              e.stopPropagation();
              deleteSuggestion(item.filePath);
            };

            return (
              <List.Item
                className={classNames('welcome__suggestion-list-item', {
                  'welcome__suggestion-list-item--disabled': 'error' in item,
                })}
                actions={[
                  <Button
                    className="welcome__suggestion-delete-btn"
                    type="primary"
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
                {'error' in item ? (
                  <List.Item.Meta
                    avatar={<ExclamationCircleOutlined style={iconStyle} />}
                    title={<span>{item.filePath.split('/').pop()}</span>}
                    description={`Failed to parse ZIP! ${item.error.message}`}
                  />
                ) : (
                  <List.Item.Meta
                    avatar={platformIcon(item.platform)}
                    title={<span>{item.filePath.split('/').pop()}</span>}
                    description={logFileDescription(item)}
                  />
                )}
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
          {renderDeleteStale(stale)}
        </div>
      );
    }

    return null;
  };

  useEffect(() => {
    const getDownloadsPath = async () => {
      setDownloadsDir(await window.Sleuth.getPath('downloads'));
    };

    getDownloadsPath();

    const unmountListener = window.Sleuth.setupSuggestionsUpdated(
      async (_event, suggestions: Suggestion[]) => {
        await props.state.getSuggestions(suggestions);
      },
    );

    return () => {
      unmountListener();
    };
  }, [props.state]);

  const suggestions = renderSuggestions();

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
            Open from <code>{downloadsDir}</code>
          </div>
          {suggestions}
        </div>
      ) : props.state.suggestionsLoaded ? (
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
});
