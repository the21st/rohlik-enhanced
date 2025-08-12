# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **Beverages**: No scores shown (`isBeverage: true`) 
- **Fats/oils/nuts**: No scores shown (`isFatsOilsNutsOrSeeds: true`)

Category detection is done via Czech category names in API responses.

### Performance Optimizations

- **Debounced updates**: 100ms debounce on DOM changes
- **Duplicate prevention**: `data-nutriscore-added` attributes prevent re-processing
- **Persistent caching**: IndexedDB with localStorage fallback
- **Race condition handling**: Immediate marking of elements being processed

### Browser Compatibility

Uses Manifest v3 with separate manifests for Chrome and Firefox. The extension requires `storage` permission and `host_permissions` for rohlik.cz.