# Rohlik Enhanced

A browser extension that enhances the Rohlik.cz shopping experience by displaying Nutri-Score ratings for products.

Note: this codebase was developed mostly by Claude 3.5 using Windsurf, so expect some weirdness. I was heavily optimizing for speed over quality.

## Development Setup

### Firefox

1. `cp manifest.firefox.json manifest.json`
1. Open Firefox and go to `about:debugging`
1. Click "This Firefox"
1. Click "Load Temporary Add-on"
1. Select the `manifest.json` file from the `extension` directory

### Chrome

1. `cp manifest.chrome.json manifest.json`
1. Open Chrome and go to `chrome://extensions/`
1. Enable "Developer mode" in the top right
1. Click "Load unpacked"
1. Select the `extension` directory

## Features

- Displays Nutri-Score ratings next to products in the product list
- Calculates scores based on nutritional information
- Caches results in IndexedDB
- Updates dynamically as you browse the site
