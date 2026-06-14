"use client";

import { useState, useEffect, useCallback } from "react";
import { getVentas } from "@/lib/supabase";
import { decodeMateriales } from "@/lib/calculadora-logica";
import { generarBoleta } from "@/lib/pdf-generator";
import { Venta } from "@/lib/types";

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
  const [exporting, setExporting] = useState(false);

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

  useEffect(() => { load(); }, [load]);

  const buscar = () => load(filtroCliente || undefined, filtroDesde || undefined, filtroHasta || undefined);
  const limpiarFiltros = () => { setFiltroCliente(""); setFiltroDesde(""); setFiltroHasta(""); load(); };

  const selectedRow = rows.find((r) => r.id === selected);

  const exportarPDF = async () => {
    if (!selectedRow) return;
    setExporting(true);
    try {
      await generarBoleta(selectedRow);
    } finally {
      setExporting(false);
    }
  };

  const inputCls = "border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9]";

  return (
    <div className="space-y-3">
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

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => selectedRow && setDetalle(selectedRow)}
            disabled={!selectedRow}
            className="bg-[#1f618d] hover:bg-[#154360] text-white text-sm px-4 py-1.5 rounded transition-colors disabled:opacity-40"
          >
            Ver Detalle Técnico
          </button>
          <button
            onClick={exportarPDF}
            disabled={!selectedRow || exporting}
            className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-1.5 rounded transition-colors disabled:opacity-40"
          >
            {exporting ? "Generando PDF..." : "Exportar Boleta PDF"}
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
                      selected === r.id ? "bg-[#ebf5ff]" : i % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-[#ebf5ff]`}
                    onClick={() => setSelected(r.id === selected ? null : r.id)}
                    onDoubleClick={() => setDetalle(r)}
                  >
                    <td className="p-2">
                      <input type="radio" checked={selected === r.id} onChange={() => setSelected(r.id)} onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td className="p-2 font-mono text-gray-500">{r.id}</td>
                    <td className="p-2 font-semibold">{r.cliente}</td>
                    <td className="p-2 text-gray-600 max-w-[180px] truncate">{descripcion}</td>
                    <td className="p-2">{r.dni || "-"}</td>
                    <td className="p-2">{r.telefono || "-"}</td>
                    <td className="p-2 text-right">{fmtS(r.costo_base)}</td>
                    <td className="p-2 text-right font-bold text-green-700">{fmtS(r.precio_venta)}</td>
                    <td className="p-2 text-gray-500">{fmtFecha(r.fecha_registro)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail modal */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-base font-bold text-[#1f618d]">Detalle Técnico</h2>
              <button onClick={() => setDetalle(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>

            <div className="space-y-2 text-sm mb-4">
              <p><span className="font-semibold">ID:</span> {detalle.id}</p>
              <p><span className="font-semibold">Cliente:</span> {detalle.cliente}</p>
              <p><span className="font-semibold">DNI:</span> {detalle.dni || "-"}</p>
              <p><span className="font-semibold">Teléfono:</span> {detalle.telefono || "-"}</p>
              <p><span className="font-semibold">Fecha:</span> {fmtFecha(detalle.fecha_registro)}</p>
            </div>

            {(() => {
              const { descripcion, materiales } = decodeMateriales(detalle.descripcion);
              return (
                <>
                  <p className="text-sm mb-2"><span className="font-semibold">Descripción:</span> {descripcion}</p>
                  {materiales.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Materiales usados</p>
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
                              <td className="p-2 text-right">{fmtS((m.precio / 1000) * m.gramos)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              );
            })()}

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
                onClick={() => { generarBoleta(detalle); }}
                className="bg-[#2980b9] hover:bg-[#1f618d] text-white text-sm px-4 py-2 rounded transition-colors"
              >
                Exportar PDF
              </button>
              <button onClick={() => setDetalle(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm px-4 py-2 rounded transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
