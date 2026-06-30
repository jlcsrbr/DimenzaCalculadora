"use client";

import { useState, useEffect, useCallback } from "react";
import { getFilamentos, insertFilamento, updateFilamento, getTiposFilamento } from "@/lib/supabase";
import { Filamento } from "@/lib/types";

type FilForm = {
  marca: string;
  tipo: string;
  color: string;
  gramos_stock: string;
  precio_kg: string;
  activo: boolean;
};

const EMPTY_FORM: FilForm = {
  marca: "",
  tipo: "PLA",
  color: "",
  gramos_stock: "0",
  precio_kg: "",
  activo: true,
};

const stockBadge = (g: number) => {
  if (g <= 0) return "bg-red-100 text-red-700";
  if (g < 200) return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
};

export default function Filamentos() {
  const [rows, setRows] = useState<Filamento[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);

  const [modal, setModal] = useState<"nuevo" | Filamento | null>(null);
  const [form, setForm] = useState<FilForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [filamentos, tiposDB] = await Promise.all([
        getFilamentos(soloActivos),
        getTiposFilamento(),
      ]);
      setRows(filamentos);
      setTipos(tiposDB.length > 0 ? tiposDB : ["PLA", "PETG", "ABS", "TPU", "Otro"]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [soloActivos]);

  useEffect(() => {
    load();
  }, [load]);

  const abrirNuevo = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModal("nuevo");
  };

  const abrirEditar = (f: Filamento) => {
    setForm({
      marca: f.marca,
      tipo: f.tipo,
      color: f.color ?? "",
      gramos_stock: String(f.gramos_stock),
      precio_kg: String(f.precio_kg),
      activo: f.activo,
    });
    setFormError("");
    setModal(f);
  };

  const guardar = async () => {
    if (!form.marca.trim()) {
      setFormError("La marca es obligatoria.");
      return;
    }
    const gramos = parseFloat(form.gramos_stock);
    const precio = parseFloat(form.precio_kg);
    if (isNaN(precio) || precio <= 0) {
      setFormError("Ingresa un precio por kg válido.");
      return;
    }
    if (isNaN(gramos) || gramos < 0) {
      setFormError("El stock no puede ser negativo.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const data = {
        marca: form.marca.trim(),
        tipo: form.tipo,
        color: form.color.trim() || undefined,
        gramos_stock: gramos,
        precio_kg: precio,
        activo: form.activo,
      };
      if (modal === "nuevo") {
        await insertFilamento(data);
      } else if (modal) {
        await updateFilamento((modal as Filamento).id, data);
      }
      setModal(null);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (f: Filamento) => {
    try {
      await updateFilamento(f.id, { activo: !f.activo });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const inputCls =
    "w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9]";

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow p-3 flex flex-wrap gap-3 items-center">
        <button
          onClick={abrirNuevo}
          className="bg-[#2980b9] hover:bg-[#1f618d] text-white text-sm px-4 py-1.5 rounded transition-colors"
        >
          + Nuevo filamento
        </button>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
          />
          Solo activos
        </label>
        <span className="ml-auto text-xs text-gray-400">{rows.length} filamentos</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : error ? (
          <div className="p-4 text-red-600 text-sm">{error}</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No hay filamentos registrados. Agrega uno con el botón de arriba.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#2980b9] text-white">
                <th className="p-2 text-left">Marca</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Color</th>
                <th className="p-2 text-right">Stock</th>
                <th className="p-2 text-right">S/ / kg</th>
                <th className="p-2 text-center">Estado</th>
                <th className="p-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f, i) => (
                <tr
                  key={f.id}
                  className={`transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${
                    !f.activo ? "opacity-50" : ""
                  }`}
                >
                  <td className="p-2 font-semibold">{f.marca}</td>
                  <td className="p-2">{f.tipo}</td>
                  <td className="p-2">
                    {f.color ? (
                      <span className="inline-block bg-gray-100 rounded px-2 py-0.5">{f.color}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-semibold ${stockBadge(
                        f.gramos_stock
                      )}`}
                    >
                      {f.gramos_stock.toFixed(0)} g
                    </span>
                  </td>
                  <td className="p-2 text-right">S/ {f.precio_kg.toFixed(2)}</td>
                  <td className="p-2 text-center">
                    <span
                      className={`inline-block rounded px-2 py-0.5 ${
                        f.activo
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {f.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="p-2 text-center whitespace-nowrap">
                    <button
                      onClick={() => abrirEditar(f)}
                      className="text-[#2980b9] hover:text-[#1f618d] underline mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleActivo(f)}
                      className={`underline ${
                        f.activo
                          ? "text-red-500 hover:text-red-700"
                          : "text-green-600 hover:text-green-800"
                      }`}
                    >
                      {f.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-base font-bold text-[#1f618d]">
                {modal === "nuevo" ? "Nuevo filamento" : "Editar filamento"}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Marca *</label>
                <input
                  className={inputCls}
                  value={form.marca}
                  onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                  placeholder="Ej: Sunlu, eSun, Bambu"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tipo *</label>
                  <select
                    className={inputCls}
                    value={form.tipo}
                    onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                  >
                    {tipos.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Color</label>
                  <input
                    className={inputCls}
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    placeholder="Ej: Rojo, Azul, Blanco"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Stock (gramos)</label>
                  <input
                    type="number"
                    min="0"
                    className={inputCls}
                    value={form.gramos_stock}
                    onChange={(e) => setForm((f) => ({ ...f, gramos_stock: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Precio (S/ / kg) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    value={form.precio_kg}
                    onChange={(e) => setForm((f) => ({ ...f, precio_kg: e.target.value }))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                />
                Activo (disponible para cotizaciones)
              </label>
            </div>

            {formError && <p className="text-red-600 text-xs mt-3">{formError}</p>}

            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={saving}
                className="px-4 py-2 bg-[#2980b9] hover:bg-[#1f618d] text-white text-sm rounded transition-colors disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
