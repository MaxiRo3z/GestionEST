export interface CursoPrecio {
  id: number;
  valor_matricula: string;
  valor_cuota: string;
  vigente_desde: string;
  motivo: string | null;
}

export interface Curso {
  id: number;
  nombre: string;
  duracion_meses: number;
  activo: boolean;
  precio_vigente: CursoPrecio | null;
}

export interface Alumno {
  id: number;
  dni: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  activo?: boolean;
}

export interface Inscripcion {
  id: number;
  alumno_id: number;
  curso_id: number;
  fecha_inscripcion: string;
  matricula_pagada: boolean;
  valor_matricula_congelado: string;
  estado: string;
  comprobante_id?: number
}

export interface Cuota {
  id: number;
  inscripcion_id: number;
  numero_cuota: number;
  fecha_vencimiento: string;
  valor_original: string;
  valor_actualizado: string;
  estado: "pendiente" | "pagada" | "vencida";
  comprobante_id?: number
}

export interface MetodoPago {
  id: number;
  nombre: string;
  recargo_pct: string;
  cuotas_max: number | null;
}

export interface Pago {
  id: number;
  cuota_id: number | null;
  inscripcion_id: number | null;
  metodo_pago_id: number;
  valor_base: string;
  recargo_aplicado: string;
  valor_total: string;
  fecha_pago: string;
  comprobante_nro: string | null;
  tipo: "cuota" | "matricula";
  comprobante_id: number | null;
}

export interface Profesor {
  id: number;
  nombre: string;
  dni: string | null;
  valor_hora: string;
  activo: boolean;
}

export interface AsistenciaProfesor {
  id: number;
  profesor_id: number;
  curso_id: number;
  fecha: string;
  horas_asignadas: string;
  horas_trabajadas: string;
  observacion: string | null;
}

export interface Liquidacion {
  id: number;
  profesor_id: number;
  periodo: string;
  horas_totales: string;
  valor_bruto: string;
  descuentos: string;
  valor_neto: string;
  pagado: boolean;
  fecha_pago: string | null;
}

export interface AsistenciaAlumno {
  id: number;
  inscripcion_id: number;
  fecha: string;
  presente: boolean;
}

export interface Gasto {
  id: number;
  categoria: string;
  descripcion: string | null;
  monto: string;
  fecha: string;
  recurrente: boolean;
}

export interface Balance {
  periodo: string;
  ingresos: number;
  egresos: number;
  resultado: number;
}

export interface AlertaCuota {
  cuota_id: number;
  numero_cuota: number;
  fecha_vencimiento: string;
  valor_actualizado: number;
  alumno: string;
  inscripcion_id: number;
}

export interface AlertaMatricula {
  inscripcion_id: number;
  alumno: string;
  valor: number;
}

export interface AlertaLiquidacion {
  liquidacion_id: number;
  profesor: string;
  periodo: string;
  valor_neto: number;
}

export interface DashboardAlertas {
  cuotas_vencidas: AlertaCuota[];
  cuotas_por_vencer: AlertaCuota[];
  matriculas_pendientes: AlertaMatricula[];
  liquidaciones_pendientes: AlertaLiquidacion[];
  resumen: {
    total_cuotas_vencidas: number;
    total_cuotas_por_vencer: number;
    total_matriculas_pendientes: number;
    total_liquidaciones_pendientes: number;
  };
}

export interface Comprobante {
  id: number;
  tipo: string;
  referencia_id: number;
  alumno_id?: number;
  numero_comprobante: string;
  creado_en: string;
}