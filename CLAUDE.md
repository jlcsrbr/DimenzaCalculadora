# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Stack

Next.js 16 (static export) · TypeScript · Tailwind CSS · Supabase JS (anon key, client-side only) · jsPDF

## Constraints críticos

- **Sin servidor**: `output: "export"` en `next.config.ts`. Sin API routes ni server components — todo es `"use client"`.
- **Deploy**: push a `main` → GitHub Actions construye y despliega a GitHub Pages. Output en `./out/`.
- **Env vars**: Requiere `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local` (local) o GitHub Secrets (CI). Template en `.env.local.example`.

## Base de datos

Supabase proyecto `funjnaeygfztzeidgfmx`. Tablas:

- `cotizaciones`: `id, cliente, dni, telefono, gramos, tiempo, inv_sin_margen, inv_con_margen, inv_con_ganancia, descripcion varchar(255), fecha_registro date`
- `ventas`: `id, cliente, dni, telefono, costo_base, precio_venta, descripcion varchar(255), fecha_registro date`

La columna de fecha es `fecha_registro date` — no `created_at`.

## Encoding de materiales

`descripcion` codifica detalles de materiales: `"texto | DET:precio1:gramos1;precio2:gramos2"`. Usar siempre `encodeMateriales` / `decodeMateriales` de `lib/calculadora-logica.ts`. No parsear manualmente.

## Fórmula de precios (`lib/calculadora-logica.ts`)

```
sinMargen    = costoMaterial + electricidad
conMargen    = (costoMaterial × 1.2) + (0.08 × min) + (0.008 × min)
conGanancia  = conMargen × 1.3  ← precio final sugerido
```

Constantes de negocio — no son configurables.
