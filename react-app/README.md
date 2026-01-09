# Liga BT4500 - React Application

A modern, responsive React application for Liga BT4500 (Clube Ténis Espinho) with API integration capabilities.

## Features

- **Fully Responsive Design**: Works seamlessly on all screen sizes (mobile, tablet, desktop)
- **React Router**: Client-side routing for smooth navigation
- **API Ready**: Complete API service layer for backend integration
- **CSS Modules**: Scoped styling with modern CSS
- **Optimized Performance**: Built with Vite for fast development and production builds
- **Animations**: Smooth page transitions and hover effects

## Project Structure

```
react-app/
├── public/
│   └── images/          # Static images (logo, etc.)
├── src/
│   ├── pages/           # Page components
│   │   ├── Home.jsx
│   │   ├── Info.jsx
│   │   ├── Provas.jsx
│   │   ├── Classificacao.jsx
│   │   ├── Home.module.css
│   │   └── PageLayout.module.css
│   ├── services/
│   │   └── api.js       # API service layer
│   ├── App.jsx          # Main app component with routing
│   ├── App.css          # Global styles
│   └── main.jsx         # Entry point
├── .env.example         # Environment variables template
└── package.json
```

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Navigate to the project directory:
```bash
cd react-app
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your API URL:
```
VITE_API_URL=http://your-api-url.com/api
```

### Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

Create an optimized production build:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## API Integration

The application includes a complete API service layer in `src/services/api.js` with the following endpoints:

### Available API Methods

- `getInfo()` - Fetch info page content
- `getProvas()` - Get list of all provas (events)
- `getProvaById(id)` - Get specific prova details
- `getClassification()` - Get current standings
- `createProva(data)` - Create new prova (admin)
- `updateClassification(id, data)` - Update team standings (admin)
- `deleteProva(id)` - Delete prova (admin)

### Expected API Response Formats

#### Info Endpoint (`/api/info`)
```json
{
  "paragraph1": "First paragraph text...",
  "paragraph2": "Second paragraph text..."
}
```

#### Provas Endpoint (`/api/provas`)
```json
[
  {
    "id": 1,
    "type": "PRATA",
    "dates": "10-11 MAI"
  },
  ...
]
```

#### Classification Endpoint (`/api/classification`)
```json
[
  {
    "position": 1,
    "team": "Equipa A",
    "points": 150,
    "games": 10,
    "wins": 8
  },
  ...
]
```

### Connecting to Your Backend

1. Set your API base URL in `.env`:
```
VITE_API_URL=http://localhost:3000/api
```

2. The app will automatically fetch data from your API
3. If API calls fail, the app will use default/fallback data
4. Check browser console for API error messages

## Responsive Breakpoints

The application is optimized for:
- **Mobile**: < 480px
- **Tablet**: 480px - 768px
- **Desktop**: > 768px

All text, spacing, and components scale appropriately using `clamp()` for fluid typography.

## Customization

### Updating Colors

Main gradient colors are defined in `src/App.css`:
```css
background: linear-gradient(135deg, #5eb5a6 0%, #5a8aa8 50%, #7e5ba3 100%);
```

Button accent color in CSS modules:
```css
border-bottom: 5px solid #f39c12;
```

### Adding New Pages

1. Create new component in `src/pages/`
2. Create associated CSS module
3. Add route in `src/App.jsx`:
```jsx
<Route path="/new-page" element={<NewPage />} />
```

## Technologies Used

- **React** - UI library
- **React Router** - Routing
- **Vite** - Build tool
- **CSS Modules** - Scoped styling
- **Fetch API** - HTTP requests

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## Deployment

### Netlify/Vercel

1. Connect your repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables in hosting platform

### Traditional Hosting

1. Run `npm run build`
2. Upload contents of `dist/` folder to your web server
3. Configure server for SPA routing (redirect all routes to index.html)

## Notes

- Copy your images to `public/images/` directory
- Copy `regulamento.pdf` to `public/` directory if needed
- The app gracefully handles API failures with fallback data
- All API methods include error handling

## License

This project is created for Clube Ténis Espinho.

## Support

For issues or questions, please contact your development team.
