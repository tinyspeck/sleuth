import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/app';

const root = createRoot(document.getElementById('SlackApp')!);
root.render(React.createElement(App));
