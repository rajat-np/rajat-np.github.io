/**
 * Astro Configuration
 *
 * Copyright (c) 2018-present Rajat Soni
 * Licensed under the MIT License
 * See LICENSE file in the project root for full license information
 */

import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://rajat-np.github.io',
  base: '/',
  integrations: [
    tailwind(),
    react(),
    sitemap(),
  ],
  output: 'static',
});
