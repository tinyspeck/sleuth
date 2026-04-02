import {
  Badge,
  Checkbox,
  Space,
  Tabs,
  Tooltip,
  Tree,
  TreeDataNode,
  Typography,
} from 'antd';
import classNames from 'classnames';
import { observer } from 'mobx-react';
import React, { Key, useCallback, useEffect, useState } from 'react';
import { SleuthState } from '../../state/sleuth';
import {
  LogType,
  ProcessableLogType,
  ProcessedLogFile,
  SelectableLogType,
  UnzippedFile,
} from '../../../interfaces';
import {
  ApartmentOutlined,
  ChromeOutlined,
  CloudOutlined,
  CommentOutlined,
  DesktopOutlined,
  DownloadOutlined,
  DownOutlined,
  ExceptionOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FileZipOutlined,
  GlobalOutlined,
  HeartOutlined,
  MacCommandOutlined,
  NotificationOutlined,
  PictureOutlined,
  SettingOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { isMergedLogFile } from '../../../utils/is-logfile';
import { getEnvironmentWarnings } from '../../analytics/environment-analytics';
import { getRootStateWarnings } from '../../analytics/root-state-analytics';
import { getTraceWarnings } from '../../analytics/trace-analytics';

interface SidebarFileTreeProps {
  state: SleuthState;
}

interface SidebarNodeData {
  file: UnzippedFile | ProcessedLogFile;
  type: SelectableLogType;
}

interface LogTypeCheckboxConfig {
  type: ProcessableLogType;
  label: string;
  icon: React.ReactNode;
}

const LOG_TYPE_CHECKBOXES: LogTypeCheckboxConfig[] = [
  {
    type: LogType.BROWSER,
    label: 'Browser Process',
    icon: <DesktopOutlined />,
  },
  {
    type: LogType.EPIC_TRACES,
    label: 'Epic Traces',
    icon: <ExperimentOutlined />,
  },
  { type: LogType.WEBAPP, label: 'WebApp', icon: <CommentOutlined /> },
  {
    type: LogType.SERVICE_WORKER,
    label: 'Service Worker',
    icon: <CloudOutlined />,
  },
  { type: LogType.CHROMIUM, label: 'Chromium', icon: <ChromeOutlined /> },
  { type: LogType.INSTALLER, label: 'Installer', icon: <DownloadOutlined /> },
];

const SidebarFileTree = observer((props: SidebarFileTreeProps) => {
  const [stateNodes, setStateNodes] = useState<TreeDataNode[]>([]);
  const [expandedStateKeys, setExpandedStateKeys] = useState<Key[]>();
  const [files, setFiles] = useState<
    Map<string, ProcessedLogFile | UnzippedFile>
  >(new Map());
  const [manualTab, setManualTab] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTree() {
      const { processedLogFiles } = props.state;

      if (!processedLogFiles) return;

      const filesMap = new Map<string, ProcessedLogFile | UnzippedFile>();

      const stateFileNodes = await Promise.all(
        processedLogFiles.state.map((file) => {
          filesMap.set(file.id, file);
          return getStateFileNode(file);
        }),
      );

      setFiles(filesMap);
      setStateNodes(stateFileNodes);
    }
    fetchTree().catch((error) => {
      console.error('Failed to build sidebar file tree:', error);
    });
  }, [props.state.processedLogFiles]);

  const onStateSelect = useCallback(
    (selectedKeys: Key[]) => {
      const selected = String(selectedKeys[0]);
      setManualTab(null);

      const file = files.get(selected);
      if (file) {
        props.state.selectLogFile(file);
      }
    },
    [props.state, files],
  );

  const onLogTypeToggle = useCallback(
    (logType: ProcessableLogType, checked: boolean) => {
      props.state.setLogTypeFilter({ [logType]: checked });

      // Ensure the ALL merged view is selected
      const { selectedLogFile } = props.state;
      if (
        !selectedLogFile ||
        !isMergedLogFile(selectedLogFile) ||
        selectedLogFile.logType !== LogType.ALL
      ) {
        props.state.selectLogFile(null, LogType.ALL);
      }
    },
    [props.state],
  );

  const { isSidebarOpen, selectedLogFile, logTypeFilter, processedLogFiles } =
    props.state;

  function getSelectedKey(): string | undefined {
    if (!selectedLogFile) return undefined;
    if (isMergedLogFile(selectedLogFile)) return selectedLogFile.logType;
    if ('id' in selectedLogFile) return selectedLogFile.id;
    return undefined;
  }

  const selectedKey = getSelectedKey();

  const isStateFileSelected = selectedKey
    ? stateNodes.some((node) => node.key === selectedKey)
    : false;
  const derivedTab = isStateFileSelected ? 'state' : 'logs';
  const activeTab = manualTab ?? derivedTab;

  // Determine which log types have files present
  const availableLogTypes = LOG_TYPE_CHECKBOXES.filter(({ type }) => {
    if (!processedLogFiles) return false;
    const key = type as keyof typeof processedLogFiles;
    return processedLogFiles[key]?.length > 0;
  });

  function getNode(
    id: string,
    nodeData: Partial<SidebarNodeData>,
    options: Partial<TreeDataNode> = {},
  ): TreeDataNode {
    return {
      key: nodeData.file ? nodeData.file.id : nodeData.type!,
      title: id,
      icon: options.icon ?? <FileTextOutlined />,
      ...options,
    };
  }

  async function getStateFileNode(file: UnzippedFile) {
    const label = file.fileName;
    let icon: React.ReactNode = <FileTextOutlined />;
    if (
      file.fileName.endsWith('gpu-info.json') ||
      file.fileName.endsWith('gpu-info.html')
    ) {
      icon = <PictureOutlined />;
    } else if (file.fileName.endsWith('notification-warnings.json')) {
      icon = <NotificationOutlined />;
    } else if (file.fileName.endsWith('environment.json')) {
      icon = <MacCommandOutlined />;
    } else if (file.fileName.endsWith('local-settings.json')) {
      icon = <SettingOutlined />;
    } else if (file.fileName.endsWith('root-state.json')) {
      icon = <ApartmentOutlined />;
    } else if (file.fileName.endsWith('external-config.json')) {
      icon = <SettingOutlined />;
    } else if (file.fileName.endsWith('logfiles-shipping-manifest.json')) {
      icon = <FileZipOutlined />;
    } else if (file.fileName.endsWith('log-context.json')) {
      icon = <GlobalOutlined />;
    } else if (file.fileName.endsWith('installation')) {
      icon = <ExceptionOutlined />;
    } else if (file.fileName.endsWith('diagnostic.json')) {
      icon = <HeartOutlined />;
    }

    const options: Partial<TreeDataNode> = {
      icon,
    };

    const hints = await getStateFileHint(file);
    if (hints) {
      options.title = (
        <Space>
          <span>{label}</span>
          {hints}
        </Space>
      );
    }

    return getNode(label, { file }, options);
  }

  async function getStateFileHint(file: UnzippedFile) {
    if (file.fileName.endsWith('root-state.json')) {
      const warnings = getRootStateWarnings(
        props.state.stateFiles[file.fileName].data,
      );

      if (warnings && warnings.length > 0) {
        const content = warnings.join('\n');
        return (
          <Tooltip title={content} placement="right">
            <ExperimentOutlined style={{ color: 'goldenrod' }} />
          </Tooltip>
        );
      }
    }

    // TODO(erickzhao): re-implement trace warnings with symbolicated file name
    if (file.fileName.endsWith('.trace')) {
      const warnings = await getTraceWarnings(file);
      if (warnings && warnings.length > 0) {
        const content = warnings.join('\n');
        return (
          <Tooltip title={content} placement="right">
            <WarningFilled style={{ color: 'goldenrod' }} />
          </Tooltip>
        );
      }
    }

    // TODO: refactor this rendering code probably
    if (file.fileName.endsWith('environment.json')) {
      const warnings = getEnvironmentWarnings(
        props.state.stateFiles[file.fileName].data,
      );
      if (warnings.length > 0) {
        const content = warnings.join('\n');
        return (
          <Tooltip title={content} placement="right">
            <WarningFilled style={{ color: 'red' }} />
          </Tooltip>
        );
      }
    }

    if (
      file.fileName.endsWith('installation') &&
      props.state.stateFiles['logfiles-shipping-manifest.json']
    ) {
      const warnings = props.state.stateFiles[
        'logfiles-shipping-manifest.json'
      ].data.files.filter((f) => f.fileName.endsWith('.dmp'));
      return (
        <Tooltip
          title={`${warnings.length} DMP files found in log bundle. Check corresponding errors on Sentry.`}
          placement="right"
        >
          <Badge status="error" />
        </Tooltip>
      );
    }

    return null;
  }

  const stateTreeProps = {
    showLine: true,
    onSelect: onStateSelect,
    showIcon: true,
    blockNode: true,
    switcherIcon: <DownOutlined />,
    selectedKeys: selectedKey ? [selectedKey] : [],
  };

  return (
    <div className={classNames('SidebarFileTree', { Open: isSidebarOpen })}>
      <Tabs
        activeKey={activeTab}
        onChange={setManualTab}
        size="small"
        items={[
          {
            key: 'logs',
            label: 'Logs',
            icon: <FileTextOutlined />,
            children: (
              <div style={{ padding: '4px 0' }}>
                {availableLogTypes.map(({ type, label, icon }) => (
                  <div
                    key={type}
                    style={{
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Checkbox
                      checked={logTypeFilter[type]}
                      onChange={(e) => onLogTypeToggle(type, e.target.checked)}
                    />
                    <Space size={4}>
                      {icon}
                      <Typography.Text>{label}</Typography.Text>
                    </Space>
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: 'state',
            label: 'State & Settings',
            icon: <SettingOutlined />,
            children: (
              <Tree
                {...stateTreeProps}
                onExpand={(keys) => setExpandedStateKeys(keys)}
                expandedKeys={expandedStateKeys}
                treeData={stateNodes}
              />
            ),
          },
        ]}
      />
    </div>
  );
});

export { SidebarFileTree };
