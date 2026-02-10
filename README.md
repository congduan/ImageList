# Image List Sidebar Extension

## Introduction

Image List Sidebar is a browser extension that displays all images from the current webpage in a sidebar and provides download functionality.

### Main Features

- ✅ Displays all images from the current webpage (including img tags, background images, SVGs, etc.)
- ✅ Supports viewing image type and size information
- ✅ Supports single image download
- ✅ Supports batch download of all images (packaged as zip file)
- ✅ Supports filtering by image type
- ✅ Supports detecting lazy-loaded images
- ✅ Supports parsing SVG image dimensions

## Installation

### Development Mode Installation

1. Clone or download this project to your local machine
2. Open your browser's extension management page (e.g., Chrome: `chrome://extensions/`)
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the root directory of this project
6. The extension is installed, and the extension icon will appear in the browser's top right corner

## Usage

1. Browse any webpage
2. Click the extension icon in the browser's top right corner
3. The sidebar will open and display all images from the current webpage
4. You can:
   - Click the "Download" button to download a single image
   - Click the "Download All Images" button to batch download
   - Use the type filter to filter images
   - Click the "Refresh" button to re-fetch images

## Technical Features

- Developed with native JavaScript, no third-party dependencies
- Supports Chrome browser and other browsers that support Chrome extension API
- Efficient image extraction algorithm, supporting multiple image types
- Intelligent image size detection, including SVG images
- Elegant error handling to ensure stable operation

## Fixed Issues

- ✅ Fixed the issue where some images displayed "UNKNOWN Unknown size"
- ✅ Improved SVG image size parsing logic
- ✅ Enhanced image type detection accuracy
- ✅ Optimized lazy-loaded image detection

## Supported Image Types

- JPG/JPEG
- PNG
- GIF
- WebP
- BMP
- SVG
- AVIF
- TIFF
- ICO

## Notes

- For cross-origin images, complete information may not be available
- For dynamically loaded images, they may need to be refreshed to display
- When batch downloading a large number of images, browser download limits may apply

## Contributing

Welcome to submit Issues and Pull Requests to improve this extension!

## License

MIT License
