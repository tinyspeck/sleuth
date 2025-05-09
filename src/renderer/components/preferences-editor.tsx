import { MenuItem } from '@blueprintjs/core';
import { ItemRenderer } from '@blueprintjs/select';
import React from 'react';

export interface Editor {
  name: string;
  cmd: string;
  args: string[];
}

export const EDITORS = [
  {
    name: 'Visual Studio Code',
    cmd: `code`,
    args: ['--goto', '{filepath}:{line}'],
  },
  {
    name: 'Sublime Text',
    cmd: `subl`,
    args: ['{filepath}:{line}'],
  },
  { name: 'Cursor', cmd: `cursor`, args: ['--goto', '{filepath}:{line}'] },
];

export const renderEditorItem: ItemRenderer<Editor> = (
  { name },
  { handleClick, modifiers },
) => {
  return (
    <MenuItem
      active={modifiers.active}
      disabled={modifiers.disabled}
      key={name}
      onClick={handleClick}
      text={name}
    />
  );
};
