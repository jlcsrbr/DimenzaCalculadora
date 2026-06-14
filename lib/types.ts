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

export interface MaterialDetalle {
  precio: number;
  gramos: number;
}
