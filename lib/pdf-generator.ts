import { Venta, VentaItem } from "./types";
import { decodeMateriales } from "./calculadora-logica";

export async function generarBoleta(venta: Venta, items: VentaItem[] = []): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ format: "a5", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();

  const PRIMARY: [number, number, number] = [41, 128, 185];
  const SECONDARY: [number, number, number] = [31, 97, 141];
  const LIGHT: [number, number, number] = [235, 245, 255];
  const TEXT: [number, number, number] = [44, 62, 80];

  // Header
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 30, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("DIMENZA 3D", W / 2, 13, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("DETALLE DE VENTA", W / 2, 22, { align: "center" });

  // Customer info
  let y = 38;
  const fecha = venta.fecha_registro
    ? new Date(venta.fecha_registro).toLocaleDateString("es-PE")
    : new Date().toLocaleDateString("es-PE");

  const info: [string, string][] = [
    ["Cliente:", venta.cliente],
    ["DNI:", venta.dni || "-"],
    ["Teléfono:", venta.telefono || "-"],
    ["Fecha:", fecha],
    ["ID:", venta.id],
  ];

  doc.setFillColor(...LIGHT);
  doc.rect(10, y - 5, W - 20, info.length * 7 + 5, "F");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  for (const [label, val] of info) {
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(val, 48, y);
    y += 7;
  }

  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SECONDARY);
  doc.text("SERVICIO", 14, y);
  y += 4;

  if (venta.usar_resumen) {
    // Modo resumen: una sola fila con descripción personalizada
    const resumen = venta.descripcion_resumen || venta.descripcion;
    autoTable(doc, {
      startY: y,
      head: [["Descripción", "Precio"]],
      body: [[resumen, `S/ ${venta.precio_venta.toFixed(2)}`]],
      theme: "grid",
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: TEXT },
      columnStyles: { 1: { halign: "right", cellWidth: 30 } },
      margin: { left: 10, right: 10 },
    });
  } else if (items.length > 0) {
    // Modo detalle: tabla de ítems con precio individual
    autoTable(doc, {
      startY: y,
      head: [["#", "Artículo", "Precio"]],
      body: items.map((item, i) => [
        i + 1,
        item.descripcion,
        `S/ ${item.precio_item.toFixed(2)}`,
      ]),
      theme: "grid",
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: TEXT },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        2: { halign: "right", cellWidth: 30 },
      },
      margin: { left: 10, right: 10 },
    });
  } else {
    // Legacy: descripción decodificada
    const { descripcion } = decodeMateriales(venta.descripcion);
    autoTable(doc, {
      startY: y,
      head: [["Descripción", "Precio"]],
      body: [[descripcion || venta.descripcion, `S/ ${venta.precio_venta.toFixed(2)}`]],
      theme: "grid",
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: TEXT },
      columnStyles: { 1: { halign: "right", cellWidth: 30 } },
      margin: { left: 10, right: 10 },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  // Total bar
  doc.setFillColor(...PRIMARY);
  doc.rect(10, y, W - 20, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL:", 14, y + 8);
  doc.text(`S/ ${venta.precio_venta.toFixed(2)}`, W - 14, y + 8, { align: "right" });

  y += 22;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text("¡Gracias por su preferencia!", W / 2, y, { align: "center" });

  doc.save(`Boleta_${venta.cliente}_${venta.id}.pdf`);
}
