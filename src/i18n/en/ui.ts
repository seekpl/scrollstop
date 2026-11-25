import type { Messages } from '..';

export const ui: Messages['ui'] = {
  close: 'Close',
  languageLabel: 'Site language',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  skipToContent: 'Skip to content',
  loading: 'Loading…',
  copyDone: 'Copied to clipboard',
  copyFailed: 'Couldn’t copy. Select the text and copy it manually.',
  stepOf: (i: number, n: number) => `Step ${i} of ${n}`,
  errorBoundary: {
    title: 'This page didn’t load',
    body: 'Refresh the page. If the message comes back, send the error description below to the person who deployed the app.',
  },
};
