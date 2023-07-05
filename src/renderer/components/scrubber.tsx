import React from 'react';

export interface ScrubberProps {
  onResizeHandler: (newHeight: number) => void;
  elementSelector: string;
}

export interface ScrubberState {
  startY: number;
  startHeight: number;
}

export class Scrubber extends React.Component<ScrubberProps, ScrubberState> {
  constructor(props: ScrubberProps) {
    super(props);

    this.mouseDownHandler = this.mouseDownHandler.bind(this);
    this.mouseMoveHandler = this.mouseMoveHandler.bind(this);
    this.mouseUpHandler = this.mouseUpHandler.bind(this);
  }

  public mouseMoveHandler(e: MouseEvent) {
    const { startHeight, startY } = this.state;
    const newHeight = startHeight + e.clientY - startY;
    this.props.onResizeHandler(newHeight);
  }

  public mouseDownHandler(e: React.MouseEvent) {
    const resizeTarget = document.getElementById(this.props.elementSelector);

    if (!resizeTarget) return;

    this.setState({
      startY: e.clientY,
      startHeight: parseInt(window.getComputedStyle(resizeTarget).height, 10)
    });

    document.addEventListener('mousemove', this.mouseMoveHandler, false);
    document.addEventListener('mouseup', this.mouseUpHandler, false);
  }

  public mouseUpHandler() {
    document.removeEventListener('mousemove', this.mouseMoveHandler, false);
    document.removeEventListener('mouseup', this.mouseUpHandler, false);
  }

  public render() {
    return (
      <div className='Scrubber' onMouseDown={this.mouseDownHandler} />
    );
  }
}
