import { MaterialInput, CalculoResult, FormulaConfig, DEFAULT_FORMULA } from "./types";

export function calcular(
  materiales: MaterialInput[],
  tiempoMinutos: number,
  config: FormulaConfig = DEFAULT_FORMULA
): CalculoResult {
  let costoMaterial = 0;
  let totalGramos = 0;

  for (const m of materiales) {
    const precio = parseFloat(m.precioKilo) || 0;
    const gramos = parseFloat(m.gramos) || 0;
    if (precio > 0 && gramos > 0) {
      costoMaterial += (precio / 1000) * gramos;
      totalGramos += gramos;
    }
  }

  const precioXGramo = totalGramos > 0 ? costoMaterial / totalGramos : 0;
  const precioPorMinuto = config.labor_rate * tiempoMinutos;
  const electricidad = config.electricity_rate * tiempoMinutos;
  const totalTiempoElec = precioPorMinuto + electricidad;
  const sinMargen = costoMaterial + electricidad;
  const conMargen = costoMaterial * config.margin + totalTiempoElec;
  const conGanancia = conMargen * config.profit;

  return {
    precioXGramo,
    costoMaterial,
    precioPorMinuto,
    electricidad,
    totalTiempoElec,
    sinMargen,
    conMargen,
    conGanancia,
    totalGramos,
  };
}

export function encodeMateriales(descripcion: string, materiales: MaterialInput[]): string {
  const validos = materiales.filter(
    (m) => parseFloat(m.precioKilo) > 0 && parseFloat(m.gramos) > 0
  );
  if (validos.length === 0) return descripcion;
  const det = validos.map((m) => `${parseFloat(m.precioKilo)}:${parseFloat(m.gramos)}`).join(";");
  return `${descripcion} | DET:${det}`;
}

export function decodeMateriales(raw: string): {
  descripcion: string;
  materiales: Array<{ precio: number; gramos: number }>;
} {
  if (!raw) return { descripcion: "", materiales: [] };
  const SEP = " | DET:";
  const idx = raw.indexOf(SEP);
  if (idx === -1) return { descripcion: raw, materiales: [] };

  const descripcion = raw.slice(0, idx);
  const materiales = raw
    .slice(idx + SEP.length)
    .split(";")
    .map((part) => {
      const [p, g] = part.split(":").map(Number);
      return { precio: p || 0, gramos: g || 0 };
    });

  return { descripcion, materiales };
}

export function fmt(n: number): string {
  return n.toFixed(2);
}
