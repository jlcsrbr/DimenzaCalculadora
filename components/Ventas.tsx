"use client";

import { useState, useEffect, useCallback } from "react";
import { getVentas, getVentaItems, deleteVenta } from "@/lib/supabase";
import { decodeMateriales } from "@/lib/calculadora-logica";
import { generarBoleta } from "@/lib/pdf-generator";
import { Venta, VentaItem } from "@/lib/types";

const fmtS = (n: number) => `S/ ${n.toFixed(2)}`;
const fmtFecha = (s?: string) => (s ? new Date(s).toLocaleDateString("es-PE") : "-");

export default function Ventas() {
  const [rows, setRows] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Venta | null>(null);
  const [detalleItems, setDetalleItems] = useState<VentaItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (cl?: string, de?: string, ha?: string) => {
    setLoading(true);
    setError("");
    try {
      setRows(await getVentas(cl, de, ha));
    } catch (e) {
      setError("Error al cargar ventas: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buscar = () =>
    load(filtroCliente || undefined, filtroDesde || undefined, filtroHasta || undefined);
  const limpiarFiltros = () => {
    setFiltroCliente("");
    setFiltroDesde("");
    setFiltroHasta("");
    load();
  };

  const selectedRow = rows.find((r) => r.id === selected);

  const verDetalle = async (venta: Venta) => {
    setDetalle(venta);
    setDetalleItems([]);
    setLoadingItems(true);
    try {
      setDetalleItems(await getVentaItems(venta.id));
    } catch {
      // legacy venta without items
    } finally {
      setLoadingItems(false);
    }
  };

  const exportarPDF = async () => {
    if (!selectedRow) return;
    setExporting(true);
    try {
      const items = await getVentaItems(selectedRow.id);
      await generarBoleta(selectedRow, items);
    } finally {
      setExporting(false);
    }
  };

  const eliminar = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteVenta(selected);
      setSelected(null);
      setConfirmEliminar(false);
      await load(filtroCliente || undefined, filtroDesde || undefined, filtroHasta || undefined);
    } catch (e) {
      setError("Error al eliminar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDeleting(false);
    }
  };

  const inputCls =
    "border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9]";

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-white rounded-lg shadow p-3 flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Cliente</label>
          <input
            className={inputCls}
            placeholder="Buscar cliente..."
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Desde</label>
          <input
            type="date"
            className={inputCls}
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Hasta</label>
          <input
            type="date"
            className={inputCls}
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
          />
        </div>
        <button
          onClick={buscar}
          className="bg-[#2980b9] hover:bg-[#1f618d] text-white text-sm px-4 py-1.5 rounded transition-colors"
        >
          Buscar
        </button>
        <button
          onClick={limpiarFiltros}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm px-4 py-1.5 rounded transition-colors"
        >
          Limpiar
        </button>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => selectedRow && verDetalle(selectedRow)}
            disabled={!selectedRow}
            className="bg-[#1f618d] hover:bg-[#154360] text-white text-sm px-4 py-1.5 rounded transition-colors disabled:opacity-40"
          >
            Ver Detalle
          </button>
          <button
            onClick={exportarPDF}
            disabled={!selectedRow || exporting}
            className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-1.5 rounded transition-colors disabled:opacity-40"
          >
            {exporting ? "Generando..." : "Exportar PDF"}
          </button>
          <button
            onClick={() => setConfirmEliminar(true)}
            disabled={!selected}
            className="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-1.5 rounded transition-colors disabled:opacity-40"
          >
            Eliminar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : error ? (
          <div className="p-4 text-red-600 text-sm">{error}</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No hay ventas registradas.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#2980b9] text-white">
                <th className="p-2 text-left">Sel.</th>
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-left">Descripción</th>
                <th className="p-2 text-left">DNI</th>
                <th className="p-2 text-left">Teléfono</th>
                <th className="p-2 text-right">Costo Base</th>
                <th className="p-2 text-right">Precio Final</th>
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
                      selected === r.id
                        ? "bg-[#ebf5ff]"
                        : i % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50"
                    } hover:bg-[#ebf5ff]`}
                    onClick={() => setSelected(r.id === selected ? null : r.id)}
                    onDoubleClick={() => verDetalle(r)}
                  >
                    <td className="p-2">
                      <input
                        type="radio"
                        checked={selected === r.id}
                        onChange={() => setSelected(r.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="p-2 font-mono text-gray-500">{r.id}</td>
                    <td className="p-2 font-semibold">{r.cliente}</td>
                    <td className="p-2 text-gray-600 max-w-[180px] truncate">
                      {r.usar_resumen && r.descripcion_resumen
                        ? r.descripcion_resumen
                        : descripcion}
                    </td>
                    <td className="p-2">{r.dni || "-"}</td>
                    <td className="p-2">{r.telefono || "-"}</td>
                    <td className="p-2 text-right">{fmtS(r.costo_base)}</td>
                    <td className="p-2 text-right font-bold text-green-700">
                      {fmtS(r.precio_venta)}
                    </td>
                    <td className="p-2 text-gray-500">{fmtFecha(r.fecha_registro)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-base font-bold text-[#1f618d]">Detalle de Venta</h2>
              <button
                onClick={() => setDetalle(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-1 text-sm mb-4">
              <p>
                <span className="font-semibold">ID:</span> {detalle.id}
              </p>
              <p>
                <span className="font-semibold">Cliente:</span> {detalle.cliente}
              </p>
              <p>
                <span className="font-semibold">DNI:</span> {detalle.dni || "-"}
              </p>
              <p>
                <span className="font-semibold">Teléfono:</span> {detalle.telefono || "-"}
              </p>
              <p>
                <span className="font-semibold">Fecha:</span>{" "}
                {fmtFecha(detalle.fecha_registro)}
              </p>
            </div>

            {loadingItems ? (
              <div className="text-center text-gray-400 text-sm py-4">Cargando ítems...</div>
            ) : detalle.usar_resumen ? (
              // Modo resumen
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  Resumen del pedido
                </p>
                <p className="text-sm bg-[#ebf5ff] rounded p-3">
                  {detalle.descripcion_resumen || detalle.descripcion}
                </p>
              </div>
            ) : detalleItems.length > 0 ? (
              // Modo detalle con ítems
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Artículos
                </p>
                <table className="w-full text-xs border rounded overflow-hidden">
                  <thead>
                    <tr className="bg-[#ebf5ff]">
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Artículo</th>
                      <th className="p-2 text-right">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalleItems.map((item, i) => (
                      <tr key={item.id ?? i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="p-2 text-gray-400">{i + 1}</td>
                        <td className="p-2">{item.descripcion}</td>
                        <td className="p-2 text-right font-semibold">
                          {fmtS(item.precio_item)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // Legacy: descripción decodificada
              (() => {
                const { descripcion, materiales } = decodeMateriales(detalle.descripcion);
                return (
                  <>
                    <p className="text-sm mb-2">
                      <span className="font-semibold">Descripción:</span> {descripcion}
                    </p>
                    {materiales.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                          Materiales usados
                        </p>
                        <table className="w-full text-xs border rounded overflow-hidden">
                          <thead>
                            <tr className="bg-[#ebf5ff]">
                              <th className="p-2 text-left">#</th>
                              <th className="p-2 text-right">S/ / kg</th>
                              <th className="p-2 text-right">Gramos</th>
                              <th className="p-2 text-right">Costo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {materiales.map((m, i) => (
                              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                <td className="p-2">{i + 1}</td>
                                <td className="p-2 text-right">{fmtS(m.precio)}</td>
                                <td className="p-2 text-right">{m.gramos} g</td>
                                <td className="p-2 text-right">
                                  {fmtS((m.precio / 1000) * m.gramos)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                );
              })()
            )}

            <div className="border-t pt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-500">Costo Base</p>
                <p className="font-bold">{fmtS(detalle.costo_base)}</p>
              </div>
              <div className="bg-green-50 rounded p-2">
                <p className="text-xs text-gray-500">Precio de Venta</p>
                <p className="font-bold text-green-700">{fmtS(detalle.precio_venta)}</p>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => generarBoleta(detalle, detalleItems)}
                className="bg-[#2980b9] hover:bg-[#1f618d] text-white text-sm px-4 py-2 rounded transition-colors"
              >
                Exportar PDF
              </button>
              <button
                onClick={() => setDetalle(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm px-4 py-2 rounded transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {confirmEliminar && selectedRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-base font-bold text-red-600 mb-2">Eliminar venta</h2>
            <p className="text-sm text-gray-600 mb-1">
              ¿Estás seguro de eliminar esta venta?
            </p>
            <div className="bg-red-50 rounded p-3 text-sm mb-4">
              <p>
                <span className="font-semibold">Cliente:</span> {selectedRow.cliente}
              </p>
              <p>
                <span className="font-semibold">Precio:</span>{" "}
                {fmtS(selectedRow.precio_venta)}
              </p>
              <p>
                <span className="font-semibold">Fecha:</span>{" "}
                {fmtFecha(selectedRow.fecha_registro)}
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmEliminar(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={eliminar}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors disabled:opacity-50"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
