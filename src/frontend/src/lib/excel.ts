import * as XLSX from "xlsx";
import type { CartItem } from "../stores/useCartStore";

export function generateOrderExcel(params: {
  orderDate: string;
  salesRepName: string;
  customerName: string;
  items: CartItem[];
  total: number;
}): Blob {
  const { orderDate, salesRepName, customerName, items, total } = params;

  const wb = XLSX.utils.book_new();

  // Header info rows
  const headerData = [
    ["订单日期", orderDate],
    ["业务员", salesRepName],
    ["客户", customerName],
    [],
    ["编号 (SKU)", "产品名称", "数量", "单价 (¥)", "小计 (¥)"],
    ...items.map((item) => [
      item.sku,
      item.name,
      item.quantity,
      item.unitPrice,
      item.unitPrice * item.quantity,
    ]),
    [],
    ["", "", "", "总计 (¥)", total],
  ];

  const ws = XLSX.utils.aoa_to_sheet(headerData);

  // Column widths
  ws["!cols"] = [
    { wch: 15 },
    { wch: 30 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Order");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadExcel(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateTemplate(): void {
  const wb = XLSX.utils.book_new();
  const templateData = [
    [
      "SKU",
      "Name_CN_Simplified",
      "Name_CN_Traditional",
      "Category",
      "Price",
      "Stock_Status",
      "Image_URL",
    ],
    [
      "PROD-001",
      "示例产品简体",
      "示例產品繁體",
      "电子产品",
      99.99,
      "in_stock",
      "",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(templateData);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadExcel(blob, "products_template.xlsx");
}

export interface ParsedProductRow {
  sku: string;
  nameCnSimplified: string;
  nameCnTraditional: string;
  category: string;
  price: number;
  stockStatus: string;
  imageUrl: string;
}

export function parseProductsExcel(file: File): Promise<ParsedProductRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const products: ParsedProductRow[] = rows.map((row) => ({
          sku: String(row.SKU || row.sku || ""),
          nameCnSimplified: String(
            row.Name_CN_Simplified || row.name_cn_simplified || "",
          ),
          nameCnTraditional: String(
            row.Name_CN_Traditional || row.name_cn_traditional || "",
          ),
          category: String(row.Category || row.category || ""),
          price: Number(row.Price || row.price || 0),
          stockStatus: String(
            row.Stock_Status || row.stock_status || "in_stock",
          ),
          imageUrl: String(row.Image_URL || row.image_url || ""),
        }));

        resolve(products.filter((p) => p.sku));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
