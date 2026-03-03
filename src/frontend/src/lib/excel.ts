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
    ["编号 (SKU)", "产品名称", "数量", "单价 (£)", "小计 (£)"],
    ...items.map((item) => [
      item.sku,
      item.name,
      item.quantity,
      item.unitPrice,
      item.unitPrice * item.quantity,
    ]),
    [],
    ["", "", "", "总计 (£)", total],
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
      "Name_CN_Traditional",
      "Name_En",
      "Category_ID",
      "Category",
      "Brand",
      "Size",
      "BBD",
      "VAT",
      "UOM",
      "Stock",
      "Promotions",
      "Price",
      "Stock_Status",
      "Image_FileName",
    ],
    [
      "PROD-001",
      "示例產品繁體",
      "Sample Product",
      "CAT-001",
      "General",
      "Brand",
      "1kg",
      "2027-12-31",
      "0",
      "PCS",
      "100",
      "",
      "99.99",
      "in_stock",
      "product-001.jpg",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(templateData);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 22 },
    { wch: 22 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 20 },
    { wch: 10 },
    { wch: 14 },
    { wch: 20 },
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
  nameCnTraditional: string;
  nameEn: string;
  category: string;
  categoryId: string;
  brand: string;
  size: string;
  bbd: string;
  vat: number;
  uom: string;
  stock: number;
  promotions: string;
  price: number;
  stockStatus: string;
  imageFileName: string;
}

/**
 * Convert an Excel date serial number to an ISO date string (YYYY-MM-DD).
 * Excel stores dates as days since 1900-01-00 (with a leap year bug for 1900).
 * Returns the original string if it's already a valid date string or empty.
 */
function excelDateToISOString(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  // If it's already a string that looks like a date, return it trimmed
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return "";
    // Already formatted as YYYY-MM-DD or similar
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);
    // Try parsing it as a date string
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().substring(0, 10);
    }
    return trimmed;
  }
  if (typeof value === "number") {
    // Excel serial date: days since 1900-01-00 (Excel has a leap year bug treating 1900 as leap)
    // Adjust: subtract 1 for the leap year bug (for dates after Feb 28, 1900)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Dec 30, 1899
    const msPerDay = 86400000;
    const date = new Date(excelEpoch.getTime() + value * msPerDay);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().substring(0, 10);
    }
  }
  if (value instanceof Date) {
    return value.toISOString().substring(0, 10);
  }
  return String(value);
}

export function parseProductsExcel(file: File): Promise<ParsedProductRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Use cellDates: true so XLSX parses date cells as JS Date objects where possible
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          raw: false,
          dateNF: "yyyy-mm-dd",
        });

        const products: ParsedProductRow[] = rows.map((row) => {
          const rawBbd = row.BBD ?? row.bbd;
          const rawStockStatus = row.Stock_Status ?? row.stock_status;
          return {
            sku: String(row.SKU || row.sku || ""),
            nameCnTraditional: String(
              row.Name_CN_Traditional || row.name_cn_traditional || "",
            ),
            nameEn: String(row.Name_En || row.name_en || ""),
            category: String(row.Category || row.category || ""),
            categoryId: String(row.Category_ID || row.category_id || ""),
            brand: String(row.Brand || row.brand || ""),
            size: String(row.Size || row.size || ""),
            bbd: excelDateToISOString(rawBbd),
            vat: Number(row.VAT ?? row.vat ?? 0),
            uom: String(row.UOM || row.uom || ""),
            stock: Number(row.Stock ?? row.stock ?? 0),
            promotions: String(row.Promotions || row.promotions || ""),
            price: Number(row.Price || row.price || 0),
            stockStatus: rawStockStatus
              ? String(rawStockStatus).trim().toLowerCase().replace(/\s+/g, "_")
              : "in_stock",
            imageFileName: String(
              row.Image_FileName || row.image_filename || "",
            ),
          };
        });

        resolve(products.filter((p) => p.sku));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
