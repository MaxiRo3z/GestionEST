import { NavLink, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "📊", end: true },
  { to: "/cursos", label: "Cursos y Aranceles", icon: "🎓" },
  { to: "/alumnos", label: "Alumnos e Inscripciones", icon: "🧑‍🎓" },
  { to: "/cobranzas", label: "Cuotas y Cobranzas", icon: "💳" },
  { to: "/profesores", label: "Profesores", icon: "👩‍🏫" },
  { to: "/liquidaciones", label: "Liquidaciones", icon: "🧾" },
  { to: "/asistencias", label: "Asistencia Alumnos", icon: "📋" },
  { to: "/gastos", label: "Gastos y Caja", icon: "💰" },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-slate-800">
          <h1 className="font-bold text-white text-lg leading-tight">Instituto ERP</h1>
          <p className="text-xs text-slate-400 mt-0.5">Estética y Peluquería</p>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-xs text-slate-500 border-t border-slate-800">
          Sistema local · PostgreSQL
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 min-h-screen">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
