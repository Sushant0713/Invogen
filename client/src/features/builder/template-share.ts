export function buildTemplateShareMessage(templateName: string): string {
  return `Invoice template "${templateName}" — preview PDF attached.`;
}

export function openEmailShare(templateName: string, pdfFilename: string): void {
  const subject = encodeURIComponent(`Invoice Template: ${templateName}`);
  const body = encodeURIComponent(
    `Hello,\n\nPlease find the invoice template "${templateName}" (${pdfFilename}).\n\nThe PDF has been downloaded from the template editor — attach it to this email before sending.\n\nThank you.`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

export function openWhatsAppShare(templateName: string): void {
  const text = encodeURIComponent(buildTemplateShareMessage(templateName));
  window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
}

export function canNativeShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return false;
  }
  try {
    const file = new File([''], 'test.pdf', { type: 'application/pdf' });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function nativeSharePdf(
  blob: Blob,
  filename: string,
  templateName: string
): Promise<boolean> {
  if (!canNativeShareFiles()) return false;

  const file = new File([blob], filename, { type: 'application/pdf' });
  await navigator.share({
    title: templateName,
    text: buildTemplateShareMessage(templateName),
    files: [file],
  });
  return true;
}
