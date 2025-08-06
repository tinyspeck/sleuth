import React from 'react';
import { observer } from 'mobx-react';
import { Card, Icon, Spinner } from '@blueprintjs/core';
import { SleuthState } from '../state/sleuth';
import { UnzippedFile } from '../../interfaces';
import autoBind from 'react-autobind';
import debug from 'debug';
import { TraceProcessor } from '../processor/trace';
import {
  PERFETTO_UI_URL,
  ensurePerfettoFormat,
  openTraceInPerfetto,
} from '../services/perfetto-service';

const d = debug('sleuth:perfettoview');

export interface PerfettoViewProps {
  state: SleuthState;
  file: UnzippedFile;
}

export interface PerfettoViewState {
  loading: boolean;
  error: string | null;
  traceData: string | null;
}

@observer
export class PerfettoView extends React.Component<
  PerfettoViewProps,
  PerfettoViewState
> {
  private processor: TraceProcessor;
  private iframeRef: React.RefObject<HTMLIFrameElement>;

  constructor(props: PerfettoViewProps) {
    super(props);
    this.processor = new TraceProcessor(this.props.file);
    this.iframeRef = React.createRef();

    autoBind(this);
    this.state = {
      loading: true,
      error: null,
      traceData: null,
    };
  }

  componentDidMount() {
    this.loadTraceData();
  }

  async loadTraceData() {
    try {
      // First try to get the raw file content
      const rawContent = await window.Sleuth.readAnyFile(this.props.file);

      // Convert the trace to Perfetto format if needed
      const perfettoTrace = ensurePerfettoFormat(rawContent);

      this.setState({
        loading: false,
        traceData: perfettoTrace,
      });

      // Once iframe loads, pass the trace data to Perfetto UI
      if (this.iframeRef.current) {
        this.iframeRef.current.addEventListener('load', this.onIframeLoad);
      }
    } catch (error) {
      d('Failed to load trace data', error);
      this.setState({
        loading: false,
        error: `Failed to load trace: ${error}`,
      });
    }
  }

  onIframeLoad = async () => {
    if (this.state.traceData && this.iframeRef.current) {
      try {
        await openTraceInPerfetto(this.iframeRef.current, this.state.traceData);
        d('Successfully loaded trace in Perfetto UI');
      } catch (error) {
        d('Failed to send trace to Perfetto UI', error);
        this.setState({
          error: `Failed to initialize Perfetto: ${error}`,
        });
      }
    }
  };

  renderLoading() {
    return (
      <Card className="PerfettoLoading">
        <h3>Loading trace data...</h3>
        <Spinner />
      </Card>
    );
  }

  renderError() {
    return (
      <Card className="PerfettoError">
        <h3>
          <Icon icon="error" /> Error Loading Trace
        </h3>
        <p>{this.state.error}</p>
      </Card>
    );
  }

  render() {
    if (this.state.loading) {
      return this.renderLoading();
    }

    if (this.state.error) {
      return this.renderError();
    }

    // Use proper parameters to ensure the UI loads correctly
    // ?embedding=true tells Perfetto this is an embedded instance
    const perfettoUrl = `${PERFETTO_UI_URL}?embedding=true`;

    return (
      <div className="PerfettoView">
        <iframe
          ref={this.iframeRef}
          title="Perfetto UI"
          src={perfettoUrl}
          frameBorder={0}
          style={{ width: '100%', height: '100%' }}
          sandbox="allow-scripts allow-same-origin allow-forms"
          allow="clipboard-write"
        />
      </div>
    );
  }
}
