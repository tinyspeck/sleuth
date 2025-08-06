import { observer } from 'mobx-react';
import { SleuthState } from '../../state/sleuth';
import React, { useEffect, useState } from 'react';
import { format as dateFormatter } from 'date-fns';

import { getSleuth } from '../../sleuth';
import {
  DATE_TIME_FORMATS,
  Editor,
  EDITORS,
  FONTS,
  getFontForCSS,
  TRACE_VIEWER,
} from './preferences-utils';
import { SORT_DIRECTION } from '../log-table-constants';
import {
  Alert,
  Checkbox,
  Divider,
  Form,
  Modal,
  Radio,
  Select,
  Space,
  Typography,
} from 'antd';
import {
  CodeOutlined,
  FieldTimeOutlined,
  FontColorsOutlined,
} from '@ant-design/icons';

export enum ColorTheme {
  Light = 'light',
  Dark = 'dark',
  System = 'system',
}

export interface PreferencesState {
  isOpen: boolean;
}

export interface PreferencesProps {
  state: SleuthState;
}

export const Preferences = observer((props: PreferencesProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  useEffect(() => {
    const cleanup = window.Sleuth.setupPreferencesShow(() => setIsOpen(true));
    return () => {
      cleanup();
    };
  }, []);

  const {
    colorTheme,
    dateTimeFormat_v3,
    defaultEditor,
    defaultSort,
    font,
    isMarkIcon,
    isOpenMostRecent,
    isSmartCopy,
  } = props.state;
  return (
    <Modal
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      width={700}
      footer={null}
      title={<Typography.Title level={4}>Preferences</Typography.Title>}
      className="Preferences"
    >
      <Alert
        type="info"
        showIcon={true}
        message={`
        You're running Sleuth ${window.Sleuth.sleuthVersion} ${getSleuth()} 
        with Electron ${window.Sleuth.versions.electron} and Chrome 
        ${window.Sleuth.versions.chrome}.`}
      ></Alert>
      <Typography.Title level={5}>Appearance</Typography.Title>
      <Form.Item layout="vertical" label="Font">
        <Space direction="vertical">
          <Select
            prefix={<FontColorsOutlined />}
            showSearch
            style={{ width: 200 }}
            defaultValue={font}
            options={FONTS.map((f) => ({
              value: f,
              label: <span style={{ fontFamily: getFontForCSS(f) }}>{f}</span>,
            }))}
            onChange={(value) => {
              props.state.font = value;
            }}
          />
          <Typography.Text type="secondary">
            Choose a custom font to override how Sleuth renders various text
            elements.
          </Typography.Text>
        </Space>
      </Form.Item>
      <Form.Item layout="vertical" label="Color Theme">
        <Space direction="vertical">
          <Radio.Group
            value={colorTheme}
            options={[
              { value: ColorTheme.Light, label: '🌕 Light' },
              { value: ColorTheme.Dark, label: '🌑 Dark' },
              { value: ColorTheme.System, label: '🌗 System' },
            ]}
            onChange={(event) => {
              props.state.colorTheme = event.target.value;
            }}
          />
          <Typography.Text type="secondary">
            Choose if Sleuth should be in light or dark mode.
          </Typography.Text>
        </Space>
      </Form.Item>

      <Space direction="vertical">
        <Checkbox
          checked={isMarkIcon}
          onChange={(e) => (props.state.isMarkIcon = e.target.checked)}
        >
          <span>Use the Mark Christian™️ icon</span>
        </Checkbox>
        <Typography.Text type="secondary">
          Mark did some art and made a special Sleuth icon (requires a restart).
        </Typography.Text>
      </Space>
      <Divider />
      <Typography.Title level={5}>Log Settings</Typography.Title>
      <Form.Item layout="vertical" label="Date Format">
        <Space direction="vertical">
          <Select
            prefix={<FieldTimeOutlined />}
            style={{ width: 200 }}
            defaultValue={dateTimeFormat_v3}
            options={DATE_TIME_FORMATS.map((f) => ({
              value: f,
              label: <span>{dateFormatter(1647029957123, f)}</span>,
            }))}
            onChange={(value) => {
              props.state.dateTimeFormat_v3 = value;
            }}
          />
          <Typography.Text type="secondary">
            Choose a custom format for dates to override how timestamps will be
            displayed.
          </Typography.Text>
        </Space>
      </Form.Item>
      <Form.Item layout="vertical" label="Sort Direction">
        <Space direction="vertical">
          <Radio.Group
            value={defaultSort}
            options={[
              { value: SORT_DIRECTION.ASC, label: 'Ascending' },
              { value: SORT_DIRECTION.DESC, label: 'Descending' },
            ]}
            onChange={(event) => {
              props.state.defaultSort = event.target.value;
            }}
          />
          <Typography.Text type="secondary">
            Sort logs by oldest (ascending) or newest (descending).
          </Typography.Text>
        </Space>
      </Form.Item>
      <Form.Item layout="vertical" label="Default Editor">
        <Space direction="vertical">
          <Select
            prefix={<CodeOutlined />}
            style={{ width: 200 }}
            defaultValue={defaultEditor?.name || 'VSCODE'}
            options={Object.entries(EDITORS).map(([editor, details]) => ({
              value: editor,
              label: <span>{details.name}</span>,
            }))}
            onChange={(value: keyof Editor) => {
              const editor = EDITORS[value];
              props.state.defaultEditor = editor ?? EDITORS.VSCODE;
            }}
          />
          <Typography.Text type="secondary">
            Sleuth can open log source files in your favorite editor.
          </Typography.Text>
        </Space>
      </Form.Item>
      <Form.Item layout="vertical" label="Default Trace Viewer">
        <Space direction="vertical">
          <Radio.Group
            value={props.state.defaultTraceViewer}
            options={[
              { value: TRACE_VIEWER.CHROME, label: 'Chrome DevTools' },
              { value: TRACE_VIEWER.PERFETTO, label: 'Perfetto' },
            ]}
            onChange={(event) => {
              props.state.defaultTraceViewer = event.target.value;
            }}
          />
          <Typography.Text type="secondary">
            Choose the default viewer for trace files.
          </Typography.Text>
        </Space>
      </Form.Item>
      <Divider />
      <Typography.Title level={5}>Runtime settings</Typography.Title>
      <Space direction="vertical">
        <Space direction="vertical">
          <Checkbox
            checked={isOpenMostRecent}
            onChange={(e) => (props.state.isOpenMostRecent = e.target.checked)}
          >
            Always open most recent file
          </Checkbox>
          <Typography.Text type="secondary">
            Skip the home screen and always open most recent file automatically.
          </Typography.Text>
        </Space>
        <Space direction="vertical">
          <Checkbox
            checked={isSmartCopy}
            onChange={(e) => (props.state.isSmartCopy = e.target.checked)}
          >
            <span>Enable &quot;smart copy&quot;</span>
          </Checkbox>
          <Typography.Text type="secondary">
            Copy whole log lines. Disable this if you are having trouble with
            copy & paste in Sleuth.
          </Typography.Text>
        </Space>
      </Space>
    </Modal>
  );
});
