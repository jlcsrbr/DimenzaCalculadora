"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCotizaciones,
  getCotizacionItems,
  insertVenta,
  insertVentaConItems,
  deleteCotizacion,
} from "@/lib/supabase";
import { decodeMateriales } from "@/lib/calculadora-logica";
import { Cotizacion, CotizacionItem, CotizacionItemMaterial, VentaItem } from "@/lib/types";

const fmt = (n: number) => `S/ ${n.toFixed(2)}`;
const fmtFecha = (s?: string) => (s ? new Date(s).toLocaleDateString("es-PE") : "-");

export default function Cotizaciones({ onVentaGuardada }: { onVentaGuardada: () => void }) {
  const [rows, setRows] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Modal cerrar venta
  const [modalVenta, setModalVenta] = useState(false);
  const [ventaItems, setVentaItems] = useState<CotizacionItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [preciosPorItem, setPreciosPorItem] = useState<Record<string, string>>({});
  const [precioLegacy, setPrecioLegacy] = useState("");
  const [totalOverride, setTotalOverride] = useState("");
  const [usarResumen, setUsarResumen] = useState(false);
  const [resumenTexto, setResumenTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(
    async (cl?: string, de?: string, ha?: string) => {
      setLoading(true);
      setError("");
      try {
        setRows(await getCotizaciones(cl, de, ha));
      } catch (e) {
        setError("Error al cargar cotizaciones: " + (e instanceof Error ? e.message : String(e)));
      } finally {
        setLoading(false);
      }
    },
    []
  );

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

  const abrirModalVenta = async () => {
    if (!selectedRow) return;
    setLoadingItems(true);
    setSaveError("");
    setPaso(1);
    setUsarResumen(false);
    setResumenTexto("");
    setTotalOverride("");
    try {
      const items = await getCotizacionItems(selectedRow.id);
      setVentaItems(items);
      if (items.length > 0) {
        const precios: Record<string, string> = {};
        items.forEach((item) => {
          if (item.id) precios[item.id] = String((item.inv_con_ganancia ?? 0).toFixed(2));
        });
        setPreciosPorItem(precios);
      } else {
        setPrecioLegacy(String(selectedRow.inv_con_ganancia.toFixed(2)));
      }
      setModalVenta(true);
    } catch (e) {
      setError("Error al cargar ítems: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingItems(false);
    }
  };

  const cerrarModal = () => {
    setModalVenta(false);
    setSaveError("");
  };

  const sumaItems = ventaItems.reduce((s, item) => {
    return s + (parseFloat(preciosPorItem[item.id ?? ""] ?? "0") || 0);
  }, 0);
  const totalVenta = totalOverride ? parseFloat(totalOverride) || 0 : sumaItems;

  const guardarVenta = async () => {
    if (!selectedRow) return;
    setSaveError("");
    setSaving(true);
    try {
      if (ventaItems.length === 0) {
        // Flujo legacy
        const precio = parseFloat(precioLegacy);
        if (!precio || precio <= 0) {
          setSaveError("Ingresa un precio válido.");
          setSaving(false);
          return;
        }
        await insertVenta({
          id: selectedRow.id,
          cliente: selectedRow.cliente,
          descripcion: selectedRow.descripcion,
          dni: selectedRow.dni,
          telefono: selectedRow.telefono,
          costo_base: selectedRow.inv_con_margen,
          precio_venta: precio,
        });
      } else {
        // Flujo con ítems
        const ventaItemsList: VentaItem[] = ventaItems.map((item) => ({
          cotizacion_item_id: item.id ?? null,
          descripcion: item.descripcion,
          precio_item: parseFloat(preciosPorItem[item.id ?? ""] ?? "0") || 0,
        }));
        const allMateriales: CotizacionItemMaterial[] = ventaItems.flatMap(
          (item) => item.materiales ?? []
        );
        await insertVentaConItems(
          {
            id: selectedRow.id,
            cliente: selectedRow.cliente,
            descripcion: selectedRow.descripcion,
            dni: selectedRow.dni,
            telefono: selectedRow.telefono,
            costo_base: selectedRow.inv_con_margen,
            precio_venta: totalVenta,
            descripcion_resumen: usarResumen ? resumenTexto.trim() : undefined,
            usar_resumen: usarResumen,
          },
          ventaItemsList,
          allMateriales
        );
      }
      cerrarModal();
      setSelected(null);
      onVentaGuardada();
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

  const inputCls =
    "border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9]";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Main table */}
      <div className="lg:col-span-3 space-y-3">
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
                        selected === r.id
                          ? "bg-[#ebf5ff]"
                          : i % 2 === 0
                          ? "bg-white"
                          : "bg-gray-50"
                      } hover:bg-[#ebf5ff]`}
                      onClick={() => setSelected(r.id === selected ? null : r.id)}
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
                      <td className="p-2 text-gray-600 max-w-[160px] truncate">{descripcion}</td>
                      <td className="p-2 text-right">{r.gramos.toFixed(1)}</td>
                      <td className="p-2 text-right">{r.tiempo}</td>
                      <td className="p-2 text-right">{fmt(r.inv_sin_margen)}</td>
                      <td className="p-2 text-right">{fmt(r.inv_con_margen)}</td>
                      <td className="p-2 text-right font-bold text-[#2980b9]">
                        {fmt(r.inv_con_ganancia)}
                      </td>
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
        <h2 className="text-sm font-bold text-[#1f618d] uppercase mb-3">Cerrar Venta</h2>
        {selectedRow ? (
          <div className="space-y-3">
            <div className="bg-[#ebf5ff] rounded p-3 text-xs space-y-1">
              <p>
                <span className="font-semibold">Cliente:</span> {selectedRow.cliente}
              </p>
              <p>
                <span className="font-semibold">Total sugerido:</span>{" "}
                {fmt(selectedRow.inv_con_ganancia)}
              </p>
              <p>
                <span className="font-semibold">Fecha:</span>{" "}
                {fmtFecha(selectedRow.fecha_registro)}
              </p>
            </div>
            <button
              onClick={abrirModalVenta}
              disabled={loadingItems}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded text-sm transition-colors disabled:opacity-50"
            >
              {loadingItems ? "Cargando..." : "Cerrar como Venta →"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center mt-4">
            Selecciona una cotización de la tabla.
          </p>
        )}
      </div>

      {/* Modal cerrar venta */}
      {modalVenta && selectedRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b">
              <div>
                <h2 className="text-base font-bold text-[#1f618d]">
                  {ventaItems.length === 0
                    ? "Cerrar venta"
                    : paso === 1
                    ? "Paso 1 — Revisar precios"
                    : "Paso 2 — Presentación al cliente"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Cliente: {selectedRow.cliente}
                </p>
              </div>
              <button
                onClick={cerrarModal}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              {/* Flujo legacy (sin ítems) */}
              {ventaItems.length === 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                    Esta cotización no tiene ítems (formato anterior). Ingresa el precio de venta directamente.
                  </p>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Precio sugerido: {fmt(selectedRow.inv_con_ganancia)}
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9]"
                      placeholder={selectedRow.inv_con_ganancia.toFixed(2)}
                      value={precioLegacy}
                      onChange={(e) => setPrecioLegacy(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Paso 1: ítems con precios */}
              {ventaItems.length > 0 && paso === 1 && (
                <div className="space-y-3">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#ebf5ff]">
                        <tr>
                          <th className="p-2 text-left">Artículo</th>
                          <th className="p-2 text-right text-gray-400">Sugerido</th>
                          <th className="p-2 text-right">Tu precio (S/)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventaItems.map((item, i) => (
                          <tr
                            key={item.id ?? i}
                            className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                          >
                            <td className="p-2 font-semibold">{item.descripcion}</td>
                            <td className="p-2 text-right text-gray-400">
                              {item.inv_con_ganancia != null
                                ? fmt(item.inv_con_ganancia)
                                : "-"}
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                className="w-24 border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2980b9] text-right"
                                value={preciosPorItem[item.id ?? ""] ?? ""}
                                onChange={(e) =>
                                  setPreciosPorItem((p) => ({
                                    ...p,
                                    [item.id ?? ""]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Suma ítems: {fmt(sumaItems)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 shrink-0">
                        Override total (opcional):
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9]"
                        placeholder={fmt(sumaItems)}
                        value={totalOverride}
                        onChange={(e) => setTotalOverride(e.target.value)}
                      />
                    </div>
                    <p className="text-sm font-bold text-[#1f618d] mt-2">
                      Total: {fmt(totalVenta)}
                    </p>
                  </div>
                </div>
              )}

              {/* Paso 2: presentación */}
              {ventaItems.length > 0 && paso === 2 && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-gray-600">
                    Total: <span className="text-[#2980b9]">{fmt(totalVenta)}</span>
                  </p>

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="modo"
                        checked={!usarResumen}
                        onChange={() => setUsarResumen(false)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-700">
                          Detalle completo
                        </p>
                        <p className="text-xs text-gray-400">
                          La boleta mostrará todos los artículos con sus precios individuales.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="modo"
                        checked={usarResumen}
                        onChange={() => setUsarResumen(true)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-700">
                          Resumen personalizado
                        </p>
                        <p className="text-xs text-gray-400">
                          Escribe una descripción resumida para el cliente.
                        </p>
                      </div>
                    </label>

                    {usarResumen && (
                      <textarea
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9] mt-1"
                        rows={3}
                        placeholder="Ej: Impresión 3D de figuras decorativas — set completo"
                        value={resumenTexto}
                        onChange={(e) => setResumenTexto(e.target.value)}
                      />
                    )}
                  </div>
                </div>
              )}

              {saveError && (
                <p className="text-red-600 text-xs mt-3">{saveError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end p-5 border-t">
              {ventaItems.length > 0 && paso === 2 && (
                <button
                  onClick={() => setPaso(1)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded transition-colors"
                >
                  ← Atrás
                </button>
              )}
              <button
                onClick={cerrarModal}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded transition-colors"
              >
                Cancelar
              </button>
              {ventaItems.length > 0 && paso === 1 ? (
                <button
                  onClick={() => setPaso(2)}
                  className="px-5 py-2 bg-[#2980b9] hover:bg-[#1f618d] text-white text-sm rounded transition-colors"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  onClick={guardarVenta}
                  disabled={saving}
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded transition-colors disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar Venta"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {confirmEliminar && selectedRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-base font-bold text-red-600 mb-2">Eliminar cotización</h2>
            <p className="text-sm text-gray-600 mb-1">
              ¿Estás seguro de eliminar esta cotización?
            </p>
            <div className="bg-red-50 rounded p-3 text-sm mb-4">
              <p>
                <span className="font-semibold">Cliente:</span> {selectedRow.cliente}
              </p>
              <p>
                <span className="font-semibold">Total:</span>{" "}
                {fmt(selectedRow.inv_con_ganancia)}
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
