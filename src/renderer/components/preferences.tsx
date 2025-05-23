import { Select } from '@blueprintjs/select';
import { observer } from 'mobx-react';
import {
  Overlay,
  Classes,
  FormGroup,
  Button,
  MenuItem,
  Callout,
  ControlGroup,
  InputGroup,
  RadioGroup,
  Radio,
  Checkbox,
  Divider,
} from '@blueprintjs/core';
import { SleuthState } from '../state/sleuth';
import classNames from 'classnames';
import React from 'react';
import autoBind from 'react-autobind';
import { format as dateFormatter } from 'date-fns';

import { getSleuth } from '../sleuth';
import { renderFontItem, filterFont, FONTS } from './preferences-font';
import {
  filterDateTime,
  renderDateTimeItem,
  DATE_TIME_FORMATS,
} from './preferences-datetime';
import { renderEditorItem, Editor, EDITORS } from './preferences-editor';
import { SORT_DIRECTION } from './log-table-constants';

const FontSelect = Select.ofType<string>();
const DateTimeSelect = Select.ofType<string>();
const EditorSelect = Select.ofType<Editor>();

export enum ColorTheme {
  Light = 'light',
  Dark = 'dark',
  System = 'system',
}

export interface PreferencesState {
  isOpen: boolean;
}

export interface PreferencesProps {
  state: SleuthState;
}

@observer
export class Preferences extends React.Component<
  PreferencesProps,
  Partial<PreferencesState>
> {
  constructor(props: PreferencesProps) {
    super(props);

    this.state = {};
    autoBind(this);

    window.Sleuth.setupPreferencesShow(() => this.setState({ isOpen: true }));
  }

  public render(): JSX.Element {
    const { dateTimeFormat_v3, defaultEditor, font } = this.props.state;

    const classes = classNames(
      Classes.CARD,
      Classes.ELEVATION_4,
      'Preferences',
    );

    return (
      <Overlay
        isOpen={this.state.isOpen}
        onClose={this.onClose}
        hasBackdrop={true}
      >
        <div className={classes}>
          <h2>Preferences</h2>
          <Callout>
            You&apos;re running Sleuth {window.Sleuth.sleuthVersion}{' '}
            {getSleuth()} with Electron {window.Sleuth.versions.electron} and
            Chrome {window.Sleuth.versions.chrome}.
          </Callout>
          <Divider style={{ marginTop: '15px' }} />
          <FormGroup
            inline={true}
            label="Font"
            helperText="Choose a custom font to override how Sleuth renders various text elements"
          >
            <FontSelect
              itemRenderer={renderFontItem}
              itemPredicate={filterFont}
              items={FONTS}
              noResults={<MenuItem disabled={true} text="No results." />}
              onItemSelect={this.onFontSelect}
              popoverProps={{ minimal: true }}
            >
              <Button text={font} rightIcon="font" />
            </FontSelect>
          </FormGroup>
          <Divider />
          <FormGroup
            inline={true}
            label="Color mode"
            helperText="Choose if Sleuth should be in light or dark mode"
          >
            <RadioGroup
              onChange={(event) => {
                this.props.state.colorTheme = event.currentTarget
                  .value as unknown as ColorTheme;
              }}
              selectedValue={this.props.state.colorTheme}
              inline={true}
            >
              <Radio label="🌕 Light" value={ColorTheme.Light} />
              <Radio label="🌑 Dark" value={ColorTheme.Dark} />
              <Radio label="🌗 System" value={ColorTheme.System} />
            </RadioGroup>
          </FormGroup>
          <Divider />
          <FormGroup
            inline={true}
            label="Date time format"
            helperText="Choose a custom format for dates to override how timestamps will be displayed"
          >
            <DateTimeSelect
              itemRenderer={renderDateTimeItem}
              itemPredicate={filterDateTime}
              items={DATE_TIME_FORMATS}
              noResults={<MenuItem disabled={true} text="No results." />}
              onItemSelect={this.onDateTimeSelect}
              popoverProps={{ minimal: true }}
            >
              <Button
                text={dateFormatter(1647029957123, dateTimeFormat_v3)}
                rightIcon="calendar"
              />
            </DateTimeSelect>
          </FormGroup>
          <Divider />
          <FormGroup
            inline={true}
            label="Sort direction"
            helperText="Sort logs by oldest (ascending) or newest (descending)"
          >
            <RadioGroup
              onChange={(event) =>
                (this.props.state.defaultSort = event.currentTarget
                  .value as SORT_DIRECTION)
              }
              selectedValue={
                this.props.state.defaultSort || SORT_DIRECTION.DESC
              }
              inline={true}
            >
              <Radio label="Ascending" value={SORT_DIRECTION.ASC} />
              <Radio label="Descending" value={SORT_DIRECTION.DESC} />
            </RadioGroup>
          </FormGroup>
          <Divider />
          <FormGroup
            inline={true}
            label="Always open most recent file"
            helperText="Skip home screen and always open most recent file automatically"
          >
            <Checkbox
              checked={this.props.state.isOpenMostRecent}
              label="Enabled"
              onChange={(event) =>
                (this.props.state.isOpenMostRecent =
                  event.currentTarget.checked)
              }
            />
          </FormGroup>
          <Divider />
          <FormGroup
            inline={true}
            label='Enable "smart copy"'
            helperText="Copy whole log lines. Disable this if you're having trouble with copy & paste in Sleuth"
          >
            <Checkbox
              checked={this.props.state.isSmartCopy}
              label="Enabled"
              onChange={(event) =>
                (this.props.state.isSmartCopy = event.currentTarget.checked)
              }
            />
          </FormGroup>
          <Divider />
          <FormGroup
            inline={true}
            label="Editor"
            helperText="Sleuth can open log source files in your favorite editor"
          >
            <ControlGroup>
              <EditorSelect
                filterable={false}
                items={EDITORS}
                itemRenderer={renderEditorItem}
                noResults={<MenuItem disabled={true} text="No results." />}
                onItemSelect={this.onEditorSelect}
                popoverProps={{ minimal: true }}
              >
                <Button text={defaultEditor.name} rightIcon="code" />
              </EditorSelect>
            </ControlGroup>
          </FormGroup>
          <Divider />
          <FormGroup
            inline={true}
            label="Use the Mark Christian™️ icon"
            helperText="Mark did some art and made a special Sleuth icon. Requires a restart"
          >
            <Checkbox
              checked={this.props.state.isMarkIcon}
              label="Enabled"
              onChange={(event) =>
                (this.props.state.isMarkIcon = event.currentTarget.checked)
              }
            />
          </FormGroup>
        </div>
      </Overlay>
    );
  }

  private onClose() {
    this.setState({ isOpen: false });
  }

  private onEditorSelect(editor: Editor) {
    this.props.state.defaultEditor = editor;
  }

  private onFontSelect(font: string) {
    this.props.state.font = font;
  }

  private onDateTimeSelect(format: string) {
    this.props.state.dateTimeFormat_v3 = format;
  }
}
