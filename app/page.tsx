"use client";

import { useState } from "react";
import Calculadora from "@/components/Calculadora";
import Cotizaciones from "@/components/Cotizaciones";
import Ventas from "@/components/Ventas";

type Tab = "calculadora" | "cotizaciones" | "ventas";

const TABS: { id: Tab; label: string }[] = [
  { id: "calculadora", label: "Calculadora" },
  { id: "cotizaciones", label: "Cotizaciones" },
  { id: "ventas", label: "Ventas" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("calculadora");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-[#2980b9] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
            D
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">DIMENZA 3D</h1>
            <p className="text-blue-100 text-xs">Sistema de Cotizaciones</p>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="bg-[#1f618d] shadow">
        <div className="max-w-7xl mx-auto px-4 flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-6 py-3 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-white text-[#2980b9]"
                  : "text-blue-100 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4">
        {tab === "calculadora" && (
          <Calculadora
            onSaved={() => {
              refresh();
              setTab("cotizaciones");
            }}
          />
        )}
        {tab === "cotizaciones" && (
          <Cotizaciones
            key={`cot-${refreshKey}`}
            onVentaGuardada={() => {
              refresh();
              setTab("ventas");
            }}
          />
        )}
        {tab === "ventas" && <Ventas key={`ven-${refreshKey}`} />}
      </main>

      <footer className="bg-[#2980b9] text-blue-100 text-center text-xs py-2">
        Dimenza 3D © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
