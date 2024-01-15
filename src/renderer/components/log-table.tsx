import debounce from 'debounce';
import React from 'react';
import classNames from 'classnames';
import { format } from 'date-fns';
import { default as keydown } from 'react-keydown';
import autoBind from 'react-autobind';
import {
  Table,
  AutoSizer,
  Column,
  TableCellProps,
  RowMouseEventHandlerParams,
  Size,
  TableProps,
} from 'react-virtualized';
import { Icon } from '@blueprintjs/core';
import debug from 'debug';
import Fuse from 'fuse.js';

import { LevelFilter, LogEntry, DateRange } from '../../interfaces';
import { didFilterChange } from '../../utils/did-filter-change';
import { isReduxAction } from '../../utils/is-redux-action';
import {
  LogTableProps,
  LogTableState,
  SORT_DIRECTION,
  SortFilterListOptions,
} from './log-table-constants';
import { isMergedLogFile } from '../../utils/is-logfile';
import { getRegExpMaybeSafe } from '../../utils/regexp';
import { between } from '../../utils/is-between';
import { getRangeEntries } from '../../utils/get-range-from-array';
import { RepeatedLevels } from '../../shared-constants';
import { reaction } from 'mobx';

const d = debug('sleuth:logtable');

/**
 * Welcome! This is the biggest class in this application - it's the table that displays logging
 * information. This is also the class that could most easily destroy performance, so be careful
 * here!
 */
export class LogTable extends React.Component<LogTableProps, LogTableState> {
  /**
   * Debounce wrapper for changing the selected log entry.
   */
  private _changeSelectedEntry:
    | ((() => void) & { clear(): void } & { flush(): void })
    | null = null;

  constructor(props: LogTableProps) {
    super(props);

    this.state = {
      sortedList: [],
      sortBy: 'index',
      sortDirection: props.state.defaultSort || SORT_DIRECTION.DESC,
      ignoreSearchIndex: false,
    };

    autoBind(this);
    this.selectSearchIndex();
  }

  /**
   * If we update the `searchIndex` variable by any means, we should
   * select the appropriate searchIndex.
   */
  private selectSearchIndex() {
    reaction(
      () => this.props.state.searchIndex,
      (searchIndex) => {
        this.props.state.selectedIndex =
          this.props.state.searchList[searchIndex];
        this.props.state.selectedEntry =
          this.state.sortedList[this.props.state.selectedIndex];
      },
    );
  }

  /**
   * Attempts at being smart about updates
   *
   * @param {LogTableProps} nextProps
   * @param {LogTableState} nextState
   * @returns {boolean}
   */
  public shouldComponentUpdate(
    nextProps: LogTableProps,
    nextState: LogTableState,
  ): boolean {
    const {
      dateTimeFormat,
      levelFilter,
      logFile,
      searchIndex,
      searchList,
      searchMethod,
      dateRange,
    } = this.props;
    const {
      sortBy,
      sortDirection,
      sortedList,
      selectedIndex,
      selectedRangeIndex,
    } = this.state;

    // Selected row changed
    if (selectedIndex !== nextState.selectedIndex) return true;
    if (selectedRangeIndex !== nextState.selectedRangeIndex) return true;

    // DateTimeFormat changed
    if (dateTimeFormat !== nextProps.dateTimeFormat) return true;

    // Sort direction changed
    const newSort =
      nextState.sortBy !== sortBy || nextState.sortDirection !== sortDirection;
    if (newSort) return true;

    // File changed - and update is in order
    const nextFile = nextProps.logFile;
    const newFile =
      (!nextFile && logFile) ||
      (nextFile && logFile && nextFile.logType !== logFile.logType);
    const newEntries =
      nextFile &&
      logFile &&
      nextFile.logEntries.length !== logFile.logEntries.length;
    const newResults =
      (!sortedList && nextState.sortedList) ||
      (sortedList && nextState.sortedList.length !== sortedList.length);
    if (newFile || newEntries || newResults) return true;

    // Filter changed
    if (didFilterChange(levelFilter, nextProps.levelFilter)) return true;

    // DateRange changed
    if (dateRange !== nextProps.dateRange) return true;

    // Search changed
    if (
      searchList !== nextProps.searchList ||
      searchIndex !== nextProps.searchIndex
    )
      return true;

    // Search method changed
    if (searchMethod !== nextProps.searchMethod) {
      return true;
    }

    return false;
  }

  public componentDidUpdate() {
    const { selectedIndex } = this.state;
    if (
      this.props.state.searchList.length > 0 &&
      (typeof selectedIndex === 'undefined' || selectedIndex < 0)
    ) {
      this.changeSelection(this.props.state.searchList[0]);
    }
  }

  /**
   * React's componentWillReceiveProps
   *
   * @param {LogTableProps} nextProps
   */
  public UNSAFE_componentWillReceiveProps(nextProps: LogTableProps): void {
    const {
      levelFilter,
      search,
      logFile,
      showOnlySearchResults,
      searchIndex,
      dateRange,
    } = this.props;

    // Next props
    const nextShowOnlySearchResults = nextProps.showOnlySearchResults;
    const nextFile = nextProps.logFile;
    const nextLevelFilter = nextProps.levelFilter;
    const nextSearch = nextProps.search;
    const nextEntry = nextProps.selectedEntry;
    const nextSearchMethod = nextProps.searchMethod;

    // Filter or search changed
    const entryChanged = nextEntry !== this.state.selectedEntry;
    const filterChanged = didFilterChange(levelFilter, nextLevelFilter);
    const searchChanged =
      search !== nextProps.search ||
      showOnlySearchResults !== nextShowOnlySearchResults;
    const fileChanged =
      (!logFile && nextFile) ||
      (logFile &&
        nextFile &&
        logFile.logEntries.length !== nextFile.logEntries.length) ||
      (logFile && nextFile && logFile.logType !== nextFile.logType);
    const searchMethodChanged = nextSearchMethod !== this.props.searchMethod;

    // Date range changed
    const rangeChanged = dateRange !== nextProps.dateRange;
    const nextRange = nextProps.dateRange;

    // This should only happen if a bookmark was activated
    if (entryChanged) {
      this.setState({
        selectedEntry: this.props.state.selectedEntry,
        scrollToSelection: true,
      });
    }

    if (
      filterChanged ||
      searchChanged ||
      fileChanged ||
      rangeChanged ||
      entryChanged ||
      searchMethodChanged
    ) {
      const sortOptions: SortFilterListOptions = {
        showOnlySearchResults: nextShowOnlySearchResults,
        filter: nextLevelFilter,
        search: nextSearch,
        logFile: nextFile,
        dateRange: nextRange,
      };
      const sortedList = this.sortAndFilterList(sortOptions);

      // Get correct selected index
      const selectedIndex = this.findIndexForSelectedEntry(sortedList);

      this.setState({
        sortedList,
        selectedIndex,
        scrollToSelection: !!selectedIndex,
      });
    }

    if (fileChanged) {
      this.setState({ selectedRangeIndex: undefined });
    }

    if (isMergedLogFile(nextFile) && this.state.sortBy === 'index') {
      this.setState({ sortBy: 'momentValue' });
    }

    if (searchIndex !== nextProps.searchIndex) {
      this.setState({ ignoreSearchIndex: false });
    }
  }

  /**
   * React's componentDidMount
   */
  public componentDidMount() {
    const sortedList = this.sortAndFilterList();
    const { selectedEntry, selectedIndex } = this.props.state;
    const update: Pick<
      LogTableState,
      'sortedList' | 'selectedIndex' | 'selectedEntry' | 'scrollToSelection'
    > = {
      sortedList,
    };

    if (selectedEntry) {
      update.selectedIndex = selectedIndex;
      update.selectedEntry = selectedEntry;
      update.scrollToSelection = true;
    }

    this.setState(update);
  }

  /**
   * Enables keyboard navigation of the table
   */
  @keydown('down', 'up')
  public onKeyboardNavigate(e: React.KeyboardEvent) {
    e.preventDefault();
    this.incrementSelection(e.key === 'ArrowDown' ? 1 : -1);
  }

  /**
   * The main render method
   *
   * @returns {(JSX.Element | null)}
   * @memberof LogTable
   */
  public render(): JSX.Element | null {
    const { logFile } = this.props;

    const typeClassName =
      logFile.type === 'MergedLogFile' ? 'Merged' : 'Single';
    const className = classNames('LogTable', 'bp3-text-muted', typeClassName);

    return (
      <div className={className}>
        <div className="Sizer">
          <AutoSizer>{(options) => this.renderTable(options)}</AutoSizer>
        </div>
      </div>
    );
  }

  private findIndexForSelectedEntry(
    sortedList: Array<LogEntry> | undefined,
  ): number {
    const { selectedEntry } = this.props.state;

    if (selectedEntry && sortedList) {
      const foundIndex = sortedList.findIndex((v) => {
        return (
          v.line === selectedEntry.line &&
          v.momentValue === selectedEntry.momentValue
        );
      });

      return foundIndex;
    }

    return -1;
  }

  /**
   * Handles a single click onto a row
   */
  private onRowClick({ index, event }: RowMouseEventHandlerParams) {
    const { sortedList } = this.state;

    let selectedRange, selectedIndex, selectedRangeIndex;
    // If the user held shift and we have a previous index selected, we want to do a "from-to" selection
    if (event.shiftKey && this.props.state.selectedIndex) {
      selectedIndex = this.props.state.selectedIndex;
      selectedRangeIndex = index;
      selectedRange = getRangeEntries(
        selectedRangeIndex,
        selectedIndex,
        sortedList,
      );
    } else {
      selectedIndex = index;
      this.changeSelection(selectedIndex);
    }

    this.props.state.selectedRangeEntries = selectedRange;
    this.props.state.selectedIndex = selectedIndex;
    this.props.state.selectedEntry = sortedList[selectedIndex];
    this.props.state.selectedRangeIndex = selectedRangeIndex;
    this.props.state.isDetailsVisible = true;

    this.setState({
      selectedIndex,
      selectedRangeIndex,
      ignoreSearchIndex: true,
      scrollToSelection: true,
    });
  }

  /**
   * Handles the change of sorting direction. This method is passed to the LogTableHeaderCell
   * components, who call it once the user changes sorting.
   */
  private onSortChange({
    sortBy,
    sortDirection,
  }: {
    sortBy: string;
    sortDirection: SORT_DIRECTION;
  }) {
    const currentState = this.state;
    const newSort =
      currentState.sortBy !== sortBy ||
      currentState.sortDirection !== sortDirection;

    if (newSort) {
      const sortedList = this.sortAndFilterList({ sortBy, sortDirection });

      // Get correct selected index
      const selectedIndex = this.findIndexForSelectedEntry(sortedList);

      this.setState({
        sortBy,
        sortDirection,
        sortedList,
        selectedIndex,
      });
    }
  }

  /**
   * Changes the current selection in the table to the target index
   *
   * @param {number} newIndex
   */
  private changeSelection(newIndex: number) {
    const nextIndex = newIndex;
    const nextEntry = this.state.sortedList[nextIndex] || null;

    if (nextEntry) {
      // Schedule an app-state update. This ensures
      // that we don't update the selection at a high
      // frequency
      if (this._changeSelectedEntry) {
        this._changeSelectedEntry.clear();
      }
      this._changeSelectedEntry = debounce(() => {
        this.props.state.selectedEntry = nextEntry;
        this.props.state.selectedIndex = nextIndex;

        if (!this.props.state.isDetailsVisible) {
          this.props.state.isDetailsVisible = true;
        }
      }, 100);
      this._changeSelectedEntry();

      this.setState({
        selectedIndex: nextIndex,
        ignoreSearchIndex: false,
        scrollToSelection: true,
      });
    }
  }

  private incrementSelection(count: number) {
    const { selectedIndex } = this.state;

    if (typeof selectedIndex === 'number') {
      const nextIndex = selectedIndex + count;
      this.changeSelection(nextIndex);
    }
  }

  /**
   * Checks whether or not the table should filter
   *
   * @returns {boolean}
   */
  private shouldFilter(filter?: LevelFilter): boolean {
    const filterOrDefault = filter || this.props.levelFilter;

    if (!filterOrDefault) return false;
    const allEnabled = Object.keys(filterOrDefault).every(
      (k: keyof LevelFilter) => filterOrDefault[k],
    );
    const allDisabled = Object.keys(filterOrDefault).every(
      (k: keyof LevelFilter) => !filterOrDefault[k],
    );

    return !(allEnabled || allDisabled);
  }

  /**
   * Performs a search operation
   */
  private doFuzzySearch(
    list: Array<LogEntry>,
    searchOptions: SortFilterListOptions,
  ): [Array<LogEntry>, Array<number>] {
    // TODO: make these configurable?
    const options: Fuse.IFuseOptions<LogEntry> = {
      keys: ['message'],
      threshold: 0.3,
      shouldSort: false,
      ignoreLocation: true,
      useExtendedSearch: true,
    };

    let rowsToDisplay = list;
    let foundIndices: Array<number> = [];

    if (searchOptions.search) {
      const fuse = new Fuse(list, options);
      const searchResult = fuse.search(searchOptions.search);

      if (searchOptions.showOnlySearchResults) {
        rowsToDisplay = searchResult.map((result) => result.item);
        foundIndices = Array.from(rowsToDisplay.keys());
      } else {
        // We use an internal Fuse.js API here to grab all records from the index
        // before the filtering even happens
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rowsToDisplay = (fuse as any)._docs;
        foundIndices = searchResult.map((result) => result.refIndex);
      }
    }

    return [rowsToDisplay, foundIndices];
  }

  /**
   * Performs a search operation
   */
  private doRegexSearch(
    list: Array<LogEntry>,
    searchOptions: SortFilterListOptions,
  ): [Array<LogEntry>, Array<number>] {
    if (searchOptions.search?.length === 0) {
      return [list, []];
    }

    const searchRegex = getRegExpMaybeSafe(searchOptions.search);

    let rowsToDisplay = list;
    let foundIndices: Array<number> = [];

    if (searchOptions.showOnlySearchResults) {
      rowsToDisplay = list.filter(
        (entry) => !searchOptions.search || searchRegex.test(entry.message),
      );
      foundIndices = Array.from(rowsToDisplay.keys());
    } else {
      list.forEach((entry, index) => {
        if (!searchOptions || searchRegex.test(entry.message)) {
          foundIndices.push(index);
        }
      });
    }

    return [rowsToDisplay, foundIndices];
  }

  private doRangeFilter(
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

  /**
   * Sorts the list and filters it by log level and search query
   */
  private sortAndFilterList(
    options: SortFilterListOptions = {},
  ): Array<LogEntry> {
    const logFile = options.logFile || this.props.logFile;
    const filter = options.filter || this.props.levelFilter;
    const search =
      options.search !== undefined ? options.search : this.props.search;
    const sortBy = options.sortBy || this.state.sortBy;
    const dateRange = options.dateRange || this.props.dateRange;
    const sortDirection = options.sortDirection || this.state.sortDirection;
    const showOnlySearchResults = options.showOnlySearchResults;

    const derivedOptions: SortFilterListOptions = {
      logFile,
      filter,
      search,
      sortBy,
      dateRange,
      sortDirection,
      showOnlySearchResults,
    };

    d(`Starting filter`);
    if (!logFile) return [];

    const shouldFilter = this.shouldFilter(filter);
    const noSort =
      (!sortBy || sortBy === 'index') &&
      (!sortDirection || sortDirection === SORT_DIRECTION.ASC);

    // Check if we can bail early and just use the naked logEntries array
    if (noSort && !shouldFilter && !search) return logFile.logEntries;

    let sortedList = logFile.logEntries.concat();

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
    if (shouldFilter) {
      sortedList = sortedList.filter(doFilter);
    }

    // DateRange
    if (dateRange) {
      d(
        `Performing date range filter (from: ${dateRange.from}, to: ${dateRange.to})`,
      );
      sortedList = this.doRangeFilter(dateRange, sortedList);
    }

    // Sort
    d(`Sorting by ${sortBy}`);
    if (sortBy === 'message') {
      sortedList = sortedList.sort(doSortByMessage);
    } else if (sortBy === 'level') {
      sortedList = sortedList.sort(doSortByLevel);
    } else if (sortBy === 'line') {
      sortedList = sortedList.sort(doSortByLine);
    } else if (sortBy === 'momentValue') {
      sortedList = sortedList.sort(doSortByTimestamp);
    }

    if (sortDirection === SORT_DIRECTION.DESC) {
      d('Reversing');
      sortedList.reverse();
    }

    // Search
    if (typeof search === 'string') {
      const [rowsToDisplay, searchList] =
        this.props.state.searchMethod === 'fuzzy'
          ? this.doFuzzySearch(sortedList, derivedOptions)
          : this.doRegexSearch(sortedList, derivedOptions);

      sortedList = rowsToDisplay;
      this.props.state.searchList = searchList;
    }

    return sortedList;
  }

  /**
   * Renders the "message" cell
   *
   * @param {any} { cellData, columnData, dataKey, rowData, rowIndex }
   * @returns {(JSX.Element | string)}
   */
  private renderMessageCell({
    rowData: entry,
  }: TableCellProps): JSX.Element | string {
    const message = entry.highlightMessage ?? entry.message;

    if (entry && entry.meta) {
      const icon = isReduxAction(entry.message) ? (
        <Icon icon="diagram-tree" />
      ) : (
        <Icon icon="paperclip" />
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
  }

  /**
   * Renders a cell, prefixing the log entries type.
   *
   * @param {any} { cellData, columnData, dataKey, rowData, rowIndex }
   * @returns {JSX.Element}
   */
  private renderTimestampCell({
    rowData: entry,
  }: TableCellProps): JSX.Element | string {
    const { dateTimeFormat } = this.props;
    const timestamp = entry.momentValue
      ? format(entry.momentValue, dateTimeFormat)
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
  }

  /**
   * Get the row data for the table
   *
   * @param {{ index: number }} { index }
   * @returns
   * @memberof LogTable
   */
  private rowGetter({ index }: { index: number }): LogEntry {
    return this.state.sortedList[index];
  }

  /**
   * Renders the table
   */
  private renderTable(options: Size): JSX.Element {
    const { sortedList, selectedIndex, ignoreSearchIndex, scrollToSelection } =
      this.state;
    const { searchIndex, searchList } = this.props;

    const tableOptions: TableProps = {
      ...options,
      rowHeight: 30,
      rowGetter: this.rowGetter,
      rowCount: sortedList.length,
      onRowClick: this.onRowClick,
      rowClassName: this.rowClassNameGetter,
      headerHeight: 30,
      sort: this.onSortChange,
      sortBy: this.state.sortBy,
      sortDirection: this.state.sortDirection,
    };

    if (scrollToSelection) tableOptions.scrollToIndex = selectedIndex;
    if (!ignoreSearchIndex && searchList.length > 0)
      tableOptions.scrollToIndex = searchList[searchIndex] || 0;

    return (
      <Table {...tableOptions}>
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
          cellRenderer={this.renderTimestampCell}
          dataKey="momentValue"
          width={200}
          flexGrow={2}
        />
        <Column label="Level" dataKey="level" width={100} />
        <Column
          label="Message"
          dataKey="message"
          cellRenderer={this.renderMessageCell}
          width={options.width - 300}
          flexGrow={2}
        />
      </Table>
    );
  }

  /**
   * Used by the table to get the className for a given row.
   * Called for each row.
   * @private
   */
  private rowClassNameGetter(input: { index: number }): string {
    const { index } = input;
    const { searchList } = this.props;
    const { selectedIndex, selectedRangeIndex, ignoreSearchIndex } = this.state;
    const isSearchIndex =
      !ignoreSearchIndex &&
      searchList.length > 0 &&
      index === searchList[this.props.searchIndex];
    const isRangeActive =
      selectedIndex !== undefined &&
      selectedRangeIndex !== undefined &&
      between(index, selectedIndex, selectedRangeIndex);

    const classes: string[] = [];

    if (isSearchIndex || selectedIndex === index || isRangeActive) {
      classes.push('ActiveRow');
    }

    if (Array.isArray(searchList) && searchList.includes(index)) {
      classes.push('HighlightRow');
    }

    const row = this.rowGetter(input);
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
  }
}
