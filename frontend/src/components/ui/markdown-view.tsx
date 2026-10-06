import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MarkdownViewProps {
  content: string;
  className?: string;
  onSelectHighlight?: (id: string) => void;
}

/**
 * Mengecek apakah sebuah baris tabel Markdown telah lengkap (tertutup).
 * Baris tabel dianggap lengkap jika berawalan dan berakhiran dengan karakter pipe '|',
 * serta tidak ada pembatas matematika LaTeX yang belum tertutup (seperti \[ tanpa \], atau $$ ganjil).
 */
function isCompleteTableRow(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;

  const openBrackets = (trimmed.match(/\\\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\\\]/g) || []).length;
  if (openBrackets !== closeBrackets) return false;

  const doubleDollars = (trimmed.match(/\$\$/g) || []).length;
  if (doubleDollars % 2 !== 0) return false;

  return true;
}

/**
 * Melakukan pra-pemrosesan untuk menyatukan baris tabel Markdown yang terpecah
 * oleh rumus matematika multibaris (misalnya: \[ \n rumus \n \]).
 */
function normalizeMarkdownContent(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inTableRow = false;
  let currentTableRow = '';

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!inTableRow) {
      if (trimmed.startsWith('|')) {
        if (isCompleteTableRow(trimmed)) {
          result.push(trimmed);
        } else {
          inTableRow = true;
          currentTableRow = trimmed;
        }
      } else {
        result.push(lines[i]);
      }
    } else {
      currentTableRow += ' ' + trimmed;
      if (isCompleteTableRow(currentTableRow)) {
        result.push(currentTableRow);
        inTableRow = false;
        currentTableRow = '';
      }
    }
  }
  if (currentTableRow) {
    result.push(currentTableRow);
  }
  return result.join('\n');
}

/**
 * Memecah baris tabel Markdown menjadi sel-sel kolom.
 * Mengabaikan karakter pipe '|' yang berada di dalam rumus matematika LaTeX (seperti |A| atau \|A\|).
 */
function splitTableRow(rowStr: string): string[] {
  const trimmed = rowStr.trim();
  let content = trimmed;
  if (content.startsWith('|')) content = content.slice(1);
  if (content.endsWith('|')) content = content.slice(0, -1);

  const cells: string[] = [];
  let currentCell = '';
  let inDoubleDollar = false;
  let inSingleDollar = false;
  let inBracketMath = false; // \[ ... \]
  let inParenMath = false;   // \( ... \)
  let inCode = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const prev = i > 0 ? content[i - 1] : '';
    const next = i + 1 < content.length ? content[i + 1] : '';

    if (ch === '`' && prev !== '\\') {
      inCode = !inCode;
      currentCell += ch;
      continue;
    }

    if (!inCode) {
      if (ch === '\\' && next === '[') {
        inBracketMath = true;
        currentCell += '\\[';
        i++;
        continue;
      }
      if (ch === '\\' && next === ']') {
        inBracketMath = false;
        currentCell += '\\]';
        i++;
        continue;
      }
      if (ch === '\\' && next === '(') {
        inParenMath = true;
        currentCell += '\\(';
        i++;
        continue;
      }
      if (ch === '\\' && next === ')') {
        inParenMath = false;
        currentCell += '\\)';
        i++;
        continue;
      }
      if (ch === '$' && next === '$' && prev !== '\\') {
        inDoubleDollar = !inDoubleDollar;
        currentCell += '$$';
        i++;
        continue;
      }
      if (ch === '$' && prev !== '\\' && !inDoubleDollar) {
        inSingleDollar = !inSingleDollar;
        currentCell += '$';
        continue;
      }
      if (ch === '\\' && next === '|') {
        currentCell += '\\|';
        i++;
        continue;
      }
    }

    const inAnyMath = inDoubleDollar || inSingleDollar || inBracketMath || inParenMath || inCode;
    if (ch === '|' && !inAnyMath) {
      cells.push(currentCell.trim());
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  cells.push(currentCell.trim());
  return cells;
}

export default function MarkdownView({ content, className = '', onSelectHighlight }: MarkdownViewProps) {
  if (!content) return null;

  // Helper untuk memformat styling inline (bold, italic, math KaTeX, code, highlight)
  const formatInline = (text: string): React.ReactNode[] => {
    // Regex mendeteksi:
    // 1. LaTeX math block di dalam teks/sel: \[...\], $$...$$, \(...\), $...$
    // 2. Bold: **...** atau __...__
    // 3. Italic: *...* atau _..._
    // 4. Inline Code: `...`
    // 5. Highlight token: [hl-...]
    const regex = /(\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)|\$(?!\$)[\s\S]*?\$|\*\*[^*]+\*\*|\_\_[^_]+\_\_|\*[^*]+\*|_[^_]+_|`[^`]+`|\[hl-\w+\])/g;
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      if (!part) return null;

      // 1. LaTeX Math via KaTeX: \[ ... \], $$ ... $$, \( ... \), atau $ ... $
      if (
        (part.startsWith('\\(') && part.endsWith('\\)')) ||
        (part.startsWith('\\[') && part.endsWith('\\]')) ||
        (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) ||
        (part.startsWith('$') && part.endsWith('$') && part.length >= 2)
      ) {
        let rawFormula = '';
        if (part.startsWith('\\(') || part.startsWith('\\[')) {
          rawFormula = part.slice(2, -2).trim();
        } else if (part.startsWith('$$')) {
          rawFormula = part.slice(2, -2).trim();
        } else {
          rawFormula = part.slice(1, -1).trim();
        }

        try {
          const html = katex.renderToString(rawFormula, {
            displayMode: false,
            throwOnError: false,
          });
          return (
            <span
              key={idx}
              className="inline-block px-1 py-0.5 mx-0.5 select-text align-baseline font-serif"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <span key={idx} className="font-serif italic px-1 text-slate-900">
              {rawFormula}
            </span>
          );
        }
      }

      // 2. Bold: **...** atau __...__
      if (
        (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
        (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
      ) {
        return (
          <strong key={idx} className="font-bold text-[#0D1B2A]">
            {formatInline(part.slice(2, -2))}
          </strong>
        );
      }

      // 3. Italic: *...* atau _..._
      if (
        ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) &&
        part.length >= 2 &&
        !part.startsWith('**') &&
        !part.startsWith('__')
      ) {
        return (
          <em key={idx} className="italic text-slate-800 font-medium">
            {formatInline(part.slice(1, -1))}
          </em>
        );
      }

      // 4. Inline Code: `...`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code key={idx} className="px-1.5 py-0.5 mx-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[11px] text-slate-800">
            {part.slice(1, -1)}
          </code>
        );
      }

      // 5. Highlight token: [hl-...]
      const matchHl = part.match(/^\[hl-(\w+)\]$/);
      if (matchHl && onSelectHighlight) {
        const highlightId = `hl-${matchHl[1]}`;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectHighlight(highlightId)}
            className="mx-1 px-1.5 py-0.5 bg-[#415A77]/10 hover:bg-[#415A77]/15 text-[#0D1B2A] rounded text-[10px] font-bold font-mono transition-colors border border-[#415A77]/35 cursor-pointer align-middle"
          >
            Lihat Kutipan
          </button>
        );
      }

      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  // Normalisasi konten sebelum parsing baris per baris
  const normalizedContent = normalizeMarkdownContent(content);
  const lines = normalizedContent.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let continuousStepCounter = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Skip baris kosong
    if (!line) {
      i++;
      continue;
    }

    // 2. Deteksi Rumus Matematika Blok Luar Tabel KaTeX ($$...$$ atau \[...\] baik single line maupun multi-line)
    if (line.startsWith('$$') || line.startsWith('\\[')) {
      const isBracket = line.startsWith('\\[');
      const endDelim = isBracket ? '\\]' : '$$';
      let mathContent = '';

      // Kasus A: Single-line math block e.g. \[ E = mc^2 \]
      if (
        (isBracket && line.endsWith('\\]') && line.length > 3) ||
        (!isBracket && line.endsWith('$$') && line.length > 3)
      ) {
        mathContent = isBracket ? line.slice(2, -2).trim() : line.slice(2, -2).trim();
        i++;
      } else {
        // Kasus B: Multi-line math block e.g. \[ \n formula \n \]
        mathContent = line.replace(/^\\\[|^\$\$/, '').trim();
        i++;
        while (i < lines.length) {
          const curLine = lines[i].trim();
          if (curLine.endsWith(endDelim) || curLine === endDelim) {
            const cleanCur = curLine.replace(/\\\]$|\$\$$/, '').trim();
            if (cleanCur) mathContent += ' ' + cleanCur;
            i++;
            break;
          } else {
            mathContent += ' ' + curLine;
            i++;
          }
        }
      }

      if (mathContent) {
        let blockHtml = '';
        try {
          blockHtml = katex.renderToString(mathContent.trim(), {
            displayMode: true,
            throwOnError: false,
          });
        } catch {
          blockHtml = mathContent;
        }

        elements.push(
          <div
            key={`math-block-${i}`}
            className="my-3 py-3 px-3 rounded-lg bg-slate-50/90 border border-slate-200/90 text-center overflow-x-auto select-text shadow-2xs"
            dangerouslySetInnerHTML={{ __html: blockHtml }}
          />
        );
        continue;
      }
    }

    // 3. Deteksi Tabel Markdown (| col1 | col2 |)
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCells = splitTableRow(tableLines[0]);
        // Baris ke-1 biasanya separator |---|---|
        const isSeparator = /^\|[\s-:]+\|$/.test(tableLines[1].replace(/\|/g, '| '));
        const bodyLines = isSeparator ? tableLines.slice(2) : tableLines.slice(1);
        const bodyRows = bodyLines.map(splitTableRow);

        elements.push(
          <div key={`table-${i}`} className="my-2.5 overflow-x-auto rounded-lg border border-slate-200 shadow-2xs bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-[#0D1B2A] font-bold">
                  {headerCells.map((h, hIdx) => (
                    <th key={hIdx} className="px-3 py-2 border-r last:border-r-0 border-slate-200 whitespace-nowrap">
                      {formatInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 border-r last:border-r-0 border-slate-200 leading-relaxed text-slate-700 align-middle">
                        {formatInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 4. Deteksi Judul Bagian Utama bernomor seperti "1. BASIC RRF FORMULA", "2. HYBRID RRF", "3. PRACTICAL STEPS"
    const mainSectionMatch = line.match(/^(\d+)\.\s+([A-Z0-9\s\(\)\/]{3,})$/);
    if (mainSectionMatch) {
      continuousStepCounter = 0; // Reset counter langkah
      const secNum = mainSectionMatch[1];
      const secTitle = mainSectionMatch[2];

      elements.push(
        <div key={`sec-${i}`} className="mt-3.5 mb-1.5 pb-1 border-b border-slate-200 flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-md bg-[#0D1B2A] text-white text-[10px] font-bold flex items-center justify-center font-mono shrink-0">
            {secNum}
          </span>
          <h4 className="text-xs font-bold text-[#0D1B2A] uppercase tracking-wider">
            {secTitle}
          </h4>
        </div>
      );
      i++;
      continue;
    }

    // 5. Deteksi Headings Markdown (###, ##, #)
    if (line.startsWith('### ')) {
      continuousStepCounter = 0;
      elements.push(
        <h4 key={`h4-${i}`} className="text-xs font-bold text-[#0D1B2A] uppercase tracking-wider mt-2.5 mb-1 pb-1 border-b border-slate-200/80">
          {formatInline(line.slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      continuousStepCounter = 0;
      elements.push(
        <h3 key={`h3-${i}`} className="text-[13px] font-bold text-[#0D1B2A] mt-3 mb-1 pb-1 border-b border-slate-200/80">
          {formatInline(line.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      continuousStepCounter = 0;
      elements.push(
        <h2 key={`h2-${i}`} className="text-sm font-bold text-[#0D1B2A] mt-3 mb-1.5">
          {formatInline(line.slice(2))}
        </h2>
      );
      i++;
      continue;
    }

    // 6. Deteksi Blockquote (> ...)
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i++;
      }
      elements.push(
        <div key={`quote-${i}`} className="my-2 p-2.5 rounded-lg border-l-2 border-[#D4AF37] bg-[#415A77]/10/40 text-xs text-slate-700 leading-relaxed italic space-y-1">
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{formatInline(ql)}</p>
          ))}
        </div>
      );
      continue;
    }

    // 7. Deteksi Bullet List (- item atau * item yang bukan italic *Tip:*)
    if (line.startsWith('- ') || (line.startsWith('* ') && !line.startsWith('*Tip:*'))) {
      const listItems: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') ||
          (lines[i].trim().startsWith('* ') && !lines[i].trim().startsWith('*Tip:*')))
      ) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-1.5 space-y-1 text-xs text-slate-700 list-disc pl-4 leading-relaxed">
          {listItems.map((item, lIdx) => (
            <li key={lIdx}>{formatInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // 8. Deteksi Numbered Step (e.g. "1. Generate Ranked Lists", "2. Assign Weights")
    const stepMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (stepMatch) {
      continuousStepCounter++;
      const stepTitle = stepMatch[2];

      elements.push(
        <div key={`step-${i}`} className="flex items-center gap-2 mt-2.5 mb-1">
          <span className="w-5 h-5 min-w-[20px] rounded-full bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-bold flex items-center justify-center font-mono shrink-0 shadow-2xs">
            {continuousStepCounter}
          </span>
          <div className="text-xs font-bold text-[#0D1B2A] leading-tight">
            {formatInline(stepTitle)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // 9. Paragraf Teks Biasa
    elements.push(
      <p key={`p-${i}`} className="text-xs text-slate-800 leading-relaxed my-1">
        {formatInline(line)}
      </p>
    );
    i++;
  }

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
}
