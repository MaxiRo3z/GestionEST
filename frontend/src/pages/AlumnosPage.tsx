import { useEffect, useState } from "react";
import { AlumnosApi, CursosApi, InscripcionesApi } from "../api/modules";
import type { Alumno, Curso, Inscripcion } from "../api/types";
import { Card, CardHeader, Button, Input, Select, Modal, ErrorBanner, Badge, EmptyState } from "../components/ui";
import { formatMoney } from "../lib/format";

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [error, setError] = useState("");
  const [showCreateAlumno, setShowCreateAlumno] = useState(false);
  const [showInscribir, setShowInscribir] = useState<Alumno | null>(null);

  const cargarTodo = () => {
    Promise.all([AlumnosApi.listar(), InscripcionesApi.listar(), CursosApi.listar()])
      .then(([a, i, c]) => { setAlumnos(a); setInscripciones(i); setCursos(c); })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { cargarTodo(); }, []);

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
          {alumnos.length === 0 && <EmptyState text="Todavía no hay alumnos cargados" />}
          {alumnos.map((alumno) => {
            const suyas = inscripciones.filter((i) => i.alumno_id === alumno.id);
            return (
              <div key={alumno.id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{alumno.nombre} {alumno.apellido}</p>
                    <p className="text-xs text-slate-400">DNI {alumno.dni} {alumno.telefono ? `· ${alumno.telefono}` : ""}</p>
                  </div>
                  <Button variant="secondary" onClick={() => setShowInscribir(alumno)}>Inscribir a curso</Button>
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
      </Card>

      <CrearAlumnoModal open={showCreateAlumno} onClose={() => setShowCreateAlumno(false)} onCreated={() => { setShowCreateAlumno(false); cargarTodo(); }} />
      <InscribirModal alumno={showInscribir} cursos={cursos} onClose={() => setShowInscribir(null)} onDone={() => { setShowInscribir(null); cargarTodo(); }} />
    </div>
  );
}

function CrearAlumnoModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(""); setSaving(true);
    try {
      await AlumnosApi.crear({ dni, nombre, apellido, telefono: telefono || undefined, email: email || undefined });
      setDni(""); setNombre(""); setApellido(""); setTelefono(""); setEmail("");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo alumno">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Input label="DNI" value={dni} onChange={setDni} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre" value={nombre} onChange={setNombre} required />
          <Input label="Apellido" value={apellido} onChange={setApellido} required />
        </div>
        <Input label="Teléfono" value={telefono} onChange={setTelefono} />
        <Input label="Email" type="email" value={email} onChange={setEmail} />
        <Button className="w-full" onClick={submit} disabled={saving || !dni || !nombre || !apellido}>
          {saving ? "Guardando..." : "Crear alumno"}
        </Button>
      </div>
    </Modal>
  );
}

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
              options={cursos.map((c) => ({ value: String(c.id), label: c.nombre }))}
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
