import React from 'react';
import { JSONView } from '../json-view';
import { AnchorButton, Card, Elevation } from '@blueprintjs/core';
import { SleuthState } from '../../state/sleuth';
import { LogEntry } from '../../../interfaces';

const debug = require('debug')('sleuth:data');

export interface LogLineDataProps {
  meta: any;
  state: SleuthState;
}

export interface LogLineDataState { }

export class LogLineData extends React.PureComponent<LogLineDataProps, LogLineDataState> {
  constructor(props: LogLineDataProps) {
    super(props);
  }

  /**
   * Renders pretty JSON
   */
  public renderJSON(raw: string): JSX.Element {
    return (
      <div className='LogLineData'>
        <Card elevation={Elevation.TWO}>
          <JSONView raw={raw} state={this.props.state} />
        </Card>
      </div>
    );
  }

  /**
   * Renders a ASCII table as a pretty table
   */
  public renderTable(raw: string): JSX.Element {
    const headerRgx = /^(\+|\|)-[+-]*-\+\s*$/;
    const contentRgx = /^\|.*\|$/;
    let data = null;

    try {
      const splitRaw = raw.split(/\r?\n/).filter((l) => {
        return l && l !== '' && !headerRgx.test(l);
      });

      // Ensure at least 3 lines
      if (!splitRaw || splitRaw.length < 3) {
        throw new Error('Split lines, but less than 3 - no way this is a table');
      }

      // Ensure beginning and end are as expected
      if (!contentRgx.test(splitRaw[0]) || !contentRgx.test(splitRaw[splitRaw.length - 1])) {
        throw new Error('Split lines, but beginning and end not recognized');
      }

      // Let's make a table
      const tableRows = splitRaw.map((line, i) => {
        const columns = line.split('|').map((v) => (v || '').trim());
        const elements = columns.map((c) => i === 0 ? <th>{c}</th> : <td>{c}</td>);
        return (<tr key={`${i}-${line}`}>{elements}</tr>);
      });

      return (<table className='ConvertedTable'>{tableRows}</table>);
    } catch (e) {
      debug(`Tried to render table, but failed`, e);
      data = <code>{raw}</code>;
    }

    return (<div className='LogLineData'>{data}</div>);
  }

  public renderChromiumFile(selectedEntry: LogEntry) {
    const str = `https://source.chromium.org/search?q=LOG%20filepath:${selectedEntry.meta.sourceFile}&ss=chromium`;

    return <div className='LogLineData'>
      <AnchorButton href={str} icon='search'>Search the log in the Chromium source</AnchorButton>
    </div>;
  }

  /**
   * Takes metadata (probably dirty JSON) and attempts to pretty-print it.
   */
  public render(): JSX.Element | null {
    const { meta } = this.props;

    if (!meta) {
      return null;
    }

    // string
    if (typeof meta === 'string') {
      if (meta && meta.startsWith(`+----`) && meta.endsWith('----+\n')) {
        return this.renderTable(meta);
      } else {
        return this.renderJSON(meta);
      }
    }

    // object
    if (meta.sourceFile) {
      const { selectedEntry } = this.props.state;
      return this.renderChromiumFile(selectedEntry!);
    }

    return null;
  }
}
