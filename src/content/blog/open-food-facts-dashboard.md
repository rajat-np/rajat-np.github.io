---
title: "Building an Indian Food Items Dashboard with Open Food Facts"
description: "A practical build using the discover API to surface Indian products, scan results, and nutrition highlights with their ecological impact"
pubDate: 2026-01-12
tags: ["open-food-facts", "data", "dashboard", "climate-tech", "public-data"]
draft: true
---

I wanted a simple, trustworthy way to explore Indian food items without maintaining my own dataset. Open Food Facts already aggregates product data from contributors around the world, and the `discover` service provides a clean, queryable layer for browsing and filtering. The goal was to make discovery fast, clear, and resilient to messy data.

## Why the Discover API

`https://ssl-api.openfoodfacts.org/discover` is flexible enough to support search, categories, and filters without locking me into a rigid schema. That meant I could keep the UI simple while still letting the data evolve.

Key decisions:

- Keep the query layer general, so filters are driven by URL parameters.
- Normalize the fields I render (name, brand, categories, nutrition) and treat everything else as optional.
- Always link back to the source record for attribution and transparency.

## The Dashboard Flow

The dashboard starts with a list view and a search bar. Users can refine results by category or label, then click into a product for details. I focused on speed and legibility so the experience feels like scanning rather than deep analysis.

### Sample Scan Result (Nutella, India)

When a product is scanned, the UI surfaces the essentials first: name, brand, market, and nutrition. Anything missing is shown as optional, not broken.

![Sample Nutella scan result showing nutrition summary and metadata](/images/nutella-scan-1.svg)

![Reference scores used in the dashboard](/images/impact-score-reference.svg)

### Details and Highlights

The details view is intentionally lightweight. Labels and nutrition highlights are shown side by side so you can quickly identify high sugar or fat content without digging through long tables.

![Nutella details view with labels and nutrition highlights](/images/nutella-scan-2.svg)

## Handling Messy Data

Public datasets are inconsistent. Some items have no images, incomplete nutrition, or inconsistent labels. The UI handles this by:

- Showing clean placeholders for missing images.
- Rendering nutrition only when reliable fields are present.
- Using neutral language where data is incomplete.

## What I’d Build Next

This project is intentionally small and flexible. If I extend it, I’d add:

- Comparisons across products in the same category.
- Regional filters for Indian states and cities.
- Trend charts for ingredients and nutrition.

For now, it’s a simple, reliable dashboard for exploring Indian food items quickly and with context.
