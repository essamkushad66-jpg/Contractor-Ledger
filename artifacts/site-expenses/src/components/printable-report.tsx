import { forwardRef } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Project, Transaction } from "@workspace/api-client-react";

interface PrintableReportProps {
  project: Project;
  transactions: Transaction[];
}

export const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(
  ({ project, transactions }, ref) => {
    return (
      <div ref={ref} className="p-8 font-sans bg-white text-black text-right" dir="rtl">
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <h1 className="text-3xl font-black mb-2">تقرير تفصيلي لمعاملات المشروع</h1>
          <div className="flex justify-between text-sm font-bold mt-4">
            <span>المشروع: {project.name}</span>
            <span>العميل: {project.clientName}</span>
          </div>
          <div className="flex justify-between text-sm font-bold mt-2">
            <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-LY')}</span>
            <span>بواسطة: المقاول ليدجر (Contractor Ledger)</span>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8 text-center border-b border-black pb-6">
          <div>
            <p className="text-sm font-bold mb-1">إجمالي المستلم</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(project.totalReceived)}</p>
          </div>
          <div>
            <p className="text-sm font-bold mb-1">إجمالي المصروف</p>
            <p className="text-xl font-bold text-red-700">{formatCurrency(project.totalSpent)}</p>
          </div>
          <div>
            <p className="text-sm font-bold mb-1">الرصيد المتبقي</p>
            <p className="text-xl font-black">{formatCurrency(project.balance)}</p>
          </div>
        </div>

        {/* Transactions Table */}
        <table className="w-full text-right border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 w-[15%]">التاريخ</th>
              <th className="border border-black p-2 w-[35%]">الوصف</th>
              <th className="border border-black p-2 w-[15%]">النوع</th>
              <th className="border border-black p-2 w-[10%]">المبلغ</th>
              <th className="border border-black p-2 w-[10%]">طريقة الدفع</th>
              <th className="border border-black p-2 w-[15%]">تفاصيل أخرى</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td className="border border-black p-2">{formatDate(tx.date)}</td>
                <td className="border border-black p-2 font-bold">{tx.description}</td>
                <td className="border border-black p-2">
                  {tx.type === "deposit" ? (
                    <span className="text-green-700 font-bold">إيداع (مستلم)</span>
                  ) : (
                    <span className="text-red-700 font-bold">مصروف (سحب)</span>
                  )}
                </td>
                <td className="border border-black p-2 font-black text-right" dir="ltr">
                  <div className="text-left">{formatCurrency(tx.amount)}</div>
                  {tx.deductionPercentage ? (
                    <div className="text-[10px] text-gray-700 font-normal mt-1 border-t border-gray-300 pt-1 text-right">
                      <div className="text-left">الصافي: {formatCurrency(tx.amount - (tx.amount * tx.deductionPercentage / 100))}</div>
                      <div className="text-red-700 text-left mt-0.5">
                        {tx.deductionReason || 'خصم'} ({tx.deductionPercentage}%): {formatCurrency(tx.amount * tx.deductionPercentage / 100)}
                      </div>
                    </div>
                  ) : null}
                </td>
                <td className="border border-black p-2">
                  {tx.paymentMethod === 'cash' ? 'نقدي' : tx.paymentMethod === 'transfer' ? 'تحويل بنكي' : tx.paymentMethod === 'card' ? 'بطاقة' : tx.paymentMethod === 'check' ? 'صك' : 'نقدي'}
                </td>
                <td className="border border-black p-2 text-xs">
                  {tx.shopName && <div>محل: {tx.shopName}</div>}
                  {tx.personName && <div>شخص: {tx.personName}</div>}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="border border-black p-4 text-center">
                  لا توجد حركات مسجلة في هذا المشروع.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }
);

PrintableReport.displayName = "PrintableReport";
