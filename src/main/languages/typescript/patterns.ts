/*
 * CodeAnalyzer - Interactive dependency graph viewer
 * Copyright (C) 2025
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Cloud SDK imports to detect
 */
export const CLOUD_SDK_PATTERNS: Record<string, { name: string; type: 'cloud_service' | 'sdk' | 'database' }> = {
  'firebase': { name: 'Firebase', type: 'cloud_service' },
  '@firebase': { name: 'Firebase', type: 'cloud_service' },
  'aws-sdk': { name: 'AWS', type: 'cloud_service' },
  '@aws-sdk': { name: 'AWS', type: 'cloud_service' },
  'stripe': { name: 'Stripe', type: 'sdk' },
  '@stripe': { name: 'Stripe', type: 'sdk' },
  'twilio': { name: 'Twilio', type: 'sdk' },
  '@sendgrid': { name: 'SendGrid', type: 'sdk' },
  'pusher': { name: 'Pusher', type: 'sdk' },
  '@supabase': { name: 'Supabase', type: 'cloud_service' },
  '@prisma/client': { name: 'Prisma', type: 'database' },
  'prisma': { name: 'Prisma', type: 'database' },
  'typeorm': { name: 'TypeORM', type: 'database' },
  'mongoose': { name: 'MongoDB', type: 'database' },
  'sequelize': { name: 'Sequelize', type: 'database' },
  'knex': { name: 'Knex', type: 'database' },
  'drizzle-orm': { name: 'Drizzle', type: 'database' }
}

/**
 * Path alias patterns commonly used in TypeScript/JavaScript projects
 */
export const ALIAS_PATTERNS: RegExp[] = [
  /^@\//,              // @/ - root alias
  /^@[a-z][a-z0-9-]*\//i,  // @components/, @utils/, @renderer/, etc. (but not @scope/pkg)
  /^~\//,              // ~/ - home alias
  /^#\//,              // #/ - alternative alias
  /^src\//,            // src/ - direct src reference
  /^app\//,            // app/ - Next.js app directory
  /^lib\//,            // lib/ - common lib folder
  /^utils\//,          // utils/ - utils folder
  /^components\//,     // components/ - components folder
  /^hooks\//,          // hooks/ - hooks folder
  /^stores\//,         // stores/ - stores folder
  /^services\//,       // services/ - services folder
  /^types\//,          // types/ - types folder
]

/**
 * Known npm scopes (not project aliases)
 */
export const KNOWN_NPM_SCOPES: string[] = [
  '@types/', '@babel/', '@emotion/', '@mui/', '@chakra-ui/',
  '@radix-ui/', '@tanstack/', '@trpc/', '@prisma/', '@nestjs/',
  '@angular/', '@vue/', '@nuxt/', '@svelte/', '@testing-library/',
  '@storybook/', '@typescript-eslint/', '@eslint/', '@vitejs/',
  '@aws-sdk/', '@azure/', '@google-cloud/', '@firebase/',
  '@supabase/', '@stripe/', '@sendgrid/', '@xyflow/',
  '@electron-toolkit/', '@electron/'
]

/**
 * Common folder aliases that map to src/<folder>/
 */
export const COMMON_FOLDER_ALIASES: string[] = [
  'components', 'utils', 'hooks', 'stores', 'store', 'types',
  'services', 'lib', 'api', 'assets', 'styles', 'config',
  'helpers', 'constants', 'context', 'contexts', 'features',
  'pages', 'views', 'layouts', 'shared', 'common', 'modules'
]

/**
 * Check if an import source is a path alias (not a real npm package)
 */
export function isPathAlias(source: string): boolean {
  // Check if it's a scoped npm package
  const scopedPackagePattern = /^@[a-z][a-z0-9-]*\/[a-z]/i
  if (scopedPackagePattern.test(source)) {
    if (KNOWN_NPM_SCOPES.some(scope => source.startsWith(scope))) {
      return false // It's a real npm scoped package
    }
  }

  return ALIAS_PATTERNS.some(pattern => pattern.test(source))
}

/**
 * Get cloud SDK info from import source
 */
export function getCloudSdkInfo(source: string): { name: string; type: 'cloud_service' | 'sdk' | 'database' } | null {
  for (const [pattern, info] of Object.entries(CLOUD_SDK_PATTERNS)) {
    if (source === pattern || source.startsWith(pattern + '/')) {
      return info
    }
  }
  return null
}
