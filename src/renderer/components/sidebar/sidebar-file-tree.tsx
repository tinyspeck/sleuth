import {
  Badge,
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
  ProcessedLogFile,
  SelectableLogType,
  TRACE_VIEWER,
  UnzippedFile,
} from '../../../interfaces';
import {
  ApartmentOutlined,
  ChromeOutlined,
  CommentOutlined,
  DashboardOutlined,
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
  MergeOutlined,
  MobileOutlined,
  NotificationOutlined,
  PictureOutlined,
  SettingOutlined,
  SlidersOutlined,
  WarningFilled,
  WifiOutlined,
} from '@ant-design/icons';
import { truncate } from '../../../utils/truncate-string';
import { isMergedLogFile, isProcessedLogFile } from '../../../utils/is-logfile';
import { getEnvironmentWarnings } from '../../analytics/environment-analytics';
import { getRootStateWarnings } from '../../analytics/root-state-analytics';
import { levelsHave } from '../../../utils/level-counts';
import { countExcessiveRepeats } from '../../../utils/count-excessive-repeats';
import { plural } from '../../../utils/pluralize';
import { getTraceWarnings } from '../../analytics/trace-analytics';

interface SidebarFileTreeProps {
  state: SleuthState;
}

interface SidebarNodeData {
  file: UnzippedFile | ProcessedLogFile;
  type: SelectableLogType;
}

const SidebarFileTree = observer((props: SidebarFileTreeProps) => {
  const [stateNodes, setStateNodes] = useState<TreeDataNode[]>([]);
  const [logNodes, setLogNodes] = useState<TreeDataNode[]>([]);
  const [expandedStateKeys, setExpandedStateKeys] = useState<Key[]>();
  const [expandedLogKeys, setExpandedLogKeys] = useState<Key[]>();
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

      const LOG_NODES: TreeDataNode[] = [
        {
          key: LogType.ALL,
          title: <Typography.Text strong>All Desktop Logs</Typography.Text>,
          icon: <MergeOutlined />,
        },
        {
          key: LogType.BROWSER,
          icon: <DesktopOutlined />,
          title: <Typography.Text strong>Browser Process</Typography.Text>,
          children: processedLogFiles.browser.map((file) => {
            filesMap.set(file.id, file);
            return getLogFileNode(file);
          }),
        },
        ...(processedLogFiles.trace.length > 0
          ? [
              {
                key: LogType.TRACE,
                icon: <SlidersOutlined />,
                selectable: false,
                title: <Typography.Text strong>Trace</Typography.Text>,
                children: [
                  {
                    key: TRACE_VIEWER.CHROME_DEVTOOLS,
                    icon: <ChromeOutlined />,
                    title: 'Chrome DevTools',
                  },
                  {
                    key: TRACE_VIEWER.PERFETTO,
                    icon: <DashboardOutlined />,
                    title: 'Perfetto',
                  },
                ],
              },
            ]
          : []),
        {
          key: LogType.CHROMIUM,
          icon: <ChromeOutlined />,
          title: <Typography.Text strong>Chromium</Typography.Text>,
          children: processedLogFiles.chromium.map((file) => {
            filesMap.set(file.id, file);
            return getLogFileNode(file);
          }),
        },
        {
          key: LogType.WEBAPP,
          icon: <CommentOutlined />,
          title: <Typography.Text strong>WebApp</Typography.Text>,
          children: processedLogFiles.webapp.map((file) => {
            filesMap.set(file.id, file);
            return getLogFileNode(file);
          }),
        },
        {
          key: LogType.INSTALLER,
          icon: <DownloadOutlined />,
          selectable: false,
          title: <Typography.Text strong>Installer</Typography.Text>,
          children: processedLogFiles.installer.map((file) => {
            filesMap.set(file.id, file);
            return getInstallerFileNode(file);
          }),
        },
        ...processedLogFiles.netlog.map((file, i) => {
          filesMap.set(file.id, file);
          return getNetlogFileNode(file, i, processedLogFiles.netlog.length);
        }),
        {
          key: LogType.MOBILE,
          icon: <MobileOutlined />,
          title: <Typography.Text strong>Mobile</Typography.Text>,
          children: processedLogFiles.mobile.map((file) => {
            filesMap.set(file.id, file);
            return getLogFileNode(file);
          }),
        },
      ];

      const hasDesktopLogs =
        processedLogFiles.browser.length > 0 ||
        processedLogFiles.webapp.length > 0;

      const visibleLogNodes = LOG_NODES.filter((node) => {
        if (node.key === LogType.ALL) return hasDesktopLogs;
        // Leaf nodes (no children array) are always visible
        if (!node.children) return true;
        return node.children.length > 0;
      });

      setFiles(filesMap);
      setStateNodes(stateFileNodes);
      setLogNodes(visibleLogNodes);
      setExpandedLogKeys(visibleLogNodes.map((node) => node.key as Key));
    }
    fetchTree().catch((error) => {
      console.error('Failed to build sidebar file tree:', error);
    });
  }, [props.state.processedLogFiles]);

  const onSelect = useCallback(
    (selectedKeys: Key[]) => {
      // only one node can be selected at a time
      const selected = String(selectedKeys[0]);
      setManualTab(null);

      if (selected === TRACE_VIEWER.CHROME_DEVTOOLS) {
        props.state.openTraceViewer(TRACE_VIEWER.CHROME_DEVTOOLS);
        return;
      } else if (selected === TRACE_VIEWER.PERFETTO) {
        props.state.openTraceViewer(TRACE_VIEWER.PERFETTO);
        return;
      }

      if (Object.values(LogType).includes(selected as SelectableLogType)) {
        props.state.selectLogFile(null, selected as SelectableLogType);
      } else {
        const file = files.get(selected);

        if (file) {
          props.state.selectLogFile(file);
        }
      }
    },
    [props.state, files],
  );

  const { isSidebarOpen, selectedLogFile } = props.state;

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

  function getNetlogFileNode(
    file: UnzippedFile,
    i: number,
    total: number,
  ): TreeDataNode {
    const text = total > 1 ? `Net Log ${i + 1}` : 'Net Log';
    return getNode(
      text,
      { file },
      {
        icon: <WifiOutlined />,
        title: <Typography.Text strong>{text}</Typography.Text>,
      },
    );
  }

  function getInstallerFileNode(
    file: UnzippedFile | ProcessedLogFile,
  ): TreeDataNode {
    const name = isProcessedLogFile(file)
      ? file.logFile.fileName
      : file.fileName;
    const truncated = truncate(name, 24);

    const options: Partial<TreeDataNode> = {};

    // Check ShipItState.plist for launchAfterInstallation warning
    if (name.toLowerCase() === 'shipitstate.plist') {
      const stateData = props.state.stateFiles[name]?.data;
      if (stateData && stateData.launchAfterInstallation === false) {
        options.title = (
          <Space>
            <span>{truncated}</span>
            <Tooltip
              title="launchAfterInstallation is false - Slack may be in an update loop"
              placement="right"
            >
              <WarningFilled style={{ color: 'goldenrod' }} />
            </Tooltip>
          </Space>
        );
      }
    }

    return getNode(truncated, { file }, options);
  }

  function getLogFileNode(file: ProcessedLogFile): TreeDataNode {
    const name = truncate(file.logFile.fileName, 24);

    const options: Partial<TreeDataNode> = {
      title: name,
    };

    const hints = getLogNodeHint(file);
    if (hints) {
      options.title = (
        <Space>
          <span>{name}</span>
          {hints}
        </Space>
      );
    }

    return getNode(name, { file }, options);
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

  function getLogNodeHint(file: ProcessedLogFile): JSX.Element | null {
    const { levelCounts, repeatedCounts } = file;
    const hasErrors = levelsHave('error', levelCounts);
    const hasWarnings = levelsHave('warn', levelCounts);
    const excessiveRepeats = countExcessiveRepeats(repeatedCounts);

    if (!hasErrors && !hasWarnings && !excessiveRepeats) {
      return null;
    }

    // Check for errors
    let content = hasErrors
      ? `This file contains ${levelCounts.error} errors`
      : '';

    if (levelsHave('warn', levelCounts)) {
      content += hasErrors
        ? ` and ${levelCounts.warn} warnings.`
        : `This file contains ${levelCounts.warn} warnings.`;
    }

    // Check for excessive repeats
    if (excessiveRepeats) {
      // Not empty? Add a space
      if (content) content += ` `;

      const line = plural('line', excessiveRepeats);
      const has = plural('has', excessiveRepeats, 'have');

      content += `${excessiveRepeats} log ${line} ${has} been excessively repeated.`;
    }

    return (
      <Tooltip title={content} placement="right">
        <Badge status="warning" />
      </Tooltip>
    );
  }

  const treeProps = {
    showLine: true,
    onSelect,
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
              <Tree
                {...treeProps}
                onExpand={(keys) => setExpandedLogKeys(keys)}
                expandedKeys={expandedLogKeys}
                treeData={logNodes}
              />
            ),
          },
          {
            key: 'state',
            label: 'State & Settings',
            icon: <SettingOutlined />,
            children: (
              <Tree
                {...treeProps}
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
