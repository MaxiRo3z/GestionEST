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
  const [liqAEditar, setLiqAEditar] = useState<Liquidacion | null>(null);

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
            <div key={l.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-4 hover:bg-slate-50">
              <div>
                <p className="font-medium text-slate-800">{profesorNombre(l.profesor_id)} · {l.periodo.slice(0, 7)}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {l.horas_totales} hs trabajadas · Bruto {formatMoney(l.valor_bruto)}
                  {Number(l.descuentos) > 0 && <span className="text-rose-500"> · Descuento {formatMoney(l.descuentos)}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-800 text-lg sm:text-sm">{formatMoney(l.valor_neto)}</span>
                {l.pagado ? (
                  <Badge tone="green">Pagada</Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setLiqAEditar(l)} 
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs px-2 py-1"
                    >
                      Editar
                    </button>
                    <Button variant="secondary" onClick={() => marcarPagada(l.id)}>Marcar pagada</Button>
                  </div>
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
      
      <EditarLiquidacionModal 
        liquidacion={liqAEditar}
        // Le pasamos el objeto Profesor entero para poder leer su valor_hora
        profesor={profesores.find(p => p.id === liqAEditar?.profesor_id) || null}
        onClose={() => setLiqAEditar(null)}
        onDone={() => { setLiqAEditar(null); cargar(); }}
      />
    </div>
  );
}

function GenerarLiquidacionModal({ open, profesores, onClose, onDone }: { open: boolean; profesores: Profesor[]; onClose: () => void; onDone: () => void }) {
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
            <Select label="Profesor" value={profesorId} onChange={setProfesorId} options={[{value: "", label: "-- Seleccionar --"}, ...profesores.map((p) => ({ value: String(p.id), label: p.nombre }))]} required />
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

// COMPONENTE DE EDICIÓN ACTUALIZADO (Solo horas):
function EditarLiquidacionModal({ liquidacion, profesor, onClose, onDone }: { liquidacion: Liquidacion | null; profesor: Profesor | null; onClose: () => void; onDone: () => void }) {
  const [horas, setHoras] = useState("");
  const [descuentos, setDescuentos] = useState("");
  
  // Estados para la vista previa (no se envían, solo se muestran)
  const [bruto, setBruto] = useState(0);
  const [neto, setNeto] = useState(0);
  
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (liquidacion) {
      setHoras(String(liquidacion.horas_totales));
      setDescuentos(String(liquidacion.descuentos));
    }
  }, [liquidacion]);

  // Recalcular Bruto y Neto visualmente mientras el usuario escribe
  useEffect(() => {
    if (profesor) {
      const vHoras = parseFloat(horas) || 0;
      const vDesc = parseFloat(descuentos) || 0;
      const vBruto = vHoras * Number(profesor.valor_hora);
      setBruto(vBruto);
      setNeto(vBruto - vDesc);
    }
  }, [horas, descuentos, profesor]);

  if (!liquidacion || !profesor) return null;

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      await ProfesoresApi.modificarLiquidacion(liquidacion.id, {
        horas_totales: horas,
        descuentos: descuentos
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!liquidacion} onClose={onClose} title="Ajustar horas y liquidación">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        
        <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
          Valor actual del profesor: <strong>{formatMoney(profesor.valor_hora)} / hora.</strong><br/>
          Al modificar las horas trabajadas, el bruto y el neto se recalcularán automáticamente usando esta tarifa.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Horas Totales Trabajadas" type="number" step="0.5" value={horas} onChange={setHoras} required />
          <Input label="Descuentos ($)" type="number" step="0.01" value={descuentos} onChange={setDescuentos} required />
        </div>
        
        <div className="flex gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2">
            <div className="flex-1">
                <p className="text-xs text-slate-500">Valor Bruto</p>
                <p className="font-medium text-slate-800">{formatMoney(bruto)}</p>
            </div>
            <div className="flex-1 border-l border-slate-200 pl-4">
                <p className="text-xs text-slate-500">Valor Neto Final</p>
                <p className="font-bold text-emerald-600 text-lg">{formatMoney(neto)}</p>
            </div>
        </div>
        
        <Button className="w-full" onClick={submit} disabled={saving}>
          {saving ? "Guardando..." : "Guardar ajustes"}
        </Button>
      </div>
    </Modal>
  );
}
