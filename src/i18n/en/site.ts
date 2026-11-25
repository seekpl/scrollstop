import type { Messages } from '..';
import { BRAND } from '../../config/brand';

export const site: Messages['site'] = {
  meta: {
    title: `${BRAND.name} — at which second do viewers stop watching?`,
  },
  nav: {
    home: 'Home',
    pricing: 'Pricing',
    privacy: 'Privacy',
    sample: 'Sample report',
    login: 'Sign in',
    studio: 'Studio',
    startFree: 'Try it free',
    menu: 'Menu',
    mainNav: 'Main navigation',
  },
  hero: {
    title: 'At which second do viewers stop watching your reel?',
    lead: 'Test your hook, edit and captions on real viewers before you post. Viewers watch on their own phone, and you get a second-by-second attention curve, a gaze map and specific fixes. The camera image never leaves the viewer’s device.',
    ctaPrimary: 'Test your reel for free',
    ctaSample: 'See a sample report',
    freeNote: 'Free: 1 project and 5 viewers. No card needed.',
  },
  building: {
    badge: 'Under construction',
    title: 'We’re building the first version',
    body: 'We’re building a tool for testing viewer attention before you post: an attention curve, a hook score, a feed test and gaze maps. This page changes with every stage of the work.',
    points: [
      'Viewers watch in the browser, with nothing to install.',
      'The camera only estimates where the viewer looks. The image never leaves the device.',
      'We test the content, not people. Adult viewers only, with their consent.',
    ],
    contact: 'Want to try it early? Write to us',
  },
  footer: {
    operator: (name: string, address: string, nip: string) => `Operated by ${name}, ${address}, VAT ID ${nip}.`,
    contact: 'Contact',
    rights: (year: number) => `© ${year} ${BRAND.name}`,
    note: 'Webcam-based gaze estimation. The camera image never leaves the viewer’s device.',
  },
  notFound: {
    title: 'This page doesn’t exist',
    body: 'The address may have changed or contain a typo.',
    home: 'Back to the home page',
  },
  soonPage: {
    title: 'This part is still being built',
    body: 'This view will appear in one of the next stages of work.',
  },
};
