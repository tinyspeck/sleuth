import React, { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react';
import { toJS } from 'mobx';

import {
  Button,
  Card,
  Descriptions,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { SleuthState } from '../state/sleuth';
import { UnzippedFile } from '../../interfaces';
import { TraceProcessor } from '../processor/trace';
import debug from 'debug';
import { AreaChartOutlined } from '@ant-design/icons';

export interface DevtoolsViewProps {
  state: SleuthState;
  file: UnzippedFile;
}

const d = debug('sleuth:devtoolsview');

export const DevtoolsView = observer((props: DevtoolsViewProps) => {
  const [profilePid, setProfilePid] = useState<number | undefined>();
  const processorRef = useRef<TraceProcessor>(new TraceProcessor(props.file));

  const prepare = useCallback(async () => {
    if (!props.state.traceThreads) {
      d('Preparing trace threads...');
      props.state.traceThreads = await processorRef.current.getProcesses();
    }
  }, [props.state.traceThreads]);

  useEffect(() => {
    prepare();
  }, [prepare]);

  useEffect(() => {
    if (profilePid) {
      window.addEventListener(
        'message',
        async (event) => {
          d('Received message event in DevToolsView:', event);
          const iframe = document.querySelector('iframe');
          d('Fetching renderer profile for pid:', profilePid);
          const events = await processorRef.current.getRendererProfile(
            profilePid,
          );

          if (!iframe?.contentWindow || event.source !== iframe.contentWindow) {
            return;
          }
          if (event.data && event.data.type === 'REHYDRATING_IFRAME_READY') {
            // Respond with REHYDRATING_TRACE_FILE message
            iframe.contentWindow.postMessage(
              {
                type: 'REHYDRATING_TRACE_FILE',
                traceJson: JSON.stringify({
                  traceEvents: events,
                }),
              },
              '*',
            );
          }
        },
        { once: true },
      );
    }
  }, [profilePid]);

  const renderThreads = () => {
    const { traceThreads } = props.state;
    const hasThreads = !!traceThreads?.length;
    const isLoading = !traceThreads;

    const startTime = parseInt(
      props.file.fileName.split('.')[0]?.split('_')[4] || '0',
      10,
    );
    const endTime = parseInt(
      props.file.fileName.split('.')[0]?.split('_')[0] || '0',
      10,
    );
    const duration = endTime - startTime;

    return (
      <Card className="ProcessTable">
        <Space direction="vertical">
          <Typography.Title level={3}>Performance Profile</Typography.Title>
          <Descriptions
            items={[
              {
                key: '1',
                label: 'Duration',
                children: (
                  <span>
                    {duration
                      ? Math.floor(duration / 1000).toString()
                      : 'unknown'}{' '}
                    seconds
                  </span>
                ),
              },
              {
                key: '2',
                label: 'Trace started',
                children: (
                  <span>
                    {startTime
                      ? new Date(startTime).toLocaleString()
                      : 'unknown'}
                  </span>
                ),
              },
              {
                key: '3',
                label: 'Trace ended',
                children: (
                  <span>
                    {endTime ? new Date(endTime).toLocaleString() : 'unknown'}
                  </span>
                ),
              },
            ]}
          />
          {isLoading && <Skeleton />}
          {!hasThreads && !isLoading ? (
            <p>No trace threads found...</p>
          ) : (
            <Table
              pagination={false}
              dataSource={traceThreads?.map((value, index) => ({
                key: index,
                process: value.title || 'Unknown',
                type: <Tag>{value.type}</Tag>,
                pid: value.processId,
                open: (
                  <Button
                    onClick={() => {
                      d('Setting profile PID to:', value.processId);
                      setProfilePid(value.processId);
                    }}
                    icon={<AreaChartOutlined />}
                  >
                    Open
                  </Button>
                ),
              }))}
              columns={[
                { title: 'Process Name', dataIndex: 'process', key: 'process' },
                { title: 'Type', dataIndex: 'type', key: 'type' },
                { title: 'PID', dataIndex: 'pid', key: 'pid' },
                { title: 'Action', dataIndex: 'open', key: 'open' },
              ]}
            />
          )}
        </Space>
      </Card>
    );
  };

  if (profilePid) {
    return (
      <div className="Devtools">
        <iframe
          title="DevTools embed"
          src={
            'https://chrome-devtools-frontend.appspot.com/serve_file/@c545657f5084b79e2aa3ea4074ae232ce328ff2d/trace_app.html?panel=timeline'
          }
          frameBorder={0}
        />
      </div>
    );
  }

  return <div className="ProcessTableWrapper">{renderThreads()}</div>;
});
