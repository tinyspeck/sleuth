import React, { useCallback } from 'react';
import { observer } from 'mobx-react';

import { SleuthState } from '../state/sleuth';
import {
  ProcessedLogFile,
  ProcessedLogFiles,
  UnzippedFile,
  ValidSuggestion,
} from '../../interfaces';
import { isProcessedLogFile } from '../../utils/is-logfile';
import { AutoComplete, Flex, Input, Modal, Space, Typography } from 'antd';
import {
  FileTextOutlined,
  FileZipOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  MacCommandOutlined,
  MenuOutlined,
  PoweroffOutlined,
  SettingOutlined,
} from '@ant-design/icons';

type AutoCompleteOptions = React.ComponentProps<typeof AutoComplete>['options'];

export interface SpotlightProps {
  state: SleuthState;
}

export const Spotlight = observer((props: SpotlightProps): JSX.Element => {
  const { isSpotlightOpen, toggleSpotlight } = props.state;

  const getItems: () => AutoCompleteOptions = useCallback(() => {
    const {
      openFile,
      processedLogFiles,
      reset,
      selectLogFile,
      suggestions,
      toggleSidebar,
    } = props.state;
    const spotSuggestions: AutoCompleteOptions = suggestions
      .filter((s) => !('error' in s))
      .map((s: ValidSuggestion) => ({
        label: (
          <Flex justify="space-between">
            <Space>
              {s.filePath.endsWith('zip') ? (
                <FileZipOutlined />
              ) : (
                <FolderOpenOutlined />
              )}
              <span>{s.filePath.split(/[/\\]/).pop() || ''}</span>
            </Space>
            <Typography.Text type="secondary">{s.age} old</Typography.Text>
          </Flex>
        ),
        value: s.filePath.split(/[/\\]/).pop() || '',
        click: () => {
          openFile(s.filePath);
        },
      }));

    const logFileSuggestions: AutoCompleteOptions = [];

    if (processedLogFiles) {
      Object.keys(processedLogFiles).forEach((key: keyof ProcessedLogFiles) => {
        const keyFiles: Array<ProcessedLogFile | UnzippedFile> =
          processedLogFiles[key];
        keyFiles.forEach((logFile) => {
          if (isProcessedLogFile(logFile)) {
            logFileSuggestions.push({
              label: (
                <Flex justify="space-between">
                  <Space>
                    <FileTextOutlined />
                    <Typography.Text>
                      {logFile.logFile.fileName}
                    </Typography.Text>
                  </Space>
                  <Typography.Text type="secondary">
                    {logFile.logEntries.length} entries
                  </Typography.Text>
                </Flex>
              ),
              value: logFile.logFile.fileName,
              click: () => {
                selectLogFile(logFile);
              },
            });
          } else {
            logFileSuggestions.push({
              label: (
                <Flex justify="space-between">
                  <Space>
                    <SettingOutlined />
                    <Typography.Text>{logFile.fileName}</Typography.Text>
                  </Space>
                  <Typography.Text type="secondary">State</Typography.Text>
                </Flex>
              ),
              value: logFile.fileName,
              click: () => {
                selectLogFile(logFile);
              },
            });
          }
        });
      });
    }

    const appSuggestions = [
      {
        label: (
          <Space>
            <PoweroffOutlined />
            Quit Sleuth
          </Space>
        ),
        value: 'quit',
        click: async () => await window.Sleuth.quit(),
      },
      {
        label: (
          <Space>
            <HomeOutlined />
            Go Home
          </Space>
        ),
        value: 'home',
        click: () => {
          reset(true);
        },
      },
      {
        label: (
          <Space>
            <MenuOutlined />
            Toggle Sidebar
          </Space>
        ),
        value: 'toggle-sidebar',
        click: () => {
          toggleSidebar();
        },
      },
    ];

    return [
      {
        label: (
          <Space>
            <FolderOpenOutlined />
            <span>Current Log Files</span>
          </Space>
        ),
        options: [...logFileSuggestions],
      },
      {
        label: (
          <Space>
            <FolderAddOutlined />
            <span>Log Bundles on Disk</span>
          </Space>
        ),
        options: [...spotSuggestions],
      },
      {
        label: (
          <Space>
            <MacCommandOutlined />
            <span>App Commands</span>
          </Space>
        ),
        options: [...appSuggestions],
      },
    ];
  }, [props.state]);

  return (
    <Modal
      width={800}
      open={isSpotlightOpen}
      onCancel={toggleSpotlight}
      closable={false}
      footer={null}
    >
      <AutoComplete
        ref={(el) => {
          // autofocus hack
          // https://stackoverflow.com/questions/60877390/why-the-autofocus-isnt-working-in-reactjs-with-antd
          setTimeout(() => el?.focus(), 0);
        }}
        style={{ width: '100%' }}
        options={getItems()}
        onSelect={(_, opt) => {
          if (opt?.click) {
            toggleSpotlight();
            opt.click();
          }
        }}
        filterOption={(inputValue, option) => {
          return (
            option?.value?.toUpperCase().indexOf(inputValue.toUpperCase()) > -1
          );
        }}
      >
        <Input.Search size="large" placeholder="Search..." />
      </AutoComplete>
    </Modal>
  );
});
