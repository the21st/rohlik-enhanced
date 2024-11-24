# Rohlik Enhanced

A browser extension that enhances the Rohlik.cz shopping experience by displaying Nutri-Score ratings for products.

## Project Structure

```
rohlik-enhanced/
├── manifest.json   # Extension configuration
├── content.js      # Content script that runs on rohlik.cz
└── background.js   # Background script for extension
```

## Development Setup

### Firefox

1. Open Firefox and go to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from the `extension` directory

### Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `extension` directory

## Features

- Displays Nutri-Score ratings next to products in the product list
- Calculates scores based on nutritional information
- Caches results in IndexedDB
- Updates dynamically as you browse the site
