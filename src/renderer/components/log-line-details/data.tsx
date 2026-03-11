import React, { ReactElement } from 'react';
import { JSONView } from '../json-view';
import debug from 'debug';
import { SleuthState } from '../../state/sleuth';
import { LogEntry } from '../../../interfaces';
import { Button } from 'antd';

const d = debug('sleuth:data');

export interface LogLineDataProps {
  meta: string | LogEntry;
  state: SleuthState;
}

function renderJSON(raw: string, state: SleuthState): JSX.Element {
  return (
    <div className="LogLineData">
      <JSONView raw={raw} state={state} />
    </div>
  );
}

function renderTable(raw: string): JSX.Element {
  const headerRgx = /^(\+|\|)-[+-]*-\+\s*$/;
  const contentRgx = /^\|.*\|$/;
  let data: ReactElement;

  try {
    const splitRaw = raw.split(/\r?\n/).filter((l) => {
      return l && l !== '' && !headerRgx.test(l);
    });

    // Ensure at least 3 lines
    if (!splitRaw || splitRaw.length < 3) {
      throw new Error('Split lines, but less than 3 - no way this is a table');
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

function renderChromiumFile(selectedEntry: LogEntry): JSX.Element | undefined {
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

export const LogLineData = React.memo((props: LogLineDataProps) => {
  const { meta } = props;
  const { selectedEntry } = props.state;

  if (!meta) {
    return null;
  }

  // string
  if (typeof meta === 'string') {
    if (meta && meta.startsWith(`+----`) && meta.endsWith('----+\n')) {
      return renderTable(meta);
    } else {
      return renderJSON(meta, props.state);
    }
  }

  // object
  if (meta.sourceFile && selectedEntry) {
    return renderChromiumFile(selectedEntry) ?? null;
  }

  return null;
});

LogLineData.displayName = 'LogLineData';
