import { useEffect, useState } from "react";
import { AlumnosApi, CursosApi, InscripcionesApi, ComprobantesApi } from "../api/modules";
import { BASE_URL } from "../api/client";
import type { Alumno, Curso, Inscripcion, Comprobante } from "../api/types";
import { Card, CardHeader, Button, Input, Select, Modal, ErrorBanner, Badge, EmptyState, Pagination } from "../components/ui";
import { formatMoney } from "../lib/format";
import { useApi, useApiList } from "../lib/useApi";

const PAGE_SIZE = 20;

export default function AlumnosPage() {
  const [page, setPage] = useState(1);

  // Alumnos paginados de verdad (la lista puede crecer indefinidamente).
  const {
    data: alumnosResp, loading: loadingAlumnos, error: errorAlumnos, reload: reloadAlumnos,
  } = useApi(
    () => AlumnosApi.listarPaginado(PAGE_SIZE, (page - 1) * PAGE_SIZE, true),
    [page],
    { data: [] as Alumno[], total: 0 as number | null },
  );
  const alumnosActivos = alumnosResp.data;
  const totalAlumnos = alumnosResp.total ?? 0;

  // Inscripciones y cursos se siguen trayendo completos: hacen falta enteros
  // para resolver nombres/badges de cualquier alumno de cualquier página.
  const { data: inscripciones, error: errorInscripciones, reload: reloadInscripciones } =
    useApiList<Inscripcion>(() => InscripcionesApi.listar(), []);
  const { data: cursos, error: errorCursos } = useApiList<Curso>(() => CursosApi.listar(), []);

  const error = errorAlumnos || errorInscripciones || errorCursos;

  const [showCreateAlumno, setShowCreateAlumno] = useState(false);
  const [alumnoAEditar, setAlumnoAEditar] = useState<Alumno | null>(null);
  const [showInscribir, setShowInscribir] = useState<Alumno | null>(null);

  // NUEVO ESTADO: Para saber de qué alumno estamos viendo los comprobantes
  const [alumnoComprobantes, setAlumnoComprobantes] = useState<Alumno | null>(null);

  const refrescarTodo = () => {
    reloadAlumnos();
    reloadInscripciones();
  };

  // Si se borró el último alumno de la página actual (y no es la primera
  // página), volvemos una página para no quedar mostrando una vacía.
  useEffect(() => {
    if (!loadingAlumnos && alumnosActivos.length === 0 && page > 1) {
      setPage((p) => p - 1);
    }
  }, [loadingAlumnos, alumnosActivos.length, page]);

  const eliminarAlumno = async (alumno: Alumno) => {
    if (!window.confirm(`¿Estás seguro de eliminar a ${alumno.nombre} ${alumno.apellido}? Se borrarán también sus inscripciones y cuotas pendientes.`)) return;

    try {
      await AlumnosApi.eliminar(alumno.id);
      refrescarTodo();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const cursoNombre = (id: number) => cursos.find((c) => c.id === id)?.nombre ?? `Curso #${id}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Alumnos e Inscripciones</h2>
          <p className="text-slate-500 text-sm mt-1">Ficha de alumnos, matrícula y plan de cuotas.</p>
        </div>
        <Button onClick={() => setShowCreateAlumno(true)}>+ Nuevo alumno</Button>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardHeader title="Alumnos" />
        <div className="divide-y divide-slate-100">
          {!loadingAlumnos && alumnosActivos.length === 0 && <EmptyState text="Todavía no hay alumnos cargados" />}
          {alumnosActivos.map((alumno) => {
            const suyas = inscripciones.filter((i) => i.alumno_id === alumno.id);
            return (
              <div key={alumno.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-800">{alumno.nombre} {alumno.apellido}</p>
                    <p className="text-xs text-slate-400">DNI {alumno.dni} {alumno.telefono ? `· ${alumno.telefono}` : ""}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* NUEVO BOTÓN: Ver Comprobantes */}
                    <button 
                      onClick={() => setAlumnoComprobantes(alumno)}
                      className="text-emerald-600 hover:text-emerald-800 font-medium text-xs px-2 py-1"
                    >
                      Ver Comprobantes
                    </button>
                    
                    <button 
                      onClick={() => setAlumnoAEditar(alumno)} 
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs px-2 py-1"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => eliminarAlumno(alumno)} 
                      className="text-rose-600 hover:text-rose-800 font-medium text-xs px-2 py-1 border-r border-slate-200 pr-4 mr-2"
                    >
                      Eliminar
                    </button>
                    <Button variant="secondary" onClick={() => setShowInscribir(alumno)}>Inscribir a curso</Button>
                  </div>
                </div>
                {suyas.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suyas.map((i) => (
                      <Badge key={i.id} tone={i.matricula_pagada ? "green" : "amber"}>
                        {cursoNombre(i.curso_id)} · matrícula {i.matricula_pagada ? "pagada" : "pendiente"} ({formatMoney(i.valor_matricula_congelado)})
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={totalAlumnos} onPageChange={setPage} />
      </Card>

      <GestionarAlumnoModal
        open={showCreateAlumno || !!alumnoAEditar}
        alumno={alumnoAEditar}
        onClose={() => { setShowCreateAlumno(false); setAlumnoAEditar(null); }}
        onSaved={() => { setShowCreateAlumno(false); setAlumnoAEditar(null); refrescarTodo(); }}
      />
      <InscribirModal alumno={showInscribir} cursos={cursos} onClose={() => setShowInscribir(null)} onDone={() => { setShowInscribir(null); refrescarTodo(); }} />
      
      {/* NUEVO MODAL: Historial de Comprobantes */}
      <HistorialComprobantesModal 
        alumno={alumnoComprobantes} 
        onClose={() => setAlumnoComprobantes(null)} 
      />
    </div>
  );
}

// Unificamos el modal para Crear y Editar
function GestionarAlumnoModal({ open, alumno, onClose, onSaved }: { open: boolean; alumno: Alumno | null; onClose: () => void; onSaved: () => void }) {
  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Precargar datos si estamos editando
  useEffect(() => {
    if (alumno) {
      setDni(alumno.dni);
      setNombre(alumno.nombre);
      setApellido(alumno.apellido);
      setTelefono(alumno.telefono || "");
      setEmail(alumno.email || "");
    } else {
      setDni(""); setNombre(""); setApellido(""); setTelefono(""); setEmail("");
    }
  }, [alumno, open]);

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      const payload = { dni, nombre, apellido, telefono: telefono || undefined, email: email || undefined };
      
      if (alumno) {
        await AlumnosApi.modificar(alumno.id, payload);
      } else {
        await AlumnosApi.crear(payload);
      }
      
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isEdicion = !!alumno;

  return (
    <Modal open={open} onClose={onClose} title={isEdicion ? "Modificar alumno" : "Nuevo alumno"}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Input label="DNI" value={dni} onChange={setDni} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre" value={nombre} onChange={setNombre} required />
          <Input label="Apellido" value={apellido} onChange={setApellido} required />
        </div>
        <Input label="Teléfono" value={telefono} onChange={setTelefono} />
        <Input label="Email" type="email" value={email} onChange={setEmail} />
        
        {/* Usamos el mismo truco para deshabilitar el botón si faltan los datos requeridos */}
        <Button className="w-full" onClick={submit} disabled={saving || !dni || !nombre || !apellido}>
          {saving ? "Guardando..." : (isEdicion ? "Guardar cambios" : "Crear alumno")}
        </Button>
      </div>
    </Modal>
  );
}

// ... (El componente InscribirModal queda igual que antes)
function InscribirModal({ alumno, cursos, onClose, onDone }: { alumno: Alumno | null; cursos: Curso[]; onClose: () => void; onDone: () => void }) {
  const [cursoId, setCursoId] = useState("");
  const [diaVencimiento, setDiaVencimiento] = useState("10");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  if (!alumno) return null;

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      await InscripcionesApi.crear({ alumno_id: alumno.id, curso_id: Number(cursoId), dia_vencimiento: Number(diaVencimiento) });
      setOk(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!alumno} onClose={() => { onClose(); onDone(); setOk(false); setCursoId(""); }} title={`Inscribir a ${alumno.nombre} ${alumno.apellido}`}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        {ok ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">
            Inscripción creada. Se generó automáticamente el plan de cuotas mensuales.
          </div>
        ) : (
          <>
            <Select
              label="Curso"
              value={cursoId}
              onChange={setCursoId}
              options= {[...cursos.map((c) => ({ value: String(c.id), label: c.nombre }))]}
              required
            />
            <Input label="Día de vencimiento mensual (1-28)" type="number" value={diaVencimiento} onChange={setDiaVencimiento} required />
            <Button className="w-full" onClick={submit} disabled={saving || !cursoId}>
              {saving ? "Inscribiendo..." : "Confirmar inscripción"}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

// NUEVO COMPONENTE: Modal para ver el historial de comprobantes
function HistorialComprobantesModal({ alumno, onClose }: { alumno: Alumno | null; onClose: () => void; }) {
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (alumno) {
      setLoading(true);
      ComprobantesApi.listarPorAlumno(alumno.id)
        .then(setComprobantes)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [alumno]);

  if (!alumno) return null;

  return (
    <Modal open={!!alumno} onClose={onClose} title={`Comprobantes de ${alumno.nombre} ${alumno.apellido}`}>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {error && <ErrorBanner message={error} />}
        
        {loading ? (
          <p className="text-center text-slate-500 py-4">Cargando historial...</p>
        ) : comprobantes.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-slate-500">Este alumno todavía no tiene comprobantes registrados.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {comprobantes.map((comp) => (
              <div key={comp.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{comp.numero_comprobante}</p>
                  <p className="text-xs text-slate-500">
                    {comp.tipo.toUpperCase()} · Emitido el {new Date(comp.creado_en).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <Button 
                  variant="secondary" 
                  className="text-xs py-1.5 px-3 flex items-center gap-2"
                  onClick={() => window.open(`${BASE_URL}/api/comprobantes/${comp.id}/pdf`, '_blank')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  PDF
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

