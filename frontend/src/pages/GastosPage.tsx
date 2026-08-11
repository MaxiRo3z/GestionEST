import { useEffect, useState } from "react";
import { GastosApi } from "../api/modules";
import type { Gasto, Balance } from "../api/types";
import { Card, CardHeader, Button, Input, Select, Modal, ErrorBanner, Badge, EmptyState } from "../components/ui";
import { formatMoney, formatDate, todayISO } from "../lib/format";
import { useApi } from "../lib/useApi";

const CATEGORIAS = [
  { value: "alquiler", label: "Alquiler" },
  { value: "servicios", label: "Servicios" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "Honorarios Profesores", label: "Honorarios Profesores" }, // Agregado para las liquidaciones
  { value: "otro", label: "Otro" },
];

export default function GastosPage() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);

  const [showCreate, setShowCreate] = useState(false);
  const [gastoAEditar, setGastoAEditar] = useState<Gasto | null>(null);

  const {
    data: { gastos, balance }, error, reload: cargarDatos,
  } = useApi(
    async () => {
      const [gastos, balance] = await Promise.all([GastosApi.listar(anio, mes), GastosApi.balance(anio, mes)]);
      return { gastos, balance };
    },
    [anio, mes],
    { gastos: [] as Gasto[], balance: null as Balance | null },
  );

  const eliminarGasto = async (gasto: Gasto) => {
    const mensaje = gasto.recurrente
      ? "¿Estás seguro de eliminar este gasto? Al ser recurrente, también se eliminarán todos los registros de los meses siguientes."
      : "¿Estás seguro de eliminar este gasto?";

    if (!window.confirm(mensaje)) return;

    try {
      await GastosApi.eliminar(gasto.id);
      cargarDatos();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const categoriaTone = (c: string): "amber" | "blue" | "slate" | "green" => {
    if (c === "alquiler") return "amber";
    if (c === "servicios") return "blue";
    if (c === "Honorarios Profesores") return "green";
    return "slate";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gastos Operativos y Caja</h2>
          <p className="text-slate-500 text-sm mt-1">Alquiler, servicios, honorarios y mantenimiento vs. ingresos.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Cargar gasto</Button>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card className="p-5">
        <div className="flex items-end gap-3 mb-4">
          <Select
            label="Mes"
            value={String(mes)}
            onChange={(v) => setMes(Number(v))}
            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1).padStart(2, "0") }))}
          />
          <Input label="Año" type="number" value={String(anio)} onChange={(v) => setAnio(Number(v) || hoy.getFullYear())} />
        </div>
        
        {balance && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-50 rounded-lg px-4 py-3">
              <p className="text-xs text-emerald-700 font-medium">Ingresos</p>
              <p className="text-xl font-bold text-emerald-700">{formatMoney(balance.ingresos)}</p>
            </div>
            <div className="bg-rose-50 rounded-lg px-4 py-3">
              <p className="text-xs text-rose-700 font-medium">Egresos</p>
              <p className="text-xl font-bold text-rose-700">{formatMoney(balance.egresos)}</p>
            </div>
            <div className={`rounded-lg px-4 py-3 ${balance.resultado >= 0 ? "bg-slate-100" : "bg-rose-100"}`}>
              <p className="text-xs text-slate-600 font-medium">Resultado</p>
              <p className={`text-xl font-bold ${balance.resultado >= 0 ? "text-slate-800" : "text-rose-700"}`}>
                {formatMoney(balance.resultado)}
              </p>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={`Gastos registrados (${mes}/${anio})`} />
        <div className="divide-y divide-slate-100">
          {gastos.length === 0 && <EmptyState text="No hay gastos cargados en este periodo" />}
          {gastos.map((g) => (
            <div key={g.id} className="px-5 py-4 flex items-center justify-between text-sm hover:bg-slate-50">
              <div>
                <p className="font-medium text-slate-800">{g.descripcion || g.categoria}</p>
                <p className="text-xs text-slate-400">
                  {formatDate(g.fecha)} {g.recurrente ? "· Recurrente (Modificar afectará meses futuros)" : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Badge tone={categoriaTone(g.categoria)}>{g.categoria}</Badge>
                <span className="font-semibold text-slate-800">{formatMoney(g.monto)}</span>
                
                {/* Acciones de Edición y Borrado */}
                <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                  <button 
                    onClick={() => setGastoAEditar(g)} 
                    className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                  >
                    Editar
                  </button>
                  <button 
                    onClick={() => eliminarGasto(g)} 
                    className="text-rose-600 hover:text-rose-800 font-medium text-xs"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <GestionarGastoModal
        open={showCreate || !!gastoAEditar}
        gasto={gastoAEditar}
        onClose={() => { setShowCreate(false); setGastoAEditar(null); }}
        onSaved={() => { setShowCreate(false); setGastoAEditar(null); cargarDatos(); }}
      />
    </div>
  );
}

// Unificamos el modal para Crear y Editar
function GestionarGastoModal({ open, gasto, onClose, onSaved }: { open: boolean; gasto: Gasto | null; onClose: () => void; onSaved: () => void }) {
  const [categoria, setCategoria] = useState("alquiler");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [recurrente, setRecurrente] = useState("false");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Precargar datos si es edición
  useEffect(() => {
    if (gasto) {
      setCategoria(gasto.categoria);
      setDescripcion(gasto.descripcion || "");
      setMonto(String(gasto.monto));
      setFecha(gasto.fecha);
      setRecurrente(gasto.recurrente ? "true" : "false");
    } else {
      setCategoria("alquiler");
      setDescripcion("");
      setMonto("");
      setFecha(todayISO());
      setRecurrente("false");
    }
  }, [gasto, open]);

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      const payload = { 
        categoria, 
        descripcion: descripcion || undefined, 
        monto, 
        fecha, 
        recurrente: recurrente === "true" 
      };

      if (gasto) {
        await GastosApi.modificar(gasto.id, payload);
      } else {
        await GastosApi.crear(payload);
      }
      
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isEdicion = !!gasto;

  return (
    <Modal open={open} onClose={onClose} title={isEdicion ? "Modificar gasto" : "Cargar gasto"}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        
        {isEdicion && gasto.recurrente && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded p-3">
            <strong>Atención:</strong> Este es un gasto recurrente. Modificar el monto, categoría o descripción afectará también a todos los meses siguientes.
          </div>
        )}

        <Select label="Categoría" value={categoria} onChange={setCategoria} options={CATEGORIAS} required />
        <Input label="Descripción" value={descripcion} onChange={setDescripcion} placeholder="Ej: Alquiler del instituto - agosto" />
        
        <div className="grid grid-cols-2 gap-3">
          <Input label="Monto" type="number" step="0.01" value={monto} onChange={setMonto} required />
          {/* Si es edición y es recurrente, bloqueamos la fecha para evitar romper la cadena generada */}
          <Input label="Fecha" type="date" value={fecha} onChange={setFecha} required disabled={isEdicion && gasto.recurrente} />
        </div>
        
        <Select 
          label="¿Es recurrente?" 
          value={recurrente} 
          onChange={setRecurrente} 
          options={[{ value: "false", label: "No" }, { value: "true", label: "Sí, todos los meses" }]} 
          disabled={isEdicion} // No permitimos cambiar la recurrencia una vez creado para evitar conflictos de cascada
        />
        
        <Button className="w-full" onClick={submit} disabled={saving || !monto}>
          {saving ? "Guardando..." : isEdicion ? "Guardar cambios" : "Cargar gasto"}
        </Button>
      </div>
    </Modal>
  );
}
