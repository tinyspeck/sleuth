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
  dateTimeFormat: string;
  state: SleuthState;
  showOnlySearchResults: boolean | undefined;
  searchIndex: number;
  dateRange?: DateRange;
  selectedEntry?: LogEntry;
  resultFunction: (results: number) => void;
}

export interface LogTableState {
  sortedList: Array<LogEntry>;
  searchList: Array<number>;
  selectedEntry?: LogEntry;
  selectedIndex?: number;
  // If not undefined, the user selected a range
  selectedRangeIndex?: number;
  sortBy?: string;
  sortDirection?: SORT_DIRECTION;
  ignoreSearchIndex?: boolean;
  scrollToSelection?: boolean;
  columnWidths?: LogTableColumnWidths;
  columnOrder?: Array<string>;
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
