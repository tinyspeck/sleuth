import { observer } from 'mobx-react';
import { SleuthState } from '../../state/sleuth';
import React from 'react';
import classNames from 'classnames';

import { LogEntry, LogLevel } from '../../../interfaces';
import { LogLineData } from './data';
import { Timestamp } from './timestamp';
import { getIsBookmark, toggleBookmark } from '../../state/bookmarks';
import { Button, Card, Flex, Space, Tag } from 'antd';
import {
  BookFilled,
  BookOutlined,
  CloseOutlined,
  ExportOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { logColorMap } from '../log-table';
import { getCopyText } from '../../state/copy';
import { toJS } from 'mobx';

export interface LogLineDetailsProps {
  state: SleuthState;
}

const levelColorMap: Record<LogLevel, string> = {
  [LogLevel.debug]: 'blue',
  [LogLevel.info]: 'default',
  [LogLevel.warn]: 'orange',
  [LogLevel.error]: 'red',
};

export const LogLineDetails = observer((props: LogLineDetailsProps) => {
  const { isDetailsVisible } = props.state;
  if (!isDetailsVisible) return null;

  const levels = Array.from(
    new Set(getProperties<string>(props.state, 'level')),
  ).join(', ');
  const logTypes = Array.from(
    new Set(getProperties<string>(props.state, 'logType')),
  );
  const type = logTypes.length > 1 ? 'multiple' : logTypes[0];
  const message = getProperties<string>(props.state, 'message').join('\n');

  const { selectedEntry, selectedRangeEntries } = props.state;

  return (
    <div
      className={classNames('Details', {
        IsVisible: isDetailsVisible,
      })}
      role="dialog"
      aria-label="Log Line Details"
    >
      <Card
        style={{
          height: '100%',
          borderRadius: 0,
        }}
        title={<span title={message}>{message}</span>}
        extra={
          <div className="Details-LogType">
            <Space>
              <Space.Compact>
                <Button
                  size="small"
                  onClick={() => {
                    if (selectedEntry) {
                      const copyText = getCopyText(selectedEntry);
                      window.Sleuth.clipboard.writeText(copyText);
                    }
                  }}
                >
                  <PaperClipOutlined />
                  Copy
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    if (selectedEntry) {
                      const { sourceFile, line } = selectedEntry;
                      window.Sleuth.openLineInSource(line, sourceFile, {
                        defaultEditor: toJS(props.state.defaultEditor),
                      });
                    }
                  }}
                >
                  <ExportOutlined />
                  View in Source
                </Button>
                <Button
                  size="small"
                  onClick={() => toggleBookmark(props.state)}
                >
                  {getIsBookmark(props.state) ? (
                    <BookFilled />
                  ) : (
                    <BookOutlined />
                  )}
                  Bookmark
                </Button>
              </Space.Compact>
              <Button
                size="small"
                aria-label="Close"
                onClick={() =>
                  (props.state.isDetailsVisible = !props.state.isDetailsVisible)
                }
              >
                <CloseOutlined />
              </Button>
            </Space>
          </div>
        }
      >
        {selectedEntry?.meta && !selectedRangeEntries && (
          <Card>
            <LogLineData state={props.state} meta={selectedEntry.meta} />
          </Card>
        )}

        <Flex className="details-card-footer">
          <Timestamp
            timestamps={getProperties(props.state, 'timestamp')}
            momentValues={getProperties(props.state, 'momentValue')}
          />
          <Tag color={levelColorMap[levels] ?? 'default'}>level:{levels}</Tag>
          <Tag color={logColorMap[type] ?? 'default'}>process:{type}</Tag>
        </Flex>
      </Card>
    </div>
  );
});

/**
 * Get an array of all the details for the currently selected entries.
 *
 * @param {keyof LogEntry} key
 * @memberof LogLineDetails
 */
function getProperties<T>(state: SleuthState, key: keyof LogEntry): T[] {
  const { selectedEntry, selectedRangeEntries } = state;

  if (selectedRangeEntries && selectedRangeEntries.length > 0) {
    return selectedRangeEntries.map((v) => v[key] as unknown as T);
  } else if (selectedEntry) {
    return [selectedEntry[key] as unknown as T];
  }

  return [];
}
// }
