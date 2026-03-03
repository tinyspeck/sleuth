import { Badge, Space, Tooltip, Tree, TreeDataNode, Typography } from 'antd';
import classNames from 'classnames';
import { observer } from 'mobx-react';
import React, { Key, useCallback, useEffect, useState } from 'react';
import { SleuthState } from '../../state/sleuth';
import {
  LogType,
  ProcessedLogFile,
  SelectableLogFile,
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
  SettingFilled,
  SettingOutlined,
  SlidersOutlined,
  WarningFilled,
  WifiOutlined,
} from '@ant-design/icons';
import { truncate } from '../../../utils/truncate-string';
import { isProcessedLogFile } from '../../../utils/is-logfile';
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
  const [nodes, setNodes] = useState<TreeDataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>();
  const [files, setFiles] = useState<
    Map<string, ProcessedLogFile | UnzippedFile>
  >(new Map());

  useEffect(() => {
    async function fetchTree() {
      const { processedLogFiles } = props.state;

      if (!processedLogFiles) return;

      const filesMap = new Map<string, ProcessedLogFile | UnzippedFile>();

      const AVAILABLE_NODES: TreeDataNode[] = [
        {
          key: LogType.STATE,
          icon: <SettingFilled />,
          selectable: false,
          title: <Typography.Text strong>State & Settings</Typography.Text>,
          children: await Promise.all(
            processedLogFiles.state.map(async (file) => {
              filesMap.set(file.id, file);
              return await getStateFileNode(file);
            }),
          ),
        },
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
        {
          key: LogType.NETLOG,
          icon: <WifiOutlined />,
          title: <Typography.Text strong>Network</Typography.Text>,
          children: processedLogFiles.netlog.map((file, i) => {
            filesMap.set(file.id, file);
            return getNetlogFileNode(file, i);
          }),
        },
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

      const visibleNodes = AVAILABLE_NODES.filter((node) => {
        // Show "All Desktop Logs" if there are any browser or webapp logs
        if (node.key === LogType.ALL) {
          const main = AVAILABLE_NODES.find((n) => n.key === LogType.BROWSER);
          const renderer = AVAILABLE_NODES.find(
            (n) => n.key === LogType.WEBAPP,
          );

          return (
            (main?.children?.length && main?.children?.length > 0) ||
            (renderer?.children?.length && renderer?.children?.length > 0)
          );
        } else {
          return node.children?.length && node.children?.length > 0;
        }
      });

      setFiles(filesMap);
      setNodes(visibleNodes);
      setExpandedKeys(visibleNodes.map((node) => node.key as Key));
    }
    fetchTree();
  }, []);

  const onSelect = useCallback(
    (selectedKeys: string[]) => {
      // only one node can be selected at atime
      const selected = selectedKeys[0];

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

  function isLogFile(
    file: SelectableLogFile | undefined,
  ): file is ProcessedLogFile | UnzippedFile {
    if (!file) return false;
    return (file as any).id !== undefined;
  }

  const defaultSelectedLog = isLogFile(selectedLogFile)
    ? selectedLogFile.id
    : 'browser.log';

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
    let label: string;
    let icon: React.ReactNode = <FileTextOutlined />;
    if (
      file.fileName.endsWith('gpu-info.json') ||
      file.fileName.endsWith('gpu-info.html')
    ) {
      label = 'GPU';
      icon = <PictureOutlined />;
    } else if (file.fileName.endsWith('notification-warnings.json')) {
      label = 'Notification Warnings';
      icon = <NotificationOutlined />;
    } else if (file.fileName.endsWith('environment.json')) {
      label = 'Environment';
      icon = <MacCommandOutlined />;
    } else if (file.fileName.endsWith('local-settings.json')) {
      label = 'Local Settings';
      icon = <SettingOutlined />;
    } else if (file.fileName.endsWith('.trace')) {
      label = 'Performance Profile';
    } else if (file.fileName.endsWith('root-state.json')) {
      label = 'Root State';
      icon = <ApartmentOutlined />;
    } else if (file.fileName.endsWith('external-config.json')) {
      label = 'External Config';
      icon = <SettingOutlined />;
    } else if (file.fileName.endsWith('logfiles-shipping-manifest.json')) {
      label = 'Log Manifest';
      icon = <FileZipOutlined />;
    } else if (file.fileName.endsWith('log-context.json')) {
      label = 'Log Context';
      icon = <GlobalOutlined />;
    } else if (file.fileName.endsWith('installation')) {
      label = 'Installation';
      icon = <ExceptionOutlined />;
    } else if (file.fileName.endsWith('diagnostic.json')) {
      label = 'System Diagnostics';
      icon = <HeartOutlined />;
    } else {
      label = file.fileName;
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

  function getNetlogFileNode(file: UnzippedFile, i: number): TreeDataNode {
    return getNode(`Net Log ${i + 1}`, { file });
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

  return (
    <Tree
      showLine={true}
      onSelect={onSelect}
      onExpand={(keys) => {
        setExpandedKeys(keys);
      }}
      expandedKeys={expandedKeys}
      className={classNames('SidebarFileTree', { Open: isSidebarOpen })}
      // apply style to child so that hiding the parent looks smoother with overflow-x: hidden
      style={{ width: '286px' }}
      defaultSelectedKeys={[defaultSelectedLog]}
      showIcon={true}
      blockNode={true}
      switcherIcon={<DownOutlined />}
      treeData={nodes}
    />
  );
});

export { SidebarFileTree };
