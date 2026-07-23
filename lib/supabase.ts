import { createClient } from "@supabase/supabase-js";
import {
  Cotizacion, Venta, FormulaConfig, DEFAULT_FORMULA,
  Filamento, CotizacionItem, CotizacionItemMaterial, VentaItem, StockProducto,
} from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

function sbError(e: { message?: string; details?: string; hint?: string }): Error {
  const msg = [e.message, e.details, e.hint].filter(Boolean).join(" | ");
  return new Error(msg || JSON.stringify(e));
}

// --- Cotizaciones ---

export async function getCotizaciones(cliente?: string, desde?: string, hasta?: string) {
  let q = supabase.from("cotizaciones").select("*").order("fecha_registro", { ascending: false });
  if (cliente) q = q.ilike("cliente", `%${cliente}%`);
  if (desde) q = q.gte("fecha_registro", desde);
  if (hasta) q = q.lte("fecha_registro", hasta);
  const { data, error } = await q;
  if (error) throw sbError(error);
  return (data ?? []) as Cotizacion[];
}

export async function insertCotizacion(c: Omit<Cotizacion, "fecha_registro">) {
  const { error } = await supabase.from("cotizaciones").insert([c]);
  if (error) throw sbError(error);
}

export async function insertCotizacionConItems(
  cotizacion: Omit<Cotizacion, "fecha_registro">,
  items: CotizacionItem[]
) {
  const { error: cotError } = await supabase.from("cotizaciones").insert([cotizacion]);
  if (cotError) throw sbError(cotError);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { data: inserted, error: itemError } = await supabase
      .from("cotizacion_items")
      .insert([{
        cotizacion_id: cotizacion.id,
        descripcion: item.descripcion,
        tiempo: item.tiempo,
        inv_sin_margen: item.inv_sin_margen ?? 0,
        inv_con_margen: item.inv_con_margen ?? 0,
        inv_con_ganancia: item.inv_con_ganancia ?? 0,
        orden: i + 1,
      }])
      .select("id")
      .single();
    if (itemError) throw sbError(itemError);

    const mats = (item.materiales ?? []).filter((m) => m.precio_kg > 0 && m.gramos > 0);
    if (mats.length > 0) {
      const { error: matError } = await supabase.from("cotizacion_item_materiales").insert(
        mats.map((m) => ({
          item_id: inserted.id,
          filamento_id: m.filamento_id ?? null,
          precio_kg: m.precio_kg,
          gramos: m.gramos,
        }))
      );
      if (matError) throw sbError(matError);
    }
  }
}

export async function getCotizacionItems(cotizacion_id: string): Promise<CotizacionItem[]> {
  const { data, error } = await supabase
    .from("cotizacion_items")
    .select("*, cotizacion_item_materiales(*)")
    .eq("cotizacion_id", cotizacion_id)
    .order("orden");
  if (error) throw sbError(error);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    cotizacion_id: row.cotizacion_id,
    descripcion: row.descripcion,
    tiempo: row.tiempo,
    inv_sin_margen: row.inv_sin_margen,
    inv_con_margen: row.inv_con_margen,
    inv_con_ganancia: row.inv_con_ganancia,
    orden: row.orden,
    materiales: (row.cotizacion_item_materiales ?? []) as CotizacionItemMaterial[],
  }));
}

export async function deleteCotizacion(id: string) {
  const { error } = await supabase.from("cotizaciones").delete().eq("id", id);
  if (error) throw sbError(error);
}

// --- Ventas ---

export async function getVentas(cliente?: string, desde?: string, hasta?: string) {
  let q = supabase.from("ventas").select("*").order("fecha_registro", { ascending: false });
  if (cliente) q = q.ilike("cliente", `%${cliente}%`);
  if (desde) q = q.gte("fecha_registro", desde);
  if (hasta) q = q.lte("fecha_registro", hasta);
  const { data, error } = await q;
  if (error) throw sbError(error);
  return (data ?? []) as Venta[];
}

export async function insertVenta(v: Omit<Venta, "fecha_registro">) {
  const { error } = await supabase.from("ventas").insert([v]);
  if (error) throw sbError(error);
}

export async function insertVentaConItems(
  venta: Omit<Venta, "fecha_registro">,
  items: VentaItem[],
  materialesParaStock: CotizacionItemMaterial[]
) {
  const { error: ventaError } = await supabase.from("ventas").insert([venta]);
  if (ventaError) throw sbError(ventaError);

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("venta_items").insert(
      items.map((item, i) => ({
        venta_id: venta.id,
        cotizacion_item_id: item.cotizacion_item_id ?? null,
        descripcion: item.descripcion,
        precio_item: item.precio_item,
        orden: i + 1,
      }))
    );
    if (itemsError) throw sbError(itemsError);
  }

  // Descontar stock por filamento agrupando gramos
  const porFilamento: Record<string, number> = {};
  for (const m of materialesParaStock) {
    if (m.filamento_id) {
      porFilamento[m.filamento_id] = (porFilamento[m.filamento_id] || 0) + m.gramos;
    }
  }
  for (const [fid, gramos] of Object.entries(porFilamento)) {
    const { data: fil } = await supabase.from("filamentos").select("gramos_stock").eq("id", fid).single();
    if (!fil) continue;
    // ponytail: soft fail, no transaction; acceptable for small business
    await supabase.from("filamentos")
      .update({ gramos_stock: Math.max(0, (fil.gramos_stock || 0) - gramos) })
      .eq("id", fid);
  }
}

export async function getVentaItems(venta_id: string): Promise<VentaItem[]> {
  const { data, error } = await supabase
    .from("venta_items")
    .select("*")
    .eq("venta_id", venta_id)
    .order("orden");
  if (error) throw sbError(error);
  return (data ?? []) as VentaItem[];
}

export async function deleteVenta(id: string) {
  const { error } = await supabase.from("ventas").delete().eq("id", id);
  if (error) throw sbError(error);
}

// --- Filamentos ---

export async function getFilamentos(soloActivos = false): Promise<Filamento[]> {
  let q = supabase.from("filamentos").select("*").order("marca").order("tipo");
  if (soloActivos) q = q.eq("activo", true);
  const { data, error } = await q;
  if (error) throw sbError(error);
  return (data ?? []) as Filamento[];
}

export async function insertFilamento(f: Omit<Filamento, "id" | "fecha_registro">) {
  const { error } = await supabase.from("filamentos").insert([f]);
  if (error) throw sbError(error);
}

export async function updateFilamento(id: string, f: Partial<Omit<Filamento, "id" | "fecha_registro">>) {
  const { error } = await supabase.from("filamentos").update(f).eq("id", id);
  if (error) throw sbError(error);
}

// --- Stock de productos ---

export async function getStockProductos(): Promise<StockProducto[]> {
  const { data, error } = await supabase
    .from("stock_productos")
    .select("*")
    .gt("cantidad_disponible", 0)
    .order("fecha_produccion", { ascending: false });
  if (error) throw sbError(error);
  return (data ?? []) as StockProducto[];
}

export async function insertStockDesdeItems(
  cotizacion: Cotizacion,
  items: Array<{ cotizacion_item_id: string | null; descripcion: string; precio_costo: number; precio_venta_sugerido: number; cantidad: number }>
) {
  const rows = items.map((item) => ({
    cotizacion_id: cotizacion.id,
    cotizacion_item_id: item.cotizacion_item_id,
    descripcion: item.descripcion,
    precio_costo: item.precio_costo,
    precio_venta_sugerido: item.precio_venta_sugerido,
    cantidad_disponible: item.cantidad,
  }));
  const { error } = await supabase.from("stock_productos").insert(rows);
  if (error) throw sbError(error);
}

export async function venderDesdeStock(
  venta: Omit<Venta, "fecha_registro">,
  ventaItems: Array<{ stock_producto_id: string; descripcion: string; precio_item: number; cantidad: number }>
) {
  const { error: ventaError } = await supabase.from("ventas").insert([venta]);
  if (ventaError) throw sbError(ventaError);

  const { error: itemsError } = await supabase.from("venta_items").insert(
    ventaItems.map((item, i) => ({
      venta_id: venta.id,
      stock_producto_id: item.stock_producto_id,
      descripcion: item.descripcion,
      precio_item: item.precio_item,
      cantidad: item.cantidad,
      orden: i + 1,
    }))
  );
  if (itemsError) throw sbError(itemsError);

  // Descontar cantidad del stock
  for (const item of ventaItems) {
    const { data: sp } = await supabase
      .from("stock_productos")
      .select("cantidad_disponible")
      .eq("id", item.stock_producto_id)
      .single();
    if (!sp) continue;
    await supabase
      .from("stock_productos")
      .update({ cantidad_disponible: Math.max(0, sp.cantidad_disponible - item.cantidad) })
      .eq("id", item.stock_producto_id);
  }
}

// --- Tipos de filamento ---

export async function getTiposFilamento(): Promise<string[]> {
  const { data, error } = await supabase
    .from("tipo_filamento")
    .select("nombre")
    .order("orden")
    .order("nombre");
  if (error) throw sbError(error);
  return (data ?? []).map((r) => r.nombre as string);
}

export async function insertTipoFilamento(nombre: string) {
  const { error } = await supabase.from("tipo_filamento").insert([{ nombre }]);
  if (error) throw sbError(error);
}

export async function deleteTipoFilamento(nombre: string) {
  const { error } = await supabase.from("tipo_filamento").delete().eq("nombre", nombre);
  if (error) throw sbError(error);
}

// --- Fórmula ---

export async function getFormulaConfig(): Promise<FormulaConfig> {
  const { data, error } = await supabase.from("config_formula").select("clave, valor");
  if (error) throw sbError(error);
  const config = { ...DEFAULT_FORMULA };
  for (const row of data ?? []) {
    if (row.clave in config) {
      (config as Record<string, number>)[row.clave] = Number(row.valor);
    }
  }
  return config;
}

export async function updateFormulaConfig(clave: string, valor: number) {
  const { error } = await supabase.from("config_formula").update({ valor }).eq("clave", clave);
  if (error) throw sbError(error);
}
