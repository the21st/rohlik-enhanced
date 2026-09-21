# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## How this repository is worked on

An AI agent does every step: the code changes, the tests, the version bumps, the commits,
the tag push, and the AMO submission. Do not hand a step back to the user because it is
procedural. Drive it.

The single exception is the Chrome Web Store upload, which has no credentials here and
needs a person in the dashboard.

## Project Overview

This is a browser extension called "Rohlik Enhanced" that displays Nutri-Score ratings for grocery products on rohlik.cz. The extension adds visual score indicators (A-E ratings) overlaid on product images as users browse the site.

## Common Commands

### Testing
```bash
npm test
```
Runs Jest tests with ES modules support and jsdom environment.

### Packaging Extensions
```bash
npm run package:firefox    # Package for Firefox
npm run package:chrome     # Package for Chrome  
npm run package:all        # Package for both browsers
```

## Releasing

Releases are driven by `.github/workflows/release.yml`, which triggers on a `v*` tag.

1. Bump `version` in **both** `manifest.firefox.json` and `manifest.chrome.json`. The
   workflow fails if they disagree with the tag.
2. Commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. The workflow runs the tests, builds both packages, signs and submits to AMO, and
   creates a GitHub release holding both zips and the signed XPI.
4. **Chrome is manual.** Download `rohlik-enhanced-chrome.zip` from that release and
   upload it at https://chrome.google.com/webstore/devconsole (extension ID
   `clohebmgoccabpjpbddkffcffamogimd`).

Store versions must always increase. Both stores reject a re-used version number.

`workflow_dispatch` on the Release workflow does a build-only dry run by default. Use it
to check a workflow change without publishing.

Repository secrets used: `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`, from
https://addons.mozilla.org/en-US/developers/addon/api/key/

The Chrome Web Store API is deliberately not wired up: it needs a Google Cloud OAuth
client and a refresh token, which costs more upkeep than the manual upload at this
release rate.

### Publishing to AMO by hand
Only when CI is unavailable. Needs a `.env` file with `JWT_ISSUER` and `JWT_SECRET`.
```bash
cp manifest.firefox.json manifest.json
source .env && npx web-ext sign --source-dir . --api-key="$JWT_ISSUER" --api-secret="$JWT_SECRET" --channel=listed
```

### Development Setup
For Firefox:
1. `cp manifest.firefox.json manifest.json`
2. Load as temporary add-on in about:debugging

For Chrome:
1. `cp manifest.chrome.json manifest.json`  
2. Load unpacked extension in chrome://extensions/

## Architecture

### Core Components

**content.js** - Main content script with these key functions:
- `fetchNutriScore(productId)` - Main entry point that fetches/calculates scores
- `fetchNutritionData(productId)` - Gets nutrition data from Rohlik API
- `fetchCategoryData(productId)` - Gets product categories from Rohlik API  
- `calculateNutriScore2022()` - Implements 2022 Nutri-Score algorithm
- `addNutriScores()` - Adds score badges to product card listings
- `addProductDetailNutriScore()` - Adds score badges to individual product pages

### Data Flow

1. **Product Detection**: MutationObserver watches for product cards with `data-test="productCard-*"` attributes
2. **Data Fetching**: Extract product ID → fetch nutrition data + categories from Rohlik APIs
3. **Score Calculation**: Apply 2022 Nutri-Score algorithm with category-specific rules
4. **Caching**: Store results in IndexedDB (fallback to localStorage)
5. **UI Rendering**: Create circular score badges positioned absolutely on product images

### Nutri-Score Implementation

The extension implements the 2022 Nutri-Score algorithm with special handling for:
- **Alcoholic beverages**: No score displayed
- **Cheese products**: Uses modified scoring rules (`isCheese: true`)
- **Red meat**: Protein score capping
- **Beverages**: No scores shown (`isBeverage: true`), except dairy drinks (categories containing "mléčn") which are scored
- **Fats/oils/nuts**: No scores shown (`isFatsOilsNutsOrSeeds: true`)

Category detection is done via Czech category names in API responses.

**Cache versioning**: When changing the scoring algorithm or category detection logic, bump the `VERSION` constant at the top of `content.js` (e.g. `"v9"` → `"v10"`). This creates a new IndexedDB/localStorage namespace, forcing fresh lookups for all products instead of serving stale cached results.

### Performance Optimizations

- **Debounced updates**: 100ms debounce on DOM changes
- **Duplicate prevention**: `data-nutriscore-added` attributes prevent re-processing
- **Persistent caching**: IndexedDB with localStorage fallback
- **Race condition handling**: Immediate marking of elements being processed

### Browser Compatibility

Uses Manifest v3 with separate manifests for Chrome and Firefox. The extension requires `storage` permission and `host_permissions` for rohlik.cz.