import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthProvider } from './context/AuthContext'
import ComparePage from './pages/ComparePage'
import LoginPage from './pages/LoginPage'
import MatchesPage from './pages/MatchesPage'
import MorePage from './pages/MorePage'
import PairDetailPage from './pages/PairDetailPage'
import PairsPage from './pages/PairsPage'
import PlayerPage from './pages/PlayerPage'
import RecordPage from './pages/RecordPage'
import SpecialsPage from './pages/SpecialsPage'
import TablePage from './pages/TablePage'

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<RecordPage />} />
            <Route path="/table" element={<TablePage />} />
            <Route path="/pairs" element={<PairsPage />} />
            <Route path="/pairs/:p1/:p2" element={<PairDetailPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="/specials" element={<SpecialsPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/player/:id" element={<PlayerPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/table" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </HashRouter>
  )
}
