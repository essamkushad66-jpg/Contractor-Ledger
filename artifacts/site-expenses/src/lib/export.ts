import type { Project, Transaction } from "@workspace/api-client-react";
import { formatDate } from "./format";

export function exportTransactionsToCSV(project: Project, transactions: Transaction[]) {
  // Define CSV headers
  const headers = [
    "التاريخ",
    "الوصف",
    "النوع",
    "المبلغ",
    "اسم المحل",
    "اسم الشخص",
    "طريقة الدفع",
    "تاريخ التسجيل"
  ];

  // Map transactions to CSV rows
  const rows = transactions.map(tx => [
    formatDate(tx.date).replace(/,/g, ''), // Remove commas to prevent CSV breaking
    `"${tx.description.replace(/"/g, '""')}"`, // Escape quotes
    tx.type === "deposit" ? "مستلمة (إيداع)" : "مصروف (سحب)",
    tx.amount,
    `"${(tx.shopName || "").replace(/"/g, '""')}"`,
    `"${(tx.personName || "").replace(/"/g, '""')}"`,
    tx.paymentMethod === 'cash' ? 'نقدي' : tx.paymentMethod === 'transfer' ? 'تحويل بنكي' : tx.paymentMethod === 'card' ? 'بطاقة' : tx.paymentMethod === 'check' ? 'صك' : 'نقدي',
    new Date(tx.createdAt).toLocaleDateString("ar-LY").replace(/,/g, '')
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(","),
    ...rows.map(e => e.join(","))
  ].join("\n");

  // Add UTF-8 BOM so Excel opens it with correct Arabic encoding
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });

  // Trigger download
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `تقرير_حركات_${project.name.replace(/\s+/g, "_")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
