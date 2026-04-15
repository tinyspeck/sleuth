import {
  Alert,
  Badge,
  Button,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tabs,
  Tag,
  theme,
  Tooltip,
  Tree,
  TreeDataNode,
  Typography,
} from 'antd';
import classNames from 'classnames';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react';
import React, { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { SleuthState } from '../../state/sleuth';
import {
  LevelFilter,
  LogLevel,
  LogType,
  ProcessableLogType,
  ProcessedLogFile,
  SelectableLogType,
  TRACE_VIEWER,
  UnzippedFile,
  LogTypeFilter,
} from '../../../interfaces';
import {
  ApartmentOutlined,
  ApiOutlined,
  ChromeOutlined,
  CloudOutlined,
  DashboardOutlined,
  MonitorOutlined,
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
import { CheckboxItem, SidebarCheckboxGroup } from './sidebar-checkbox-group';
import { isMergedLogFile } from '../../../utils/is-logfile';
import { hashTagColor } from '../../../utils/match-tag';
import { logColorMap } from '../log-table';
import { TraceProcessor } from '../../processor/trace';

interface SidebarFileTreeProps {
  state: SleuthState;
}

interface SidebarNodeData {
  file: UnzippedFile | ProcessedLogFile;
  type: SelectableLogType;
}

const LOG_TYPE_CHECKBOXES: CheckboxItem[] = [
  { key: LogType.BROWSER, label: 'browser', icon: <DesktopOutlined /> },
  { key: LogType.WEBAPP, label: 'webapp', icon: <CommentOutlined /> },
  {
    key: LogType.SERVICE_WORKER,
    label: 'service worker',
    icon: <CloudOutlined />,
  },
  {
    key: LogType.RX_EPIC,
    label: 'epic traces',
    icon: <ExperimentOutlined />,
  },
  { key: LogType.CHROMIUM, label: 'chromium', icon: <ChromeOutlined /> },
  { key: LogType.INSTALLER, label: 'installer', icon: <DownloadOutlined /> },
];

const LOG_LEVEL_KEYS = [
  { key: LogLevel.error, label: 'error' },
  { key: LogLevel.warn, label: 'warning' },
  { key: LogLevel.info, label: 'info' },
  { key: LogLevel.debug, label: 'debug' },
];

const SidebarFileTree = observer((props: SidebarFileTreeProps) => {
  const { token } = theme.useToken();

  const LOG_LEVEL_CHECKBOXES: CheckboxItem[] = useMemo(
    () =>
      LOG_LEVEL_KEYS.map(({ key, label }) => ({
        key,
        label,
        icon: (
          <Badge
            color={
              key === LogLevel.error
                ? token.colorError
                : key === LogLevel.warn
                  ? token.colorWarning
                  : key === LogLevel.info
                    ? token.colorInfo
                    : token.colorSuccess
            }
          />
        ),
      })),
    [token],
  );

  const [stateNodes, setStateNodes] = useState<TreeDataNode[]>([]);
  const [expandedStateKeys, setExpandedStateKeys] = useState<Key[]>();
  const [files, setFiles] = useState<
    Map<string, ProcessedLogFile | UnzippedFile>
  >(new Map());
  const [manualTab, setManualTab] = useState<string | null>(null);
  const [tagSort, setTagSort] = useState<'freq' | 'az'>('freq');
  const [traceSourcemapped, setTraceSourcemapped] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    async function fetchTree() {
      const { processedLogFiles } = props.state;

      if (!processedLogFiles) return;

      const filesMap = new Map<string, ProcessedLogFile | UnzippedFile>();

      const stateFileNodes = processedLogFiles.state.map((file) => {
        filesMap.set(file.id, file);
        return getStateFileNode(file);
      });

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
        props.state.selectFile(file);
      }
    },
    [props.state, files],
  );

  // Load trace threads when trace files are available
  useEffect(() => {
    const traceFiles = props.state.processedLogFiles?.trace;
    if (!traceFiles?.length || props.state.traceThreads) return;
    const processor = new TraceProcessor(traceFiles[0]);
    processor
      .getProcesses()
      .then((threads) => {
        props.state.setTraceThreads(threads);
      })
      .catch((error) => {
        console.error('Failed to load trace threads:', error);
        props.state.setTraceThreads([]);
      });
  }, [props.state.processedLogFiles?.trace, props.state.traceThreads]);

  // Check if trace files are sourcemapped
  useEffect(() => {
    const traceFiles = props.state.processedLogFiles?.trace;
    if (!traceFiles?.length) return;
    setTraceSourcemapped(null);
    window.Sleuth.isTraceSourcemapped(traceFiles[0])
      .then((result) => setTraceSourcemapped(result))
      .catch(() => setTraceSourcemapped(null));
  }, [props.state.processedLogFiles?.trace]);

  const onTraceSelect = useCallback(
    (selectedKeys: Key[]) => {
      const selected = String(selectedKeys[0]);
      if (selected === TRACE_VIEWER.PERFETTO) {
        props.state.openTraceViewer(TRACE_VIEWER.PERFETTO);
      } else {
        // Thread PID — open DevTools with that process
        const pid = parseInt(selected, 10);
        if (!isNaN(pid)) {
          props.state.openTraceViewer(TRACE_VIEWER.CHROME_DEVTOOLS);
          props.state.setSelectedTracePid(pid);
        }
      }
    },
    [props.state],
  );

  const onNetlogSelect = useCallback(
    (fileId: string) => {
      const file = props.state.processedLogFiles?.netlog?.find(
        (f) => f.id === fileId,
      );
      if (file) {
        props.state.selectFile(file);
      }
    },
    [props.state],
  );

  // --- Log type callbacks ---
  const onLogTypeToggle = useCallback(
    (key: string, checked: boolean) => {
      props.state.setLogTypeFilter({ [key]: checked });
      const { selectedFile } = props.state;
      if (
        !selectedFile ||
        !isMergedLogFile(selectedFile) ||
        selectedFile.logType !== LogType.ALL
      ) {
        props.state.selectAllLogs();
      }
    },
    [props.state],
  );

  const onLogTypeShowAll = useCallback(() => {
    const filter = Object.fromEntries(
      LOG_TYPE_CHECKBOXES.map(({ key }) => [key, true]),
    ) as Partial<LogTypeFilter>;
    props.state.setLogTypeFilter(filter);
  }, [props.state]);

  const onLogTypeFocus = useCallback(
    (focusKey: string) => {
      const { logTypeFilter } = props.state;
      const isAlreadyFocused = LOG_TYPE_CHECKBOXES.every(
        ({ key }) =>
          logTypeFilter[key as ProcessableLogType] === (key === focusKey),
      );
      const filter = Object.fromEntries(
        LOG_TYPE_CHECKBOXES.map(({ key }) => [
          key,
          isAlreadyFocused ? true : key === focusKey,
        ]),
      ) as Partial<LogTypeFilter>;
      props.state.setLogTypeFilter(filter);

      const { selectedFile } = props.state;
      if (
        !selectedFile ||
        !isMergedLogFile(selectedFile) ||
        selectedFile.logType !== LogType.ALL
      ) {
        props.state.selectAllLogs();
      }
    },
    [props.state],
  );

  // --- Log level callbacks ---
  const onLevelToggle = useCallback(
    (key: string, checked: boolean) => {
      props.state.setFilterLogLevels({ [key]: checked });
    },
    [props.state],
  );

  const onLevelShowAll = useCallback(() => {
    props.state.setFilterLogLevels({
      debug: true,
      info: true,
      warn: true,
      error: true,
    });
  }, [props.state]);

  const onLevelFocus = useCallback(
    (focusKey: string) => {
      const { levelFilter } = props.state;
      const isAlreadyFocused = LOG_LEVEL_KEYS.every(
        ({ key }) => levelFilter[key as LogLevel] === (key === focusKey),
      );
      props.state.setFilterLogLevels(
        Object.fromEntries(
          LOG_LEVEL_KEYS.map(({ key }) => [
            key,
            isAlreadyFocused ? true : key === focusKey,
          ]),
        ) as Partial<LevelFilter>,
      );
    },
    [props.state],
  );

  const { isSidebarOpen, selectedFile, logTypeFilter, processedLogFiles } =
    props.state;

  function getSelectedKey(): string | undefined {
    if (!selectedFile) return undefined;
    if (isMergedLogFile(selectedFile)) return selectedFile.logType;
    if ('id' in selectedFile) return selectedFile.id;
    return undefined;
  }

  const selectedKey = getSelectedKey();

  const isStateFileSelected =
    props.state.showStateSummary ||
    (selectedKey ? stateNodes.some((node) => node.key === selectedKey) : false);
  const isTraceFileSelected =
    selectedFile &&
    'fileName' in selectedFile &&
    selectedFile.fileName.endsWith('.trace');
  const isNetlogFileSelected = selectedKey
    ? (processedLogFiles?.netlog?.some((f) => f.id === selectedKey) ?? false)
    : false;
  const derivedTab = isNetlogFileSelected
    ? 'netlog'
    : isTraceFileSelected
      ? 'trace'
      : isStateFileSelected
        ? 'state'
        : 'logs';
  const activeTab = manualTab ?? derivedTab;

  // Compute log level line counts across all processable files
  const logLevelItems = useMemo(() => {
    if (!processedLogFiles) return LOG_LEVEL_CHECKBOXES as CheckboxItem[];
    const totals: Record<string, number> = {};
    for (const typeKey of LOG_TYPE_CHECKBOXES.map(({ key }) => key)) {
      const files =
        (processedLogFiles[typeKey as keyof typeof processedLogFiles] as
          | ProcessedLogFile[]
          | undefined) ?? [];
      for (const f of files) {
        for (const [level, count] of Object.entries(f.levelCounts ?? {})) {
          totals[level] = (totals[level] ?? 0) + count;
        }
      }
    }
    return LOG_LEVEL_CHECKBOXES.map((item) => ({
      ...item,
      count: totals[item.key] ?? 0,
    }));
  }, [processedLogFiles]);

  // Collect unique tags with counts across all processable files
  const tagOptions = useMemo(() => {
    if (!processedLogFiles) return [];
    const tagCounts = new Map<string, number>();
    for (const typeKey of LOG_TYPE_CHECKBOXES.map(({ key }) => key)) {
      const files =
        (processedLogFiles[typeKey as keyof typeof processedLogFiles] as
          | ProcessedLogFile[]
          | undefined) ?? [];
      for (const f of files) {
        for (const entry of f.logEntries ?? []) {
          if (entry.tag?.name) {
            tagCounts.set(
              entry.tag.name,
              (tagCounts.get(entry.tag.name) ?? 0) + 1,
            );
          }
        }
      }
    }
    const sorted = Array.from(tagCounts.entries()).sort((a, b) =>
      tagSort === 'az' ? a[0].localeCompare(b[0]) : b[1] - a[1],
    );
    return sorted.map(([name, count]) => ({
      label: name,
      value: name,
      count,
    }));
  }, [processedLogFiles, tagSort]);

  // Determine which log types have files present, and compute line counts
  const logTypeItems = useMemo(() => {
    if (!processedLogFiles) return [];
    return LOG_TYPE_CHECKBOXES.filter(({ key }) => {
      const pKey = key as keyof typeof processedLogFiles;
      return processedLogFiles[pKey]?.length > 0;
    }).map((item) => {
      const typeFiles =
        (processedLogFiles[item.key as keyof typeof processedLogFiles] as
          | ProcessedLogFile[]
          | undefined) ?? [];
      const count = typeFiles.reduce(
        (sum: number, f: ProcessedLogFile) => sum + (f.logEntries?.length ?? 0),
        0,
      );
      return { ...item, count };
    });
  }, [processedLogFiles]);

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

  function getStateFileNode(file: UnzippedFile) {
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

    return getNode(label, { file }, { icon });
  }

  const stateTreeProps = {
    showLine: true,
    onSelect: onStateSelect,
    showIcon: true,
    blockNode: true,
    switcherIcon: <DownOutlined />,
    selectedKeys: props.state.showStateSummary
      ? []
      : selectedKey
        ? [selectedKey]
        : [],
  };

  return (
    <div className={classNames('SidebarFileTree', { Open: isSidebarOpen })}>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setManualTab(key);
          if (key === 'logs' && derivedTab !== 'logs') {
            props.state.selectAllLogs();
          }
          if (key === 'state') {
            runInAction(() => {
              props.state.showStateSummary = true;
            });
          }
        }}
        size="small"
        items={[
          {
            key: 'logs',
            label: 'Logs',
            icon: <FileTextOutlined />,
            children: (
              <>
                <SidebarCheckboxGroup
                  title="Log Types"
                  items={logTypeItems}
                  filter={logTypeFilter}
                  onToggle={onLogTypeToggle}
                  onFocus={onLogTypeFocus}
                  onShowAll={onLogTypeShowAll}
                  allShownWhen="all-true"
                />
                <SidebarCheckboxGroup
                  title="Log Levels"
                  items={logLevelItems}
                  filter={props.state.levelFilter}
                  onToggle={onLevelToggle}
                  onFocus={onLevelFocus}
                  onShowAll={onLevelShowAll}
                  allShownWhen="all-true"
                />
                {tagOptions.length > 0 && (
                  <fieldset className="SidebarTags">
                    <legend className="SidebarTags-legend">
                      <Typography.Text
                        type="secondary"
                        className="SidebarCheckboxGroup-title"
                      >
                        Tags
                      </Typography.Text>
                      <Segmented
                        size="small"
                        value={tagSort}
                        onChange={(val) => setTagSort(val as 'freq' | 'az')}
                        options={[
                          {
                            label: (
                              <Tooltip
                                title="Sort by frequency"
                                classNames={{ root: 'SidebarTooltip-sm' }}
                              >
                                #
                              </Tooltip>
                            ),
                            value: 'freq',
                          },
                          {
                            label: (
                              <Tooltip
                                title="Sort alphabetically"
                                classNames={{ root: 'SidebarTooltip-sm' }}
                              >
                                Az
                              </Tooltip>
                            ),
                            value: 'az',
                          },
                        ]}
                        className="SidebarTags-sortToggle"
                      />
                    </legend>
                    <Select
                      mode="multiple"
                      placeholder="Filter by tag..."
                      options={tagOptions}
                      value={props.state.selectedTags}
                      onChange={(tags) => props.state.setSelectedTags(tags)}
                      className="SidebarTags-select"
                      size="small"
                      allowClear
                      optionRender={(option) => {
                        const count = (option.data as { count?: number }).count;
                        const countLabel =
                          count !== undefined
                            ? count >= 1000
                              ? `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`
                              : String(count)
                            : '';
                        return (
                          <span
                            className="SidebarTags-option"
                            style={{
                              color: hashTagColor(
                                String(option.value ?? ''),
                                props.state.prefersDarkColors,
                              ),
                            }}
                          >
                            <span className="SidebarTags-optionLabel">
                              {option.label}
                            </span>
                            <span className="SidebarTags-optionCount">
                              {countLabel}
                            </span>
                          </span>
                        );
                      }}
                      tagRender={({ label, value, closable, onClose }) => (
                        <span
                          className="SidebarTags-tag"
                          style={{
                            color: hashTagColor(
                              String(value ?? ''),
                              props.state.prefersDarkColors,
                            ),
                          }}
                        >
                          <span className="SidebarTags-tagLabel">{label}</span>
                          {closable && (
                            <span
                              className="SidebarTags-tagClose"
                              onClick={onClose}
                            >
                              ×
                            </span>
                          )}
                        </span>
                      )}
                    />
                  </fieldset>
                )}
              </>
            ),
          },
          {
            key: 'state',
            label: 'State',
            icon: <SettingOutlined />,
            children: (
              <>
                <Button
                  className="SidebarStateSummary"
                  type={props.state.showStateSummary ? 'primary' : 'default'}
                  ghost={props.state.showStateSummary}
                  icon={<MonitorOutlined />}
                  block
                  onClick={() => {
                    runInAction(() => {
                      props.state.showStateSummary = true;
                    });
                  }}
                >
                  Summary
                </Button>
                <fieldset className="SidebarCheckboxGroup">
                  <legend className="SidebarCheckboxGroup-legend">
                    <Typography.Text
                      type="secondary"
                      className="SidebarCheckboxGroup-title"
                    >
                      State & Settings
                    </Typography.Text>
                  </legend>
                  <Tree
                    {...stateTreeProps}
                    onExpand={(keys) => setExpandedStateKeys(keys)}
                    expandedKeys={expandedStateKeys}
                    treeData={stateNodes}
                  />
                </fieldset>
              </>
            ),
          },
          ...(processedLogFiles?.netlog?.length
            ? [
                {
                  key: 'netlog',
                  label: 'Net',
                  icon: <ApiOutlined />,
                  children: (
                    <fieldset className="SidebarCheckboxGroup">
                      <legend className="SidebarCheckboxGroup-legend">
                        <Typography.Text
                          type="secondary"
                          className="SidebarCheckboxGroup-title"
                        >
                          Network Logs
                        </Typography.Text>
                      </legend>
                      <Alert
                        type="info"
                        title={
                          <Typography.Paragraph type="secondary">
                            Net logs provide network-level captures showing HTTP
                            requests, socket connections, and DNS lookups.
                          </Typography.Paragraph>
                        }
                        className="SidebarPreamble"
                      />
                      {processedLogFiles.netlog.map((file) => {
                        const isSelected =
                          isNetlogFileSelected && selectedKey === file.id;
                        return (
                          <div
                            key={file.id}
                            className={classNames('SidebarCheckboxGroup-row', {
                              selected: isSelected,
                            })}
                            onClick={() => onNetlogSelect(file.id)}
                          >
                            <Space size={4} style={{ flex: 1 }}>
                              <GlobalOutlined />
                              <Typography.Text className="SidebarCheckboxGroup-label">
                                {file.fileName}
                              </Typography.Text>
                            </Space>
                          </div>
                        );
                      })}
                    </fieldset>
                  ),
                },
              ]
            : []),
          ...(processedLogFiles?.trace?.length
            ? [
                {
                  key: 'trace',
                  label: (
                    <Space size={4}>
                      Trace
                      {traceSourcemapped === false && (
                        <Tooltip title="Trace is not sourcemapped">
                          <WarningFilled
                            style={{ color: token.colorWarning }}
                          />
                        </Tooltip>
                      )}
                    </Space>
                  ),
                  icon: <DashboardOutlined />,
                  children: (
                    <>
                      {traceSourcemapped === false && (
                        <Alert
                          type="warning"
                          showIcon
                          title="Trace is not sourcemapped"
                          description="Function names may appear minified. Re-export with sourcemaps for readable stack traces."
                          className="SidebarPreamble"
                        />
                      )}
                      <Alert
                        type="info"
                        title={
                          <Typography.Paragraph type="secondary">
                            Performance profiles captured via Electron's{' '}
                            <code>contentTracing</code> API. Inspect the entire
                            trace with Google's Perfetto trace viewer, or
                            analyze performance from a web perspective with
                            Chrome DevTools.
                          </Typography.Paragraph>
                        }
                        className="SidebarPreamble"
                      />
                      <fieldset className="SidebarCheckboxGroup">
                        <legend className="SidebarCheckboxGroup-legend">
                          <Typography.Text
                            type="secondary"
                            className="SidebarCheckboxGroup-title"
                          >
                            Chrome DevTools
                          </Typography.Text>
                        </legend>
                        {!props.state.traceThreads && (
                          <Skeleton
                            active
                            paragraph={{ rows: 2 }}
                            title={false}
                          />
                        )}
                        {props.state.traceThreads?.map((thread) => {
                          const isSelected =
                            isTraceFileSelected &&
                            props.state.selectedTraceViewer ===
                              TRACE_VIEWER.CHROME_DEVTOOLS &&
                            props.state.selectedTracePid === thread.processId;
                          return (
                            <div
                              key={thread.processId}
                              className={classNames(
                                'SidebarCheckboxGroup-row',
                                { selected: isSelected },
                              )}
                              onClick={() =>
                                onTraceSelect([String(thread.processId)])
                              }
                            >
                              <Space size={4} style={{ flex: 1 }}>
                                <ChromeOutlined />
                                <Typography.Text className="SidebarCheckboxGroup-label">
                                  {thread.title || `PID ${thread.processId}`}
                                </Typography.Text>
                              </Space>
                              <Tag
                                color={
                                  thread.type === 'renderer'
                                    ? logColorMap[LogType.WEBAPP]
                                    : logColorMap[LogType.BROWSER]
                                }
                                style={{
                                  fontSize: 10,
                                  lineHeight: '16px',
                                  padding: '0 4px',
                                  margin: 0,
                                }}
                              >
                                {thread.type === 'renderer'
                                  ? 'webapp'
                                  : thread.type}
                              </Tag>
                            </div>
                          );
                        })}
                      </fieldset>
                      <fieldset className="SidebarCheckboxGroup">
                        <legend className="SidebarCheckboxGroup-legend">
                          <Typography.Text
                            type="secondary"
                            className="SidebarCheckboxGroup-title"
                          >
                            Perfetto
                          </Typography.Text>
                        </legend>
                        <div
                          className={classNames('SidebarCheckboxGroup-row', {
                            selected:
                              isTraceFileSelected &&
                              props.state.selectedTraceViewer ===
                                TRACE_VIEWER.PERFETTO,
                          })}
                          onClick={() => onTraceSelect([TRACE_VIEWER.PERFETTO])}
                        >
                          <Space size={4} style={{ flex: 1 }}>
                            <DashboardOutlined />
                            <Typography.Text className="SidebarCheckboxGroup-label">
                              Open in Perfetto
                            </Typography.Text>
                          </Space>
                        </div>
                      </fieldset>
                    </>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
});

export { SidebarFileTree };
