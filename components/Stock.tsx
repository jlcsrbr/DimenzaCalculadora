"use client";

import { useState, useEffect, useCallback } from "react";
import { getStockProductos, venderDesdeStock } from "@/lib/supabase";
import { StockProducto } from "@/lib/types";

const fmt = (n: number) => `S/ ${n.toFixed(2)}`;
const fmtFecha = (s?: string) => (s ? new Date(s).toLocaleDateString("es-PE") : "-");

const stockBadge = (n: number) => {
  if (n <= 0) return "bg-red-100 text-red-700";
  if (n <= 2) return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
};

export default function Stock({ onVentaGuardada }: { onVentaGuardada: () => void }) {
  const [rows, setRows] = useState<StockProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // Modal venta
  const [modalVenta, setModalVenta] = useState(false);
  const [ventaForm, setVentaForm] = useState({
    cliente: "",
    dni: "",
    telefono: "",
    precio_venta: "",
    descripcion_resumen: "",
    usar_resumen: false,
    cantidad: "1",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await getStockProductos());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedRow = rows.find((r) => r.id === selected);

  const abrirVenta = () => {
    if (!selectedRow) return;
    setVentaForm({
      cliente: "",
      dni: "",
      telefono: "",
      precio_venta: String(selectedRow.precio_venta_sugerido.toFixed(2)),
      descripcion_resumen: "",
      usar_resumen: false,
      cantidad: "1",
    });
    setSaveError("");
    setModalVenta(true);
  };

  const guardarVenta = async () => {
    if (!selectedRow) return;
    const { cliente, dni, telefono, precio_venta, descripcion_resumen, usar_resumen, cantidad } = ventaForm;
    if (!cliente.trim()) { setSaveError("El nombre del cliente es obligatorio."); return; }
    const precio = parseFloat(precio_venta);
    if (!precio || precio <= 0) { setSaveError("Ingresa un precio de venta válido."); return; }
    const cant = parseInt(cantidad) || 1;
    if (cant < 1) { setSaveError("La cantidad debe ser al menos 1."); return; }
    if (cant > selectedRow.cantidad_disponible) {
      setSaveError(`Solo hay ${selectedRow.cantidad_disponible} unidades disponibles.`);
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const ventaId = `VNT-${Date.now()}`;
      await venderDesdeStock(
        {
          id: ventaId,
          cliente: cliente.trim(),
          descripcion: selectedRow.descripcion,
          dni: dni.trim(),
          telefono: telefono.trim(),
          costo_base: selectedRow.precio_costo * cant,
          precio_venta: precio * cant,
          descripcion_resumen: usar_resumen ? descripcion_resumen.trim() : undefined,
          usar_resumen,
        },
        [{
          stock_producto_id: selectedRow.id,
          descripcion: selectedRow.descripcion,
          precio_item: precio,
          cantidad: cant,
        }]
      );
      setModalVenta(false);
      setSelected(null);
      await load();
      onVentaGuardada();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9]";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Tabla */}
      <div className="lg:col-span-3 space-y-3">
        <div className="bg-white rounded-lg shadow p-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#1f618d]">Productos en Stock</span>
          <button onClick={load} className="text-xs text-[#2980b9] hover:underline">Recargar</button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
          ) : error ? (
            <div className="p-4 text-red-600 text-sm">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No hay productos en stock. Pasa una cotización a stock desde la pestaña Cotizaciones.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#2980b9] text-white">
                  <th className="p-2 text-left">Sel.</th>
                  <th className="p-2 text-left">Descripción</th>
                  <th className="p-2 text-center">Unidades</th>
                  <th className="p-2 text-right">Costo</th>
                  <th className="p-2 text-right">P. Venta Sug.</th>
                  <th className="p-2 text-left">Fecha prod.</th>
                  <th className="p-2 text-left">Cotización</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
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
                    <td className="p-2 font-semibold max-w-[200px] truncate" title={r.descripcion}>
                      {r.descripcion}
                    </td>
                    <td className="p-2 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 font-bold ${stockBadge(r.cantidad_disponible)}`}>
                        {r.cantidad_disponible}
                      </span>
                    </td>
                    <td className="p-2 text-right">{fmt(r.precio_costo)}</td>
                    <td className="p-2 text-right font-semibold text-[#2980b9]">{fmt(r.precio_venta_sugerido)}</td>
                    <td className="p-2 text-gray-500">{fmtFecha(r.fecha_produccion)}</td>
                    <td className="p-2 font-mono text-gray-400 text-xs">{r.cotizacion_id ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Panel lateral */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-sm font-bold text-[#1f618d] uppercase mb-3">Vender</h2>
        {selectedRow ? (
          <div className="space-y-3">
            <div className="bg-[#ebf5ff] rounded p-3 text-xs space-y-1">
              <p className="font-semibold truncate" title={selectedRow.descripcion}>{selectedRow.descripcion}</p>
              <p><span className="font-semibold">Disponibles:</span>{" "}
                <span className={`font-bold ${selectedRow.cantidad_disponible <= 2 ? "text-yellow-600" : "text-green-600"}`}>
                  {selectedRow.cantidad_disponible} ud.
                </span>
              </p>
              <p><span className="font-semibold">P. sugerido:</span> {fmt(selectedRow.precio_venta_sugerido)}</p>
            </div>
            <button
              onClick={abrirVenta}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded text-sm transition-colors"
            >
              Registrar Venta →
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center mt-4">
            Selecciona un producto de la tabla.
          </p>
        )}
      </div>

      {/* Modal venta */}
      {modalVenta && selectedRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-5 border-b">
              <div>
                <h2 className="text-base font-bold text-[#1f618d]">Registrar Venta</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{selectedRow.descripcion}</p>
              </div>
              <button onClick={() => setModalVenta(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
            </div>

            <div className="p-5 space-y-3">
              {/* Datos del cliente */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Cliente *</label>
                  <input
                    className={inputCls}
                    placeholder="Nombre del cliente"
                    value={ventaForm.cliente}
                    onChange={(e) => setVentaForm((f) => ({ ...f, cliente: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">DNI</label>
                  <input
                    className={inputCls}
                    placeholder="DNI"
                    value={ventaForm.dni}
                    onChange={(e) => setVentaForm((f) => ({ ...f, dni: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Teléfono</label>
                  <input
                    className={inputCls}
                    placeholder="Teléfono"
                    value={ventaForm.telefono}
                    onChange={(e) => setVentaForm((f) => ({ ...f, telefono: e.target.value }))}
                  />
                </div>
              </div>

              {/* Precio y cantidad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Precio unit. (S/) *
                    <span className="text-gray-300 ml-1">sug: {fmt(selectedRow.precio_venta_sugerido)}</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    value={ventaForm.precio_venta}
                    onChange={(e) => setVentaForm((f) => ({ ...f, precio_venta: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Cantidad (máx. {selectedRow.cantidad_disponible})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedRow.cantidad_disponible}
                    className={inputCls}
                    value={ventaForm.cantidad}
                    onChange={(e) => setVentaForm((f) => ({ ...f, cantidad: e.target.value }))}
                  />
                </div>
              </div>

              {/* Total calculado */}
              {parseFloat(ventaForm.precio_venta) > 0 && parseInt(ventaForm.cantidad) > 0 && (
                <div className="bg-green-50 rounded p-2 text-sm flex justify-between">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-bold text-green-700">
                    {fmt(parseFloat(ventaForm.precio_venta) * (parseInt(ventaForm.cantidad) || 1))}
                  </span>
                </div>
              )}

              {/* Presentación al cliente */}
              <div className="border-t pt-3 space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ventaForm.usar_resumen}
                    onChange={(e) => setVentaForm((f) => ({ ...f, usar_resumen: e.target.checked }))}
                  />
                  Usar descripción personalizada en boleta
                </label>
                {ventaForm.usar_resumen && (
                  <textarea
                    className={inputCls}
                    rows={2}
                    placeholder="Descripción para el cliente..."
                    value={ventaForm.descripcion_resumen}
                    onChange={(e) => setVentaForm((f) => ({ ...f, descripcion_resumen: e.target.value }))}
                  />
                )}
              </div>

              {saveError && <p className="text-red-600 text-xs">{saveError}</p>}
            </div>

            <div className="flex gap-2 justify-end p-5 border-t">
              <button onClick={() => setModalVenta(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded transition-colors">
                Cancelar
              </button>
              <button
                onClick={guardarVenta}
                disabled={saving}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded transition-colors disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar Venta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
