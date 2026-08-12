import { api } from "./client";
import type {
  Curso, Alumno, Inscripcion, Cuota, MetodoPago, Pago,
  Profesor, AsistenciaProfesor, Liquidacion, AsistenciaAlumno, Gasto,
  Balance, DashboardAlertas, Comprobante
} from "./types";

// ---- Cursos ----
export const CursosApi = {
  listar: () => api.get<Curso[]>("/api/cursos"),
  crear: (data: { nombre: string; duracion_meses: number; valor_matricula: string; valor_cuota: string }) =>
    api.post<Curso>("/api/cursos", data),
  ajustarArancel: (cursoId: number, data: { nuevo_valor_cuota: string; motivo: string; nuevo_valor_matricula?: string }) =>
    api.post<{ curso_id: number; nuevo_precio_id: number; cuotas_actualizadas: number }>(
      `/api/cursos/${cursoId}/ajustar-arancel`, data
    ),
};

// ---- Alumnos ----
export const AlumnosApi = {
  // Sin argumentos trae la lista completa (la usan otras pantallas, como
  // Cobranzas, para resolver nombres por id sin tener que paginar).
  listar: () => api.get<Alumno[]>("/api/alumnos"),
  // Con {limit, offset} pagina de verdad: devuelve la página pedida más el
  // total real (para armar "página X de Y"), usado por AlumnosPage.
  listarPaginado: (limit: number, offset: number, activo?: boolean) => {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (activo !== undefined) qs.set("activo", String(activo));
    return api.getWithTotal<Alumno[]>(`/api/alumnos?${qs}`);
  },
  crear: (data: { dni: string; nombre: string; apellido: string; telefono?: string; email?: string }) =>
    api.post<Alumno>("/api/alumnos", data),
  modificar: (id: number, data: { dni: string; nombre: string; apellido: string; telefono?: string; email?: string }) =>
    api.put<Alumno>(`/api/alumnos/${id}`, data),
  eliminar: (id: number) => api.del(`/api/alumnos/${id}`),
};

// ---- Inscripciones ----
export const InscripcionesApi = {
  listar: () => api.get<Inscripcion[]>("/api/inscripciones"),
  crear: (data: { alumno_id: number; curso_id: number; dia_vencimiento: number }) =>
    api.post<Inscripcion>("/api/inscripciones", data),
};

// ---- Pagos / Cuotas / Métodos ----
export const PagosApi = {
  metodos: () => api.get<MetodoPago[]>("/api/pagos/metodos"),
  crearMetodo: (data: { nombre: string; recargo_pct: string; cuotas_max?: number }) =>
    api.post<MetodoPago>("/api/pagos/metodos", data),
  cuotas: (params?: { inscripcion_id?: number; estado?: string }) => {
    const qs = new URLSearchParams();
    if (params?.inscripcion_id) qs.set("inscripcion_id", String(params.inscripcion_id));
    if (params?.estado) qs.set("estado", params.estado);
    const suffix = qs.toString() ? `?${qs}` : "";
    return api.get<Cuota[]>(`/api/pagos/cuotas${suffix}`);
  },
  pagarCuota: (cuotaId: number, data: { metodo_pago_id: number; comprobante_nro?: string }) =>
    api.post<Pago>(`/api/pagos/cuotas/${cuotaId}/pagar`, data),
  pagarMatricula: (data: { inscripcion_id: number; metodo_pago_id: number; comprobante_nro?: string }) =>
    api.post<Pago>("/api/pagos/matricula/pagar", data),
  listarPagos: () => api.get<Pago[]>("/api/pagos"),
  listarPagosPaginado: (limit: number, offset: number) =>
    api.getWithTotal<Pago[]>(`/api/pagos?limit=${limit}&offset=${offset}`),
  marcarVencidas: () => api.post<{ cuotas_marcadas_vencidas: number }>("/api/pagos/marcar-vencidas"),
};

// ---- Profesores / Asistencias / Liquidaciones ----
export const ProfesoresApi = {
  listar: () => api.get<Profesor[]>("/api/profesores"),
  crear: (data: { nombre: string; dni?: string; valor_hora: string }) =>
    api.post<Profesor>("/api/profesores", data),
  cargarAsistencia: (data: {
    profesor_id: number; curso_id: number; fecha: string;
    horas_asignadas: string; horas_trabajadas: string; observacion?: string;
  }) => api.post<AsistenciaProfesor>("/api/profesores/asistencias", data),
  editarAsistencia: (id: number, data: { horas_asignadas: string; horas_trabajadas: string; observacion?: string }) =>
    api.put<AsistenciaProfesor>(`/api/profesores/asistencias/${id}`, data),
  listarAsistencias: (params?: { profesorId?: number; fecha?: string }) => {
    const qs = new URLSearchParams();
    if (params?.profesorId) qs.set("profesor_id", String(params.profesorId));
    if (params?.fecha) qs.set("fecha", params.fecha);
    const suffix = qs.toString() ? `?${qs}` : "";
    return api.get<AsistenciaProfesor[]>(`/api/profesores/asistencias${suffix}`);
  },
  generarLiquidacion: (data: { profesor_id: number; periodo: string }) =>
    api.post<Liquidacion>("/api/profesores/liquidaciones/generar", data),
  listarLiquidaciones: (profesorId?: number) =>
    api.get<Liquidacion[]>(`/api/profesores/liquidaciones${profesorId ? `?profesor_id=${profesorId}` : ""}`),
  marcarLiquidacionPagada: (id: number) =>
    api.post<Liquidacion>(`/api/profesores/liquidaciones/${id}/marcar-pagada`),
  modificarLiquidacion: (id: number, data: { horas_totales: string | number; descuentos: string | number }) => 
    api.put<Liquidacion>(`/api/profesores/liquidaciones/${id}`, data),
};

// ---- Asistencia de alumnos ----
export const AsistenciasAlumnosApi = {
  listar: (inscripcionId?: number) =>
    api.get<AsistenciaAlumno[]>(`/api/asistencias-alumnos${inscripcionId ? `?inscripcion_id=${inscripcionId}` : ""}`),
  cargar: (data: { inscripcion_id: number; fecha: string; presente: boolean; justificada?: boolean }) =>
    api.post<AsistenciaAlumno>("/api/asistencias-alumnos", data),
};

// ---- Gastos y caja ----
export const GastosApi = {
  listar: (anio: number, mes: number) => 
    api.get<Gasto[]>(`/api/gastos?anio=${anio}&mes=${mes}`),
  crear: (data: { categoria: string; descripcion?: string; monto: string; fecha: string; recurrente: boolean }) =>
    api.post<Gasto>("/api/gastos", data),
  modificar: (id: number, data: { categoria: string; descripcion?: string; monto: string; fecha: string; recurrente: boolean }) =>
    api.put<Gasto>(`/api/gastos/${id}`, data),
  eliminar: (id: number) => 
    api.del(`/api/gastos/${id}`),
  balance: (anio: number, mes: number) => 
    api.get<Balance>(`/api/gastos/balance?anio=${anio}&mes=${mes}`),
};

// ---- Dashboard ----
export const DashboardApi = {
  alertas: (diasProximos = 7, cursoId?: number) => {
    const qs = new URLSearchParams({ dias_proximos: String(diasProximos) });
    if (cursoId) qs.set("curso_id", String(cursoId));
    return api.get<DashboardAlertas>(`/api/dashboard/alertas?${qs}`);
  },
};

// Los comprobantes hoy solo se emiten para alumnos (cuota / matrícula); el
// recibo de liquidación docente no se entrega a los profesores por el momento.
export const ComprobantesApi = {
  listarPorAlumno: (alumnoId: number) => api.get<Comprobante[]>(`/api/comprobantes/alumno/${alumnoId}`),
};