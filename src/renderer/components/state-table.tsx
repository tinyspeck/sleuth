import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import { SelectableLogFile, UnzippedFile } from '../../interfaces';
import { SleuthState } from '../state/sleuth';
import { JSONView } from './json-view';
import { getFontForCSS } from './preferences/preferences-utils';
import { Card } from 'antd';

export interface StateTableProps {
  state: SleuthState;
}

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export interface StateTableState {
  data?: any;
  path?: string;
  raw?: string;
}

function isStateFile(file?: SelectableLogFile): file is UnzippedFile {
  const _file = file as UnzippedFile;
  return !!_file.fullPath;
}

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export const StateTable = observer(({ state }: StateTableProps) => {
  const { selectedFile, stateFiles } = state;
  const fileState = useMemo(() => {
    if (isStateFile(selectedFile)) {
      return stateFiles[selectedFile.fileName] ?? {};
    }
    return {};
  }, [selectedFile, stateFiles]);

  const { data, path, raw } = fileState;
  const { font } = state;

  const onIFrameLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const iframe = e.currentTarget;
    if (iframe?.contentWindow) {
      const { document: idoc } = iframe.contentWindow;
      iframe.height = `${idoc.body.scrollHeight}px`;
    }
  };

  const content =
    !data && path ? (
      <iframe sandbox="" onLoad={onIFrameLoad} src={`logfile://${path}`} />
    ) : (
      <JSONView data={data} raw={raw} state={state} />
    );

  return (
    <div
      className="StateTable"
      style={{
        fontFamily: getFontForCSS(font),
      }}
    >
      <div className="StateTable-Content">
        <Card>{content}</Card>
      </div>
    </div>
  );
});
