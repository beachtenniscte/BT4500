# Setup Guide - Liga BT4500 React App

This guide will help you set up and run the Liga BT4500 React application.

## Quick Start

### 1. Install Dependencies

```bash
cd react-app
npm install
```

### 2. Configure Environment

Copy the environment template:
```bash
cp .env.example .env
```

Edit `.env` and update the API URL:
```
VITE_API_URL=http://your-backend-url.com/api
```

### 3. Copy Assets

Copy your images to the public directory:
```bash
# Copy club logo
cp ../images/clube-logo.svg public/images/

# Copy regulation PDF (if available)
cp ../regulamento.pdf public/
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Detailed Setup

### System Requirements

- **Node.js**: v14.0.0 or higher
- **npm**: v6.0.0 or higher (comes with Node.js)

Check your versions:
```bash
node --version
npm --version
```

### Installing Node.js

If you don't have Node.js installed:

**Windows:**
1. Download from [nodejs.org](https://nodejs.org)
2. Run the installer
3. Verify installation: `node --version`

**macOS:**
```bash
# Using Homebrew
brew install node
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm

# Fedora
sudo dnf install nodejs
```

---

## Project Structure Explained

```
react-app/
├── public/              # Static assets served as-is
│   ├── images/         # Image files (logo, etc.)
│   └── regulamento.pdf # PDF file (if needed)
│
├── src/
│   ├── pages/          # Page components
│   │   ├── Home.jsx    # Landing page with navigation
│   │   ├── Info.jsx    # Info/about page
│   │   ├── Provas.jsx  # Events list page
│   │   └── Classificacao.jsx # Standings table
│   │
│   ├── services/
│   │   └── api.js      # API integration layer
│   │
│   ├── App.jsx         # Main app with routing
│   ├── App.css         # Global styles
│   └── main.jsx        # React entry point
│
├── .env                # Environment variables (create this)
├── .env.example        # Environment template
├── package.json        # Dependencies and scripts
├── vite.config.js      # Vite configuration
└── index.html          # HTML entry point
```

---

## Running the Application

### Development Mode

```bash
npm run dev
```

Features:
- Hot module replacement (changes reflect instantly)
- Detailed error messages
- Available at `http://localhost:5173`

### Production Build

```bash
npm run build
```

Creates optimized files in `dist/` folder:
- Minified JavaScript
- Optimized CSS
- Compressed assets

### Preview Production Build

```bash
npm run preview
```

Test the production build locally before deploying.

---

## Connecting to an API

### Option 1: Without API (Default)

The app works without a backend API. It uses default/fallback data defined in each component.

### Option 2: With Your Own API

1. Create `.env` file:
```bash
VITE_API_URL=http://localhost:3000/api
```

2. Ensure your API implements these endpoints:
   - `GET /api/info` - Info page content
   - `GET /api/provas` - List of events
   - `GET /api/classification` - Team standings

3. See `API_DOCUMENTATION.md` for full API specification

### Option 3: Mock API for Testing

Use a tool like JSON Server for quick testing:

```bash
# Install JSON Server globally
npm install -g json-server

# Create db.json file
cat > db.json << 'EOF'
{
  "info": {
    "paragraph1": "É com este objectivo...",
    "paragraph2": "Acreditamos que a colaboração..."
  },
  "provas": [
    {"id": 1, "type": "PRATA", "dates": "10-11 MAI"}
  ],
  "classification": [
    {"position": 1, "team": "Equipa A", "points": 150, "games": 10, "wins": 8}
  ]
}
EOF

# Run JSON Server
json-server --watch db.json --port 3000
```

Then set `.env`:
```
VITE_API_URL=http://localhost:3000
```

---

## Common Issues & Solutions

### Issue: Port 5173 already in use

**Solution:** Kill the process or use a different port:
```bash
npm run dev -- --port 3001
```

### Issue: Module not found errors

**Solution:** Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Images not showing

**Solution:** Ensure images are in `public/images/`:
```bash
mkdir -p public/images
cp ../images/* public/images/
```

### Issue: API calls failing (CORS errors)

**Solution:** Configure CORS on your backend:
```javascript
// Express.js example
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:5173'
}));
```

### Issue: Routes not working on refresh (404 errors)

**Solution:** Configure your hosting for SPA routing:

**Netlify:** Create `public/_redirects`:
```
/* /index.html 200
```

**Vercel:** Create `vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Apache:** Create `.htaccess`:
```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

---

## Customization

### Changing Colors

Edit `src/App.css`:
```css
background: linear-gradient(135deg, #5eb5a6 0%, #5a8aa8 50%, #7e5ba3 100%);
```

### Adding New Pages

1. Create component: `src/pages/NewPage.jsx`
2. Create styles: `src/pages/NewPage.module.css`
3. Add route in `src/App.jsx`:
```jsx
import NewPage from './pages/NewPage';
// ...
<Route path="/new-page" element={<NewPage />} />
```

### Modifying Navigation

Edit `src/pages/Home.jsx`:
```jsx
<Link to="/new-page" className={styles.navButton}>
  NEW PAGE
</Link>
```

---

## Deployment

### Deploy to Netlify

1. Sign up at [netlify.com](https://netlify.com)
2. Connect your Git repository
3. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Add environment variables in Netlify dashboard
5. Deploy!

### Deploy to Vercel

1. Sign up at [vercel.com](https://vercel.com)
2. Import your repository
3. Vercel auto-detects Vite configuration
4. Add environment variables
5. Deploy!

### Deploy to Traditional Hosting

1. Build the project:
```bash
npm run build
```

2. Upload `dist/` contents to your web server

3. Configure web server for SPA routing (see Common Issues above)

---

## Development Tips

### VS Code Extensions (Recommended)

- **ES7+ React/Redux/React-Native snippets** - Code snippets
- **Prettier** - Code formatting
- **ESLint** - Code linting
- **Auto Rename Tag** - HTML/JSX tag renaming

### Code Formatting

Install Prettier:
```bash
npm install --save-dev prettier
```

Create `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2
}
```

Format code:
```bash
npx prettier --write src/
```

### Git Setup

Initialize git (if not already):
```bash
git init
git add .
git commit -m "Initial commit"
```

Create `.gitignore`:
```
node_modules/
dist/
.env
.DS_Store
```

---

## Performance Optimization

### Lazy Loading Routes

Update `src/App.jsx`:
```jsx
import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./pages/Home'));
const Info = lazy(() => import('./pages/Info'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/info" element={<Info />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
```

### Image Optimization

Use WebP format for better compression:
```bash
# Convert SVG to WebP (if needed)
npm install -g sharp-cli
sharp -i logo.svg -o logo.webp
```

---

## Testing

### Install Testing Libraries

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest
```

### Run Tests

```bash
npm run test
```

---

## Getting Help

### Documentation Links

- [React Documentation](https://react.dev)
- [React Router](https://reactrouter.com)
- [Vite Documentation](https://vitejs.dev)

### Common Commands Cheat Sheet

```bash
npm install              # Install dependencies
npm run dev             # Start development server
npm run build           # Build for production
npm run preview         # Preview production build
npm install <package>   # Add new package
npm uninstall <package> # Remove package
```

---

## Next Steps

1. ✅ Set up the development environment
2. ✅ Run the app locally
3. 📝 Customize colors and content
4. 🔌 Connect to your backend API
5. 🧪 Test on different devices
6. 🚀 Deploy to production

For API integration details, see `API_DOCUMENTATION.md`.

---

**Need more help?** Contact your development team or open an issue in the project repository.
