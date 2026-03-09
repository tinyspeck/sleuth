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

export interface SortFilterListOptions {
  sortBy?: string;
  sortDirection?: string;
  filter?: LevelFilter;
  search?: string;
  logFile?: ProcessedLogFile | MergedLogFile;
  showOnlySearchResults?: boolean;
  dateRange?: DateRange;
}
