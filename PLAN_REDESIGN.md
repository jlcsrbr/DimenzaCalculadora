# Plan de rediseño — multi-ítem, filamentos, fórmula configurable, venta con resumen

## SQL — ejecutar en Supabase SQL Editor (en orden)

```sql
-- 1. Fórmula configurable
CREATE TABLE config_formula (
  clave       varchar(50)    PRIMARY KEY,
  valor       numeric(10,4)  NOT NULL,
  descripcion varchar(100)
);
INSERT INTO config_formula VALUES
  ('labor_rate',       0.08,   'Costo mano de obra (S/ por minuto)'),
  ('electricity_rate', 0.008,  'Costo electricidad (S/ por minuto)'),
  ('margin',           1.2,    'Multiplicador de margen (20%)'),
  ('profit',           1.3,    'Multiplicador de ganancia (30%)');

-- 2. Catálogo de filamentos + stock
CREATE TABLE filamentos (
  id             uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  marca          varchar(100)  NOT NULL,
  tipo           varchar(50)   NOT NULL,   -- PLA, PETG, ABS, TPU, etc.
  color          varchar(50),
  gramos_stock   numeric(10,2) NOT NULL DEFAULT 0,
  precio_kg      numeric(10,2) NOT NULL,
  activo         boolean       NOT NULL DEFAULT true,
  fecha_registro date          DEFAULT CURRENT_DATE
);

-- 3. Ítems de cotización (un artículo por fila)
CREATE TABLE cotizacion_items (
  id               uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  cotizacion_id    varchar(50)  NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  descripcion      varchar(255) NOT NULL,
  tiempo           numeric(10,2) NOT NULL DEFAULT 0,
  inv_sin_margen   numeric(10,2),
  inv_con_margen   numeric(10,2),
  inv_con_ganancia numeric(10,2),
  orden            smallint     DEFAULT 1
);

-- 4. Materiales por ítem de cotización
CREATE TABLE cotizacion_item_materiales (
  id           uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id      uuid          NOT NULL REFERENCES cotizacion_items(id) ON DELETE CASCADE,
  filamento_id uuid          REFERENCES filamentos(id),  -- NULL = entrada manual
  precio_kg    numeric(10,2) NOT NULL,
  gramos       numeric(10,2) NOT NULL
);

-- 5. Campos extra en ventas (resumen personalizado)
ALTER TABLE ventas
  ADD COLUMN descripcion_resumen varchar(500),
  ADD COLUMN usar_resumen        boolean DEFAULT false;

-- 6. Ítems de venta
CREATE TABLE venta_items (
  id                 uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  venta_id           varchar(50)   NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  cotizacion_item_id uuid          REFERENCES cotizacion_items(id),
  descripcion        varchar(255)  NOT NULL,
  precio_item        numeric(10,2) NOT NULL,
  orden              smallint      DEFAULT 1
);

-- 7. RLS: habilitar y crear política permisiva para anon en cada tabla nueva
ALTER TABLE config_formula              ENABLE ROW LEVEL SECURITY;
ALTER TABLE filamentos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizacion_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizacion_item_materiales  ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items                 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON config_formula             FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON filamentos                 FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON cotizacion_items           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON cotizacion_item_materiales FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON venta_items                FOR ALL TO anon USING (true) WITH CHECK (true);
```

---

## Cambios en el código

### Orden de implementación

| # | Archivo | Tipo |
|---|---------|------|
| 1 | `lib/types.ts` | Nuevas interfaces |
| 2 | `lib/supabase.ts` | Nuevas funciones CRUD |
| 3 | `lib/calculadora-logica.ts` | Recibe `FormulaConfig` en lugar de constantes |
| 4 | `components/Configuracion.tsx` | **Nuevo** — CRUD config_formula |
| 5 | `components/Filamentos.tsx` | **Nuevo** — CRUD filamentos + stock |
| 6 | `components/Calculadora.tsx` | Refactor — multi-ítem + selector de filamento |
| 7 | `components/Cotizaciones.tsx` | Modal cerrar venta multi-paso |
| 8 | `components/Ventas.tsx` | Detalle con ítems o resumen |
| 9 | `app/page.tsx` | 5 tabs + carga FormulaConfig |
| 10 | `lib/pdf-generator.ts` | Soporte ítems en boleta |

---

### Nuevas interfaces (`lib/types.ts`)

```typescript
export interface FormulaConfig {
  labor_rate: number;
  electricity_rate: number;
  margin: number;
  profit: number;
}

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

// Actualizar Venta:
// + descripcion_resumen?: string
// + usar_resumen?: boolean
```

---

### Nuevas funciones Supabase (`lib/supabase.ts`)

- `getFormulaConfig()` → `FormulaConfig`
- `updateFormulaConfig(clave, valor)`
- `getFilamentos(soloActivos?)` → `Filamento[]`
- `insertFilamento(f)`, `updateFilamento(id, f)`, `softDeleteFilamento(id)` (activo=false)
- `getCotizacionItems(cotizacion_id)` — incluye materiales por ítem
- `insertCotizacionConItems(cotizacion, items[])` — header + ítems + materiales
- `getVentaItems(venta_id)` → `VentaItem[]`
- `insertVentaConItems(venta, items[], cotizacion_items_materiales[])` — venta + ítems + descuenta stock filamentos

---

### Calculadora — nueva UX

- Header: cliente, DNI, teléfono, descripción general
- Lista dinámica de ítems; cada ítem tiene:
  - Nombre del artículo
  - Tiempo (min)
  - Hasta 8 materiales con dropdown del catálogo de filamentos (pre-llena precio/kg)
  - Resultado calculado en tiempo real
- "＋ Agregar artículo" / "✕ Eliminar ítem"
- Panel resumen: total de todos los ítems
- Guardar → `insertCotizacionConItems`

---

### Cerrar venta — modal multi-paso

**Paso 1 — Revisar precios por ítem:**
- Lista de ítems con `inv_con_ganancia` como precio sugerido (editable)
- Total = suma ítems (editable para override)

**Paso 2 — Presentación al cliente:**
- Toggle: "Detalle completo" / "Resumen personalizado"
- Si resumen: textarea descripción + total final editable
- Guardar → `insertVentaConItems` + descuento de stock

---

### Filamentos — nueva pantalla

- Tabla: Marca, Tipo, Color (chip), Stock (badge verde/amarillo/rojo), Precio/kg, Estado
- Modal alta/edición: todos los campos
- Soft delete (activo = false), no borrado físico

---

### Configuración — nueva pantalla

- 4 cards con nombre, descripción y campo numérico editable
- Preview en vivo del resultado de la fórmula
- Guardar actualiza `config_formula` en Supabase

---

### Backward compatibility

- Cotizaciones antiguas sin ítems en DB → muestran `descripcion` legacy (decodificado)
- Ventas antiguas → muestran `descripcion` legacy
