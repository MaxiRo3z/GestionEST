import { useEffect, useState } from "react";
import { GastosApi } from "../api/modules";
import type { Gasto, Balance } from "../api/types";
import { Card, CardHeader, Button, Input, Select, Modal, ErrorBanner, Badge, EmptyState } from "../components/ui";
import { formatMoney, formatDate, todayISO } from "../lib/format";

const CATEGORIAS = [
  { value: "alquiler", label: "Alquiler" },
  { value: "servicios", label: "Servicios" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "otro", label: "Otro" },
];

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);

  const cargarGastos = () => GastosApi.listar().then(setGastos).catch((e) => setError(e.message));
  const cargarBalance = (a: number, m: number) =>
    GastosApi.balance(a, m).then(setBalance).catch((e) => setError(e.message));

  useEffect(() => { cargarGastos(); }, []);
  useEffect(() => { cargarBalance(anio, mes); }, [anio, mes]);

  const categoriaTone = (c: string): "amber" | "blue" | "slate" =>
    c === "alquiler" ? "amber" : c === "servicios" ? "blue" : "slate";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gastos Operativos y Caja</h2>
          <p className="text-slate-500 text-sm mt-1">Alquiler, servicios y mantenimiento vs. ingresos por cuotas y matrículas.</p>
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
        <CardHeader title="Gastos registrados" />
        <div className="divide-y divide-slate-100">
          {gastos.length === 0 && <EmptyState text="Todavía no hay gastos cargados" />}
          {gastos.map((g) => (
            <div key={g.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-slate-800">{g.descripcion || g.categoria}</p>
                <p className="text-xs text-slate-400">{formatDate(g.fecha)} {g.recurrente ? "· recurrente" : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={categoriaTone(g.categoria)}>{g.categoria}</Badge>
                <span className="font-semibold text-slate-800">{formatMoney(g.monto)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <CrearGastoModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); cargarGastos(); cargarBalance(anio, mes); }}
      />
    </div>
  );
}

function CrearGastoModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [categoria, setCategoria] = useState("alquiler");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [recurrente, setRecurrente] = useState("false");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      await GastosApi.crear({ categoria, descripcion: descripcion || undefined, monto, fecha, recurrente: recurrente === "true" });
      setDescripcion(""); setMonto("");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Cargar gasto">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Select label="Categoría" value={categoria} onChange={setCategoria} options={CATEGORIAS} required />
        <Input label="Descripción" value={descripcion} onChange={setDescripcion} placeholder="Ej: Alquiler del instituto - agosto" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Monto" type="number" step="0.01" value={monto} onChange={setMonto} required />
          <Input label="Fecha" type="date" value={fecha} onChange={setFecha} required />
        </div>
        <Select label="¿Es recurrente?" value={recurrente} onChange={setRecurrente} options={[{ value: "false", label: "No" }, { value: "true", label: "Sí, todos los meses" }]} />
        <Button className="w-full" onClick={submit} disabled={saving || !monto}>
          {saving ? "Guardando..." : "Cargar gasto"}
        </Button>
      </div>
    </Modal>
  );
}
