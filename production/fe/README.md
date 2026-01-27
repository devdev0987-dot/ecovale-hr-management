# Frontend (fe/) Directory

This directory contains the React.js frontend application for the EcoVale HR Management System.

---

## Quick Start

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |

---

## Environment Variables

Create a `.env` file in the `fe/` directory:

```bash
# API URL
VITE_API_URL=http://localhost:5000/api

# App Name
VITE_APP_NAME=EcoVale HR
```

---

## Development

### Local Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### API Proxy

In development, API requests are proxied to the backend server:

```javascript
// vite.config.js
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
```

---

## Building for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` directory.

---

## Project Dependencies

### Production Dependencies
- `react` - UI library
- `react-dom` - React DOM renderer
- `react-router-dom` - Client-side routing
- `@tanstack/react-query` - Data fetching and caching
- `axios` - HTTP client
- `prop-types` - Runtime prop validation

### Development Dependencies
- `vite` - Build tool and dev server
- `@vitejs/plugin-react` - React plugin for Vite
- `vitest` - Testing framework
- `@testing-library/react` - React testing utilities
- `eslint` - Linting
- `tailwindcss` - Utility-first CSS (optional)

---

## Folder Structure Overview

```
fe/
├── src/
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Page components
│   ├── services/        # API service layer
│   └── utils/           # Utility functions
├── public/              # Static assets
└── dist/                # Production build output
```

See [structure.md](structure.md) for complete directory breakdown.
