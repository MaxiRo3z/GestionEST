import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CursosPage from "./pages/CursosPage";
import AlumnosPage from "./pages/AlumnosPage";
import CobranzasPage from "./pages/CobranzasPage";
import ProfesoresPage from "./pages/ProfesoresPage";
import LiquidacionesPage from "./pages/LiquidacionesPage";
import AsistenciasPage from "./pages/AsistenciasPage";
import GastosPage from "./pages/GastosPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Cargando...</div>;
  }
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="/cursos" element={<CursosPage />} />
            <Route path="/alumnos" element={<AlumnosPage />} />
            <Route path="/cobranzas" element={<CobranzasPage />} />
            <Route path="/profesores" element={<ProfesoresPage />} />
            <Route path="/liquidaciones" element={<LiquidacionesPage />} />
            <Route path="/asistencias" element={<AsistenciasPage />} />
            <Route path="/gastos" element={<GastosPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
