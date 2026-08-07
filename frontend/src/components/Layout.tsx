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
      {/* Fondo del menú actualizado a tu variable de gris oscuro */}
      <aside className="w-64 bg-brand-gray-dark text-slate-200 flex flex-col shrink-0 shadow-xl z-10">
        
        {/* Cabecera con Logo y Títulos integrando dorados y terracotas */}
        <div className="px-4 py-6 border-b border-brand-gray flex flex-col items-center text-center gap-3">
          <img 
            src="/logo.ico" 
            alt="Logo Instituto" 
            className="w-30 h-30 object-contain rounded-xl bg-white p-1 shadow-lg" 
          />
          <div>
            <h1 className="font-bold text-brand-gold-light text-lg leading-tight uppercase tracking-wide">
              Instituto Profesional
            </h1>
            <p className="text-sm text-brand-terra-light mt-0.5 font-medium tracking-widest uppercase">
              de Estilismo
            </p>
          </div>
        </div>
        
        {/* Navegación con estados hover (brand-gray) y activo (brand-gold) */}
        <nav className="flex-1 py-6 space-y-1.5 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? "bg-brand-gold text-white shadow-md" 
                    : "text-slate-300 hover:bg-brand-gray hover:text-brand-gold-light"
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        
        <div className="px-5 py-4 text-xs text-slate-400 bg-brand-gray-dark border-t border-brand-gray text-center font-medium opacity-50">
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
