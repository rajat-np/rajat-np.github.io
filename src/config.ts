/**
 * Site Configuration
 *
 * Copyright (c) 2018-present Rajat Soni
 * Licensed under the MIT License (code) and CC BY 4.0 (content)
 * See LICENSE and LICENSE-CONTENT files for full license information
 */

const START_YEAR = 2025;
const CURRENT_YEAR = new Date().getFullYear();

export const COPYRIGHT = {
  startYear: START_YEAR,
  currentYear: CURRENT_YEAR,
  displayYear: START_YEAR === CURRENT_YEAR ? `${START_YEAR}` : `${START_YEAR}-${CURRENT_YEAR}`,
  notice: `© ${START_YEAR === CURRENT_YEAR ? START_YEAR : `${START_YEAR}-${CURRENT_YEAR}`} Rajat Soni. All rights reserved.`,
};

export const SITE = {
  title: "Rajat Soni",
  description: "Software engineer building backend systems, APIs, and data pipelines with experience in SaaS startups and climate tech.",
  author: "Rajat Soni",
  locale: "en-US",
  baseUrl: "https://rajat-np.github.io",
};

export const SOCIALS = {
  github: "https://github.com/rajat-np",
  twitter: "https://x.com/brute_tack",
  linkedin: "https://www.linkedin.com/in/rajat-tcp/",
  stackoverflow: "https://stackoverflow.com/users/7766133/rajat-soni",
  flickr: "https://www.flickr.com/photos/rajatsoni/",
};

export const NAV_LINKS = [
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
];
