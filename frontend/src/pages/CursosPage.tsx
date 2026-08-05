import { useEffect, useState } from "react";
import { CursosApi } from "../api/modules";
import type { Curso } from "../api/types";
import { Card, Button, Input, Modal, ErrorBanner, Badge } from "../components/ui";
import { formatMoney } from "../lib/format";

export default function CursosPage() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [ajusteTarget, setAjusteTarget] = useState<Curso | null>(null);

  const cargar = () => CursosApi.listar().then(setCursos).catch((e) => setError(e.message));

  useEffect(() => { cargar(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Cursos y Política de Precios</h2>
          <p className="text-slate-500 text-sm mt-1">Gestioná los cursos y aplicá aumentos sin perder el histórico.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nuevo curso</Button>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 gap-5">
        {cursos.map((curso) => (
          <Card key={curso.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{curso.nombre}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{curso.duracion_meses} meses</p>
              </div>
              <Badge tone={curso.activo ? "green" : "slate"}>{curso.activo ? "Activo" : "Inactivo"}</Badge>
            </div>
            {curso.precio_vigente && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-slate-400 text-xs">Matrícula</p>
                  <p className="font-semibold text-slate-800">{formatMoney(curso.precio_vigente.valor_matricula)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-slate-400 text-xs">Cuota mensual</p>
                  <p className="font-semibold text-slate-800">{formatMoney(curso.precio_vigente.valor_cuota)}</p>
                </div>
              </div>
            )}
            <Button variant="secondary" className="mt-4 w-full" onClick={() => setAjusteTarget(curso)}>
              Aplicar ajuste de arancel
            </Button>
          </Card>
        ))}
        {cursos.length === 0 && <p className="text-slate-400 text-sm">Todavía no hay cursos cargados.</p>}
      </div>

      <CrearCursoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); cargar(); }} />
      <AjustarArancelModal curso={ajusteTarget} onClose={() => setAjusteTarget(null)} onDone={() => { setAjusteTarget(null); cargar(); }} />
    </div>
  );
}

function CrearCursoModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [nombre, setNombre] = useState("");
  const [duracion, setDuracion] = useState("12");
  const [matricula, setMatricula] = useState("");
  const [cuota, setCuota] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      await CursosApi.crear({ nombre, duracion_meses: Number(duracion), valor_matricula: matricula, valor_cuota: cuota });
      setNombre(""); setDuracion("12"); setMatricula(""); setCuota("");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo curso">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Input label="Nombre del curso" value={nombre} onChange={setNombre} placeholder="Curso Completo de Estética y Peluquería" required />
        <Input label="Duración (meses)" type="number" value={duracion} onChange={setDuracion} required />
        <Input label="Valor matrícula" type="number" step="0.01" value={matricula} onChange={setMatricula} required />
        <Input label="Valor cuota mensual" type="number" step="0.01" value={cuota} onChange={setCuota} required />
        <Button className="w-full" onClick={submit} disabled={saving || !nombre || !matricula || !cuota}>
          {saving ? "Guardando..." : "Crear curso"}
        </Button>
      </div>
    </Modal>
  );
}

function AjustarArancelModal({ curso, onClose, onDone }: { curso: Curso | null; onClose: () => void; onDone: () => void }) {
  const [nuevoValor, setNuevoValor] = useState("");
  const [motivo, setMotivo] = useState("Ajuste inflacionario");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  if (!curso) return null;

  const submit = async () => {
    setError(""); setSaving(true); setResultado(null);
    try {
      const res = await CursosApi.ajustarArancel(curso.id, { nuevo_valor_cuota: nuevoValor, motivo });
      setResultado(`Se actualizaron ${res.cuotas_actualizadas} cuotas pendientes. Las cuotas ya pagadas no se modificaron.`);
      setNuevoValor("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!curso} onClose={() => { onClose(); onDone(); }} title={`Ajustar arancel · ${curso.nombre}`}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        {resultado && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">{resultado}</div>}
        <p className="text-xs text-slate-500">
          Valor actual de cuota: <strong>{curso.precio_vigente ? formatMoney(curso.precio_vigente.valor_cuota) : "-"}</strong>.
          Este ajuste solo afecta cuotas pendientes o vencidas; las cuotas ya pagadas mantienen su valor histórico.
        </p>
        <Input label="Nuevo valor de cuota" type="number" step="0.01" value={nuevoValor} onChange={setNuevoValor} required />
        <Input label="Motivo" value={motivo} onChange={setMotivo} />
        <Button className="w-full" onClick={submit} disabled={saving || !nuevoValor}>
          {saving ? "Aplicando..." : "Aplicar ajuste"}
        </Button>
      </div>
    </Modal>
  );
}
