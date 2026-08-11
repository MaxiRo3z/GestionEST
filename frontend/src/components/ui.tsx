import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
      <h3 className="font-semibold text-brand-gray-dark">{title}</h3>
      {action}
    </div>
  );
}

// Ampliados los tonos del Badge para incluir tu paleta, usando opacidades para los fondos
export function Badge({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "terra" | "gray" | "green" | "red" | "amber" | "blue" | "slate" }) {
  const tones: Record<string, string> = {
    gold: "bg-brand-gold-light/20 text-brand-gold-dark",
    terra: "bg-brand-terra-light/20 text-brand-terra-dark",
    gray: "bg-slate-100 text-brand-gray-dark",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    slate: "bg-slate-200 text-slate-700",
  };
  return <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${tones[tone]}`}>{children}</span>;
}

// Variantes adaptadas a tu paleta
export function Button({
  children, onClick, variant = "primary", type = "button", disabled, className = "",
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit"; disabled?: boolean; className?: string;
}) {
  const variants: Record<string, string> = {
    primary: "bg-brand-gold hover:bg-brand-gold-dark text-white shadow-sm",
    secondary: "bg-brand-gray hover:bg-brand-gray-dark text-white shadow-sm",
    danger: "bg-brand-terra hover:bg-brand-terra-dark text-white shadow-sm",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// Inputs y Selects ahora enfocan con anillos color Dorado
export function Input({
  label, value, onChange, type = "text", placeholder, required, step, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; required?: boolean; step?: string; disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-brand-gray-dark font-semibold">{label}</span>
      <input
        type={type}
        step={step}
        required={required}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-brand-gray-dark placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold transition-shadow disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
      />
    </label>
  );
}

export function Select({
  label, value, onChange, options, required, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean; disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-brand-gray-dark font-semibold">{label}</span>
      <select
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white text-brand-gray-dark focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold transition-shadow disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
      >
        <option value="">Seleccionar...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// El fondo del modal usa brand-gray-dark con opacidad y efecto blur
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-brand-gray-dark/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
          <h3 className="font-bold text-brand-gray-dark">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-brand-terra-dark text-2xl leading-none transition-colors">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// Controles de paginación genéricos: se usan con cualquier listado que
// devuelva {total, page, pageSize} (ver AlumnosApi.listarPaginado / useApi).
export function Pagination({
  page, pageSize, total, onPageChange,
}: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const desde = (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm">
      <span className="text-slate-500">
        Mostrando {desde}–{hasta} de {total}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          &larr; Anterior
        </Button>
        <span className="text-slate-500 px-1">Página {page} de {totalPages}</span>
        <Button variant="secondary" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Siguiente &rarr;
        </Button>
      </div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="text-center text-sm text-slate-400 py-10 font-medium">{text}</div>;
}

// El banner de error adaptado a tu tono Terracota
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-brand-terra-light/10 border border-brand-terra-light/30 text-brand-terra-dark text-sm font-medium rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
      <span className="text-brand-terra">⚠️</span> {message}
    </div>
  );
}
