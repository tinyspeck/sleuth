import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { didFilterChange } from '../../utils/did-filter-change';
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
  const [sortedList, setSortedList] = useState<Array<LogEntry>>([]);
  const [sortBy, setSortBy] = useState<string>('index');
  const [sortDirection, setSortDirection] = useState<SORT_DIRECTION>(
    state.defaultSort || SORT_DIRECTION.DESC,
  );
  const [ignoreSearchIndex, setIgnoreSearchIndex] = useState(false);
  const [selectedRangeIndex, setSelectedRangeIndex] = useState<
    number | undefined
  >(undefined);
  const [scrollToSelection, setScrollToSelection] = useState(false);
  const [userTZ] = useState(
    state.stateFiles['log-context.json']?.data?.systemTZ,
  );

  // Track previous values for comparison
  const prevPropsRef = useRef({
    levelFilter,
    search,
    logFile,
    showOnlySearchResults,
    searchIndex,
    dateRange,
    selectedEntry,
  });

  const findIndexForSelectedEntry = useCallback(
    (list: Array<LogEntry> | undefined): number => {
      const { selectedEntry } = state;

      if (selectedEntry && list) {
        const foundIndex = list.findIndex((v) => {
          return (
            v.line === selectedEntry.line &&
            v.momentValue === selectedEntry.momentValue
          );
        });

        return foundIndex;
      }

      return -1;
    },
    [state],
  );

  /**
   * Changes the current selection in the table to the target index
   */
  const changeSelection = useCallback(
    (newIndex: number) => {
      const nextIndex = newIndex;
      const nextEntry = sortedList[nextIndex] || null;

      if (nextEntry) {
        state.selectedEntry = nextEntry;
        state.selectedIndex = nextIndex;

        if (!state.isDetailsVisible) {
          state.isDetailsVisible = true;
        }

        setIgnoreSearchIndex(false);
        setScrollToSelection(true);
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

      setSelectedRangeIndex(rangeIndex);
      setIgnoreSearchIndex(true);
      setScrollToSelection(true);
    },
    [sortedList, state, changeSelection],
  );

  /**
   * Show a context menu for the individual log lines in the table
   */
  const onRowRightClick = useCallback(
    async (params: RowMouseEventHandlerParams) => {
      const rowData: LogEntry = params.rowData;
      // type assertion because this component should only appear when you have a LogFile showing
      const logType = (state.selectedLogFile as LogFile).logType;
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
    },
    [state, sortedList, changeSelection],
  );

  const incrementSelection = useCallback(
    (count: number) => {
      const { selectedIndex } = state;

      if (typeof selectedIndex === 'number') {
        const nextIndex = selectedIndex + count;
        console.log({ nextIndex });
        changeSelection(nextIndex);
      }
    },
    [state, changeSelection],
  );

  /**
   * Checks whether or not the table should filter
   */
  const shouldFilter = useCallback(
    (filter?: LevelFilter): boolean => {
      const filterOrDefault = filter || levelFilter;

      if (!filterOrDefault) return false;
      const allEnabled = Object.keys(filterOrDefault).every(
        (k: keyof LevelFilter) => filterOrDefault[k],
      );
      const allDisabled = Object.keys(filterOrDefault).every(
        (k: keyof LevelFilter) => !filterOrDefault[k],
      );

      return !(allEnabled || allDisabled);
    },
    [levelFilter],
  );

  /**
   * Performs a search operation
   */
  const doSearch = useCallback(
    (
      list: Array<LogEntry>,
      searchOptions: SortFilterListOptions,
    ): [Array<LogEntry>, Array<number>] => {
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
    },
    [],
  );

  const doRangeFilter = useCallback(
    ({ from, to }: DateRange, list: Array<LogEntry>): Array<LogEntry> => {
      if (!from && !to) return list;

      const fromTs = from ? from.getTime() : null;
      const toTs = to ? to.getTime() : null;

      return list.filter((e) => {
        const ts = e.momentValue || 0;
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
        return true;
      });
    },
    [],
  );

  /**
   * Sorts the list and filters it by log level and search query
   */
  const sortAndFilterList = useCallback(
    (options: SortFilterListOptions = {}): Array<LogEntry> => {
      const file = options.logFile || logFile;
      const filter = options.filter || levelFilter;
      const searchText = options.search !== undefined ? options.search : search;
      const sortByKey = options.sortBy || sortBy;
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
      if (!file) return [];

      const shouldDoFilter = shouldFilter(filter);
      const noSort =
        (!sortByKey || sortByKey === 'index') &&
        (!sortDir || sortDir === SORT_DIRECTION.ASC);

      // Check if we can bail early and just use the naked logEntries array
      if (noSort && !shouldDoFilter && !searchText) return file.logEntries;

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
        d(
          `Performing date range filter (from: ${range.from}, to: ${range.to})`,
        );
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
        const [rowsToDisplay, searchList] = doSearch(list, derivedOptions);

        list = rowsToDisplay;
        state.searchList = searchList;
      }

      return list;
    },
    [
      logFile,
      levelFilter,
      search,
      sortBy,
      dateRange,
      sortDirection,
      shouldFilter,
      doRangeFilter,
      doSearch,
      state,
    ],
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
      const newSort =
        sortBy !== newSortBy || sortDirection !== newSortDirection;

      if (newSort) {
        const newSortedList = sortAndFilterList({
          sortBy: newSortBy,
          sortDirection: newSortDirection,
        });

        // Get correct selected index
        state.selectedIndex = findIndexForSelectedEntry(newSortedList);

        setSortBy(newSortBy);
        setSortDirection(newSortDirection);
        setSortedList(newSortedList);
      }
    },
    [
      sortBy,
      sortDirection,
      sortAndFilterList,
      state,
      findIndexForSelectedEntry,
    ],
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
            className="Meta Color-Browser ts_icon ts_icon_power_off"
          />
        );
      } else if (entry.logType === 'webapp') {
        prefix = (
          <i
            title="Webapp Log"
            className="Meta Color-Webapp ts_icon ts_icon_globe"
          />
        );
      } else if (entry.logType === 'mobile') {
        prefix = (
          <i
            title="Mobile Log"
            className="Meta Color-Mobile ts_icon ts_icon_phone"
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
        selectedRangeIndex !== undefined &&
        between(index, state.selectedIndex, selectedRangeIndex);

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
      props,
      ignoreSearchIndex,
      searchIndex,
      state.selectedIndex,
      selectedRangeIndex,
      rowGetter,
    ],
  );

  /**
   * Renders the table
   */
  const renderTable = useCallback(
    (options: Size): JSX.Element => {
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

      if (scrollToSelection) tableOptions.scrollToIndex = state.selectedIndex;

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
                  color={
                    logColorMap[cellData as ProcessableLogType] ?? 'default'
                  }
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
    },
    [
      searchList,
      rowGetter,
      sortedList.length,
      onRowClick,
      onRowRightClick,
      rowClassNameGetter,
      onSortChange,
      sortBy,
      sortDirection,
      scrollToSelection,
      state.selectedIndex,
      ignoreSearchIndex,
      searchIndex,
      renderTimestampCell,
      logFile.logType,
      renderMessageCell,
    ],
  );

  // Setup MobX reaction for searchIndex changes
  useEffect(() => {
    const dispose = reaction(
      () => state.searchIndex,
      (newSearchIndex) => {
        state.selectedIndex = state.searchList[newSearchIndex];
        state.selectedEntry = sortedList[state.selectedIndex];
      },
    );
    return dispose;
  }, [state, sortedList]);

  // Setup MobX reaction for timezone changes
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
  }, [state.isUserTZ]);

  // componentDidMount - initial sort and filter
  useEffect(() => {
    const initialSortedList = sortAndFilterList();
    const { selectedEntry } = state;

    setSortedList(initialSortedList);
    if (selectedEntry) {
      setScrollToSelection(true);
    }
  }, []);

  useEffect(() => {
    if (
      state.searchList.length > 0 &&
      (typeof state.selectedIndex === 'undefined' || state.selectedIndex < 0)
    ) {
      changeSelection(state.searchList[0]);
    }
  });

  useEffect(() => {
    const prevProps = prevPropsRef.current;

    // Filter or search changed
    const entryChanged = selectedEntry !== state.selectedEntry;
    const filterChanged = didFilterChange(prevProps.levelFilter, levelFilter);
    const searchChanged =
      prevProps.search !== search ||
      prevProps.showOnlySearchResults !== showOnlySearchResults;
    const fileChanged =
      (!prevProps.logFile && logFile) ||
      (prevProps.logFile &&
        logFile &&
        prevProps.logFile.logEntries.length !== logFile.logEntries.length) ||
      (prevProps.logFile &&
        logFile &&
        prevProps.logFile.logType !== logFile.logType);

    // Date range changed
    const rangeChanged = prevProps.dateRange !== dateRange;

    // This should only happen if a bookmark was activated
    if (entryChanged) {
      setScrollToSelection(true);
    }

    if (
      filterChanged ||
      searchChanged ||
      fileChanged ||
      rangeChanged ||
      entryChanged
    ) {
      const sortOptions: SortFilterListOptions = {
        showOnlySearchResults,
        filter: levelFilter,
        search,
        logFile,
        dateRange,
      };
      const newSortedList = sortAndFilterList(sortOptions);

      // Get correct selected index
      state.selectedIndex = findIndexForSelectedEntry(newSortedList);

      setSortedList(newSortedList);
    }

    if (fileChanged) {
      setSelectedRangeIndex(undefined);
    }

    if (isMergedLogFile(logFile) && sortBy === 'index') {
      setSortBy('momentValue');
    }

    if (prevProps.searchIndex !== searchIndex) {
      setIgnoreSearchIndex(false);
    }

    // Update prevProps ref for next render
    prevPropsRef.current = {
      levelFilter,
      search,
      logFile,
      showOnlySearchResults,
      searchIndex,
      dateRange,
      selectedEntry,
    };
  }, [
    levelFilter,
    search,
    logFile,
    showOnlySearchResults,
    searchIndex,
    dateRange,
    selectedEntry,
    state,
    sortAndFilterList,
    findIndexForSelectedEntry,
    sortBy,
  ]);

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        incrementSelection(e.key === 'ArrowDown' ? 1 : -1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
