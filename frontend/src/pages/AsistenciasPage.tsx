import { useEffect, useState } from "react";
import { AlumnosApi, CursosApi, InscripcionesApi, AsistenciasAlumnosApi } from "../api/modules";
import type { Alumno, Curso, Inscripcion, AsistenciaAlumno } from "../api/types";
import { Card, CardHeader, Button, Select, Input, ErrorBanner, EmptyState, Badge } from "../components/ui";
import { formatDate, todayISO } from "../lib/format";

export default function AsistenciasPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  
  // Nuevos estados para filtrado por materia y fecha
  const [cursoSeleccionado, setCursoSeleccionado] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  
  // Estado local para los checkboxes del día: { [inscripcionId]: boolean }
  const [asistenciasDelDia, setAsistenciasDelDia] = useState<Record<number, boolean>>({});
  
  // Historial mensual para la tabla
  const [asistenciasMes, setAsistenciasMes] = useState<AsistenciaAlumno[]>([]);
  
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([AlumnosApi.listar(), InscripcionesApi.listar(), CursosApi.listar()])
      .then(([a, i, c]) => { setAlumnos(a); setInscripciones(i); setCursos(c); })
      .catch((e) => setError(e.message));
  }, []);

  // Inscripciones correspondientes al curso seleccionado
  const inscripcionesDelCurso = inscripciones.filter(i => i.curso_id === Number(cursoSeleccionado));

  // Cargar asistencias existentes al cambiar de curso o de fecha
  useEffect(() => {
    if (!cursoSeleccionado) {
      setAsistenciasDelDia({});
      setAsistenciasMes([]);
      return;
    }

    // Inicializamos por defecto todos como presentes (true) para el manejo de checkboxes
    const estadoInicial: Record<number, boolean> = {};
    inscripcionesDelCurso.forEach(ins => {
      estadoInicial[ins.id] = true; // Por defecto presente si no se toca
    });

    // Buscamos los registros guardados para esta fecha y curso
    const cargarDatosFecha = async () => {
      try {
        // Traemos las asistencias de las inscripciones de este curso
        const promesas = inscripcionesDelCurso.map(ins => AsistenciasAlumnosApi.listar(ins.id));
        const resultados = await Promise.all(promesas);
        const todasLasAsistencias = resultados.flat();
        
        setAsistenciasMes(todasLasAsistencias);

        // Filtramos las que corresponden estrictamente a la fecha actual seleccionada
        const mapDia: Record<number, boolean> = { ...estadoInicial };
        todasLasAsistencias.forEach(a => {
          if (a.fecha === fecha) {
            mapDia[a.inscripcion_id] = a.presente;
          }
        });
        setAsistenciasDelDia(mapDia);
      } catch (e) {
        setError((e as Error).message);
      }
    };

    cargarDatosFecha();
  }, [cursoSeleccionado, fecha]);

  // Manejo de cambio de fecha con autoguardado de la fecha anterior
  const handleFechaChange = async (nuevaFecha: string) => {
    if (!cursoSeleccionado || nuevaFecha === fecha) {
      setFecha(nuevaFecha);
      return;
    }

    setSaving(true);
    setError("");
    try {
      // Guardar automáticamente la fecha anterior con el estado actual (los no marcados se van como true/presente)
      const promesasGuardado = inscripcionesDelCurso.map(ins => {
        const estadoPresente = asistenciasDelDia[ins.id] ?? true;
        return AsistenciasAlumnosApi.cargar({
          inscripcion_id: ins.id,
          fecha: fecha, // Fecha vieja
          presente: estadoPresente
        });
      });

      await Promise.all(promesasGuardado);
      setFecha(nuevaFecha); // Actualizamos a la nueva fecha
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const guardarCambiosDia = async () => {
    setSaving(true);
    setError("");
    try {
      const promesas = inscripcionesDelCurso.map(ins => {
        const presente = asistenciasDelDia[ins.id] ?? true;
        return AsistenciasAlumnosApi.cargar({
          inscripcion_id: ins.id,
          fecha,
          presente
        });
      });
      await Promise.all(promesas);
      
      // Recargar historial mensual
      const promesasMes = inscripcionesDelCurso.map(ins => AsistenciasAlumnosApi.listar(ins.id));
      const resultados = await Promise.all(promesasMes);
      setAsistenciasMes(resultados.flat());
      
      alert("Asistencias guardadas correctamente");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const getNombreAlumno = (alumnoId: number) => {
    const al = alumnos.find(a => a.id === alumnoId);
    return al ? `${al.nombre} ${al.apellido}` : "Desconocido";
  };

  // Construir matriz para la tabla mensual
  // Fechas únicas del mes y alumnos del curso
  const fechasUnicas = Array.from(new Set(asistenciasMes.map(a => a.fecha))).sort();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Control de Asistencias por Materia</h2>
        <p className="text-slate-500 text-sm mt-1">Seleccioná una materia para registrar asistencias por lote o ver el resumen mensual.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Selectores de Materia y Fecha */}
      <Card className="p-5 space-y-4">
        <Select
          label="Seleccionar Materia (Curso)"
          value={cursoSeleccionado}
          onChange={setCursoSeleccionado}
          options={[
            ...cursos.map((c) => ({ value: String(c.id), label: c.nombre }))
          ]}
        />

        {cursoSeleccionado && (
          <div className="flex items-end gap-3 pt-2 border-t border-slate-100">
            <Input 
              label="Fecha de clase" 
              type="date" 
              value={fecha} 
              onChange={handleFechaChange} 
            />
            <Button onClick={guardarCambiosDia} disabled={saving}>
              {saving ? "Guardando..." : "Guardar Asistencias del Día"}
            </Button>
          </div>
        )}
      </Card>

      {/* Lista de Alumnos con Checkbox para el día seleccionado */}
      {cursoSeleccionado && (
        <Card>
          <CardHeader title={`Alumnos Inscriptos - Clase del ${formatDate(fecha)}`} />
          <div className="divide-y divide-slate-100">
            {inscripcionesDelCurso.length === 0 && <EmptyState text="No hay alumnos inscriptos en este curso" />}
            {inscripcionesDelCurso.map((ins) => {
              const isPresente = asistenciasDelDia[ins.id] ?? true;
              return (
                <div key={ins.id} className="px-5 py-3 flex items-center justify-between text-sm hover:bg-slate-50">
                  <span className="font-medium text-slate-800">{getNombreAlumno(ins.alumno_id)}</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      checked={isPresente}
                      onChange={(e) => {
                        setAsistenciasDelDia({
                          ...asistenciasDelDia,
                          [ins.id]: e.target.checked
                        });
                      }}
                    />
                    <span className={isPresente ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                      {isPresente ? "Presente" : "Ausente"}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Tabla de Muestra Mensual */}
      {cursoSeleccionado && fechasUnicas.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Muestra Mensual de Asistencias" />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase text-xs border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Alumno</th>
                  {fechasUnicas.map(f => (
                    <th key={f} className="px-3 py-3 text-center">{formatDate(f)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inscripcionesDelCurso.map(ins => (
                  <tr key={ins.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {getNombreAlumno(ins.alumno_id)}
                    </td>
                    {fechasUnicas.map(f => {
                      const registro = asistenciasMes.find(a => a.inscripcion_id === ins.id && a.fecha === f);
                      const estado = registro ? registro.presente : true; // por defecto presente si no hay registro
                      return (
                        <td key={f} className="px-3 py-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${estado ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {estado ? "P" : "A"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
