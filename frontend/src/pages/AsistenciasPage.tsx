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

  // Estado local para "ausencia justificada" del día: { [inscripcionId]: boolean }
  // Solo tiene sentido cuando el alumno está marcado ausente.
  const [justificadasDelDia, setJustificadasDelDia] = useState<Record<number, boolean>>({});

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
      setJustificadasDelDia({});
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
        const mapJustificada: Record<number, boolean> = {};
        todasLasAsistencias.forEach(a => {
          if (a.fecha === fecha) {
            mapDia[a.inscripcion_id] = a.presente;
            mapJustificada[a.inscripcion_id] = a.justificada;
          }
        });
        setAsistenciasDelDia(mapDia);
        setJustificadasDelDia(mapJustificada);
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
          presente: estadoPresente,
          justificada: estadoPresente ? false : (justificadasDelDia[ins.id] ?? false)
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
          presente,
          justificada: presente ? false : (justificadasDelDia[ins.id] ?? false)
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
      const pageWidth = doc.internal.pageSize.getWidth();
      const generadoEl = formatDate(todayISO());

      // ---- Encabezado ----
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidth, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text("Instituto Profesional", 14, 10);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Planilla de Asistencias — ${cursoNombre}`, 14, 17);
      doc.setFontSize(9);
      doc.text(`Generado el ${generadoEl}`, pageWidth - 14, 10, { align: "right" });
      doc.text(`${inscripcionesDelCurso.length} alumno(s) — ${fechasUnicas.length} clase(s)`, pageWidth - 14, 17, { align: "right" });
      doc.setTextColor(0, 0, 0);

      // ---- Leyenda ----
      const drawCheck = (x: number, y: number, color: [number, number, number]) => {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.6);
        doc.line(x - 2, y + 0.3, x - 0.4, y + 2);
        doc.line(x - 0.4, y + 2, x + 2.2, y - 2);
      };
      const drawX = (x: number, y: number, color: [number, number, number]) => {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.6);
        doc.line(x - 1.8, y - 1.8, x + 1.8, y + 1.8);
        doc.line(x - 1.8, y + 1.8, x + 1.8, y - 1.8);
      };
      const legendY = 29;
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      drawCheck(16, legendY, [16, 185, 129]);
      doc.text("Presente", 20, legendY + 1);
      drawX(56, legendY, [225, 29, 72]);
      doc.text("Ausente", 60, legendY + 1);
      drawX(96, legendY, [217, 119, 6]);
      doc.text("Ausencia justificada", 100, legendY + 1);
      doc.setTextColor(0, 0, 0);

      const head = [["Alumno", ...fechasUnicas.map(f => formatDate(f)), "Presentes", "Ausentes", "Justif."]];

      // Código crudo por celda de fecha: "P" (presente), "A" (ausente) o "AJ" (ausente
      // justificada). El texto no se dibuja: el tilde y la cruz se pintan a mano con
      // líneas vectoriales en didDrawCell, evitando glifos que la fuente por defecto
      // de jsPDF no renderiza bien.
      const body = inscripcionesDelCurso.map(ins => {
        let presentes = 0, ausentes = 0, justificadas = 0;
        const celdasFecha = fechasUnicas.map(f => {
          const registro = asistenciasMes.find(a => a.inscripcion_id === ins.id && a.fecha === f);
          const presente = registro ? registro.presente : true;
          const justificada = registro ? registro.justificada : false;
          if (presente) {
            presentes++;
            return "P";
          }
          ausentes++;
          if (justificada) {
            justificadas++;
            return "AJ";
          }
          return "A";
        });
        return [getNombreAlumno(ins.alumno_id), ...celdasFecha, String(presentes), String(ausentes), String(justificadas)];
      });

      const primeraColSummary = 1 + fechasUnicas.length;

      autoTable(doc, {
        head,
        body,
        startY: 34,
        theme: "grid",
        styles: { fontSize: 8.5, halign: "center", minCellHeight: 8, lineColor: [203, 213, 225], lineWidth: 0.1 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold", cellWidth: 42 },
          [primeraColSummary]: { fontStyle: "bold", textColor: [16, 185, 129] },
          [primeraColSummary + 1]: { fontStyle: "bold", textColor: [225, 29, 72] },
          [primeraColSummary + 2]: { fontStyle: "bold", textColor: [217, 119, 6] },
        },
        didParseCell: (data) => {
          // Oculta el texto crudo de las columnas de fecha (nombre y resumen quedan intactos)
          if (data.section === "body" && data.column.index > 0 && data.column.index < primeraColSummary) {
            data.cell.text = [];
          }
        },
        didDrawCell: (data) => {
          if (data.section !== "body" || data.column.index === 0 || data.column.index >= primeraColSummary) return;

          const raw = data.cell.raw;
          const cx = data.cell.x + data.cell.width / 2;
          const cy = data.cell.y + data.cell.height / 2;

          if (raw === "P") {
            drawCheck(cx, cy, [16, 185, 129]);
          } else if (raw === "AJ") {
            drawX(cx, cy, [217, 119, 6]);
          } else {
            drawX(cx, cy, [225, 29, 72]);
          }
        },
      });

      // ---- Pie de página con numeración ----
      const totalPaginas = doc.getNumberOfPages();
      for (let i = 1; i <= totalPaginas; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Sistema de Gestión — Instituto Profesional", 14, pageHeight - 7);
        doc.text(`Página ${i} de ${totalPaginas}`, pageWidth - 14, pageHeight - 7, { align: "right" });
      }

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
              const isJustificada = justificadasDelDia[ins.id] ?? false;
              return (
                <div key={ins.id} className="px-5 py-3 flex items-center justify-between text-sm hover:bg-slate-50">
                  <span className="font-medium text-slate-800">{getNombreAlumno(ins.alumno_id)}</span>
                  <div className="flex items-center gap-4">
                    {!isPresente && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                          checked={isJustificada}
                          onChange={(e) => {
                            setJustificadasDelDia({
                              ...justificadasDelDia,
                              [ins.id]: e.target.checked
                            });
                          }}
                        />
                        <span className="text-amber-600 font-medium">Ausencia justificada</span>
                      </label>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        checked={isPresente}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setAsistenciasDelDia({
                            ...asistenciasDelDia,
                            [ins.id]: checked
                          });
                          if (checked) {
                            // Si vuelve a estar presente, la justificación deja de aplicar
                            setJustificadasDelDia({
                              ...justificadasDelDia,
                              [ins.id]: false
                            });
                          }
                        }}
                      />
                      <span className={isPresente ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                        {isPresente ? "Presente" : "Ausente"}
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
