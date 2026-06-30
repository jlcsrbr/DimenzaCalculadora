"use client";

import { useState, useEffect } from "react";
import { getFormulaConfig, updateFormulaConfig, getTiposFilamento, insertTipoFilamento, deleteTipoFilamento } from "@/lib/supabase";
import { FormulaConfig, DEFAULT_FORMULA } from "@/lib/types";
import { calcular, fmt } from "@/lib/calculadora-logica";

const LABELS: Record<keyof FormulaConfig, { titulo: string; descripcion: string }> = {
  labor_rate: {
    titulo: "Costo mano de obra",
    descripcion: "S/ por minuto de impresión",
  },
  electricity_rate: {
    titulo: "Costo electricidad",
    descripcion: "S/ por minuto de impresión",
  },
  margin: {
    titulo: "Multiplicador de margen",
    descripcion: "Ej: 1.2 = aplica 20% sobre costo de material",
  },
  profit: {
    titulo: "Multiplicador de ganancia",
    descripcion: "Ej: 1.3 = aplica 30% sobre precio con margen",
  },
};

export default function Configuracion({ onSaved }: { onSaved: () => void }) {
  const [saved, setSaved] = useState<FormulaConfig>(DEFAULT_FORMULA);
  const [tipos, setTipos] = useState<string[]>([]);
  const [nuevoTipo, setNuevoTipo] = useState("");
  const [addingTipo, setAddingTipo] = useState(false);
  const [form, setForm] = useState<Record<keyof FormulaConfig, string>>({
    labor_rate: "0.08",
    electricity_rate: "0.008",
    margin: "1.2",
    profit: "1.3",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([getFormulaConfig(), getTiposFilamento()])
      .then(([c, t]) => {
        setSaved(c);
        setForm({
          labor_rate: String(c.labor_rate),
          electricity_rate: String(c.electricity_rate),
          margin: String(c.margin),
          profit: String(c.profit),
        });
        setTipos(t);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const agregarTipo = async () => {
    const nombre = nuevoTipo.trim();
    if (!nombre) return;
    setAddingTipo(true);
    try {
      await insertTipoFilamento(nombre);
      setTipos((prev) => [...prev, nombre]);
      setNuevoTipo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAddingTipo(false);
    }
  };

  const eliminarTipo = async (nombre: string) => {
    try {
      await deleteTipoFilamento(nombre);
      setTipos((prev) => prev.filter((t) => t !== nombre));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const guardar = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      for (const key of Object.keys(form) as (keyof FormulaConfig)[]) {
        const val = parseFloat(form[key]);
        if (isNaN(val) || val <= 0) {
          setError(`Valor inválido para "${LABELS[key].titulo}"`);
          return;
        }
        await updateFormulaConfig(key, val);
      }
      const updated: FormulaConfig = {
        labor_rate: parseFloat(form.labor_rate),
        electricity_rate: parseFloat(form.electricity_rate),
        margin: parseFloat(form.margin),
        profit: parseFloat(form.profit),
      };
      setSaved(updated);
      setSuccess(true);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const previewConfig: FormulaConfig = {
    labor_rate: parseFloat(form.labor_rate) || 0,
    electricity_rate: parseFloat(form.electricity_rate) || 0,
    margin: parseFloat(form.margin) || 0,
    profit: parseFloat(form.profit) || 0,
  };
  // Preview: 10g de material a S/1000/kg + 60 minutos
  const preview = calcular([{ precioKilo: "1000", gramos: "10" }], 60, previewConfig);

  const inputCls =
    "border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9] w-36 text-right";

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-sm font-bold text-[#1f618d] uppercase mb-4">
          Variables de la fórmula de precio
        </h2>

        <div className="space-y-5">
          {(Object.keys(LABELS) as (keyof FormulaConfig)[]).map((key) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">{LABELS[key].titulo}</p>
                <p className="text-xs text-gray-400">{LABELS[key].descripcion}</p>
                <p className="text-xs text-[#2980b9] mt-0.5">Guardado: {saved[key]}</p>
              </div>
              <input
                type="number"
                step="0.001"
                min="0"
                className={inputCls}
                value={form[key]}
                onChange={(e) => {
                  setSuccess(false);
                  setForm((f) => ({ ...f, [key]: e.target.value }));
                }}
              />
            </div>
          ))}
        </div>

        {error && <p className="text-red-600 text-xs mt-4">{error}</p>}
        {success && <p className="text-green-600 text-xs mt-4">Cambios guardados correctamente.</p>}

        <button
          onClick={guardar}
          disabled={saving}
          className="mt-5 bg-[#2980b9] hover:bg-[#1f618d] text-white font-semibold py-2 px-6 rounded text-sm transition-colors disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      {/* Tipos de filamento */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-sm font-bold text-[#1f618d] uppercase mb-4">
          Tipos de filamento
        </h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {tipos.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 bg-[#ebf5ff] text-[#1f618d] rounded-full px-3 py-1 text-sm"
            >
              {t}
              <button
                onClick={() => eliminarTipo(t)}
                className="text-[#2980b9] hover:text-red-500 font-bold leading-none ml-1"
                title={`Eliminar ${t}`}
              >
                ×
              </button>
            </span>
          ))}
          {tipos.length === 0 && (
            <p className="text-xs text-gray-400">No hay tipos registrados.</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9]"
            placeholder="Ej: PETG, Nylon, Cobre..."
            value={nuevoTipo}
            onChange={(e) => setNuevoTipo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregarTipo()}
          />
          <button
            onClick={agregarTipo}
            disabled={addingTipo || !nuevoTipo.trim()}
            className="px-4 py-1.5 bg-[#2980b9] hover:bg-[#1f618d] text-white text-sm rounded transition-colors disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      </div>

      {/* Vista previa */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-sm font-bold text-[#1f618d] uppercase mb-1">Vista previa</h2>
        <p className="text-xs text-gray-500 mb-3">
          Ejemplo: 10 g de filamento (S/ 1000/kg) + 60 min de impresión
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {([
            ["Costo material", preview.costoMaterial],
            ["Mano de obra", preview.precioPorMinuto],
            ["Electricidad", preview.electricidad],
            ["Con margen", preview.conMargen],
          ] as [string, number][]).map(([label, val]) => (
            <div key={label} className="bg-gray-50 rounded p-2 flex justify-between">
              <span className="text-gray-500">{label}</span>
              <span className="font-semibold">S/ {fmt(val)}</span>
            </div>
          ))}
          <div className="col-span-2 bg-[#ebf5ff] rounded p-2 flex justify-between font-bold">
            <span className="text-[#1f618d]">TOTAL (con ganancia)</span>
            <span className="text-[#2980b9]">S/ {fmt(preview.conGanancia)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
