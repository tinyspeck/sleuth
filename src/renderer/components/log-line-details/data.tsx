import React, { ReactElement } from 'react';
import { JSONView } from '../json-view';
import debug from 'debug';
import { SleuthState } from '../../state/sleuth';
import { LogEntry, LogMetaType, LogType } from '../../../interfaces';
import { Button } from 'antd';

const d = debug('sleuth:data');

export interface LogLineDataProps {
  meta: LogMetaType<any>;
  state: SleuthState;
}

export class LogLineData extends React.PureComponent<LogLineDataProps, object> {
  constructor(props: LogLineDataProps) {
    super(props);
  }

  /**
   * Renders pretty JSON
   */
  public renderJSON(raw: string): JSX.Element {
    return (
      <div className="LogLineData">
        <JSONView raw={raw} state={this.props.state} />
      </div>
    );
  }

  /**
   * Renders a ASCII table as a pretty table
   */
  public renderTable(raw: string): JSX.Element {
    const headerRgx = /^(\+|\|)-[+-]*-\+\s*$/;
    const contentRgx = /^\|.*\|$/;
    let data: ReactElement;

    try {
      const splitRaw = raw.split(/\r?\n/).filter((l) => {
        return l && l !== '' && !headerRgx.test(l);
      });

      // Ensure at least 3 lines
      if (!splitRaw || splitRaw.length < 3) {
        throw new Error(
          'Split lines, but less than 3 - no way this is a table',
        );
      }

      // Ensure beginning and end are as expected
      if (
        !contentRgx.test(splitRaw[0]) ||
        !contentRgx.test(splitRaw[splitRaw.length - 1])
      ) {
        throw new Error('Split lines, but beginning and end not recognized');
      }

      // Let's make a table
      const tableRows = splitRaw.map((line, i) => {
        const columns = line.split('|').map((v) => (v || '').trim());
        const elements = columns.map((c) =>
          i === 0 ? <th key={c}>{c}</th> : <td key={c}>{c}</td>,
        );
        return <tr key={`${i}-${line}`}>{elements}</tr>;
      });

      return <table className="ConvertedTable">{tableRows}</table>;
    } catch (e) {
      d(`Tried to render table, but failed`, e);
      data = <code>{raw}</code>;
    }

    return <div className="LogLineData">{data}</div>;
  }

  public renderChromiumFile(selectedEntry: LogEntry<LogType.CHROMIUM>) {
    if (!selectedEntry?.meta || typeof selectedEntry.meta === 'string') return;
    const str = `https://source.chromium.org/search?q=LOG%20filepath:${selectedEntry.meta.sourceFile}&ss=chromium`;

    return (
      <div className="LogLineData">
        <Button href={str} icon="search">
          Search the log in the Chromium source
        </Button>
      </div>
    );
  }

  /**
   * Takes metadata (probably dirty JSON) and attempts to pretty-print it.
   */
  public render(): JSX.Element | null {
    const { meta } = this.props;
    const { selectedEntry } = this.props.state;

    if (!meta || !meta.data || !selectedEntry) {
      return null;
    }

    const isLogType =
      <T extends LogType>(logType: T) =>
      (entry: LogEntry<LogType>): entry is LogEntry<T> =>
        entry.logType === logType;

    if (isLogType(LogType.CHROMIUM)(selectedEntry)) {
      return this.renderChromiumFile(selectedEntry) ?? null;
    } else if (typeof meta.data === 'string') {
      if (
        meta &&
        meta.data.startsWith(`+----`) &&
        meta.data.endsWith('----+\n')
      ) {
        return this.renderTable(meta.data);
      } else {
        return this.renderJSON(meta.data);
      }
    }

    return null;
  }
}
