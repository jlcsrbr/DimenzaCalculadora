"use client";

import { useState, useCallback, useEffect } from "react";
import { calcular, fmt } from "@/lib/calculadora-logica";
import { insertCotizacionConItems, getFilamentos } from "@/lib/supabase";
import {
  MaterialInput,
  CalculoResult,
  FormulaConfig,
  Filamento,
  CotizacionItem,
  CotizacionItemMaterial,
} from "@/lib/types";

const EMPTY_RESULT: CalculoResult = {
  precioXGramo: 0,
  costoMaterial: 0,
  precioPorMinuto: 0,
  electricidad: 0,
  totalTiempoElec: 0,
  sinMargen: 0,
  conMargen: 0,
  conGanancia: 0,
  totalGramos: 0,
};

type MatRow = {
  filamento_id: string | null;
  precioKilo: string;
  gramos: string;
};

type ItemForm = {
  localId: string;
  descripcion: string;
  tiempo: string;
  materiales: MatRow[];
  resultado: CalculoResult;
  abierto: boolean;
};

const emptyItem = (): ItemForm => ({
  localId: `${Date.now()}-${Math.random()}`,
  descripcion: "",
  tiempo: "",
  materiales: [
    { filamento_id: null, precioKilo: "", gramos: "" },
    { filamento_id: null, precioKilo: "", gramos: "" },
  ],
  resultado: { ...EMPTY_RESULT },
  abierto: true,
});

function recalcItem(item: ItemForm, config: FormulaConfig): ItemForm {
  const mats: MaterialInput[] = item.materiales.map((m) => ({
    precioKilo: m.precioKilo,
    gramos: m.gramos,
  }));
  return { ...item, resultado: calcular(mats, parseFloat(item.tiempo) || 0, config) };
}

export default function Calculadora({
  onSaved,
  formulaConfig,
}: {
  onSaved: () => void;
  formulaConfig: FormulaConfig;
}) {
  const [cliente, setCliente] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);
  const [filamentos, setFilamentos] = useState<Filamento[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getFilamentos(true).then(setFilamentos).catch(() => {});
  }, []);

  // Recalcular todos los ítems si cambia la fórmula
  useEffect(() => {
    setItems((prev) => prev.map((item) => recalcItem(item, formulaConfig)));
  }, [formulaConfig]);

  const updateItem = useCallback(
    (localId: string, updater: (item: ItemForm) => ItemForm) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.localId !== localId) return item;
          return recalcItem(updater(item), formulaConfig);
        })
      );
    },
    [formulaConfig]
  );

  const agregarItem = () => setItems((prev) => [...prev, emptyItem()]);
  const eliminarItem = (localId: string) =>
    setItems((prev) => prev.filter((i) => i.localId !== localId));
  const toggleItem = (localId: string) =>
    setItems((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, abierto: !i.abierto } : i))
    );

  const handleMatChange = (
    localId: string,
    matIdx: number,
    field: "precioKilo" | "gramos",
    val: string
  ) => {
    updateItem(localId, (item) => ({
      ...item,
      materiales: item.materiales.map((m, i) =>
        i === matIdx ? { ...m, [field]: val } : m
      ),
    }));
  };

  const handleFilamentoSelect = (
    localId: string,
    matIdx: number,
    filamento_id: string | null
  ) => {
    const fil = filamentos.find((f) => f.id === filamento_id);
    updateItem(localId, (item) => ({
      ...item,
      materiales: item.materiales.map((m, i) =>
        i === matIdx
          ? {
              ...m,
              filamento_id,
              precioKilo: fil ? String(fil.precio_kg) : m.precioKilo,
            }
          : m
      ),
    }));
  };

  const agregarMaterial = (localId: string) =>
    updateItem(localId, (item) => ({
      ...item,
      materiales: [
        ...item.materiales,
        { filamento_id: null, precioKilo: "", gramos: "" },
      ],
    }));

  const eliminarMaterial = (localId: string, matIdx: number) =>
    updateItem(localId, (item) => ({
      ...item,
      materiales: item.materiales.filter((_, i) => i !== matIdx),
    }));

  // Totales del pedido
  const totalGramos = items.reduce((s, i) => s + i.resultado.totalGramos, 0);
  const totalTiempo = items.reduce((s, i) => s + (parseFloat(i.tiempo) || 0), 0);
  const totalSinMargen = items.reduce((s, i) => s + i.resultado.sinMargen, 0);
  const totalConMargen = items.reduce((s, i) => s + i.resultado.conMargen, 0);
  const totalConGanancia = items.reduce((s, i) => s + i.resultado.conGanancia, 0);

  const limpiar = () => {
    setCliente("");
    setDni("");
    setTelefono("");
    setDescripcion("");
    setItems([emptyItem()]);
    setError("");
  };

  const guardar = async () => {
    if (!cliente.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }
    const validItems = items.filter(
      (i) => i.descripcion.trim() && i.resultado.conGanancia > 0
    );
    if (validItems.length === 0) {
      setError("Agrega al menos un artículo con nombre y materiales para calcular.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const id = `COT-${Date.now()}`;
      const cotItems: CotizacionItem[] = validItems.map((item, idx) => ({
        descripcion: item.descripcion.trim(),
        tiempo: parseFloat(item.tiempo) || 0,
        inv_sin_margen: item.resultado.sinMargen,
        inv_con_margen: item.resultado.conMargen,
        inv_con_ganancia: item.resultado.conGanancia,
        orden: idx + 1,
        materiales: item.materiales
          .filter((m) => parseFloat(m.gramos) > 0 && parseFloat(m.precioKilo) > 0)
          .map(
            (m): CotizacionItemMaterial => ({
              filamento_id: m.filamento_id,
              precio_kg: parseFloat(m.precioKilo),
              gramos: parseFloat(m.gramos),
            })
          ),
      }));

      await insertCotizacionConItems(
        {
          id,
          cliente: cliente.trim(),
          descripcion: descripcion.trim() || validItems[0].descripcion.trim(),
          dni: dni.trim(),
          telefono: telefono.trim(),
          gramos: totalGramos,
          tiempo: totalTiempo,
          inv_sin_margen: totalSinMargen,
          inv_con_margen: totalConMargen,
          inv_con_ganancia: totalConGanancia,
        },
        cotItems
      );
      limpiar();
      onSaved();
    } catch (e) {
      setError("Error al guardar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9]";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: formulario */}
      <div className="lg:col-span-2 space-y-4">
        {/* Datos del cliente */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-bold text-[#1f618d] uppercase mb-3">Datos del Cliente</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
              <input
                className={inputCls}
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre del cliente"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">DNI</label>
              <input
                className={inputCls}
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="Número de DNI"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Teléfono</label>
              <input
                className={inputCls}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Teléfono"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Descripción general</label>
              <input
                className={inputCls}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Descripción del pedido"
              />
            </div>
          </div>
        </div>

        {/* Ítems */}
        {items.map((item, itemIdx) => (
          <div key={item.localId} className="bg-white rounded-lg shadow">
            {/* Cabecera del ítem */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 rounded-lg"
              onClick={() => toggleItem(item.localId)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-[#2980b9] shrink-0">
                  #{itemIdx + 1}
                </span>
                <span className="text-sm font-semibold text-gray-700 truncate">
                  {item.descripcion.trim() || "Artículo sin nombre"}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {item.resultado.conGanancia > 0 && (
                  <span className="text-sm font-bold text-[#2980b9]">
                    S/ {fmt(item.resultado.conGanancia)}
                  </span>
                )}
                {items.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminarItem(item.localId);
                    }}
                    className="text-red-400 hover:text-red-600 text-lg font-bold leading-none"
                    title="Eliminar artículo"
                  >
                    ×
                  </button>
                )}
                <span className="text-gray-400 text-xs">{item.abierto ? "▲" : "▼"}</span>
              </div>
            </div>

            {item.abierto && (
              <div className="px-4 pb-4 border-t">
                <div className="grid grid-cols-2 gap-3 mt-3 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Nombre del artículo
                    </label>
                    <input
                      className={inputCls}
                      placeholder="Ej: Figura Pikachu"
                      value={item.descripcion}
                      onChange={(e) =>
                        updateItem(item.localId, (i) => ({
                          ...i,
                          descripcion: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Tiempo de impresión (min)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      placeholder="Minutos"
                      value={item.tiempo}
                      onChange={(e) =>
                        updateItem(item.localId, (i) => ({
                          ...i,
                          tiempo: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Materiales */}
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Materiales</p>
                <div className="grid grid-cols-12 gap-1 text-xs text-gray-400 mb-1 px-1">
                  <span className="col-span-1" />
                  <span className="col-span-4">Filamento</span>
                  <span className="col-span-3">S/ / kg</span>
                  <span className="col-span-3">Gramos</span>
                  <span className="col-span-1" />
                </div>
                {item.materiales.map((mat, matIdx) => (
                  <div
                    key={matIdx}
                    className="grid grid-cols-12 gap-1 mb-1.5 items-center"
                  >
                    <span className="col-span-1 text-xs text-gray-400 text-right pr-1">
                      {matIdx + 1}.
                    </span>
                    <div className="col-span-4">
                      <select
                        className="w-full border border-gray-300 rounded px-1.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2980b9]"
                        value={mat.filamento_id ?? ""}
                        onChange={(e) =>
                          handleFilamentoSelect(
                            item.localId,
                            matIdx,
                            e.target.value || null
                          )
                        }
                      >
                        <option value="">— Manual —</option>
                        {filamentos.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.marca} {f.tipo}
                            {f.color ? ` (${f.color})` : ""} — S/{f.precio_kg}/kg
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-gray-300 rounded px-1.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2980b9]"
                        placeholder="S/ / kg"
                        value={mat.precioKilo}
                        onChange={(e) =>
                          handleMatChange(item.localId, matIdx, "precioKilo", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-gray-300 rounded px-1.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2980b9]"
                        placeholder="g"
                        value={mat.gramos}
                        onChange={(e) =>
                          handleMatChange(item.localId, matIdx, "gramos", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      {item.materiales.length > 1 && (
                        <button
                          onClick={() => eliminarMaterial(item.localId, matIdx)}
                          className="text-gray-300 hover:text-red-400 font-bold text-base leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {item.materiales.length < 8 && (
                  <button
                    onClick={() => agregarMaterial(item.localId)}
                    className="text-xs text-[#2980b9] hover:text-[#1f618d] underline mt-1"
                  >
                    + Material
                  </button>
                )}

                {/* Resultado del ítem */}
                {item.resultado.conGanancia > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    {(
                      [
                        ["Sin margen", item.resultado.sinMargen],
                        ["Con margen", item.resultado.conMargen],
                        ["Total", item.resultado.conGanancia],
                      ] as [string, number][]
                    ).map(([label, val]) => (
                      <div key={label} className="bg-[#ebf5ff] rounded p-2 text-center">
                        <p className="text-gray-500">{label}</p>
                        <p className="font-bold text-[#1f618d]">S/ {fmt(val)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <button
          onClick={agregarItem}
          className="w-full border-2 border-dashed border-[#2980b9] text-[#2980b9] hover:bg-[#ebf5ff] py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          + Agregar artículo
        </button>
      </div>

      {/* Right: resumen + guardar */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-bold text-[#1f618d] uppercase mb-3">Resumen del Pedido</h2>
          <div className="space-y-2">
            {(
              [
                ["Artículos válidos", `${items.filter((i) => i.resultado.conGanancia > 0).length}`],
                ["Gramos totales", `${fmt(totalGramos)} g`],
                ["Tiempo total", `${totalTiempo} min`],
                ["Sin margen", `S/ ${fmt(totalSinMargen)}`],
                ["Con margen", `S/ ${fmt(totalConMargen)}`],
              ] as [string, string][]
            ).map(([label, val]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-sm text-gray-700">{val}</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-[#1f618d]">TOTAL COTIZACIÓN</span>
                <div className="bg-[#2980b9] text-white font-bold text-sm rounded px-3 py-2">
                  S/ {fmt(totalConGanancia)}
                </div>
              </div>
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
