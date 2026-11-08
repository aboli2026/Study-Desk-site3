import { PDFDocument, rgb, PDFName, PDFString } from 'pdf-lib';
import { DrawingStroke, StickyNoteItem } from '../types';

export interface ExportAnnotatedPdfOptions {
  pdfData: ArrayBuffer;
  fileName: string;
  pageStrokes: Record<number, DrawingStroke[]>;
  stickyNotes: StickyNoteItem[];
  fileId?: string;
}

/**
 * Parses color strings (hex, rgb, rgba) into normalized 0-1 values for pdf-lib rgb()
 */
function parseColorToRgb(colorStr: string) {
  if (!colorStr) return rgb(0.1, 0.1, 0.1);

  const clean = colorStr.trim().toLowerCase();

  // Hex colors #fff or #ffffff
  if (clean.startsWith('#')) {
    let hex = clean.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      return rgb(
        isNaN(r) ? 0 : Math.max(0, Math.min(1, r)),
        isNaN(g) ? 0 : Math.max(0, Math.min(1, g)),
        isNaN(b) ? 0 : Math.max(0, Math.min(1, b))
      );
    }
  }

  // rgb/rgba string
  const rgbMatch = clean.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10) / 255;
    const g = parseInt(rgbMatch[2], 10) / 255;
    const b = parseInt(rgbMatch[3], 10) / 255;
    return rgb(
      isNaN(r) ? 0 : Math.max(0, Math.min(1, r)),
      isNaN(g) ? 0 : Math.max(0, Math.min(1, g)),
      isNaN(b) ? 0 : Math.max(0, Math.min(1, b))
    );
  }

  // Named color fallbacks
  if (clean.includes('yellow')) return rgb(0.98, 0.8, 0.08);
  if (clean.includes('green')) return rgb(0.29, 0.87, 0.5);
  if (clean.includes('blue') || clean.includes('cyan')) return rgb(0.22, 0.74, 0.97);
  if (clean.includes('pink') || clean.includes('rose')) return rgb(0.96, 0.45, 0.71);
  if (clean.includes('orange')) return rgb(0.98, 0.57, 0.24);
  if (clean.includes('purple')) return rgb(0.75, 0.52, 0.99);

  return rgb(0.15, 0.15, 0.15);
}

/**
 * Extracts embedded study workspace data (strokes, sticky notes) from a PDF.
 */
export async function extractWorkspaceDataFromPdf(pdfBuffer: ArrayBuffer): Promise<{
  pageStrokes?: Record<number, DrawingStroke[]>;
  stickyNotes?: StickyNoteItem[];
  fileName?: string;
} | null> {
  try {
    if (!pdfBuffer || pdfBuffer.byteLength < 100) return null;
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

    let base64 = '';
    const subject = pdfDoc.getSubject() || '';
    if (subject.startsWith('STUDY_WORKSPACE_DATA:')) {
      base64 = subject.slice('STUDY_WORKSPACE_DATA:'.length).trim();
    } else {
      const keywordsRaw: any = pdfDoc.getKeywords();
      if (typeof keywordsRaw === 'string') {
        const found = keywordsRaw.split(';').map((s: string) => s.trim()).find((k: string) => k.startsWith('STUDY_DATA:'));
        if (found) base64 = found.slice('STUDY_DATA:'.length).trim();
      } else if (Array.isArray(keywordsRaw)) {
        const found = keywordsRaw.find((k: any) => typeof k === 'string' && k.startsWith('STUDY_DATA:'));
        if (found) base64 = found.slice('STUDY_DATA:'.length).trim();
      }
    }

    if (!base64) return null;

    const jsonStr = decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(jsonStr);

    return {
      pageStrokes: parsed.pageStrokes || {},
      stickyNotes: parsed.stickyNotes || [],
      fileName: parsed.fileName,
    };
  } catch (err) {
    console.warn('Could not extract workspace data from PDF:', err);
    return null;
  }
}

/**
 * Bakes canvas drawings (pens, highlighters, ruler lines) and sticky notes into a downloadable PDF.
 * Uses single-pass SVG vector paths to keep colors radiant and transparent (preventing muddy/dull overlap),
 * replaces huge broken '?' boxes with elegant compact pin badges + standard PDF annotations,
 * and embeds structured metadata so the file remains 100% interactive when reopened in the app.
 */
export async function exportAnnotatedPdf(options: ExportAnnotatedPdfOptions): Promise<void> {
  const { pdfData, fileName, pageStrokes, stickyNotes, fileId } = options;

  if (!pdfData || pdfData.byteLength === 0) {
    throw new Error('فایل PDF نامعتبر است یا داده‌ای وجود ندارد.');
  }

  // Load existing PDF
  const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageNumber = pageIdx + 1;
    const page = pages[pageIdx];
    const { width, height } = page.getSize();

    // 1. Draw strokes with single-pass vector paths (NO muddy overlapping segments!)
    const strokes = pageStrokes[pageNumber] || [];
    for (const stroke of strokes) {
      if (!stroke.points || stroke.points.length === 0) continue;

      const isHighlighter = stroke.tool === 'highlighter';
      const strokeColor = parseColorToRgb(stroke.color);
      const thickness = stroke.width || (isHighlighter ? 18 : 2.5);

      // Highlighters use 0.35 opacity without self-overlap; pens use 1.0 or stroke opacity
      const strokeOpacity =
        stroke.opacity !== undefined
          ? stroke.opacity
          : isHighlighter
          ? 0.35
          : 1.0;

      if (stroke.points.length === 1) {
        // Single dot
        const pt = stroke.points[0];
        const cx = Math.max(0, Math.min(width, pt.x));
        const cy = Math.max(0, Math.min(height, height - pt.y));
        page.drawCircle({
          x: cx,
          y: cy,
          size: Math.max(1, thickness / 2),
          color: strokeColor,
          opacity: strokeOpacity,
        });
      } else {
        // Continuous single-pass SVG Path: perfectly prevents opacity multiplication!
        let pathData = `M ${Math.max(0, Math.min(width, stroke.points[0].x)).toFixed(1)} ${Math.max(
          0,
          Math.min(height, height - stroke.points[0].y)
        ).toFixed(1)}`;

        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          const px = Math.max(0, Math.min(width, pt.x)).toFixed(1);
          const py = Math.max(0, Math.min(height, height - pt.y)).toFixed(1);
          pathData += ` L ${px} ${py}`;
        }

        try {
          page.drawSvgPath(pathData, {
            borderColor: strokeColor,
            borderWidth: thickness,
            borderOpacity: strokeOpacity,
          });
        } catch {
          // Fallback if SVG parser encounters an issue
          for (let i = 0; i < stroke.points.length - 1; i++) {
            const p1 = stroke.points[i];
            const p2 = stroke.points[i + 1];
            page.drawLine({
              start: {
                x: Math.max(0, Math.min(width, p1.x)),
                y: Math.max(0, Math.min(height, height - p1.y)),
              },
              end: {
                x: Math.max(0, Math.min(width, p2.x)),
                y: Math.max(0, Math.min(height, height - p2.y)),
              },
              thickness,
              color: strokeColor,
              opacity: strokeOpacity,
            });
          }
        }
      }
    }

    // 2. Render Sticky Notes: Discrete 20x20 Pin Badge + Standard PDF Text Annotation (NO big ugly '?' box!)
    const notesForPage = (stickyNotes || []).filter((n) => n.pageNumber === pageNumber);
    for (const note of notesForPage) {
      const badgeSize = 20;
      const noteX = Math.max(4, Math.min(width - badgeSize - 4, note.x));
      const noteY = Math.max(4, Math.min(height - badgeSize - 4, height - note.y - badgeSize));

      const noteBg = parseColorToRgb(note.color || '#fef08a');
      const noteBorder = rgb(0.75, 0.65, 0.15);

      // A. Draw a discrete, compact sticky note badge (clean vector design, zero text to prevent encoding '?')
      page.drawRectangle({
        x: noteX,
        y: noteY,
        width: badgeSize,
        height: badgeSize,
        color: noteBg,
        borderColor: noteBorder,
        borderWidth: 1,
        opacity: 0.95,
      });

      // Mini note lines emblem
      page.drawLine({
        start: { x: noteX + 4, y: noteY + badgeSize - 5 },
        end: { x: noteX + badgeSize - 4, y: noteY + badgeSize - 5 },
        thickness: 1.2,
        color: noteBorder,
        opacity: 0.8,
      });
      page.drawLine({
        start: { x: noteX + 4, y: noteY + badgeSize - 9 },
        end: { x: noteX + badgeSize - 6, y: noteY + badgeSize - 9 },
        thickness: 1.2,
        color: noteBorder,
        opacity: 0.6,
      });
      page.drawLine({
        start: { x: noteX + 4, y: noteY + badgeSize - 13 },
        end: { x: noteX + badgeSize - 8, y: noteY + badgeSize - 13 },
        thickness: 1.2,
        color: noteBorder,
        opacity: 0.4,
      });

      // B. Standard PDF Text Annotation: Universal native comment in Adobe Acrobat, Foxit, Preview, etc.
      try {
        const fullContent = [note.title, note.content].filter(Boolean).join('\n\n');
        const annot = pdfDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Text',
          Rect: [noteX, noteY, noteX + badgeSize, noteY + badgeSize],
          Contents: PDFString.of(fullContent || 'یادداشت چسبان'),
          Name: 'Comment',
        });
        const annotRef = pdfDoc.context.register(annot);
        const annotsKey = PDFName.of('Annots');
        const existingAnnots = page.node.get(annotsKey);
        if (existingAnnots) {
          (existingAnnots as any).push(annotRef);
        } else {
          page.node.set(annotsKey, pdfDoc.context.obj([annotRef]));
        }
      } catch {
        // Annotation registration failure is non-fatal
      }
    }
  }

  // 3. Embed structured workspace metadata inside PDF Subject & Keywords
  try {
    const workspaceMeta = {
      version: 2,
      fileId: fileId || `study_${Date.now()}`,
      fileName,
      exportedAt: new Date().toISOString(),
      pageStrokes: pageStrokes || {},
      stickyNotes: stickyNotes || [],
    };
    const jsonStr = JSON.stringify(workspaceMeta);
    const base64Data = btoa(unescape(encodeURIComponent(jsonStr)));
    pdfDoc.setSubject(`STUDY_WORKSPACE_DATA:${base64Data}`);
    pdfDoc.setKeywords([`STUDY_DATA:${base64Data}`]);
  } catch (err) {
    console.warn('Failed to embed workspace metadata in PDF:', err);
  }

  // 4. Generate downloadable blob
  const modifiedPdfBytes = await pdfDoc.save();
  const blob = new Blob([modifiedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);

  const cleanName = fileName?.endsWith('.pdf') ? fileName : `${fileName || 'Study-Document'}.pdf`;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = cleanName;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }, 2000);
}
