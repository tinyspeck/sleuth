import {
  isProcessedLogFile,
  isUnzippedFile,
  isMergedLogFile,
} from './is-logfile';
import { SelectableLogFile } from '../interfaces';

export function getFileName(file: SelectableLogFile): string {
  if (isProcessedLogFile(file)) {
    return file.logFile.fileName;
  } else if (isMergedLogFile(file)) {
    return file.logType;
  } else if (isUnzippedFile(file)) {
    return file.fileName;
  } else {
    return '';
  }
}
