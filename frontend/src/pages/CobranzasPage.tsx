import { useEffect, useState } from "react";
import { AlumnosApi, CursosApi, InscripcionesApi, PagosApi } from "../api/modules";
import type { Alumno, Curso, Inscripcion, Cuota, MetodoPago } from "../api/types";
import { Card, Button, Select, Input, Modal, ErrorBanner, Badge, EmptyState } from "../components/ui";
import { formatMoney, formatDate } from "../lib/format";

export default function CobranzasPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  
  // Nuevos estados para la navegación
  const [cursoSeleccionado, setCursoSeleccionado] = useState<string>("");
  const [tabActiva, setTabActiva] = useState<"matriculas" | "cuotas">("matriculas");
  const [nroCuotaSeleccionada, setNroCuotaSeleccionada] = useState<number>(1);
  
  // Estado para almacenar todas las cuotas del curso seleccionado
  const [cuotasDelCurso, setCuotasDelCurso] = useState<Cuota[]>([]);
  
  const [error, setError] = useState("");
  const [pagoTarget, setPagoTarget] = useState<{ tipo: "cuota" | "matricula"; cuota?: Cuota; inscripcion?: Inscripcion; alumnoNombre?: string } | null>(null);

  useEffect(() => {
    Promise.all([AlumnosApi.listar(), InscripcionesApi.listar(), CursosApi.listar(), PagosApi.metodos()])
      .then(([a, i, c, m]) => { setAlumnos(a); setInscripciones(i); setCursos(c); setMetodos(m); })
      .catch((e) => setError(e.message));
  }, []);

  // Cargar todas las cuotas de todas las inscripciones del curso seleccionado
  useEffect(() => {
    if (!cursoSeleccionado) {
      setCuotasDelCurso([]);
      return;
    }

    const cargarCuotasMateria = async () => {
      try {
        const inscripcionesMateria = inscripciones.filter(i => i.curso_id === Number(cursoSeleccionado));
        const promesasCuotas = inscripcionesMateria.map(i => PagosApi.cuotas({ inscripcion_id: i.id }));
        const resultadosCuotas = await Promise.all(promesasCuotas);
        
        // Aplanamos el array de arrays de cuotas en uno solo
        setCuotasDelCurso(resultadosCuotas.flat());
      } catch (e) {
        setError((e as Error).message);
      }
    };

    cargarCuotasMateria();
  }, [cursoSeleccionado, inscripciones]);

  const badgeTone = (estado: string) => (estado === "pagada" ? "green" : estado === "vencida" ? "red" : "amber");

  // Filtros para la vista
  const inscripcionesDelCurso = inscripciones.filter((i) => i.curso_id === Number(cursoSeleccionado));
  const deudoresMatricula = inscripcionesDelCurso.filter((i) => !i.matricula_pagada);
  const cuotasMostradas = cuotasDelCurso.filter(c => c.numero_cuota === nroCuotaSeleccionada);

  const getNombreAlumno = (alumnoId: number) => {
    const alumno = alumnos.find(a => a.id === alumnoId);
    return alumno ? `${alumno.nombre} ${alumno.apellido}` : "Desconocido";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Cobranzas por Materia</h2>
        <p className="text-slate-500 text-sm mt-1">Filtrá por curso para gestionar matrículas pendientes o cobrar cuotas específicas.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Selector de Materia */}
      <Card className="p-5">
        <Select
          label="Seleccionar Curso"
          value={cursoSeleccionado}
          onChange={(val) => { setCursoSeleccionado(val); setNroCuotaSeleccionada(1); }}
          options={[
            ...cursos.map((c) => ({ value: String(c.id), label: c.nombre }))
          ]}
        />
      </Card>

      {cursoSeleccionado && (
        <Card>
          {/* Navegación por pestañas (sin usar botones nativos raros, usando estilos base) */}
          <div className="flex border-b border-slate-200">
            <button 
              className={`flex-1 py-3 text-sm font-medium text-center ${tabActiva === 'matriculas' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setTabActiva('matriculas')}
            >
              Matrículas Pendientes ({deudoresMatricula.length})
            </button>
            <button 
              className={`flex-1 py-3 text-sm font-medium text-center ${tabActiva === 'cuotas' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setTabActiva('cuotas')}
            >
              Gestión de Cuotas
            </button>
          </div>

          <div className="p-0">
            {/* VISTA: MATRÍCULAS */}
            {tabActiva === "matriculas" && (
              <div className="divide-y divide-slate-100">
                {deudoresMatricula.length === 0 && <EmptyState text="No hay alumnos con matrícula pendiente en esta materia" />}
                {deudoresMatricula.map((inscripcion) => (
                  <div key={inscripcion.id} className="px-5 py-4 flex items-center justify-between text-sm hover:bg-slate-50">
                    <div>
                      <p className="font-semibold text-slate-800">{getNombreAlumno(inscripcion.alumno_id)}</p>
                      <p className="text-xs text-slate-500">Inscripto el {formatDate(inscripcion.fecha_inscripcion)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-800">{formatMoney(inscripcion.valor_matricula_congelado)}</span>
                      <Button variant="secondary" onClick={() => setPagoTarget({ tipo: "matricula", inscripcion, alumnoNombre: getNombreAlumno(inscripcion.alumno_id) })}>
                        Cobrar Matrícula
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* VISTA: CUOTAS */}
            {tabActiva === "cuotas" && (
              <div className="flex flex-col">
                {/* Navegador de cuotas */}
                <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
                  <Button variant="secondary" onClick={() => setNroCuotaSeleccionada(prev => Math.max(1, prev - 1))} disabled={nroCuotaSeleccionada <= 1}>
                    &larr; Cuota Anterior
                  </Button>
                  <span className="font-bold text-slate-700">Viendo Cuota #{nroCuotaSeleccionada}</span>
                  <Button variant="secondary" onClick={() => setNroCuotaSeleccionada(prev => prev + 1)}>
                    Cuota Siguiente &rarr;
                  </Button>
                </div>

                {/* Lista de alumnos para esta cuota */}
                <div className="divide-y divide-slate-100">
                  {cuotasMostradas.length === 0 && <EmptyState text={`Ningún alumno tiene generada la cuota #${nroCuotaSeleccionada}`} />}
                  {cuotasMostradas.map((cuota) => {
                    const insc = inscripciones.find(i => i.id === cuota.inscripcion_id);
                    const alumnoName = insc ? getNombreAlumno(insc.alumno_id) : "Desconocido";

                    return (
                      <div key={cuota.id} className="px-5 py-3 flex items-center justify-between text-sm hover:bg-slate-50">
                        <div>
                          <p className="font-semibold text-slate-800">{alumnoName}</p>
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
                            <Button variant="secondary" onClick={() => setPagoTarget({ tipo: "cuota", cuota, alumnoNombre: alumnoName })}>
                              Cobrar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Modal de Pago adaptado */}
      <PagoModal
        target={pagoTarget}
        metodos={metodos}
        onClose={() => setPagoTarget(null)}
        onDone={() => { 
          setPagoTarget(null); 
          InscripcionesApi.listar().then(setInscripciones);
          // Recargar cuotas es gestionado por los useEffects al cambiar 'inscripciones'
        }}
      />
    </div>
  );
}

// Modal (Solo se le agregó el nombre del alumno al título para mayor claridad)
function PagoModal({
  target, metodos, onClose, onDone,
}: {
  target: { tipo: "cuota" | "matricula"; cuota?: Cuota; inscripcion?: Inscripcion; alumnoNombre?: string } | null;
  metodos: MetodoPago[]; onClose: () => void; onDone: () => void;
}) {
  const [metodoId, setMetodoId] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  
  // NUEVO: Estado para guardar el ID del comprobante generado
  const [comprobanteId, setComprobanteId] = useState<number | null>(null);

  if (!target) return null;

  const valorBase = target.tipo === "cuota" ? Number(target.cuota!.valor_actualizado) : Number(target.inscripcion!.valor_matricula_congelado);
  const metodo = metodos.find((m) => m.id === Number(metodoId));
  const recargo = metodo ? (valorBase * Number(metodo.recargo_pct)) / 100 : 0;
  const total = valorBase + recargo;

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      let res;
      if (target.tipo === "cuota") {
        res = await PagosApi.pagarCuota(target.cuota!.id, { metodo_pago_id: Number(metodoId), comprobante_nro: comprobante || undefined });
      } else {
        res = await PagosApi.pagarMatricula({ inscripcion_id: target.inscripcion!.id, metodo_pago_id: Number(metodoId), comprobante_nro: comprobante || undefined });
      }
      setResultado(`Pago registrado por ${formatMoney(total)}.`);
      
      // Capturamos el ID del comprobante que generó el backend
      if (res && res.comprobante_id) {
        setComprobanteId(res.comprobante_id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const titleModal = target.tipo === "cuota" 
    ? `Cobrar cuota #${target.cuota!.numero_cuota} - ${target.alumnoNombre}` 
    : `Cobrar matrícula - ${target.alumnoNombre}`;

  // Función para resetear el modal al cerrar
  const handleClose = () => {
    onClose(); 
    onDone(); 
    setResultado(null); 
    setMetodoId(""); 
    setComprobante("");
    setComprobanteId(null);
  };

  return (
    <Modal open={!!target} onClose={handleClose} title={titleModal}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        
        {resultado ? (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">
              {resultado}
            </div>
            
            {/* NUEVO: Botón de descarga condicional si el backend devolvió el ID */}
            {comprobanteId && (
              <Button 
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900" 
                onClick={() =>window.open(`http://localhost:8000/api/comprobantes/${comprobanteId}/pdf`, '_blank')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                Descargar Comprobante PDF
              </Button>
            )}
            
            <Button variant="secondary" className="w-full" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
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
