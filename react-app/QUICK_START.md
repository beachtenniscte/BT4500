# Quick Start - Liga BT4500

Get your React app running in 3 simple steps!

## Step 1: Install Dependencies

```bash
cd react-app
npm install
```

## Step 2: Start Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Step 3: (Optional) Configure API

If you want to connect to a backend API:

1. Copy the environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your API URL:
```
VITE_API_URL=http://your-api-url.com/api
```

3. Restart the dev server

---

## What You Get

- **4 Pages**: Home, Info, Provas, Classificação
- **Fully Responsive**: Works on mobile, tablet, and desktop
- **API Ready**: Complete service layer for backend integration
- **Modern Stack**: React + React Router + Vite

## File Structure

```
react-app/
├── src/
│   ├── pages/          ← Your page components
│   ├── services/       ← API integration
│   └── App.jsx         ← Main app with routing
├── public/
│   └── images/         ← Put your images here
└── .env                ← API configuration (create this)
```

## Common Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Need Help?

- Full setup guide: See [SETUP.md](SETUP.md)
- API documentation: See [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- Project overview: See [README.md](README.md)

---

**That's it!** Your app is now running.

To connect it to your backend, see the API documentation.
