# GitHub Pages Setup Instructions

## Overview
This repository is now configured to automatically deploy to GitHub Pages when code is pushed to the `main` or `copilot/update-code-and-republish-pages` branches.

## Required Steps to Enable GitHub Pages

Since GitHub Pages needs to be enabled manually in repository settings, please follow these steps:

### 1. Enable GitHub Pages in Repository Settings

1. Go to your repository on GitHub: https://github.com/devdev0987-dot/ecovale-hr-management
2. Click on **Settings** (top navigation)
3. In the left sidebar, click on **Pages** under "Code and automation"
4. Under "Build and deployment":
   - **Source**: Select "GitHub Actions" from the dropdown
   - This allows the workflow to deploy automatically
5. Click **Save** if prompted

### 2. Re-run the Workflow (if needed)

After enabling GitHub Pages:

1. Go to **Actions** tab in your repository
2. Find the "Deploy to GitHub Pages" workflow run
3. If it shows "action_required", click **Re-run all jobs**

Alternatively, just push a new commit and the workflow will run automatically.

### 3. Access Your Deployed Site

Once the workflow completes successfully:

- Your site will be available at: **https://devdev0987-dot.github.io/ecovale-hr-management/**
- The URL will also be shown in the workflow run under the "deploy" job

## What Was Configured

The following changes were made to enable GitHub Pages deployment:

### 1. GitHub Actions Workflow (`.github/workflows/deploy-pages.yml`)
- **Build Job**: Installs dependencies, builds the Vite app, and uploads the build artifact
- **Deploy Job**: Deploys the build artifact to GitHub Pages
- Triggers on pushes to `main` and `copilot/update-code-and-republish-pages` branches
- Can also be manually triggered via "workflow_dispatch"

### 2. Vite Configuration (`vite.config.ts`)
- Set `base: '/ecovale-hr-management/'` for production builds
- This ensures assets are loaded with the correct path on GitHub Pages

### 3. Public Directory (`.nojekyll`)
- Added `.nojekyll` file to prevent GitHub from processing the site with Jekyll
- This prevents issues with files and folders starting with underscores

## Verification

After GitHub Pages is enabled and the workflow runs successfully:

1. Check the **Actions** tab for a successful deployment (green checkmark)
2. Visit your site at: https://devdev0987-dot.github.io/ecovale-hr-management/
3. Test the application to ensure all features work correctly

## Troubleshooting

### If the workflow shows "action_required":
- Make sure GitHub Pages is enabled in repository settings
- Ensure the source is set to "GitHub Actions"

### If the site doesn't load:
- Check browser console for 404 errors
- Verify the `base` path in `vite.config.ts` matches your repository name
- Ensure the build was successful in the workflow logs

### If assets don't load:
- Clear browser cache and reload
- Check that the `base` path in Vite config is correct
- Verify `.nojekyll` file exists in the `dist` folder after build

## Additional Notes

- The workflow uses `npm ci` for faster, deterministic installs
- The build output is in the `dist` directory (excluded from git via `.gitignore`)
- Production environment variables can be configured in repository secrets if needed
- The current build is configured for production mode with optimizations

## Next Steps

1. Enable GitHub Pages as described above
2. Merge this PR to `main` branch
3. The site will automatically deploy on every push to `main`
4. Share the deployed URL with your team!
