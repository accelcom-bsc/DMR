// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	integrations: [
		starlight({
			title: 'DMR',
			description: 'Dynamic MPI Reconfiguration library by the Barcelona Supercomputing Center',
			social: [
				{
					icon: 'gitlab',
					label: 'GitLab',
					href: 'https://gitlab.bsc.es/accelcom/releases/dmr/dmr',
				},
			],
			defaultLocale: 'en',
			locales: {
				en: { label: 'English', lang: 'en' },
				es: { label: 'Español', lang: 'es' },
			},
			sidebar: [
				{
					label: 'Getting Started',
					translations: { es: 'Primeros pasos' },
					items: [
						{ label: 'What is DMR?', translations: { es: '¿Qué es DMR?' }, slug: 'getting-started/what-is-dmr' },
						{ label: 'Installation', translations: { es: 'Instalación' }, slug: 'getting-started/installation' },
						{ label: 'Quick Start', translations: { es: 'Inicio rápido' }, slug: 'getting-started/quick-start' },
						{ label: 'Modes of Operation', translations: { es: 'Modos de operación' }, slug: 'getting-started/modes-of-operation' },
					],
				},
				{
					label: 'User Guide',
					translations: { es: 'Guía de usuario' },
					items: [
						{ label: 'Application Structure', translations: { es: 'Estructura de la aplicación' }, slug: 'user-guide/app-structure' },
						{ label: 'The DMR_AUTO Macro', translations: { es: 'La macro DMR_AUTO' }, slug: 'user-guide/dmr-auto-macro' },
						{ label: 'Reconfiguration Callbacks', translations: { es: 'Callbacks de reconfiguración' }, slug: 'user-guide/reconfiguration-callbacks' },
						{ label: 'Configuration', translations: { es: 'Configuración' }, slug: 'user-guide/configuration' },
						{ label: 'Analytics', slug: 'user-guide/analytics' },
					],
				},
				{
					label: 'Policies',
					translations: { es: 'Políticas' },
					items: [
						{ label: 'Overview', translations: { es: 'Introducción' }, slug: 'policies/overview' },
						{ label: 'Built-in Policies', translations: { es: 'Políticas predefinidas' }, slug: 'policies/builtin-policies' },
						{ label: 'Custom Policies', translations: { es: 'Políticas personalizadas' }, slug: 'policies/custom-policies' },
						{ label: 'Policy Context Reference', translations: { es: 'Referencia del contexto' }, slug: 'policies/policy-context-reference' },
						{ label: 'Migration from Legacy API', translations: { es: 'Migración desde la API antigua' }, slug: 'policies/legacy-migration' },
					],
				},
				{
					label: 'API Reference',
					translations: { es: 'Referencia de la API' },
					items: [
						{ label: 'dmr.h', slug: 'api/dmr-h' },
						{ label: 'dmr_policies.h', slug: 'api/dmr-policies-h' },
					],
				},
				{
					label: 'Examples',
					translations: { es: 'Ejemplos' },
					items: [
						{ label: 'Hello World', slug: 'examples/hello-world' },
						{ label: 'Distributed Dataset', slug: 'examples/distributed-dataset' },
					],
				},
			],
		}),
	],
});
