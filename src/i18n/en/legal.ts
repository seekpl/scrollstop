import { BRAND } from '../../config/brand';
import type { Messages } from '..';

export const legal: Messages['legal'] = {
  draft: 'Draft for legal review.',
  updated: (date: string) => `Effective from ${date}.`,
  terms: {
    title: 'Terms of service',
    lead: `The rules for using ${BRAND.name}: who provides the service, what it covers, what it costs and how to report a problem.`,
    operator: (name: string, address: string, nip: string, email: string) => `${BRAND.name} is operated by ${name}, ${address}, Polish tax ID (NIP) ${nip} (the operator). Contact: ${email}.`,
    sections: [
      {
        id: 'definitions',
        title: '1. Definitions',
        items: [
          `Service — the ${BRAND.name} browser application: the public website, the creator studio, the viewer study and the lab.`,
          'Creator — a person or company that sets up a study of a video and receives the report.',
          'Viewer — an adult who voluntarily watches the video as part of a study.',
          'Account — a creator account in server mode, created with an email address and a password.',
          'Plan — the set of features and limits described on the pricing page (Free, Creator, Pro, Agency).',
          'Panel study — a service that recruits viewers outside the creator’s audience, quoted individually.',
        ],
      },
      {
        id: 'services',
        title: '2. Services',
        items: [
          'The service uses the viewer’s webcam to estimate whether and where the viewer looks at the video and shows the creator aggregate results: the attention curve, drops, scenes, heatmaps, areas and version comparisons.',
          'Camera images are processed only in the viewer’s browser and are never sent or stored.',
          'Local mode works without an account: projects and sessions stay in the creator’s browser. Server mode stores projects, media and sessions on the operator’s server.',
          'Results are webcam-based estimates whose accuracy depends on the device, lighting and number of viewers. The report shows the uncertainty of each result. The service does not predict views or reach.',
          'Recommendations written by AI are labelled with the model name, are based only on computed metrics and are advisory.',
        ],
      },
      {
        id: 'technical',
        title: '3. Technical requirements',
        items: [
          'An up-to-date browser (Chrome, Edge, Safari or Firefox) with JavaScript enabled and an internet connection.',
          'For viewers: a camera and the browser’s permission to use it. Studies work only over an encrypted connection (HTTPS).',
        ],
      },
      {
        id: 'account',
        title: '4. Account',
        items: [
          'Accounts are created by adults using a real email address. The account owner is responsible for keeping the password secure.',
          'The owner can invite team members as editors or report viewers; the number of seats depends on the plan.',
          'You can delete your account at any time in the settings. Deleting the account deletes projects, sessions and files. Cancel any active subscription in the billing portal first.',
        ],
      },
      {
        id: 'creator',
        title: '5. Creator obligations',
        items: [
          'The creator confirms they hold the rights to the media they upload or link, and that it contains no sexual content, violence, hate speech, scams or political advertising.',
          'The creator studies adults only and does not use the service for purposes excluded by the ethical principles (including studying viewers without their knowledge, at work or school, scoring individuals or recognising emotions).',
          'The creator is the controller of the data from their study and is named on the consent screen. The operator processes this data on the creator’s behalf; a data processing agreement is available on request (included with the Agency plan).',
          'If a viewer reports content, the operator may pause the project until the matter is resolved.',
        ],
      },
      {
        id: 'payments',
        title: '6. Plans and payments',
        items: [
          'Prices on the pricing page exclude VAT, which is added to invoices as required by law. The Free plan costs nothing.',
          'Creator and Pro are monthly or yearly subscriptions paid by card through Stripe. Subscriptions renew automatically; cancel in the billing portal and the plan stays active until the end of the paid period.',
          'The Agency plan and panel studies are invoiced; a panel study needs a quote and a confirmed date, and is paid by bank transfer (50% upfront).',
          'If a card payment fails, Stripe retries it for a few days and the plan stays active meanwhile. If the payment still fails, the subscription is cancelled and the account returns to the Free plan without losing data.',
        ],
      },
      {
        id: 'consumers',
        title: '7. Consumers',
        items: [
          'Consumers (and sole traders with consumer rights under Polish law) may withdraw from a distance contract within 14 days without giving a reason by writing to the operator’s contact address.',
          'If, at the consumer’s express request, the service started before that period ended, the consumer pays for the period up to the withdrawal. These terms do not limit any statutory consumer rights.',
        ],
      },
      {
        id: 'liability',
        title: '8. Liability and availability',
        items: [
          'The operator works to keep the service available but may take it offline temporarily for maintenance.',
          'Towards businesses, the operator’s liability is limited to the fees paid in the last 12 months and excludes lost profits.',
          'Editing and publishing decisions are the creator’s; study results are guidance, not a guarantee of any outcome.',
        ],
      },
      {
        id: 'complaints',
        title: '9. Complaints',
        items: ['Send complaints by email to the operator’s contact address, describing the problem and naming the account or project.', 'The operator replies within 14 days.'],
      },
      {
        id: 'changes',
        title: '10. Changes and governing law',
        items: [
          'The operator emails account holders about changes to these terms at least 14 days in advance; anyone who disagrees can delete their account before the changes take effect.',
          'Polish law applies. Disputes with businesses are settled by the court competent for the operator’s seat; consumers may use the court competent under general rules.',
        ],
      },
    ],
  },
  privacyExtra: {
    creatorsTitle: 'Creator data (accounts)',
    creators: [
      'For an account we store the email, name, company name, a password hash (never the password itself), the plan and payment history, as well as projects and uploaded media.',
      'The legal bases are the service contract (Art. 6(1)(b) GDPR), tax obligations for invoices (Art. 6(1)(c)) and legitimate interest for security and rate limits (Art. 6(1)(f)).',
      'Account data is kept until the account is deleted; accounting records for the period required by tax law.',
    ],
    processorsTitle: 'Who processes data for us',
    processors: [
      'Server hosting for accounts, projects and sessions.',
      'Stripe — card payments and subscription invoices (payer data only, no viewer data).',
      'Anthropic — AI-written recommendations when a creator uses them; the model receives only computed aggregate metrics, with no personal data of creators or viewers.',
    ],
    gdprTitle: 'Your rights',
    gdpr: [
      'You have the right to access, rectify and erase your data, to restrict processing, to data portability and to object.',
      'You have the right to lodge a complaint with a supervisory authority (in Poland: the President of the Personal Data Protection Office, UODO).',
      'A viewer whose data belongs to a creator’s study can also contact the creator named on the consent screen, or delete their session with the deletion code.',
    ],
  },
};
