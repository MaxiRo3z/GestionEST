import { useEffect, useState } from "react";
import { ProfesoresApi, CursosApi } from "../api/modules";
import type { Profesor, Curso, AsistenciaProfesor } from "../api/types";
import { Card, CardHeader, Button, Input, Select, Modal, ErrorBanner, EmptyState } from "../components/ui";
import { formatMoney, formatDate, todayISO } from "../lib/format";

export default function ProfesoresPage() {
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [asistenciaTarget, setAsistenciaTarget] = useState<Profesor | null>(null);
  const [verAsistencias, setVerAsistencias] = useState<Profesor | null>(null);
  const [asistencias, setAsistencias] = useState<AsistenciaProfesor[]>([]);

  const cargar = () => {
    Promise.all([ProfesoresApi.listar(), CursosApi.listar()])
      .then(([p, c]) => { setProfesores(p); setCursos(c); })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (verAsistencias) {
      ProfesoresApi.listarAsistencias(verAsistencias.id).then(setAsistencias).catch((e) => setError(e.message));
    }
  }, [verAsistencias]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Profesores</h2>
          <p className="text-slate-500 text-sm mt-1">Ficha docente, honorarios y carga de asistencia.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nuevo profesor</Button>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardHeader title="Plantel docente" />
        <div className="divide-y divide-slate-100">
          {profesores.length === 0 && <EmptyState text="Todavía no hay profesores cargados" />}
          {profesores.map((p) => (
            <div key={p.id} className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{p.nombre}</p>
                <p className="text-xs text-slate-400">{p.dni ? `DNI ${p.dni} · ` : ""}{formatMoney(p.valor_hora)} / hora</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setVerAsistencias(p)}>Ver asistencias</Button>
                <Button onClick={() => setAsistenciaTarget(p)}>Cargar asistencia</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <CrearProfesorModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); cargar(); }} />
      <CargarAsistenciaModal profesor={asistenciaTarget} cursos={cursos} onClose={() => setAsistenciaTarget(null)} />

      <Modal open={!!verAsistencias} onClose={() => setVerAsistencias(null)} title={`Asistencias · ${verAsistencias?.nombre ?? ""}`}>
        <div className="space-y-2">
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
