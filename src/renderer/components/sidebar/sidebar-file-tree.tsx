import {
  Badge,
  Segmented,
  Select,
  Space,
  Tabs,
  theme,
  Tooltip,
  Tree,
  TreeDataNode,
  Typography,
} from 'antd';
import classNames from 'classnames';
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
  UnzippedFile,
  LogTypeFilter,
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
import { CheckboxItem, SidebarCheckboxGroup } from './sidebar-checkbox-group';
import { isMergedLogFile } from '../../../utils/is-logfile';
import { getEnvironmentWarnings } from '../../analytics/environment-analytics';
import { getRootStateWarnings } from '../../analytics/root-state-analytics';
import { getTraceWarnings } from '../../analytics/trace-analytics';
import { hashTagColor } from '../log-table';

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
    key: LogType.rx_epic,
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

  // --- Log type callbacks ---
  const onLogTypeToggle = useCallback(
    (key: string, checked: boolean) => {
      props.state.setLogTypeFilter({ [key]: checked });
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
      ].data.files.filter((f: any) => f.fileName.endsWith('.dmp'));
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
        onChange={(key) => {
          setManualTab(key);
          if (key === 'logs' && isStateFileSelected) {
            props.state.selectLogFile(null, LogType.ALL);
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
                          { label: '#', value: 'freq' },
                          { label: 'Az', value: 'az' },
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
