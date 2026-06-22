// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'DMR',
  tagline: 'Dynamic MPI Reconfiguration — scale your HPC application at runtime.',
  favicon: 'img/logo-browser.png',

  future: { v4: true },
  markdown: {
    mermaid: true,
    hooks: { onBrokenMarkdownLinks: 'warn' },
  },
  themes: ['@docusaurus/theme-mermaid'],

  url: 'https://accelcom-bsc.github.io',
  baseUrl: process.env.BASE_URL ?? '/DMR/',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
    localeConfigs: {
      en: { label: 'English' },
      es: { label: 'Español' },
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: { respectPrefersColorScheme: true },
      navbar: {
        title: 'DMR',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'gettingStarted',
            label: 'Getting Started',
            position: 'left',
          },
          {
            type: 'docSidebar',
            sidebarId: 'userGuide',
            label: 'User Guide',
            position: 'left',
          },
          {
            type: 'docSidebar',
            sidebarId: 'api',
            label: 'API Reference',
            position: 'left',
          },
          {
            type: 'docSidebar',
            sidebarId: 'examples',
            label: 'Examples',
            position: 'left',
          },
          {
            type: 'docSidebar',
            sidebarId: 'references',
            label: 'References',
            position: 'left',
          },
          { type: 'localeDropdown', position: 'right' },
          {
            href: 'https://gitlab.bsc.es/accelcom/releases/dmr/dmr',
            label: 'GitLab',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        copyright: `Copyright © ${new Date().getFullYear()} Barcelona Supercomputing Center. Built with Docusaurus.`,
      },
      mermaid: {
        theme: { light: 'neutral', dark: 'dark' },
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'c'],
      },
    }),
};

export default config;
