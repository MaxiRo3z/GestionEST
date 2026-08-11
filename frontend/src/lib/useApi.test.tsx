import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useApi, useApiList } from "./useApi";

describe("useApi", () => {
  it("carga datos y expone loading/error/data correctamente", async () => {
    const fetcher = vi.fn().mockResolvedValue({ nombre: "Instituto" });
    const { result } = renderHook(() => useApi(fetcher, [], { nombre: "" }));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ nombre: "Instituto" });
    expect(result.current.error).toBe("");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("expone el mensaje de error si el fetcher rechaza", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("Falló la conexión"));
    const { result } = renderHook(() => useApi(fetcher, [], null));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Falló la conexión");
    expect(result.current.data).toBeNull();
  });

  it("reload() vuelve a pedir los datos", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("v1").mockResolvedValueOnce("v2");
    const { result } = renderHook(() => useApi(fetcher, [], ""));

    await waitFor(() => expect(result.current.data).toBe("v1"));

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.data).toBe("v2"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("vuelve a pedir los datos cuando cambian las deps", async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const { rerender } = renderHook(({ dep }) => useApi(fetcher, [dep], []), {
      initialProps: { dep: 1 },
    });

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    rerender({ dep: 2 });

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});

describe("useApiList", () => {
  it("arranca en un array vacío mientras carga", async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);
    const { result } = renderHook(() => useApiList(fetcher, []));
    expect(result.current.data).toEqual([]);
    // Se espera a que termine de resolver para no dejar un setState colgado
    // entre tests (evita el warning de "not wrapped in act").
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
