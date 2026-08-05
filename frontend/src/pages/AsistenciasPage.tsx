import { useEffect, useState } from "react";
import { AlumnosApi, CursosApi, InscripcionesApi, AsistenciasAlumnosApi } from "../api/modules";
import type { Alumno, Curso, Inscripcion, AsistenciaAlumno } from "../api/types";
import { Card, CardHeader, Button, Select, Input, ErrorBanner, EmptyState, Badge } from "../components/ui";
import { formatDate, todayISO } from "../lib/format";

export default function AsistenciasPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [seleccion, setSeleccion] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [presente, setPresente] = useState("true");
  const [asistencias, setAsistencias] = useState<AsistenciaAlumno[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([AlumnosApi.listar(), InscripcionesApi.listar(), CursosApi.listar()])
      .then(([a, i, c]) => { setAlumnos(a); setInscripciones(i); setCursos(c); })
      .catch((e) => setError(e.message));
  }, []);

  const cargarAsistencias = (inscripcionId: number) => {
    AsistenciasAlumnosApi.listar(inscripcionId).then(setAsistencias).catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (seleccion) cargarAsistencias(Number(seleccion));
    else setAsistencias([]);
  }, [seleccion]);

  const registrar = async () => {
    setError(""); setSaving(true);
    try {
      await AsistenciasAlumnosApi.cargar({ inscripcion_id: Number(seleccion), fecha, presente: presente === "true" });
      cargarAsistencias(Number(seleccion));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Asistencia de Alumnos</h2>
        <p className="text-slate-500 text-sm mt-1">Control de regularidad académica por clase.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card className="p-5 space-y-4">
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
        {seleccion && (
          <div className="flex items-end gap-3">
            <Input label="Fecha" type="date" value={fecha} onChange={setFecha} />
            <Select label="Estado" value={presente} onChange={setPresente} options={[{ value: "true", label: "Presente" }, { value: "false", label: "Ausente" }]} />
            <Button onClick={registrar} disabled={saving}>{saving ? "Guardando..." : "Registrar"}</Button>
          </div>
        )}
      </Card>

      {seleccion && (
        <Card>
          <CardHeader title="Historial" />
          <div className="divide-y divide-slate-100">
            {asistencias.length === 0 && <EmptyState text="Sin asistencias registradas todavía" />}
            {asistencias.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span>{formatDate(a.fecha)}</span>
                <Badge tone={a.presente ? "green" : "red"}>{a.presente ? "Presente" : "Ausente"}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
