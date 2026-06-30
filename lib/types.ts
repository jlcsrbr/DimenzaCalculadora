export interface Cotizacion {
  id: string;
  cliente: string;
  descripcion: string;
  dni: string;
  telefono: string;
  gramos: number;
  tiempo: number;
  inv_sin_margen: number;
  inv_con_margen: number;
  inv_con_ganancia: number;
  fecha_registro?: string;
}

export interface Venta {
  id: string;
  cliente: string;
  descripcion: string;
  dni: string;
  telefono: string;
  costo_base: number;
  precio_venta: number;
  descripcion_resumen?: string;
  usar_resumen?: boolean;
  fecha_registro?: string;
}

export interface MaterialInput {
  precioKilo: string;
  gramos: string;
}

export interface CalculoResult {
  precioXGramo: number;
  costoMaterial: number;
  precioPorMinuto: number;
  electricidad: number;
  totalTiempoElec: number;
  sinMargen: number;
  conMargen: number;
  conGanancia: number;
  totalGramos: number;
}

export interface FormulaConfig {
  labor_rate: number;
  electricity_rate: number;
  margin: number;
  profit: number;
}

export const DEFAULT_FORMULA: FormulaConfig = {
  labor_rate: 0.08,
  electricity_rate: 0.008,
  margin: 1.2,
  profit: 1.3,
};

export interface Filamento {
  id: string;
  marca: string;
  tipo: string;
  color?: string;
  gramos_stock: number;
  precio_kg: number;
  activo: boolean;
  fecha_registro?: string;
}

export interface CotizacionItem {
  id?: string;
  cotizacion_id?: string;
  descripcion: string;
  tiempo: number;
  inv_sin_margen?: number;
  inv_con_margen?: number;
  inv_con_ganancia?: number;
  orden?: number;
  materiales?: CotizacionItemMaterial[];
}

export interface CotizacionItemMaterial {
  id?: string;
  item_id?: string;
  filamento_id?: string | null;
  precio_kg: number;
  gramos: number;
}

export interface VentaItem {
  id?: string;
  venta_id?: string;
  cotizacion_item_id?: string | null;
  descripcion: string;
  precio_item: number;
  orden?: number;
}
