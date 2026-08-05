import { api } from "./client";
import type {
  Curso, Alumno, Inscripcion, Cuota, MetodoPago, Pago,
  Profesor, AsistenciaProfesor, Liquidacion, AsistenciaAlumno, Gasto,
  Balance, DashboardAlertas,
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
  listar: () => api.get<Alumno[]>("/api/alumnos"),
  crear: (data: { dni: string; nombre: string; apellido: string; telefono?: string; email?: string }) =>
    api.post<Alumno>("/api/alumnos", data),
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
  listarAsistencias: (profesorId?: number) =>
    api.get<AsistenciaProfesor[]>(`/api/profesores/asistencias${profesorId ? `?profesor_id=${profesorId}` : ""}`),
  generarLiquidacion: (data: { profesor_id: number; periodo: string }) =>
    api.post<Liquidacion>("/api/profesores/liquidaciones/generar", data),
  listarLiquidaciones: (profesorId?: number) =>
    api.get<Liquidacion[]>(`/api/profesores/liquidaciones${profesorId ? `?profesor_id=${profesorId}` : ""}`),
  marcarLiquidacionPagada: (id: number) =>
    api.post<Liquidacion>(`/api/profesores/liquidaciones/${id}/marcar-pagada`),
};

// ---- Asistencia de alumnos ----
export const AsistenciasAlumnosApi = {
  listar: (inscripcionId?: number) =>
    api.get<AsistenciaAlumno[]>(`/api/asistencias-alumnos${inscripcionId ? `?inscripcion_id=${inscripcionId}` : ""}`),
  cargar: (data: { inscripcion_id: number; fecha: string; presente: boolean }) =>
    api.post<AsistenciaAlumno>("/api/asistencias-alumnos", data),
};

// ---- Gastos y caja ----
export const GastosApi = {
  listar: () => api.get<Gasto[]>("/api/gastos"),
  crear: (data: { categoria: string; descripcion?: string; monto: string; fecha: string; recurrente: boolean }) =>
    api.post<Gasto>("/api/gastos", data),
  balance: (anio: number, mes: number) => api.get<Balance>(`/api/gastos/balance?anio=${anio}&mes=${mes}`),
};

// ---- Dashboard ----
export const DashboardApi = {
  alertas: (diasProximos = 7) => api.get<DashboardAlertas>(`/api/dashboard/alertas?dias_proximos=${diasProximos}`),
};
