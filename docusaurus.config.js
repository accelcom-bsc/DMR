// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'DMR',
  tagline: 'Dynamic MPI Reconfiguration — scale your HPC application at runtime.',
  favicon: 'img/favicon.ico',

  future: { v4: true },

  url: 'https://iarejula-bsc.github.io',
  baseUrl: '/dmr_doc/',
  organizationName: 'iarejula-bsc',
  projectName: 'dmr_doc',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
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
            sidebarId: 'policies',
            label: 'Policies',
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
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'c'],
      },
    }),
};

export default config;
