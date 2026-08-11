import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ApiError } from "../api/client";

export interface UseApiResult<T> {
  data: T;
  loading: boolean;
  error: string;
  /** Vuelve a pedir los datos (por ejemplo, después de guardar algo en un modal). */
  reload: () => void;
  /** Para actualizar el estado local sin pegarle de nuevo a la API (ej. optimistic update). */
  setData: Dispatch<SetStateAction<T>>;
}

/**
 * Hook genérico de carga de datos: junta en un solo lugar el patrón que se
 * repetía en cada página (useState de data/loading/error + useEffect que
 * llama a la API + .then/.catch/.finally). Antes cada pantalla lo escribía
 * a mano de forma un poco distinta; esto estandariza el comportamiento
 * (incluido cómo se muestra un ApiError) en toda la app.
 *
 * `deps` funciona como en useEffect: cuando cambia, se vuelve a pedir.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[], initialValue: T): UseApiResult<T> {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    fetcherRef
      .current()
      .then((result) => setData(result))
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Ocurrió un error inesperado."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload, setData };
}

/** Atajo para el caso más común: un listado que arranca vacío. */
export function useApiList<T>(fetcher: () => Promise<T[]>, deps: unknown[]): UseApiResult<T[]> {
  return useApi<T[]>(fetcher, deps, []);
}
