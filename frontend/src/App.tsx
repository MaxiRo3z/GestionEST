import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import CursosPage from "./pages/CursosPage";
import AlumnosPage from "./pages/AlumnosPage";
import CobranzasPage from "./pages/CobranzasPage";
import ProfesoresPage from "./pages/ProfesoresPage";
import LiquidacionesPage from "./pages/LiquidacionesPage";
import AsistenciasPage from "./pages/AsistenciasPage";
import GastosPage from "./pages/GastosPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
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
    </BrowserRouter>
  );
}
