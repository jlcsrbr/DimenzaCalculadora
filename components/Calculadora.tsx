"use client";

import { useState, useCallback } from "react";
import { calcular, encodeMateriales, fmt } from "@/lib/calculadora-logica";
import { insertCotizacion } from "@/lib/supabase";
import { MaterialInput, CalculoResult } from "@/lib/types";

const EMPTY_MAT: MaterialInput = { precioKilo: "", gramos: "" };
const EMPTY_RESULT: CalculoResult = {
  precioXGramo: 0, costoMaterial: 0, precioPorMinuto: 0,
  electricidad: 0, totalTiempoElec: 0, sinMargen: 0, conMargen: 0,
  conGanancia: 0, totalGramos: 0,
};

export default function Calculadora({ onSaved }: { onSaved: () => void }) {
  const [cliente, setCliente] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tiempo, setTiempo] = useState("");
  const [materiales, setMateriales] = useState<MaterialInput[]>(
    Array.from({ length: 8 }, () => ({ ...EMPTY_MAT }))
  );
  const [resultado, setResultado] = useState<CalculoResult>(EMPTY_RESULT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const recalcular = useCallback(
    (mats: MaterialInput[], t: string) => {
      const mins = parseFloat(t) || 0;
      setResultado(calcular(mats, mins));
    },
    []
  );

  const updateMaterial = (idx: number, field: keyof MaterialInput, val: string) => {
    const next = materiales.map((m, i) => (i === idx ? { ...m, [field]: val } : m));
    setMateriales(next);
    recalcular(next, tiempo);
  };

  const handleTiempo = (val: string) => {
    setTiempo(val);
    recalcular(materiales, val);
  };

  const limpiar = () => {
    setCliente(""); setDni(""); setTelefono(""); setDescripcion(""); setTiempo("");
    const mats = Array.from({ length: 8 }, () => ({ ...EMPTY_MAT }));
    setMateriales(mats);
    setResultado(EMPTY_RESULT);
    setError("");
  };

  const guardar = async () => {
    if (!cliente.trim()) { setError("El nombre del cliente es obligatorio."); return; }
    if (resultado.conGanancia <= 0) { setError("Ingresa al menos un material para calcular."); return; }
    setError("");
    setSaving(true);
    try {
      const id = `COT-${Date.now()}`;
      await insertCotizacion({
        id,
        cliente: cliente.trim(),
        descripcion: encodeMateriales(descripcion.trim(), materiales),
        dni: dni.trim(),
        telefono: telefono.trim(),
        gramos: resultado.totalGramos,
        tiempo: parseFloat(tiempo) || 0,
        inv_sin_margen: resultado.sinMargen,
        inv_con_margen: resultado.conMargen,
        inv_con_ganancia: resultado.conGanancia,
      });
      limpiar();
      onSaved();
    } catch (e) {
      setError("Error al guardar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9]";
  const readCls = "w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-[#ebf5ff] text-[#1f618d] font-semibold";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: Customer + Materials */}
      <div className="lg:col-span-2 space-y-4">
        {/* Customer info */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-bold text-[#1f618d] uppercase mb-3">Datos del Cliente</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
              <input className={inputCls} value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">DNI</label>
              <input className={inputCls} value={dni} onChange={(e) => setDni(e.target.value)} placeholder="Número de DNI" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Teléfono</label>
              <input className={inputCls} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Descripción del proyecto</label>
              <input className={inputCls} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción" />
            </div>
          </div>
        </div>

        {/* Materials */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-bold text-[#1f618d] uppercase mb-3">Materiales (hasta 8)</h2>
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-gray-500 mb-1 px-1">
            <span>S/ por Kilo</span>
            <span>Gramos</span>
          </div>
          {materiales.map((m, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 mb-2 items-center">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                <input
                  type="number"
                  className={inputCls}
                  placeholder="S/ / kg"
                  value={m.precioKilo}
                  onChange={(e) => updateMaterial(i, "precioKilo", e.target.value)}
                  min="0"
                />
              </div>
              <input
                type="number"
                className={inputCls}
                placeholder="g"
                value={m.gramos}
                onChange={(e) => updateMaterial(i, "gramos", e.target.value)}
                min="0"
              />
            </div>
          ))}

          <div className="mt-3 border-t pt-3">
            <label className="text-xs text-gray-500 mb-1 block">Tiempo de impresión (minutos)</label>
            <input
              type="number"
              className={inputCls + " max-w-[200px]"}
              placeholder="Minutos"
              value={tiempo}
              onChange={(e) => handleTiempo(e.target.value)}
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Right: Results */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-bold text-[#1f618d] uppercase mb-3">Resultado del Cálculo</h2>
          <div className="space-y-2">
            {[
              ["Precio x Gramo", `S/ ${fmt(resultado.precioXGramo)}`],
              ["Costo Material", `S/ ${fmt(resultado.costoMaterial)}`],
              ["Precio por Minuto", `S/ ${fmt(resultado.precioPorMinuto)}`],
              ["Electricidad", `S/ ${fmt(resultado.electricidad)}`],
              ["Total (T+E)", `S/ ${fmt(resultado.totalTiempoElec)}`],
              ["Sin Margen", `S/ ${fmt(resultado.sinMargen)}`],
              ["Con Margen (20%)", `S/ ${fmt(resultado.conMargen)}`],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-gray-500">{label}</span>
                <input readOnly className={readCls + " w-28 text-right"} value={val} />
              </div>
            ))}

            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-[#1f618d]">TOTAL (×1.3)</span>
                <div className="bg-[#2980b9] text-white font-bold text-sm rounded px-3 py-2">
                  S/ {fmt(resultado.conGanancia)}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Gramos totales: {fmt(resultado.totalGramos)} g</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={guardar}
            disabled={saving}
            className="flex-1 bg-[#2980b9] hover:bg-[#1f618d] text-white font-semibold py-2 rounded text-sm transition-colors disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar Cotización"}
          </button>
          <button
            onClick={limpiar}
            className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded text-sm transition-colors"
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}
