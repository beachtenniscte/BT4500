import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Info from './pages/Info';
import Provas from './pages/Provas';
import Classificacao from './pages/Classificacao';
import Profile from './pages/Profile';
import AdminCreateTournament from './pages/AdminCreateTournament';
import AdminImportResults from './pages/AdminImportResults';
import AdminLinkPlayers from './pages/AdminLinkPlayers';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/info" element={<Info />} />
        <Route path="/provas" element={<Provas />} />
        <Route path="/classificacao" element={<Classificacao />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin/create-tournament" element={<AdminCreateTournament />} />
        <Route path="/admin/import-results" element={<AdminImportResults />} />
        <Route path="/admin/link-players" element={<AdminLinkPlayers />} />
      </Routes>
    </Router>
  );
}

export default App;
