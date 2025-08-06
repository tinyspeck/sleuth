import React from 'react';
import { observer } from 'mobx-react';
import { Card, AnchorButton } from '@blueprintjs/core';
import { SleuthState } from '../state/sleuth';
import debug from 'debug';
import { PERFETTO_UI_URL } from '../services/perfetto-service';

const d = debug('sleuth:trace-generator');

export interface TraceGeneratorProps {
  state: SleuthState;
}

export interface TraceGeneratorState {
  duration: number;
  fileName: string;
  isRecording: boolean;
}

/**
 * Component for generating Perfetto traces
 */
@observer
export class TraceGenerator extends React.Component<
  TraceGeneratorProps,
  TraceGeneratorState
> {
  constructor(props: TraceGeneratorProps) {
    super(props);

    this.state = {
      duration: 10,
      fileName: 'sleuth-trace',
      isRecording: false,
    };

    this.handleDurationChange = this.handleDurationChange.bind(this);
    this.handleFileNameChange = this.handleFileNameChange.bind(this);
    this.startRecording = this.startRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
  }

  handleDurationChange(event: React.FormEvent<HTMLSelectElement>) {
    const duration = parseInt(event.currentTarget.value, 10);
    this.setState({ duration });
  }

  handleFileNameChange(event: React.FormEvent<HTMLInputElement>) {
    this.setState({ fileName: event.currentTarget.value });
  }

  async startRecording() {
    try {
      this.setState({ isRecording: true });

      // In a real implementation, this would use Perfetto's recording API
      d(`Starting trace recording for ${this.state.duration} seconds`);

      // For demo purposes, we'll just wait for the duration
      setTimeout(() => {
        this.stopRecording();
      }, this.state.duration * 1000);
    } catch (error) {
      d(`Failed to start recording: ${error}`);
      this.setState({ isRecording: false });
    }
  }

  async stopRecording() {
    try {
      d('Stopping trace recording');

      // In a real implementation, this would use Perfetto's API to get the trace data
      // and then save it to a file
      const fileName = `${this.state.fileName}.perfetto-trace`;

      // In a real implementation, we would save the trace data here
      // const traceData = await window.Sleuth.saveTraceFile(fileName, traceBuffer);

      this.setState({ isRecording: false });
      d(`Trace saved as ${fileName}`);
    } catch (error) {
      d(`Failed to stop recording: ${error}`);
      this.setState({ isRecording: false });
    }
  }

  render() {
    return (
      <Card className="TraceGenerator">
        <h3>Perfetto Performance Tracing</h3>
        <p>Record and analyze performance traces with Perfetto.</p>

        <div className="tracing-options">
          <AnchorButton
            icon="graph"
            text="Open Perfetto UI"
            target="_blank"
            href={PERFETTO_UI_URL}
            intent="primary"
            className="option-button"
          />

          <AnchorButton
            icon="desktop"
            text="Record System Trace"
            target="_blank"
            href={`${PERFETTO_UI_URL}#!/record`}
            intent="success"
            className="option-button"
          />

          <AnchorButton
            icon="code"
            text="Integrate Tracing in Your App"
            target="_blank"
            href="https://perfetto.dev/docs/instrumentation/track-events"
            intent="warning"
            className="option-button"
          />
        </div>

        <h4>Electron App Tracing</h4>
        <p className="info-text">
          To trace your Electron app, you&apos;ll need to use the perftrace
          library:
        </p>
        <pre className="code-example">
          {`const { TraceEvents } = require("perftrace");
const traceEvents = new TraceEvents();

// Track require() calls
const { trackRequires } = require("perftrace");
trackRequires(true);

// Add custom trace points
performance.mark("operation-start");
// ... your code ...
performance.measure("operation", "operation-start");

// Save the trace on exit
process.on("beforeExit", () => {
  const events = traceEvents.getEvents();
  traceEvents.destroy();
  writeFileSync("trace.json", JSON.stringify(events));
});`}
        </pre>
      </Card>
    );
  }
}
