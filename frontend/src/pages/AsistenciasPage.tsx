import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AlumnosApi, CursosApi, InscripcionesApi, AsistenciasAlumnosApi } from "../api/modules";
import type { Alumno, Curso, Inscripcion, AsistenciaAlumno } from "../api/types";
import { Card, CardHeader, Button, Select, Input, ErrorBanner, EmptyState } from "../components/ui";
import { formatDate, todayISO } from "../lib/format";

export default function AsistenciasPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);

  // Filtrado por materia y fecha
  const [cursoSeleccionado, setCursoSeleccionado] = useState("");
  const [fecha, setFecha] = useState(todayISO());

  // Estado local para los checkboxes del día: { [inscripcionId]: boolean }
  const [asistenciasDelDia, setAsistenciasDelDia] = useState<Record<number, boolean>>({});

  // Historial completo, usado ahora solo para armar el PDF (ya no se renderiza como tabla)
  const [asistenciasMes, setAsistenciasMes] = useState<AsistenciaAlumno[]>([]);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  useEffect(() => {
    Promise.all([AlumnosApi.listar(), InscripcionesApi.listar(), CursosApi.listar()])
      .then(([a, i, c]) => { setAlumnos(a); setInscripciones(i); setCursos(c); })
      .catch((e) => setError(e.message));
  }, []);

  const inscripcionesDelCurso = inscripciones.filter(i => i.curso_id === Number(cursoSeleccionado));

  useEffect(() => {
    if (!cursoSeleccionado) {
      setAsistenciasDelDia({});
      setAsistenciasMes([]);
      return;
    }

    const estadoInicial: Record<number, boolean> = {};
    inscripcionesDelCurso.forEach(ins => {
      estadoInicial[ins.id] = true;
    });

    const cargarDatosFecha = async () => {
      try {
        const promesas = inscripcionesDelCurso.map(ins => AsistenciasAlumnosApi.listar(ins.id));
        const resultados = await Promise.all(promesas);
        const todasLasAsistencias = resultados.flat();

        setAsistenciasMes(todasLasAsistencias);

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

  const handleFechaChange = async (nuevaFecha: string) => {
    if (!cursoSeleccionado || nuevaFecha === fecha) {
      setFecha(nuevaFecha);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const promesasGuardado = inscripcionesDelCurso.map(ins => {
        const estadoPresente = asistenciasDelDia[ins.id] ?? true;
        return AsistenciasAlumnosApi.cargar({
          inscripcion_id: ins.id,
          fecha: fecha,
          presente: estadoPresente
        });
      });

      await Promise.all(promesasGuardado);
      setFecha(nuevaFecha);
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

      // Recargar historial (para que el PDF salga actualizado si se genera después)
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

  const fechasUnicas = Array.from(new Set(asistenciasMes.map(a => a.fecha))).sort();

  const generarPdf = () => {
    if (!cursoSeleccionado || fechasUnicas.length === 0) return;
    setGenerandoPdf(true);
    try {
      const cursoNombre = cursos.find(c => c.id === Number(cursoSeleccionado))?.nombre ?? "Curso";
      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFontSize(14);
      doc.text(`Asistencias - ${cursoNombre}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Generado el ${formatDate(todayISO())}`, 14, 21);

      const head = [["Alumno", ...fechasUnicas.map(f => formatDate(f))]];

      // Usamos "P"/"A" como valor crudo (para la lógica), pero el texto no se
      // dibuja: el tilde y la cruz se pintan a mano con líneas vectoriales en
      // didDrawCell, evitando el glifo "✓" que la fuente por defecto de jsPDF
      // no renderiza bien.
      const body = inscripcionesDelCurso.map(ins => {
        const fila = [getNombreAlumno(ins.alumno_id)];
        fechasUnicas.forEach(f => {
          const registro = asistenciasMes.find(a => a.inscripcion_id === ins.id && a.fecha === f);
          const presente = registro ? registro.presente : true;
          fila.push(presente ? "P" : "A");
        });
        return fila;
      });

      autoTable(doc, {
        head,
        body,
        startY: 27,
        styles: { fontSize: 9, halign: "center", minCellHeight: 8 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
        didParseCell: (data) => {
          // Oculta el texto crudo "P"/"A" en las columnas de fecha; el nombre (columna 0) queda intacto
          if (data.section === "body" && data.column.index > 0) {
            data.cell.text = [];
          }
        },
        didDrawCell: (data) => {
          if (data.section !== "body" || data.column.index === 0) return;

          const presente = data.cell.raw === "P";
          const cx = data.cell.x + data.cell.width / 2;
          const cy = data.cell.y + data.cell.height / 2;

          if (presente) {
            doc.setDrawColor(16, 185, 129);
            doc.setLineWidth(0.7);
            doc.line(cx - 2.2, cy + 0.2, cx - 0.5, cy + 2.2);
            doc.line(cx - 0.5, cy + 2.2, cx + 2.6, cy - 2.4);
          } else {
            doc.setDrawColor(225, 29, 72);
            doc.setLineWidth(0.7);
            doc.line(cx - 2, cy - 2, cx + 2, cy + 2);
            doc.line(cx - 2, cy + 2, cx + 2, cy - 2);
          }
        },
      });

      doc.save(`asistencias_${cursoNombre.replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerandoPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Control de Asistencias por Materia</h2>
        <p className="text-slate-500 text-sm mt-1">Seleccioná una materia para registrar asistencias por lote o exportar el resumen en PDF.</p>
      </div>

      {error && <ErrorBanner message={error} />}

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
            <Button
              onClick={generarPdf}
              disabled={generandoPdf || fechasUnicas.length === 0}
              variant="secondary"
            >
              {generandoPdf ? "Generando..." : "Exportar PDF"}
            </Button>
          </div>
        )}
      </Card>

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
    </div>
  );
}
