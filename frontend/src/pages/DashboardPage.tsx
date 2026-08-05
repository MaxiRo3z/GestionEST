import { useEffect, useState } from "react";
import { DashboardApi } from "../api/modules";
import type { DashboardAlertas } from "../api/types";
import { Card, CardHeader, Badge, EmptyState, ErrorBanner } from "../components/ui";
import { formatMoney, formatDate } from "../lib/format";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardAlertas | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    DashboardApi.alertas(7)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Cargando...</p>;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  const { resumen } = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Panel de Alertas</h2>
        <p className="text-slate-500 text-sm mt-1">Estado general del instituto, actualizado en tiempo real.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Cuotas vencidas" value={resumen.total_cuotas_vencidas} tone="red" />
        <SummaryCard label="Vencen en 7 días" value={resumen.total_cuotas_por_vencer} tone="amber" />
        <SummaryCard label="Matrículas pendientes" value={resumen.total_matriculas_pendientes} tone="blue" />
        <SummaryCard label="Liquidaciones pendientes" value={resumen.total_liquidaciones_pendientes} tone="slate" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Cuotas vencidas" />
          <div className="divide-y divide-slate-100">
            {data.cuotas_vencidas.length === 0 && <EmptyState text="No hay cuotas vencidas 🎉" />}
            {data.cuotas_vencidas.map((c) => (
              <div key={c.cuota_id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-slate-800">{c.alumno}</p>
                  <p className="text-slate-400 text-xs">Cuota #{c.numero_cuota} · venció {formatDate(c.fecha_vencimiento)}</p>
                </div>
                <Badge tone="red">{formatMoney(c.valor_actualizado)}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Vencen próximamente" />
          <div className="divide-y divide-slate-100">
            {data.cuotas_por_vencer.length === 0 && <EmptyState text="Sin vencimientos próximos" />}
            {data.cuotas_por_vencer.map((c) => (
              <div key={c.cuota_id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-slate-800">{c.alumno}</p>
                  <p className="text-slate-400 text-xs">Cuota #{c.numero_cuota} · vence {formatDate(c.fecha_vencimiento)}</p>
                </div>
                <Badge tone="amber">{formatMoney(c.valor_actualizado)}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Matrículas pendientes" />
          <div className="divide-y divide-slate-100">
            {data.matriculas_pendientes.length === 0 && <EmptyState text="Todas las matrículas están pagadas" />}
            {data.matriculas_pendientes.map((m) => (
              <div key={m.inscripcion_id} className="px-5 py-3 flex items-center justify-between text-sm">
                <p className="font-medium text-slate-800">{m.alumno}</p>
                <Badge tone="blue">{formatMoney(m.valor)}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Liquidaciones docentes pendientes" />
          <div className="divide-y divide-slate-100">
            {data.liquidaciones_pendientes.length === 0 && <EmptyState text="No hay liquidaciones pendientes de pago" />}
            {data.liquidaciones_pendientes.map((l) => (
              <div key={l.liquidacion_id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-slate-800">{l.profesor}</p>
                  <p className="text-slate-400 text-xs">Período {l.periodo.slice(0, 7)}</p>
                </div>
                <Badge tone="slate">{formatMoney(l.valor_neto)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "blue" | "slate" }) {
  const colors: Record<string, string> = {
    red: "text-rose-600", amber: "text-amber-600", blue: "text-blue-600", slate: "text-slate-600",
  };
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[tone]}`}>{value}</p>
    </Card>
  );
}
