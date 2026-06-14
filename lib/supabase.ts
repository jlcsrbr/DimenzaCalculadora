import { createClient } from "@supabase/supabase-js";
import { Cotizacion, Venta } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

function sbError(e: { message?: string; details?: string; hint?: string }): Error {
  const msg = [e.message, e.details, e.hint].filter(Boolean).join(" | ");
  return new Error(msg || JSON.stringify(e));
}

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

export async function deleteCotizacion(id: string) {
  const { error } = await supabase.from("cotizaciones").delete().eq("id", id);
  if (error) throw sbError(error);
}

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
