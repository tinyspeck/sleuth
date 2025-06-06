import { ProcessedLogFiles, SelectableLogFile } from '../interfaces';

export function getFirstLogFile(
  files: ProcessedLogFiles | undefined,
): SelectableLogFile {
  if (files) {
    if (files.browser && files.browser.length > 0) return files.browser[0];
    if (files.webapp && files.webapp.length > 0) return files.webapp[0];
    if (files.netlog && files.netlog.length > 0) return files.netlog[0];
    if (files.trace && files.trace.length > 0) return files.netlog[0];
    if (files.installer && files.installer.length > 0)
      return files.installer[0];
    if (files.state && files.state.length > 0) return files.state[0];
    if (files.mobile && files.mobile.length > 0) return files.mobile[0];
  }

  throw new Error('No log files found');
}
