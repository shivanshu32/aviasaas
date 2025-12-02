import { PrescriptionPrint } from '../../components/print';

/**
 * PrescriptionPrintView - Wrapper that uses the new professional print template
 */
export default function PrescriptionPrintView({ prescription, patient, doctor }) {
  if (!prescription) return null;

  return <PrescriptionPrint prescription={prescription} patient={patient} doctor={doctor} />;
}
