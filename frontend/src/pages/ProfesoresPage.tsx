import { useEffect, useState } from "react";
import { ProfesoresApi, CursosApi } from "../api/modules";
import type { Profesor, Curso, AsistenciaProfesor } from "../api/types";
import { Card, CardHeader, Button, Input, Select, Modal, ErrorBanner, EmptyState, Badge } from "../components/ui";
import { formatMoney, formatDate, todayISO } from "../lib/format";
import { useApiList } from "../lib/useApi";

export default function ProfesoresPage() {
  const { data: profesores, error: errorProfesores, reload: cargar } = useApiList<Profesor>(() => ProfesoresApi.listar(), []);
  const { data: cursos, error: errorCursos } = useApiList<Curso>(() => CursosApi.listar(), []);
  const error = errorProfesores || errorCursos;

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Profesor | null>(null);
  const [asistenciaTarget, setAsistenciaTarget] = useState<Profesor | null>(null);
  const [showCargaDia, setShowCargaDia] = useState(false);
  const [verAsistencias, setVerAsistencias] = useState<Profesor | null>(null);
  const [asistencias, setAsistencias] = useState<AsistenciaProfesor[]>([]);
  const [errorAsistencias, setErrorAsistencias] = useState("");

  useEffect(() => {
    if (verAsistencias) {
      ProfesoresApi.listarAsistencias({ profesorId: verAsistencias.id }).then(setAsistencias).catch((e) => setErrorAsistencias(e.message));
    }
  }, [verAsistencias]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Profesores</h2>
          <p className="text-slate-500 text-sm mt-1">Ficha docente, honorarios y carga de asistencia.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowCargaDia(true)}>Cargar asistencia del día</Button>
          <Button onClick={() => setShowCreate(true)}>+ Nuevo profesor</Button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardHeader title="Plantel docente" />
        <div className="divide-y divide-slate-100">
          {profesores.length === 0 && <EmptyState text="Todavía no hay profesores cargados" />}
          {profesores.map((p) => (
            <div key={p.id} className="px-5 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-800">{p.nombre}</p>
                  {!p.activo && <Badge tone="slate">Inactivo</Badge>}
                </div>
                <p className="text-xs text-slate-400">{p.dni ? `DNI ${p.dni} · ` : ""}{formatMoney(p.valor_hora)} / hora</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditTarget(p)}>Editar</Button>
                <Button variant="secondary" onClick={() => setVerAsistencias(p)}>Ver asistencias</Button>
                <Button onClick={() => setAsistenciaTarget(p)}>Cargar asistencia</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <CrearProfesorModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); cargar(); }} />
      <EditarProfesorModal profesor={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); cargar(); }} />
      <CargarAsistenciaModal profesor={asistenciaTarget} cursos={cursos} onClose={() => setAsistenciaTarget(null)} />
      <CargarAsistenciaDiaModal open={showCargaDia} profesores={profesores} cursos={cursos} onClose={() => setShowCargaDia(false)} />

      <Modal open={!!verAsistencias} onClose={() => setVerAsistencias(null)} title={`Asistencias · ${verAsistencias?.nombre ?? ""}`}>
        <div className="space-y-2">
          {errorAsistencias && <ErrorBanner message={errorAsistencias} />}
          {asistencias.length === 0 && <EmptyState text="Sin asistencias cargadas" />}
          {asistencias.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
              <div>
                <p className="font-medium text-slate-800">{formatDate(a.fecha)}</p>
                {a.observacion && <p className="text-xs text-amber-600">{a.observacion}</p>}
              </div>
              <p className="text-slate-600">{a.horas_trabajadas} / {a.horas_asignadas} hs</p>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function CrearProfesorModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [valorHora, setValorHora] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      await ProfesoresApi.crear({ nombre, dni: dni || undefined, valor_hora: valorHora });
      setNombre(""); setDni(""); setValorHora("");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo profesor">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Input label="Nombre completo" value={nombre} onChange={setNombre} required />
        <Input label="DNI" value={dni} onChange={setDni} />
        <Input label="Valor por hora" type="number" step="0.01" value={valorHora} onChange={setValorHora} required />
        <Button className="w-full" onClick={submit} disabled={saving || !nombre || !valorHora}>
          {saving ? "Guardando..." : "Crear profesor"}
        </Button>
      </div>
    </Modal>
  );
}

// Edición de la ficha del profesor: nombre, DNI, valor/hora y estado
// (activo/inactivo). Pensado para corregir errores de tipeo al ingresar los
// datos sin tener que borrar y volver a crear el registro (lo que perdería
// el historial de asistencias y liquidaciones ya asociado a ese profesor).
function EditarProfesorModal({
  profesor, onClose, onSaved,
}: { profesor: Profesor | null; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [valorHora, setValorHora] = useState("");
  const [activo, setActivo] = useState("true");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Cada vez que se abre el modal con un profesor distinto, precarga sus
  // datos actuales en el formulario.
  useEffect(() => {
    if (profesor) {
      setNombre(profesor.nombre);
      setDni(profesor.dni ?? "");
      setValorHora(profesor.valor_hora);
      setActivo(profesor.activo ? "true" : "false");
      setError("");
    }
  }, [profesor]);

  if (!profesor) return null;

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      await ProfesoresApi.modificar(profesor.id, {
        nombre, dni: dni || undefined, valor_hora: valorHora, activo: activo === "true",
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!profesor} onClose={onClose} title={`Editar profesor · ${profesor.nombre}`}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Input label="Nombre completo" value={nombre} onChange={setNombre} required />
        <Input label="DNI" value={dni} onChange={setDni} />
        <Input label="Valor por hora" type="number" step="0.01" value={valorHora} onChange={setValorHora} required />
        <Select
          label="Estado"
          value={activo}
          onChange={setActivo}
          options={[{ value: "true", label: "Activo" }, { value: "false", label: "Inactivo" }]}
          required
        />
        <Button className="w-full" onClick={submit} disabled={saving || !nombre || !valorHora}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </Modal>
  );
}

function CargarAsistenciaModal({ profesor, cursos, onClose }: { profesor: Profesor | null; cursos: Curso[]; onClose: () => void }) {
  const [cursoId, setCursoId] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [horasAsignadas, setHorasAsignadas] = useState("");
  const [horasTrabajadas, setHorasTrabajadas] = useState("");
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  if (!profesor) return null;

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      await ProfesoresApi.cargarAsistencia({
        profesor_id: profesor.id, curso_id: Number(cursoId), fecha,
        horas_asignadas: horasAsignadas, horas_trabajadas: horasTrabajadas, observacion: observacion || undefined,
      });
      setOk(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!profesor} onClose={() => { onClose(); setOk(false); setCursoId(""); setHorasAsignadas(""); setHorasTrabajadas(""); setObservacion(""); }} title={`Cargar asistencia · ${profesor.nombre}`}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        {ok ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">Asistencia cargada correctamente.</div>
        ) : (
          <>
            <Select label="Curso" value={cursoId} onChange={setCursoId} options={cursos.map((c) => ({ value: String(c.id), label: c.nombre }))} required />
            <Input label="Fecha" type="date" value={fecha} onChange={setFecha} required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Horas asignadas" type="number" step="0.5" value={horasAsignadas} onChange={setHorasAsignadas} required />
              <Input label="Horas trabajadas" type="number" step="0.5" value={horasTrabajadas} onChange={setHorasTrabajadas} required />
            </div>
            <Input label="Observación (opcional)" value={observacion} onChange={setObservacion} placeholder="Ej: llegó tarde, inasistencia justificada..." />
            <Button className="w-full" onClick={submit} disabled={saving || !cursoId || !horasAsignadas || !horasTrabajadas}>
              {saving ? "Guardando..." : "Cargar asistencia"}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

// ---- Carga masiva "por día": elegís una fecha y cargás/corregís de una
// las horas de todos los profesores activos para ese día. Reutiliza los
// mismos endpoints que la carga individual: POST para una fila nueva,
// PUT para corregir una que ya existía (evita el error de duplicado y
// permite editarla directamente desde acá).
interface FilaAsistenciaDia {
  cursoId: string;
  horasAsignadas: string;
  horasTrabajadas: string;
  observacion: string;
  existingId: number | null;
  saving: boolean;
  error: string;
  ok: boolean;
}

function CargarAsistenciaDiaModal({
  open, profesores, cursos, onClose,
}: { open: boolean; profesores: Profesor[]; cursos: Curso[]; onClose: () => void }) {
  const [fecha, setFecha] = useState(todayISO());
  const [existentes, setExistentes] = useState<AsistenciaProfesor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filas, setFilas] = useState<Record<number, FilaAsistenciaDia>>({});

  const profesoresActivos = profesores.filter((p) => p.activo);

  const cargarExistentes = (f: string) => {
    setLoading(true); setError("");
    ProfesoresApi.listarAsistencias({ fecha: f })
      .then((data) => {
        setExistentes(data);
        const nuevasFilas: Record<number, FilaAsistenciaDia> = {};
        for (const p of profesoresActivos) {
          const delProfesor = data.filter((a) => a.profesor_id === p.id);
          // Si ya tiene una única asistencia ese día, la mostramos lista para
          // revisar/corregir. Si tiene más de una (varios cursos ese día),
          // se deja en blanco y el usuario elige el curso para verla.
          const base = delProfesor.length === 1 ? delProfesor[0] : null;
          nuevasFilas[p.id] = {
            cursoId: base ? String(base.curso_id) : "",
            horasAsignadas: base ? base.horas_asignadas : "",
            horasTrabajadas: base ? base.horas_trabajadas : "",
            observacion: base?.observacion ?? "",
            existingId: base?.id ?? null,
            saving: false,
            error: "",
            ok: false,
          };
        }
        setFilas(nuevasFilas);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) cargarExistentes(fecha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fecha]);

  const actualizarFila = (profesorId: number, patch: Partial<FilaAsistenciaDia>) => {
    setFilas((prev) => ({ ...prev, [profesorId]: { ...prev[profesorId], ...patch } }));
  };

  // Al elegir el curso, si ese profesor ya tiene una asistencia cargada para
  // ese curso en esa fecha, la mostramos para editar en vez de dejar cargar
  // una segunda (así se cumple la restricción de unicidad del backend).
  const onCursoChange = (profesorId: number, cursoId: string) => {
    const match = existentes.find((a) => a.profesor_id === profesorId && String(a.curso_id) === cursoId);
    actualizarFila(profesorId, {
      cursoId,
      horasAsignadas: match ? match.horas_asignadas : "",
      horasTrabajadas: match ? match.horas_trabajadas : "",
      observacion: match?.observacion ?? "",
      existingId: match?.id ?? null,
      ok: false,
      error: "",
    });
  };

  const guardarFila = async (profesor: Profesor) => {
    const fila = filas[profesor.id];
    if (!fila || !fila.cursoId || !fila.horasAsignadas || !fila.horasTrabajadas) return;
    actualizarFila(profesor.id, { saving: true, error: "", ok: false });
    try {
      if (fila.existingId) {
        await ProfesoresApi.editarAsistencia(fila.existingId, {
          horas_asignadas: fila.horasAsignadas,
          horas_trabajadas: fila.horasTrabajadas,
          observacion: fila.observacion || undefined,
        });
        actualizarFila(profesor.id, { saving: false, ok: true });
      } else {
        const creada = await ProfesoresApi.cargarAsistencia({
          profesor_id: profesor.id, curso_id: Number(fila.cursoId), fecha,
          horas_asignadas: fila.horasAsignadas, horas_trabajadas: fila.horasTrabajadas,
          observacion: fila.observacion || undefined,
        });
        setExistentes((prev) => [...prev, creada]);
        actualizarFila(profesor.id, { saving: false, ok: true, existingId: creada.id });
      }
    } catch (e) {
      actualizarFila(profesor.id, { saving: false, error: (e as Error).message });
    }
  };

  const handleClose = () => {
    onClose();
    setFecha(todayISO());
    setFilas({});
    setExistentes([]);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Cargar asistencia del día">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Input label="Fecha" type="date" value={fecha} onChange={setFecha} required />
        <p className="text-xs text-slate-500">
          Elegí el curso de cada profesor y cargá sus horas. Si ese profesor ya tiene una
          asistencia cargada ese día para ese curso, se muestra lista para corregir en vez
          de duplicarla.
        </p>

        {loading ? (
          <p className="text-center text-slate-500 py-4 text-sm">Cargando...</p>
        ) : profesoresActivos.length === 0 ? (
          <EmptyState text="No hay profesores activos" />
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {profesoresActivos.map((p) => {
              const fila = filas[p.id];
              if (!fila) return null;
              const esEdicion = !!fila.existingId;
              const puedeGuardar = !!fila.cursoId && !!fila.horasAsignadas && !!fila.horasTrabajadas;
              return (
                <div key={p.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-800 text-sm">{p.nombre}</p>
                    {esEdicion && <Badge tone="amber">Ya cargada · editando</Badge>}
                    {fila.ok && <Badge tone="green">Guardada</Badge>}
                  </div>
                  {fila.error && <p className="text-xs text-brand-terra-dark">{fila.error}</p>}
                  <Select
                    label="Curso"
                    value={fila.cursoId}
                    onChange={(v) => onCursoChange(p.id, v)}
                    options={cursos.map((c) => ({ value: String(c.id), label: c.nombre }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Horas asignadas" type="number" step="0.5" value={fila.horasAsignadas} onChange={(v) => actualizarFila(p.id, { horasAsignadas: v, ok: false })} />
                    <Input label="Horas trabajadas" type="number" step="0.5" value={fila.horasTrabajadas} onChange={(v) => actualizarFila(p.id, { horasTrabajadas: v, ok: false })} />
                  </div>
                  <Input label="Observación (opcional)" value={fila.observacion} onChange={(v) => actualizarFila(p.id, { observacion: v, ok: false })} />
                  <Button
                    variant={esEdicion ? "secondary" : "primary"}
                    className="w-full"
                    onClick={() => guardarFila(p)}
                    disabled={!puedeGuardar || fila.saving}
                  >
                    {fila.saving ? "Guardando..." : esEdicion ? "Actualizar" : "Guardar"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <Button variant="secondary" className="w-full" onClick={handleClose}>Cerrar</Button>
      </div>
    </Modal>
  );
}
