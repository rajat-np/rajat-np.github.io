/**
 * BadgeGrid Component - Interactive skill badges display
 *
 * Copyright (c) 2018-present Rajat Soni
 * Licensed under the MIT License
 * See LICENSE file in the project root for full license information
 */

import type { Badge } from "@data/skills";

interface BadgeGridProps {
  badges: Badge[];
  title: string;
}

export default function BadgeGrid({ badges, title }: BadgeGridProps) {
  return (
    <div className="mb-8">
      <h4 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {badges.map(({ name, badge, url }) => (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-transform hover:scale-105"
          >
            <img src={badge} alt={name} loading="lazy" />
          </a>
        ))}
      </div>
    </div>
  );
}
