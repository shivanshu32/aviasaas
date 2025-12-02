import { useRef, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Download, X } from 'lucide-react';
import { Button } from '../ui';

/**
 * PrintWrapper - A reusable component for print preview and printing
 * 
 * Usage:
 * <PrintWrapper
 *   title="OPD Bill"
 *   documentName="OPD-Bill-12345"
 *   onClose={() => setShowPrint(false)}
 * >
 *   <OpdBillPrint bill={billData} />
 * </PrintWrapper>
 */
export default function PrintWrapper({ 
  children, 
  title = 'Print Preview',
  documentName = 'document',
  onClose,
  showActions = true,
}) {
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: documentName,
    onAfterPrint: () => {
      console.log('Print completed');
    },
  });

  const handleDownloadPDF = useCallback(() => {
    // Note: For actual PDF download, you'd need a library like html2pdf or jspdf
    // This triggers the browser's print dialog which can save as PDF
    handlePrint();
  }, [handlePrint]);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/50 overflow-auto">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm no-print">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
            <h2 className="font-semibold text-gray-900">{title}</h2>
          </div>
          
          {showActions && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleDownloadPDF} icon={Download}>
                Save as PDF
              </Button>
              <Button size="sm" onClick={handlePrint} icon={Printer}>
                Print
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Print Preview */}
      <div className="py-8 px-4">
        <div 
          ref={printRef}
          className="bg-white shadow-xl mx-auto"
          style={{ 
            width: '210mm',
            minHeight: '297mm',
          }}
        >
          {children}
        </div>
      </div>

      {/* Print Instructions */}
      <div className="max-w-5xl mx-auto px-4 pb-8 no-print">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-medium mb-2">Print Tips:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>Use Chrome browser for best print quality</li>
            <li>Set paper size to A4 in print settings</li>
            <li>Enable "Background graphics" for colors to print</li>
            <li>Set margins to "Default" or "None"</li>
            <li>To save as PDF, select "Save as PDF" as the printer</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * usePrintDocument - Custom hook for printing documents
 * 
 * Usage:
 * const { printRef, handlePrint } = usePrintDocument('Bill-12345');
 * 
 * <div ref={printRef}>
 *   <BillContent />
 * </div>
 * <button onClick={handlePrint}>Print</button>
 */
export function usePrintDocument(documentTitle = 'document') {
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle,
  });

  return { printRef, handlePrint };
}
