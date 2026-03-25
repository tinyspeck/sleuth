import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import classNames from 'classnames';
import { format } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import {
  Table,
  AutoSizer,
  Column,
  TableCellProps,
  RowMouseEventHandlerParams,
  Size,
  TableProps,
} from 'react-virtualized';
import debug from 'debug';

import {
  LevelFilter,
  LogEntry,
  DateRange,
  LogType,
  ProcessableLogType,
  LogLineContextMenuActions,
  LogFile,
} from '../../interfaces';
import { isReduxAction } from '../../utils/is-redux-action';
import {
  LogTableProps,
  SORT_DIRECTION,
  SortFilterListOptions,
} from './log-table-constants';
import { isMergedLogFile } from '../../utils/is-logfile';
import { getRegExpMaybeSafe } from '../../utils/regexp';
import { between } from '../../utils/is-between';
import { getRangeEntries } from '../../utils/get-range-from-array';
import { RepeatedLevels } from '../../shared-constants';
import { reaction, toJS } from 'mobx';
import { Tag } from 'antd';
import { observer } from 'mobx-react';
import { getCopyText } from '../state/copy';
import { PaperClipOutlined, PartitionOutlined } from '@ant-design/icons';

const d = debug('sleuth:logtable');

export const logColorMap: Record<ProcessableLogType, string> = {
  [LogType.BROWSER]: 'cyan',
  [LogType.WEBAPP]: 'magenta',
  [LogType.INSTALLER]: 'green',
  [LogType.CHROMIUM]: 'geekblue',
  [LogType.MOBILE]: 'lime',
};

/**
 * Welcome! This is the biggest component in this application - it's the table that displays logging
 * information. This is also the component that could most easily destroy performance, so be careful
 * here!
 */
export const LogTable = observer((props: LogTableProps) => {
  const {
    levelFilter,
    search,
    logFile,
    showOnlySearchResults,
    searchIndex,
    searchList,
    dateRange,
    selectedEntry,
    state,
  } = props;

  const tableRef = useRef<Table>(null);
  const [sortBy, setSortBy] = useState<string>('index');
  const [sortDirection, setSortDirection] = useState<SORT_DIRECTION>(
    state.defaultSort || SORT_DIRECTION.DESC,
  );
  const [ignoreSearchIndex, setIgnoreSearchIndex] = useState(false);
  const scrollToSelectionRef = useRef(false);
  const userTZRef = useRef(
    state.stateFiles['log-context.json']?.data?.systemTZ,
  );
  const userTZ = userTZRef.current;

  function findIndexForSelectedEntry(
    list: Array<LogEntry> | undefined,
    entry: LogEntry | undefined,
  ): number {
    if (entry && list) {
      return list.findIndex((v) => {
        return v.line === entry.line && v.momentValue === entry.momentValue;
      });
    }

    return -1;
  }

  function shouldFilter(filter?: LevelFilter): boolean {
    const filterOrDefault = filter || levelFilter;

    if (!filterOrDefault) return false;
    const allEnabled = Object.keys(filterOrDefault).every(
      (k: keyof LevelFilter) => filterOrDefault[k],
    );
    const allDisabled = Object.keys(filterOrDefault).every(
      (k: keyof LevelFilter) => !filterOrDefault[k],
    );

    return !(allEnabled || allDisabled);
  }

  function doSearch(
    list: Array<LogEntry>,
    searchOptions: SortFilterListOptions,
  ): [Array<LogEntry>, Array<number>] {
    if (searchOptions.search?.length === 0) {
      return [list, []];
    }

    const searchParams = searchOptions.search?.split(' ') ?? [];
    let searchRegex = getRegExpMaybeSafe(searchOptions.search);

    function _match(a: LogEntry) {
      return !searchRegex || searchRegex.test(a.message);
    }
    function _exclude(a: LogEntry) {
      return !searchRegex || !searchRegex.test(a.message);
    }

    let rowsToDisplay = list;
    let foundIndices: Array<number> = [];

    if (searchOptions.showOnlySearchResults) {
      searchParams.forEach((param) => {
        if (param.startsWith('!') && param.length > 1) {
          d(`Filter-Excluding ${param.slice(1)}`);
          searchRegex = new RegExp(param.slice(1) || '', 'i');
          rowsToDisplay = rowsToDisplay.filter(_exclude);
        } else {
          d(`Filter-Searching for ${param}`);
          rowsToDisplay = list.filter(_match);
        }
      });
      foundIndices = Array.from(rowsToDisplay.keys());
    } else {
      foundIndices = Array.from(Array(list.length).keys());
      searchParams.forEach((param) => {
        if (param.startsWith('!') && param.length > 1) {
          d(`Filter-Excluding ${param.slice(1)}`);
          searchRegex = new RegExp(param.slice(1) || '', 'i');
          foundIndices = foundIndices.filter((idx) => _exclude(list[idx]));
        } else {
          d(`Filter-Searching for ${param}`);
          foundIndices = foundIndices.filter((idx) => _match(list[idx]));
        }
      });
    }

    return [rowsToDisplay, foundIndices];
  }

  function doRangeFilter(
    { from, to }: DateRange,
    list: Array<LogEntry>,
  ): Array<LogEntry> {
    if (!from && !to) return list;

    const fromTs = from ? from.getTime() : null;
    const toTs = to ? to.getTime() : null;

    return list.filter((e) => {
      const ts = e.momentValue || 0;
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      return true;
    });
  }

  // Auto-switch to momentValue sort for merged log files
  const effectiveSortBy =
    isMergedLogFile(logFile) && sortBy === 'index' ? 'momentValue' : sortBy;

  /**
   * Sorts the list and filters it by log level and search query.
   * Computed synchronously during render via useMemo to avoid extra render cycles.
   */
  function sortAndFilterList(options: SortFilterListOptions = {}): {
    list: Array<LogEntry>;
    newSearchList: Array<number> | null;
  } {
    const file = options.logFile || logFile;
    const filter = options.filter || levelFilter;
    const searchText = options.search !== undefined ? options.search : search;
    const sortByKey = options.sortBy || effectiveSortBy;
    const range = options.dateRange || dateRange;
    const sortDir = options.sortDirection || sortDirection;
    const showOnlyResults =
      options.showOnlySearchResults ?? showOnlySearchResults;

    const derivedOptions: SortFilterListOptions = {
      logFile: file,
      filter,
      search: searchText,
      sortBy: sortByKey,
      dateRange: range,
      sortDirection: sortDir,
      showOnlySearchResults: showOnlyResults,
    };

    d(`Starting filter`);
    if (!file) return { list: [], newSearchList: null };

    const shouldDoFilter = shouldFilter(filter);
    const noSort =
      (!sortByKey || sortByKey === 'index') &&
      (!sortDir || sortDir === SORT_DIRECTION.ASC);

    // Check if we can bail early and just use the naked logEntries array
    if (noSort && !shouldDoFilter && !searchText)
      return { list: file.logEntries, newSearchList: null };

    let list = file.logEntries.concat();

    // Named definition here allows V8 to go craaaaaazy, speed-wise.
    function doSortByMessage(a: LogEntry, b: LogEntry) {
      return a.message.localeCompare(b.message);
    }
    function doSortByLevel(a: LogEntry, b: LogEntry) {
      return a.level.localeCompare(b.level);
    }
    function doSortByLine(a: LogEntry, b: LogEntry) {
      return a.line > b.line ? 1 : -1;
    }
    function doSortByTimestamp(a: LogEntry, b: LogEntry) {
      if (a.momentValue === b.momentValue) return 0;
      return (a.momentValue || 0) > (b.momentValue || 0) ? 1 : -1;
    }
    function doFilter(a: LogEntry) {
      return a.level && filter[a.level];
    }

    // Filter
    if (shouldDoFilter) {
      list = list.filter(doFilter);
    }

    // DateRange
    if (range) {
      d(`Performing date range filter (from: ${range.from}, to: ${range.to})`);
      list = doRangeFilter(range, list);
    }

    // Sort
    d(`Sorting by ${sortByKey}`);
    if (sortByKey === 'message') {
      list = list.sort(doSortByMessage);
    } else if (sortByKey === 'level') {
      list = list.sort(doSortByLevel);
    } else if (sortByKey === 'line') {
      list = list.sort(doSortByLine);
    } else if (sortByKey === 'momentValue') {
      list = list.sort(doSortByTimestamp);
    }

    if (sortDir === SORT_DIRECTION.DESC) {
      d('Reversing');
      list.reverse();
    }

    // Search
    if (typeof searchText === 'string') {
      const [rowsToDisplay, searchResults] = doSearch(list, derivedOptions);

      list = rowsToDisplay;
      return { list, newSearchList: searchResults };
    }

    return { list, newSearchList: null };
  }

  /**
   * sortedList is a derived value from props + sort state.
   * Computing it synchronously in useMemo avoids the extra render cycle
   * that useEffect + useState would cause.
   */
  const { sortedList, newSearchList } = useMemo(() => {
    const { list, newSearchList } = sortAndFilterList();
    return { sortedList: list, newSearchList };
  }, [
    logFile,
    levelFilter,
    search,
    effectiveSortBy,
    dateRange,
    sortDirection,
    showOnlySearchResults,
    state,
  ]);

  // Sync searchList to MobX state as a side effect (not inside useMemo)
  useEffect(() => {
    if (newSearchList !== null) {
      state.searchList = newSearchList;
    }
  }, [newSearchList, state]);

  /**
   * Changes the current selection in the table to the target index
   */
  const changeSelection = useCallback(
    (newIndex: number) => {
      const nextEntry = sortedList[newIndex] || null;

      if (nextEntry) {
        state.selectedEntry = nextEntry;
        state.selectedIndex = newIndex;

        if (!state.isDetailsVisible) {
          state.isDetailsVisible = true;
        }

        setIgnoreSearchIndex(false);
        scrollToSelectionRef.current = true;
      }
    },
    [sortedList, state],
  );

  /**
   * Handles a single click onto a row
   */
  const onRowClick = useCallback(
    ({ index, event }: RowMouseEventHandlerParams) => {
      let selectedRange: Array<LogEntry> | undefined;
      let selectedIdx: number;
      let rangeIndex: number | undefined;
      // If the user held shift and we have a previous index selected, we want to do a "from-to" selection
      if (event.shiftKey && state.selectedIndex) {
        selectedIdx = state.selectedIndex;
        rangeIndex = index;
        selectedRange = getRangeEntries(rangeIndex, selectedIdx, sortedList);
      } else {
        selectedIdx = index;
        changeSelection(selectedIdx);
      }

      state.selectedRangeEntries = selectedRange;
      state.selectedIndex = selectedIdx;
      state.selectedEntry = sortedList[selectedIdx];
      state.selectedRangeIndex = rangeIndex;
      state.isDetailsVisible = true;

      setIgnoreSearchIndex(true);
      scrollToSelectionRef.current = true;
    },
    [sortedList, state, changeSelection],
  );

  /**
   * Show a context menu for the individual log lines in the table
   */
  const onRowRightClick = useCallback(
    async (params: RowMouseEventHandlerParams) => {
      try {
        const rowData: LogEntry = params.rowData;
        const selectedLogFile = state.selectedLogFile as LogFile | undefined;
        if (!selectedLogFile) return;

        const logType = selectedLogFile.logType;
        const response = await window.Sleuth.showLogLineContextMenu(logType);

        switch (response) {
          case LogLineContextMenuActions.COPY_TO_CLIPBOARD: {
            let copyText = '';
            if (state.selectedRangeEntries) {
              for (const entry of state.selectedRangeEntries) {
                copyText += getCopyText(entry) + '\n';
              }
            } else {
              copyText = getCopyText(rowData);
            }
            window.Sleuth.clipboard.writeText(copyText);
            break;
          }
          case LogLineContextMenuActions.OPEN_SOURCE: {
            const { line, sourceFile } = rowData;
            window.Sleuth.openLineInSource(line, sourceFile, {
              defaultEditor: toJS(state.defaultEditor),
            });
            break;
          }
          case LogLineContextMenuActions.SHOW_IN_CONTEXT:
            {
              state.selectLogFile(null, LogType.ALL);
              const matchingIndex = sortedList.findIndex(
                (row) => row.momentValue === rowData.momentValue,
              );
              changeSelection(matchingIndex);
            }
            break;
        }
      } catch (error) {
        d('Error in context menu handler:', error);
      }
    },
    [state, sortedList, changeSelection],
  );

  const incrementSelection = useCallback(
    (count: number) => {
      const { selectedIndex } = state;

      if (typeof selectedIndex === 'number') {
        const nextIndex = selectedIndex + count;
        changeSelection(nextIndex);
      }
    },
    [state, changeSelection],
  );

  /**
   * Handles the change of sorting direction. This method is passed to the LogTableHeaderCell
   * components, who call it once the user changes sorting.
   */
  const onSortChange = useCallback(
    ({
      sortBy: newSortBy,
      sortDirection: newSortDirection,
    }: {
      sortBy: string;
      sortDirection: SORT_DIRECTION;
    }) => {
      setSortBy(newSortBy);
      setSortDirection(newSortDirection);
    },
    [],
  );

  /**
   * Renders the "message" cell
   */
  const renderMessageCell = useCallback(
    ({ rowData: entry }: TableCellProps): JSX.Element | string => {
      const message = entry.highlightMessage ?? entry.message;

      if (entry && entry.meta) {
        const icon = isReduxAction(entry.message) ? (
          <PartitionOutlined />
        ) : (
          <PaperClipOutlined />
        );
        return (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <span title={entry.message}>{icon}</span>
            <span title={entry.message}>{message}</span>
          </div>
        );
      } else if (entry && entry.repeated) {
        const count = entry.repeated.length;
        let emoji = '';

        if (count > RepeatedLevels.NOTIFY) {
          emoji = '🛑';
        } else if (count > RepeatedLevels.WARNING) {
          emoji = '🌶';
        } else if (count > RepeatedLevels.ERROR) {
          emoji = '🔥';
        }

        const emojiMessage = `(${emoji} Repeated ${entry.repeated.length} times)`;
        return (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <span>{emojiMessage}</span>
            <span>{message}</span>
          </div>
        );
      } else {
        return message;
      }
    },
    [],
  );

  /**
   * Renders a cell, prefixing the log entries type.
   */
  const renderTimestampCell = useCallback(
    ({ rowData: entry }: TableCellProps): JSX.Element | string => {
      const { dateTimeFormat } = props;
      const timestamp = entry.momentValue
        ? format(
            new TZDate(
              entry.momentValue,
              state.isUserTZ
                ? userTZ
                : Intl.DateTimeFormat().resolvedOptions().timeZone,
            ),
            dateTimeFormat,
          )
        : entry.timestamp;
      let prefix = <i className="Meta ts_icon ts_icon_question" />;

      if (entry.logType === 'browser') {
        prefix = (
          <i
            title="Browser Log"
            className="Meta ts_icon ts_icon_power_off"
            style={{ color: 'var(--color-browser)' }}
          />
        );
      } else if (entry.logType === 'webapp') {
        prefix = (
          <i
            title="Webapp Log"
            className="Meta ts_icon ts_icon_globe"
            style={{ color: 'var(--color-webapp)' }}
          />
        );
      } else if (entry.logType === 'mobile') {
        prefix = (
          <i
            title="Mobile Log"
            className="Meta ts_icon ts_icon_phone"
            style={{ color: 'var(--color-mobile)' }}
          />
        );
      }

      return (
        <span title={entry.timestamp}>
          {prefix}
          {timestamp}
        </span>
      );
    },
    [props, state.isUserTZ, userTZ],
  );

  /**
   * Get the row data for the table
   */
  const rowGetter = useCallback(
    ({ index }: { index: number }): LogEntry => {
      return sortedList[index];
    },
    [sortedList],
  );

  /**
   * Used by the table to get the className for a given row.
   * Called for each row.
   */
  const rowClassNameGetter = useCallback(
    (input: { index: number }): string => {
      const { index } = input;
      const isSearchIndex =
        !ignoreSearchIndex &&
        searchList.length > 0 &&
        index === searchList[searchIndex];
      const isRangeActive =
        state.selectedIndex !== undefined &&
        state.selectedRangeIndex !== undefined &&
        between(index, state.selectedIndex, state.selectedRangeIndex);

      const classes: string[] = [];

      if (isSearchIndex || state.selectedIndex === index || isRangeActive) {
        classes.push('ActiveRow');
      }

      if (Array.isArray(searchList) && searchList.includes(index)) {
        classes.push('HighlightRow');
      }

      const row = rowGetter(input);
      if (
        row?.level === 'error' ||
        (row?.repeated?.length || 0) > RepeatedLevels.ERROR
      ) {
        classes.push('ErrorRow');
      } else if (
        row?.level === 'warn' ||
        (row?.repeated?.length || 0) > RepeatedLevels.WARNING
      ) {
        classes.push('WarnRow');
      }

      return classNames(...classes);
    },
    [
      searchList,
      ignoreSearchIndex,
      searchIndex,
      state.selectedIndex,
      state.selectedRangeIndex,
      rowGetter,
    ],
  );

  /**
   * Renders the table
   */
  function renderTable(options: Size): JSX.Element {
    const tableOptions: TableProps = {
      ...options,
      rowHeight: 30,
      rowGetter,
      rowCount: sortedList.length,
      onRowClick,
      onRowRightClick,
      rowClassName: rowClassNameGetter,
      headerHeight: 30,
      sort: onSortChange,
      sortBy,
      sortDirection,
    };

    if (scrollToSelectionRef.current) {
      tableOptions.scrollToIndex = state.selectedIndex;
      scrollToSelectionRef.current = false;
    }

    if (!ignoreSearchIndex && searchList.length > 0)
      tableOptions.scrollToIndex = searchList[searchIndex] || 0;

    return (
      <Table {...tableOptions} ref={tableRef}>
        <Column
          label="Index"
          dataKey="index"
          width={100}
          flexGrow={0}
          flexShrink={1}
        />
        <Column label="Line" dataKey="line" width={100} />
        <Column
          label="Timestamp"
          cellRenderer={renderTimestampCell}
          dataKey="momentValue"
          width={200}
          flexGrow={2}
        />
        <Column label="Level" dataKey="level" width={100} />
        {logFile.logType === LogType.ALL ? (
          <Column
            label="Process"
            dataKey="logType"
            width={120}
            cellRenderer={({ cellData }: TableCellProps) => (
              <Tag
                color={logColorMap[cellData as ProcessableLogType] ?? 'default'}
              >
                {cellData}
              </Tag>
            )}
          />
        ) : null}
        <Column
          label="Message"
          dataKey="message"
          cellRenderer={renderMessageCell}
          width={options.width - 300}
          flexGrow={2}
        />
      </Table>
    );
  }

  // Use a ref so the searchIndex reaction always reads the latest sortedList
  // without needing to tear down and recreate the reaction.
  const sortedListRef = useRef(sortedList);
  sortedListRef.current = sortedList;

  // Setup MobX reaction for searchIndex changes (once)
  useEffect(() => {
    const dispose = reaction(
      () => state.searchIndex,
      (newSearchIndex) => {
        state.selectedIndex = state.searchList[newSearchIndex];
        state.selectedEntry = sortedListRef.current[state.selectedIndex];
      },
    );
    return dispose;
  }, [state]);

  // Setup MobX reaction for timezone changes (once)
  useEffect(() => {
    const dispose = reaction(
      () => state.isUserTZ,
      () => {
        if (tableRef.current) {
          tableRef.current.forceUpdateGrid();
        }
      },
    );
    return dispose;
  }, [state]);

  // Keep selectedIndex in sync with the current sortedList
  useEffect(() => {
    state.selectedIndex = findIndexForSelectedEntry(
      sortedList,
      state.selectedEntry,
    );
  }, [sortedList, state, state.selectedEntry]);

  // Scroll to selection when a bookmark is activated (selectedEntry prop changes)
  useEffect(() => {
    if (selectedEntry !== state.selectedEntry) {
      scrollToSelectionRef.current = true;
    }
  }, [selectedEntry, state]);

  // Reset range selection when the file changes
  useEffect(() => {
    state.selectedRangeIndex = undefined;
  }, [logFile, state]);

  // Reset ignoreSearchIndex when searchIndex prop changes
  useEffect(() => {
    setIgnoreSearchIndex(false);
  }, [searchIndex]);

  // Auto-select first search result when search list populates with no selection
  useEffect(() => {
    if (
      state.searchList.length > 0 &&
      (typeof state.selectedIndex === 'undefined' || state.selectedIndex < 0)
    ) {
      changeSelection(state.searchList[0]);
    }
  }, [state.searchList, state.selectedIndex, changeSelection]);

  // Scroll to selection on mount if there's already a selected entry
  useEffect(() => {
    if (state.selectedEntry) {
      scrollToSelectionRef.current = true;
    }
  }, []);

  // Keyboard navigation handler — listen on document to match
  // the previous global behavior (react-keydown listened globally)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        incrementSelection(e.key === 'ArrowDown' ? 1 : -1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [incrementSelection]);

  const typeClassName = logFile.type === 'MergedLogFile' ? 'Merged' : 'Single';
  const className = classNames('LogTable', typeClassName);

  return (
    <div className={className}>
      <div className="Sizer">
        <AutoSizer>{(options) => renderTable(options)}</AutoSizer>
      </div>
    </div>
  );
});
