import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

/**
 * Render a DOM element to a multi-page PDF and trigger a download.
 * Captures the element at 2x scale, then slices the resulting bitmap
 * across A4 pages so long reports don't get clipped.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  // Capture the element. Use a white background so dark mode / translucent
  // surfaces don't render as transparent black.
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const renderWidth = pageWidth - margin * 2;
  const renderHeight = (canvas.height * renderWidth) / canvas.width;

  if (renderHeight <= pageHeight - margin * 2) {
    pdf.addImage(imgData, "JPEG", margin, margin, renderWidth, renderHeight);
  } else {
    // Slice the image across multiple pages by shifting the y offset.
    let position = margin;
    let heightLeft = renderHeight;
    pdf.addImage(imgData, "JPEG", margin, position, renderWidth, renderHeight);
    heightLeft -= pageHeight - margin * 2;
    while (heightLeft > 0) {
      position = margin - (renderHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, position, renderWidth, renderHeight);
      heightLeft -= pageHeight - margin * 2;
    }
  }

  pdf.save(filename);
}

/** Build a safe-ish filename from a URL + suffix. */
export function pdfFilenameForUrl(url: string, suffix: string): string {
  let host = "scan";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* fall through */
  }
  const date = new Date().toISOString().slice(0, 10);
  return `${host}-${suffix}-${date}.pdf`;
}
