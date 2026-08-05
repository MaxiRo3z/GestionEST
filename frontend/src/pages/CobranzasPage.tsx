import { useEffect, useState } from "react";
import { AlumnosApi, CursosApi, InscripcionesApi, PagosApi } from "../api/modules";
import type { Alumno, Curso, Inscripcion, Cuota, MetodoPago } from "../api/types";
import { Card, CardHeader, Button, Select, Input, Modal, ErrorBanner, Badge, EmptyState } from "../components/ui";
import { formatMoney, formatDate } from "../lib/format";

export default function CobranzasPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [seleccion, setSeleccion] = useState<string>("");
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [error, setError] = useState("");
  const [pagoTarget, setPagoTarget] = useState<{ tipo: "cuota" | "matricula"; cuota?: Cuota; inscripcion?: Inscripcion } | null>(null);

  useEffect(() => {
    Promise.all([AlumnosApi.listar(), InscripcionesApi.listar(), CursosApi.listar(), PagosApi.metodos()])
      .then(([a, i, c, m]) => { setAlumnos(a); setInscripciones(i); setCursos(c); setMetodos(m); })
      .catch((e) => setError(e.message));
  }, []);

  const cargarCuotas = (inscripcionId: number) => {
    PagosApi.cuotas({ inscripcion_id: inscripcionId }).then(setCuotas).catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (seleccion) cargarCuotas(Number(seleccion));
    else setCuotas([]);
  }, [seleccion]);

  const inscripcionSeleccionada = inscripciones.find((i) => i.id === Number(seleccion));
  const alumnoSeleccionado = inscripcionSeleccionada && alumnos.find((a) => a.id === inscripcionSeleccionada.alumno_id);
  const cursoSeleccionado = inscripcionSeleccionada && cursos.find((c) => c.id === inscripcionSeleccionada.curso_id);

  const badgeTone = (estado: string) => (estado === "pagada" ? "green" : estado === "vencida" ? "red" : "amber");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Cuotas y Cobranzas</h2>
        <p className="text-slate-500 text-sm mt-1">Elegí una inscripción para ver su plan de pagos y registrar cobros.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card className="p-5">
        <Select
          label="Alumno / Inscripción"
          value={seleccion}
          onChange={setSeleccion}
          options={inscripciones.map((i) => {
            const al = alumnos.find((a) => a.id === i.alumno_id);
            const cu = cursos.find((c) => c.id === i.curso_id);
            return { value: String(i.id), label: `${al ? al.nombre + " " + al.apellido : "?"} · ${cu?.nombre ?? "?"}` };
          })}
        />
      </Card>

      {inscripcionSeleccionada && alumnoSeleccionado && (
        <Card>
          <CardHeader
            title={`${alumnoSeleccionado.nombre} ${alumnoSeleccionado.apellido} · ${cursoSeleccionado?.nombre ?? ""}`}
            action={
              !inscripcionSeleccionada.matricula_pagada ? (
                <Button onClick={() => setPagoTarget({ tipo: "matricula", inscripcion: inscripcionSeleccionada })}>
                  Pagar matrícula ({formatMoney(inscripcionSeleccionada.valor_matricula_congelado)})
                </Button>
              ) : (
                <Badge tone="green">Matrícula pagada</Badge>
              )
            }
          />
          <div className="divide-y divide-slate-100">
            {cuotas.length === 0 && <EmptyState text="Sin cuotas generadas" />}
            {cuotas.map((cuota) => (
              <div key={cuota.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-slate-800">Cuota #{cuota.numero_cuota}</p>
                  <p className="text-xs text-slate-400">
                    Vence {formatDate(cuota.fecha_vencimiento)}
                    {cuota.valor_original !== cuota.valor_actualizado && (
                      <span className="text-amber-600"> · ajustada de {formatMoney(cuota.valor_original)}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-800">{formatMoney(cuota.valor_actualizado)}</span>
                  <Badge tone={badgeTone(cuota.estado)}>{cuota.estado}</Badge>
                  {cuota.estado !== "pagada" && (
                    <Button variant="secondary" onClick={() => setPagoTarget({ tipo: "cuota", cuota })}>Cobrar</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <PagoModal
        target={pagoTarget}
        metodos={metodos}
        onClose={() => setPagoTarget(null)}
        onDone={() => { setPagoTarget(null); if (seleccion) cargarCuotas(Number(seleccion)); InscripcionesApi.listar().then(setInscripciones); }}
      />
    </div>
  );
}

function PagoModal({
  target, metodos, onClose, onDone,
}: {
  target: { tipo: "cuota" | "matricula"; cuota?: Cuota; inscripcion?: Inscripcion } | null;
  metodos: MetodoPago[]; onClose: () => void; onDone: () => void;
}) {
  const [metodoId, setMetodoId] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  if (!target) return null;

  const valorBase = target.tipo === "cuota" ? Number(target.cuota!.valor_actualizado) : Number(target.inscripcion!.valor_matricula_congelado);
  const metodo = metodos.find((m) => m.id === Number(metodoId));
  const recargo = metodo ? (valorBase * Number(metodo.recargo_pct)) / 100 : 0;
  const total = valorBase + recargo;

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      if (target.tipo === "cuota") {
        await PagosApi.pagarCuota(target.cuota!.id, { metodo_pago_id: Number(metodoId), comprobante_nro: comprobante || undefined });
      } else {
        await PagosApi.pagarMatricula({ inscripcion_id: target.inscripcion!.id, metodo_pago_id: Number(metodoId), comprobante_nro: comprobante || undefined });
      }
      setResultado(`Pago registrado por ${formatMoney(total)}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!target} onClose={() => { onClose(); onDone(); setResultado(null); setMetodoId(""); setComprobante(""); }} title={target.tipo === "cuota" ? `Cobrar cuota #${target.cuota!.numero_cuota}` : "Cobrar matrícula"}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        {resultado ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">{resultado}</div>
        ) : (
          <>
            <Select label="Método de pago" value={metodoId} onChange={setMetodoId} options={metodos.map((m) => ({ value: String(m.id), label: `${m.nombre}${Number(m.recargo_pct) > 0 ? ` (+${m.recargo_pct}%)` : ""}` }))} required />
            <Input label="N° de comprobante (opcional)" value={comprobante} onChange={setComprobante} />
            {metodoId && (
              <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Valor base</span><span>{formatMoney(valorBase)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Recargo</span><span>{formatMoney(recargo)}</span></div>
                <div className="flex justify-between font-semibold border-t border-slate-200 pt-1 mt-1"><span>Total a cobrar</span><span>{formatMoney(total)}</span></div>
              </div>
            )}
            <Button className="w-full" onClick={submit} disabled={saving || !metodoId}>
              {saving ? "Registrando..." : "Confirmar cobro"}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
