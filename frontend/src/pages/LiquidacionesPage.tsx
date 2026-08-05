import { useEffect, useState } from "react";
import { ProfesoresApi } from "../api/modules";
import type { Profesor, Liquidacion } from "../api/types";
import { Card, CardHeader, Button, Select, Input, Modal, ErrorBanner, Badge, EmptyState } from "../components/ui";
import { formatMoney } from "../lib/format";

export default function LiquidacionesPage() {
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [error, setError] = useState("");
  const [showGenerar, setShowGenerar] = useState(false);

  const cargar = () => {
    Promise.all([ProfesoresApi.listar(), ProfesoresApi.listarLiquidaciones()])
      .then(([p, l]) => { setProfesores(p); setLiquidaciones(l); })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { cargar(); }, []);

  const profesorNombre = (id: number) => profesores.find((p) => p.id === id)?.nombre ?? `#${id}`;

  const marcarPagada = async (id: number) => {
    try {
      await ProfesoresApi.marcarLiquidacionPagada(id);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Liquidación de Sueldos</h2>
          <p className="text-slate-500 text-sm mt-1">Calculada automáticamente sobre horas trabajadas registradas.</p>
        </div>
        <Button onClick={() => setShowGenerar(true)}>+ Generar liquidación</Button>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardHeader title="Liquidaciones" />
        <div className="divide-y divide-slate-100">
          {liquidaciones.length === 0 && <EmptyState text="Todavía no se generaron liquidaciones" />}
          {liquidaciones.map((l) => (
            <div key={l.id} className="px-5 py-4 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-slate-800">{profesorNombre(l.profesor_id)} · {l.periodo.slice(0, 7)}</p>
                <p className="text-xs text-slate-400">
                  {l.horas_totales} hs trabajadas · Bruto {formatMoney(l.valor_bruto)}
                  {Number(l.descuentos) > 0 && <span className="text-rose-500"> · Descuento {formatMoney(l.descuentos)}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-800">{formatMoney(l.valor_neto)}</span>
                {l.pagado ? (
                  <Badge tone="green">Pagada</Badge>
                ) : (
                  <Button variant="secondary" onClick={() => marcarPagada(l.id)}>Marcar pagada</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <GenerarLiquidacionModal
        open={showGenerar}
        profesores={profesores}
        onClose={() => setShowGenerar(false)}
        onDone={() => { setShowGenerar(false); cargar(); }}
      />
    </div>
  );
}

function GenerarLiquidacionModal({
  open, profesores, onClose, onDone,
}: { open: boolean; profesores: Profesor[]; onClose: () => void; onDone: () => void }) {
  const [profesorId, setProfesorId] = useState("");
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<Liquidacion | null>(null);

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      const res = await ProfesoresApi.generarLiquidacion({ profesor_id: Number(profesorId), periodo: `${periodo}-01` });
      setResultado(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); onDone(); setResultado(null); setProfesorId(""); }} title="Generar liquidación mensual">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        {resultado ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3 space-y-1">
            <p>Liquidación generada: <strong>{formatMoney(resultado.valor_neto)}</strong></p>
            <p className="text-xs">{resultado.horas_totales} hs trabajadas · descuento {formatMoney(resultado.descuentos)}</p>
          </div>
        ) : (
          <>
            <Select label="Profesor" value={profesorId} onChange={setProfesorId} options={profesores.map((p) => ({ value: String(p.id), label: p.nombre }))} required />
            <Input label="Período (mes)" type="month" value={periodo} onChange={setPeriodo} required />
            <p className="text-xs text-slate-500">Se calcula automáticamente sobre las asistencias cargadas ese mes: horas trabajadas × valor hora, con descuento por horas no trabajadas.</p>
            <Button className="w-full" onClick={submit} disabled={saving || !profesorId}>
              {saving ? "Calculando..." : "Generar liquidación"}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
