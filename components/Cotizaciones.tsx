"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCotizaciones,
  getCotizacionItems,
  insertStockDesdeItems,
  deleteCotizacion,
} from "@/lib/supabase";
import { decodeMateriales } from "@/lib/calculadora-logica";
import { Cotizacion, CotizacionItem } from "@/lib/types";

const fmt = (n: number) => `S/ ${n.toFixed(2)}`;
const fmtFecha = (s?: string) => (s ? new Date(s).toLocaleDateString("es-PE") : "-");

export default function Cotizaciones({ onStockActualizado }: { onStockActualizado: () => void }) {
  const [rows, setRows] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Modal pasar a stock
  const [modalStock, setModalStock] = useState(false);
  const [cotItems, setCotItems] = useState<CotizacionItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [stockForm, setStockForm] = useState<
    Record<string, { precio_venta_sugerido: string; cantidad: string }>
  >({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async (cl?: string, de?: string, ha?: string) => {
    setLoading(true);
    setError("");
    try {
      setRows(await getCotizaciones(cl, de, ha));
    } catch (e) {
      setError("Error al cargar cotizaciones: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const buscar = () => load(filtroCliente || undefined, filtroDesde || undefined, filtroHasta || undefined);
  const limpiarFiltros = () => { setFiltroCliente(""); setFiltroDesde(""); setFiltroHasta(""); load(); };

  const selectedRow = rows.find((r) => r.id === selected);

  const abrirModalStock = async () => {
    if (!selectedRow) return;
    setLoadingItems(true);
    setSaveError("");
    try {
      const items = await getCotizacionItems(selectedRow.id);
      setCotItems(items);

      // Pre-llenar formulario: precio sugerido = inv_con_ganancia, cantidad = 1
      const form: Record<string, { precio_venta_sugerido: string; cantidad: string }> = {};
      if (items.length > 0) {
        items.forEach((item) => {
          const key = item.id ?? item.descripcion;
          form[key] = {
            precio_venta_sugerido: String((item.inv_con_ganancia ?? 0).toFixed(2)),
            cantidad: "1",
          };
        });
      } else {
        // Legacy: cotización sin ítems individuales
        form["__legacy__"] = {
          precio_venta_sugerido: String(selectedRow.inv_con_ganancia.toFixed(2)),
          cantidad: "1",
        };
      }
      setStockForm(form);
      setModalStock(true);
    } catch (e) {
      setError("Error al cargar ítems: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingItems(false);
    }
  };

  const guardarEnStock = async () => {
    if (!selectedRow) return;
    setSaveError("");
    setSaving(true);
    try {
      let items: Array<{
        cotizacion_item_id: string | null;
        descripcion: string;
        precio_costo: number;
        precio_venta_sugerido: number;
        cantidad: number;
      }>;

      if (cotItems.length > 0) {
        items = cotItems.map((item) => {
          const key = item.id ?? item.descripcion;
          const f = stockForm[key] ?? { precio_venta_sugerido: "0", cantidad: "1" };
          return {
            cotizacion_item_id: item.id ?? null,
            descripcion: item.descripcion,
            precio_costo: item.inv_con_ganancia ?? 0,
            precio_venta_sugerido: parseFloat(f.precio_venta_sugerido) || 0,
            cantidad: parseInt(f.cantidad) || 1,
          };
        });
      } else {
        const f = stockForm["__legacy__"] ?? { precio_venta_sugerido: "0", cantidad: "1" };
        const { descripcion } = decodeMateriales(selectedRow.descripcion);
        items = [{
          cotizacion_item_id: null,
          descripcion: descripcion || selectedRow.descripcion,
          precio_costo: selectedRow.inv_con_ganancia,
          precio_venta_sugerido: parseFloat(f.precio_venta_sugerido) || 0,
          cantidad: parseInt(f.cantidad) || 1,
        }];
      }

      await insertStockDesdeItems(selectedRow, items);
      setModalStock(false);
      setSelected(null);
      onStockActualizado();
    } catch (e) {
      setSaveError("Error al guardar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteCotizacion(selected);
      setSelected(null);
      setConfirmEliminar(false);
      await load(filtroCliente || undefined, filtroDesde || undefined, filtroHasta || undefined);
    } catch (e) {
      setError("Error al eliminar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDeleting(false);
    }
  };

  const inputCls = "border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9]";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Main table */}
      <div className="lg:col-span-3 space-y-3">
        {/* Filter bar */}
        <div className="bg-white rounded-lg shadow p-3 flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Cliente</label>
            <input className={inputCls} placeholder="Buscar cliente..." value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Desde</label>
            <input type="date" className={inputCls} value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Hasta</label>
            <input type="date" className={inputCls} value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
          </div>
          <button onClick={buscar} className="bg-[#2980b9] hover:bg-[#1f618d] text-white text-sm px-4 py-1.5 rounded transition-colors">Buscar</button>
          <button onClick={limpiarFiltros} className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm px-4 py-1.5 rounded transition-colors">Limpiar</button>
          <button
            onClick={() => setConfirmEliminar(true)}
            disabled={!selected}
            className="ml-auto bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-1.5 rounded transition-colors disabled:opacity-40"
          >
            Eliminar
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
          ) : error ? (
            <div className="p-4 text-red-600 text-sm">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No hay cotizaciones.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#2980b9] text-white">
                  <th className="p-2 text-left">Sel.</th>
                  <th className="p-2 text-left">ID</th>
                  <th className="p-2 text-left">Cliente</th>
                  <th className="p-2 text-left">Descripción</th>
                  <th className="p-2 text-right">Gramos</th>
                  <th className="p-2 text-right">Min.</th>
                  <th className="p-2 text-right">Sin Margen</th>
                  <th className="p-2 text-right">Con Margen</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const { descripcion } = decodeMateriales(r.descripcion);
                  return (
                    <tr
                      key={r.id}
                      className={`cursor-pointer transition-colors ${
                        selected === r.id ? "bg-[#ebf5ff]" : i % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } hover:bg-[#ebf5ff]`}
                      onClick={() => setSelected(r.id === selected ? null : r.id)}
                    >
                      <td className="p-2">
                        <input type="radio" checked={selected === r.id} onChange={() => setSelected(r.id)} onClick={(e) => e.stopPropagation()} />
                      </td>
                      <td className="p-2 font-mono text-gray-500">{r.id}</td>
                      <td className="p-2 font-semibold">{r.cliente}</td>
                      <td className="p-2 text-gray-600 max-w-[160px] truncate">{descripcion}</td>
                      <td className="p-2 text-right">{r.gramos.toFixed(1)}</td>
                      <td className="p-2 text-right">{r.tiempo}</td>
                      <td className="p-2 text-right">{fmt(r.inv_sin_margen)}</td>
                      <td className="p-2 text-right">{fmt(r.inv_con_margen)}</td>
                      <td className="p-2 text-right font-bold text-[#2980b9]">{fmt(r.inv_con_ganancia)}</td>
                      <td className="p-2 text-gray-500">{fmtFecha(r.fecha_registro)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Panel lateral */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-sm font-bold text-[#1f618d] uppercase mb-3">Pasar a Stock</h2>
        {selectedRow ? (
          <div className="space-y-3">
            <div className="bg-[#ebf5ff] rounded p-3 text-xs space-y-1">
              <p><span className="font-semibold">Cliente:</span> {selectedRow.cliente}</p>
              <p><span className="font-semibold">Total cotizado:</span> {fmt(selectedRow.inv_con_ganancia)}</p>
              <p><span className="font-semibold">Fecha:</span> {fmtFecha(selectedRow.fecha_registro)}</p>
            </div>
            <button
              onClick={abrirModalStock}
              disabled={loadingItems}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded text-sm transition-colors disabled:opacity-50"
            >
              {loadingItems ? "Cargando..." : "Pasar a Stock →"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center mt-4">
            Selecciona una cotización de la tabla.
          </p>
        )}
      </div>

      {/* Modal pasar a stock */}
      {modalStock && selectedRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex justify-between items-center p-5 border-b">
              <div>
                <h2 className="text-base font-bold text-[#1f618d]">Pasar a Stock</h2>
                <p className="text-xs text-gray-500 mt-0.5">Cliente: {selectedRow.cliente}</p>
              </div>
              <button onClick={() => setModalStock(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500">
                Confirma la cantidad producida y el precio de venta sugerido para cada artículo.
              </p>

              {/* Header columnas */}
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 px-1">
                <span className="col-span-5">Artículo</span>
                <span className="col-span-3 text-right">Costo</span>
                <span className="col-span-2 text-right">P. Venta</span>
                <span className="col-span-2 text-right">Cant.</span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {cotItems.length > 0 ? (
                  cotItems.map((item) => {
                    const key = item.id ?? item.descripcion;
                    const f = stockForm[key] ?? { precio_venta_sugerido: "0", cantidad: "1" };
                    return (
                      <div key={key} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded p-2">
                        <span className="col-span-5 text-xs font-semibold text-gray-700 truncate" title={item.descripcion}>
                          {item.descripcion}
                        </span>
                        <span className="col-span-3 text-xs text-gray-400 text-right">
                          {fmt(item.inv_con_ganancia ?? 0)}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="col-span-2 border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2980b9] text-right"
                          value={f.precio_venta_sugerido}
                          onChange={(e) =>
                            setStockForm((prev) => ({
                              ...prev,
                              [key]: { ...f, precio_venta_sugerido: e.target.value },
                            }))
                          }
                        />
                        <input
                          type="number"
                          min="1"
                          className="col-span-2 border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2980b9] text-right"
                          value={f.cantidad}
                          onChange={(e) =>
                            setStockForm((prev) => ({
                              ...prev,
                              [key]: { ...f, cantidad: e.target.value },
                            }))
                          }
                        />
                      </div>
                    );
                  })
                ) : (
                  // Legacy
                  (() => {
                    const f = stockForm["__legacy__"] ?? { precio_venta_sugerido: "0", cantidad: "1" };
                    const { descripcion } = decodeMateriales(selectedRow.descripcion);
                    return (
                      <div className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded p-2">
                        <span className="col-span-5 text-xs font-semibold text-gray-700 truncate">
                          {descripcion || selectedRow.descripcion}
                        </span>
                        <span className="col-span-3 text-xs text-gray-400 text-right">
                          {fmt(selectedRow.inv_con_ganancia)}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="col-span-2 border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2980b9] text-right"
                          value={f.precio_venta_sugerido}
                          onChange={(e) =>
                            setStockForm((prev) => ({ ...prev, __legacy__: { ...f, precio_venta_sugerido: e.target.value } }))
                          }
                        />
                        <input
                          type="number"
                          min="1"
                          className="col-span-2 border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2980b9] text-right"
                          value={f.cantidad}
                          onChange={(e) =>
                            setStockForm((prev) => ({ ...prev, __legacy__: { ...f, cantidad: e.target.value } }))
                          }
                        />
                      </div>
                    );
                  })()
                )}
              </div>

              {saveError && <p className="text-red-600 text-xs">{saveError}</p>}
            </div>

            <div className="flex gap-2 justify-end p-5 border-t">
              <button onClick={() => setModalStock(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded transition-colors">
                Cancelar
              </button>
              <button
                onClick={guardarEnStock}
                disabled={saving}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm rounded transition-colors disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Confirmar Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {confirmEliminar && selectedRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-base font-bold text-red-600 mb-2">Eliminar cotización</h2>
            <p className="text-sm text-gray-600 mb-1">¿Estás seguro de eliminar esta cotización?</p>
            <div className="bg-red-50 rounded p-3 text-sm mb-4">
              <p><span className="font-semibold">Cliente:</span> {selectedRow.cliente}</p>
              <p><span className="font-semibold">Total:</span> {fmt(selectedRow.inv_con_ganancia)}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmEliminar(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded transition-colors">Cancelar</button>
              <button onClick={eliminar} disabled={deleting} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors disabled:opacity-50">
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
