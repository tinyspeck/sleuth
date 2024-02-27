import {
  LevelFilter,
  ProcessedLogFile,
  MergedLogFile,
  LogEntry,
  DateRange,
} from '../../interfaces';
import { SleuthState } from '../state/sleuth';

export enum SORT_DIRECTION {
  ASC = 'ASC',
  DESC = 'DESC',
}

export interface LogTableColumnWidths {
  index: number;
  line: number;
  timestamp: number;
  level: number;
  message: number;
}

export interface LogTableProps {
  logFile: ProcessedLogFile | MergedLogFile;
  levelFilter: LevelFilter;
  search?: string;
  searchIndex: number;
  searchList: Array<number>;
  dateTimeFormat: string;
  state: SleuthState;
  showOnlySearchResults: boolean | undefined;
  dateRange?: DateRange;
  selectedEntry?: LogEntry;
}

export interface LogTableState {
  sortedList: Array<LogEntry>;
  /**
   * If not undefined, the user selected a range of log lines.
   */
  selectedRangeIndex?: number;
  sortBy?: string;
  sortDirection?: SORT_DIRECTION;
  ignoreSearchIndex?: boolean;
  scrollToSelection?: boolean;
}

export interface SortFilterListOptions {
  sortBy?: string;
  sortDirection?: string;
  filter?: LevelFilter;
  search?: string;
  logFile?: ProcessedLogFile | MergedLogFile;
  showOnlySearchResults?: boolean;
  dateRange?: DateRange;
}
