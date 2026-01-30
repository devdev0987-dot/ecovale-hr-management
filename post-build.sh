#!/bin/bash
# Post-build script to copy index.html to 404.html for GitHub Pages SPA support

cp dist/index.html dist/404.html
echo "✓ Created 404.html for GitHub Pages SPA routing"
