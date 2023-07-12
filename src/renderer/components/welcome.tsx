import React from 'react';
import path from 'path';

import { ControlGroup, Button, InputGroup, Tooltip} from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { getSleuth } from '../sleuth';
import { deleteSuggestion, deleteSuggestions} from '../suggestions';
import { SleuthState } from '../state/sleuth';
import { isBefore } from 'date-fns';

import fs from 'fs-extra';
import { getPath } from '../ipc';

export interface WelcomeState {
  sleuth: string;
}

export interface WelcomeProps {
  sleuth?: string;
  state: SleuthState;
}

@observer
export class Welcome extends React.Component<WelcomeProps, Partial<WelcomeState>> {
  constructor(props: WelcomeProps) {
    super(props);

    this.state = {
      sleuth: props.sleuth || getSleuth()
    };
  }

  public async deleteSuggestion(filePath: string) {
    await deleteSuggestion(filePath);
    await this.props.state.getSuggestions();
  }

  public async deleteSuggestions(filePaths: Array<string>) {
    await deleteSuggestions(filePaths);
    await this.props.state.getSuggestions();
  }

  public async watchSuggestions(close: boolean) {
    try {
      const downloadsDir = await getPath('downloads');
      const watcher = fs.watch(downloadsDir, async () => {
        console.log("still watching")
        await this.props.state.getSuggestions()
      } )
      if(close == true){
        setTimeout(() => watcher.close(), 1000)
      }
    }catch(error){
      console.log(`this is the error: ${error}`)
    }
  }

  public renderSuggestions(): JSX.Element | null {
    const { openFile } = this.props.state;
    const suggestions = this.props.state.suggestions || [];
    const elements = suggestions
      .map((file) => {
        const stats = file;
        const basename = path.basename(file.filePath);
        const deleteElement = (
          <Button
            icon='trash'
            minimal={true}
            onClick={() => this.deleteSuggestion(file.filePath)}
          />
        );
    const leave = async () => {
      await this.watchSuggestions(true)
      openFile(file.filePath)
    }

        return (
          <li key={basename}>
            <ControlGroup className='Suggestion' fill={true}>
              <Tooltip content={basename.length > 38 ? basename : ''} hoverOpenDelay={800}>
                <Button
                  className='OpenButton'
                  alignText='left'
                  onClick={() => leave()}
                  icon='document'
                >
                  {basename}
                </Button>
              </Tooltip>
              <InputGroup
                leftIcon='time'
                defaultValue={`${stats.age} old`}
                readOnly={true}
                rightElement={deleteElement}
              />
            </ControlGroup>
          </li>
        );
      });

    if (elements.length > 0) {
      return (
        <div className='Suggestions'>
          <ul className='bp3-list-unstyled'>{elements}</ul>
          {this.renderDeleteAll()}
        </div>
      );
    }

    return <div />;
  }

  public renderDeleteAll(): JSX.Element | null {
    const suggestions = this.props.state.suggestions || [];

    // Do we have any files older than 48 hours?
    const twoDaysAgo = Date.now() - 172800000;
    const toDeleteAll: Array<string> = [];

    suggestions.forEach((item) => {
      if (isBefore(item.mtimeMs, twoDaysAgo)) {
        toDeleteAll.push(item.filePath);
      }
    });

    if (toDeleteAll.length > 0) {
      return (
        <Button
          icon='trash'
          onClick={() => this.deleteSuggestions(toDeleteAll)}
        >
          Delete files older than 2 days
        </Button>
      );
    }

    return null;
  }

  public render() {
    const { sleuth } = this.state;
    const scrollStyle: React.CSSProperties = {
      marginTop: '50px',
      marginBottom: '50px',
      overflowY: 'auto'
    };
    
    this.watchSuggestions(false)

    return (
      <div className='Welcome'>
        <div>
          <h1 className='Title'>
            <span className='Emoji'>{sleuth}</span>
            <span>Sleuth</span>
          </h1>
          <h4>Drop a logs zip file or folder anywhere on this window to open it.</h4>
        </div>

        <div style={scrollStyle}>
          <h5>From your Downloads folder, may we suggest:</h5>
          <div >
            {this.renderSuggestions()}
          </div>
        </div>
      </div>
    );
  }
}
