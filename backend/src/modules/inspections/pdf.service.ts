import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * Helper function to resolve logo to a solid Base64 Data URI for Puppeteer PDF rendering.
   */
  private resolveLogoBase64(reportLogo?: string): string {
    if (reportLogo && reportLogo.startsWith('data:image')) {
      return reportLogo;
    }
    if (reportLogo && (reportLogo.startsWith('http://') || reportLogo.startsWith('https://'))) {
      return reportLogo;
    }

    const possiblePaths = [
      path.join(process.cwd(), '../frontend/public/tvs_logo.jpeg'),
      path.join(process.cwd(), 'client/tvs_logo.jpeg'),
      path.join(process.cwd(), 'public/tvs_logo.jpeg'),
      path.join(__dirname, '../../../../frontend/public/tvs_logo.jpeg'),
      path.join(__dirname, '../../../frontend/public/tvs_logo.jpeg'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const fileBuf = fs.readFileSync(p);
          const ext = path.extname(p).toLowerCase().replace('.', '') || 'jpeg';
          const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
          return `data:${mime};base64,${fileBuf.toString('base64')}`;
        } catch (e) {
          this.logger.error(`Error reading logo file at ${p}:`, e);
        }
      }
    }
    return '';
  }

  /**
   * Generates a 100% vector-crisp A4 Landscape PDF Check Sheet using Puppeteer (Headless Chromium).
   * Exact match to sample.pdf format: Abbreviations & Remarks integrated directly inside table rows on a single page.
   */
  async generateDailyReportPdf(
    settings: any,
    partInfo: any,
    operationInfo: any,
    mcNo: string,
    dateStr: string,
    parameters: any[],
    transactions: any[],
    shifts: any[]
  ): Promise<Buffer> {
    const html = this.buildDailyReportHtml(
      settings,
      partInfo,
      operationInfo,
      mcNo,
      dateStr,
      parameters,
      transactions,
      shifts
    );

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: false,
        printBackground: true,
        margin: {
          top: '3mm',
          bottom: '3mm',
          left: '4mm',
          right: '4mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private buildDailyReportHtml(
    settings: any,
    partInfo: any,
    operationInfo: any,
    mcNo: string,
    dateStr: string,
    parameters: any[],
    transactions: any[],
    shifts: any[]
  ): string {
    const logoBase64 = this.resolveLogoBase64(settings.report_logo);
    const companyName = settings.report_company_name !== undefined ? settings.report_company_name : '';
    const companySubtitle = settings.report_company_subtitle !== undefined ? settings.report_company_subtitle : '';
    const reportTitle = settings.inspection_report_title || 'INSPECTOR - INPROCESS CHECK SHEET';
    const docNumber = settings.inspection_report_doc_number || 'TAF / P2 / 9.1B';
    const revDate = settings.inspection_report_r_date || '06.10.2023';

    // Single-page dynamic font and padding scaling based on parameter count
    const rowCount = parameters.length;
    let fontSize = '10px';
    let cellPadding = '3px 4px';
    let cellHeight = '28px';
    let headerFontSize = '10px';

    if (rowCount > 30) {
      fontSize = '7.5px';
      cellPadding = '1px 2px';
      cellHeight = '18px';
      headerFontSize = '8px';
    } else if (rowCount > 22) {
      fontSize = '8.5px';
      cellPadding = '1.5px 3px';
      cellHeight = '22px';
      headerFontSize = '8.5px';
    } else if (rowCount > 15) {
      fontSize = '9px';
      cellPadding = '2px 3.5px';
      cellHeight = '24px';
      headerFontSize = '9px';
    }

    const getReadingCount = (freq: string | null | undefined): number => {
      if (!freq) return 1;
      const lower = freq.toLowerCase().trim();
      if (lower.includes('4nos') || lower.startsWith('4')) return 2;
      return 1;
    };

    const getCellContent = (shiftName: string, intervalName: string, param: any) => {
      const tx = transactions.find(t => 
        t.shift?.name?.toLowerCase() === shiftName.toLowerCase() && 
        t.intervalName === intervalName
      );
      if (!tx || !tx.details) {
        if (getReadingCount(param.freqOfInspn) === 2) {
          return `
            <div style="position:relative; height:${cellHeight}; width:100%;">
              <svg style="position:absolute; inset:0; width:100%; height:100%;" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="0" y1="100" x2="100" y2="0" stroke="#000" stroke-width="1"/>
              </svg>
            </div>`;
        }
        return '';
      }

      const readings = tx.details.filter((d: any) => d.parameterId === param.id);
      if (readings.length === 0) {
        if (getReadingCount(param.freqOfInspn) === 2) {
          return `
            <div style="position:relative; height:${cellHeight}; width:100%;">
              <svg style="position:absolute; inset:0; width:100%; height:100%;" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="0" y1="100" x2="100" y2="0" stroke="#000" stroke-width="1"/>
              </svg>
            </div>`;
        }
        return '';
      }

      if (readings.length >= 2) {
        const val1 = readings[0];
        const val2 = readings[1];
        const color1 = val1.status === 'FAIL' ? '#dc2626' : '#111827';
        const color2 = val2.status === 'FAIL' ? '#dc2626' : '#111827';
        return `
          <div style="position:relative; height:${cellHeight}; width:100%;">
            <svg style="position:absolute; inset:0; width:100%; height:100%;" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1="0" y1="100" x2="100" y2="0" stroke="#000" stroke-width="1"/>
            </svg>
            <span style="position:absolute; top:1px; left:3px; font-size:${fontSize}; font-weight:600; color:${color1};">${val1.observedValue}</span>
            <span style="position:absolute; bottom:1px; right:3px; font-size:${fontSize}; font-weight:600; color:${color2};">${val2.observedValue}</span>
          </div>`;
      }

      const r = readings[0];
      const color = r.status === 'FAIL' ? '#dc2626' : '#111827';
      return `<div style="text-align:center; font-weight:600; font-size:${fontSize}; color:${color};">${r.observedValue}</div>`;
    };

    const isOncePerDay = (param: any) => {
      return param.frequencyUnit === 'Day-wise' || param.frequencyUnit === 'day';
    };

    const isOncePerShift = (param: any) => {
      if (isOncePerDay(param)) return false;
      const freq = String(param.freqOfInspn || '').toLowerCase().trim();
      return freq === '1' || freq === 'once per shift' || freq === '1no/shift' || freq === '1/shift' || freq === '1/day';
    };

    const getMergedCellContent = (shiftName: string, param: any) => {
      const shiftTxs = transactions
        .filter(t => t.shift?.name?.toLowerCase() === shiftName.toLowerCase())
        .sort((a, b) => new Date(a.inspectionTimestamp).getTime() - new Date(b.inspectionTimestamp).getTime());
      
      const readings: any[] = [];
      shiftTxs.forEach(tx => {
        if (tx.details) {
          tx.details.forEach((d: any) => {
            if (d.parameterId === param.id) readings.push(d);
          });
        }
      });

      if (readings.length === 0) return '';
      const r = readings[readings.length - 1];
      const color = r.status === 'FAIL' ? '#dc2626' : '#111827';
      return `<div style="text-align:center; font-weight:600; font-size:${fontSize}; color:${color};">${r.observedValue}</div>`;
    };

    const getFooterStatus = (shiftName: string, intervalName: string) => {
      const tx = transactions.find(t => 
        t.shift?.name?.toLowerCase() === shiftName.toLowerCase() && 
        t.intervalName === intervalName
      );
      if (!tx) return '-';
      return tx.status === 'PASSED' 
        ? `<span style="background:#16a34a; color:#fff; padding:1px 5px; border-radius:2px; font-size:9px; font-weight:bold;">OK</span>`
        : `<span style="background:#dc2626; color:#fff; padding:1px 5px; border-radius:2px; font-size:9px; font-weight:bold;">NG</span>`;
    };

    const getInspectorSignature = (shiftName: string, intervalName: string) => {
      const tx = transactions.find(t => 
        t.shift?.name?.toLowerCase() === shiftName.toLowerCase() && 
        t.intervalName === intervalName
      );
      if (tx?.inspector?.signature) {
        return `<img src="${tx.inspector.signature}" style="height:22px; max-width:100%; object-fit:contain; vertical-align:middle;"/>`;
      }
      return tx?.inspector?.name || '-';
    };

    const getApproverSignature = (shiftName: string) => {
      const shiftTxs = transactions.filter(
        t => t.shift?.name?.toLowerCase() === shiftName.toLowerCase() && t.approvedBy?.signature
      );
      if (shiftTxs.length === 0) return '<span style="color:#6b7280; font-style:italic; font-size:9px;">Pending</span>';
      const approver = shiftTxs[0].approvedBy;
      return `<img src="${approver.signature}" style="height:22px; max-width:100%; object-fit:contain; vertical-align:middle;"/>`;
    };

    const remarksText = transactions.filter(t => t.remarks).map(t => `${t.shift?.name || 'Shift'}: ${t.remarks}`).join(' | ') || 'No remarks logged today.';

    // Generate table rows HTML
    const tableRowsHtml = parameters.map((param, index) => {
      let cellsHtml = '';
      if (isOncePerDay(param)) {
        const readings: any[] = [];
        transactions.forEach(tx => {
          if (tx.details) {
            tx.details.forEach((d: any) => {
              if (d.parameterId === param.id) readings.push(d);
            });
          }
        });
        const lastVal = readings[readings.length - 1];
        const valStr = lastVal ? lastVal.observedValue : '';
        const color = lastVal?.status === 'FAIL' ? '#dc2626' : '#111827';
        cellsHtml = `<td colspan="6" style="text-align:center; font-weight:600; font-size:${fontSize}; color:${color};">${valStr}</td>`;
      } else if (isOncePerShift(param)) {
        cellsHtml = `
          <td colspan="2" style="padding:0;">${getMergedCellContent('Shift A', param)}</td>
          <td colspan="2" style="padding:0;">${getMergedCellContent('Shift B', param)}</td>
          <td colspan="2" style="padding:0;">${getMergedCellContent('Shift C', param)}</td>`;
      } else {
        cellsHtml = `
          <td style="padding:0;">${getCellContent('Shift A', '1 Half', param)}</td>
          <td style="padding:0;">${getCellContent('Shift A', '2 Half', param)}</td>
          <td style="padding:0;">${getCellContent('Shift B', '1 Half', param)}</td>
          <td style="padding:0;">${getCellContent('Shift B', '2 Half', param)}</td>
          <td style="padding:0;">${getCellContent('Shift C', '1 Half', param)}</td>
          <td style="padding:0;">${getCellContent('Shift C', '2 Half', param)}</td>`;
      }

      const specText = param.specText || `${param.nominalValue} ±${param.upperTolerance}`;

      return `
        <tr>
          <td style="text-align:center; font-weight:600;">${String(index + 1).padStart(2, '0')}</td>
          <td style="font-weight:600;">${param.parameterName}</td>
          <td style="font-weight:600; text-align:center;">${param.class || ''}</td>
          <td style="text-align:center;">${specText}</td>
          <td style="text-align:center;">${param.methodOfChecking || '-'}</td>
          <td style="text-align:center;">${param.freqOfInspn || '-'}</td>
          ${cellsHtml}
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${reportTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 3mm 4mm 3mm 4mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-size: ${fontSize};
      width: 100%;
    }
    .report-wrapper {
      width: 100%;
    }
    .header-box {
      border: 1px solid #000;
      display: flex;
      align-items: stretch;
      margin-bottom: -1px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .header-left {
      width: 34.5%;
      padding: 0;
      border-right: 1px solid #000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header-middle {
      width: 36.5%;
      padding: 6px;
      border-right: 1px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .header-right {
      width: 29.0%;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      font-size: ${fontSize};
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: avoid;
      break-inside: avoid;
      table-layout: fixed;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th, td {
      border: 1px solid #000000;
      padding: ${cellPadding};
      font-size: ${fontSize};
      vertical-align: middle;
      word-wrap: break-word;
      word-break: normal;
      overflow: hidden;
    }
    th {
      background-color: #f3f4f6;
      font-weight: bold;
      text-align: center;
      font-size: ${headerFontSize};
    }
    .th-shift-a { background-color: #dbeafe; }
    .th-shift-b { background-color: #ccfbf1; }
    .th-shift-c { background-color: #ffedd5; }
  </style>
</head>
<body>

<div class="report-wrapper">
  <!-- Header Box -->
  <div class="header-box">
    <div class="header-left">
      <div style="display:flex; align-items:center; gap:8px; padding:6px;">
        ${logoBase64 ? `<div style="height:44px; width:48px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <img src="${logoBase64}" style="max-height:44px; max-width:100%; object-fit:contain;" />
        </div>` : ''}
        <div style="flex:1; min-width:0;">
          ${companyName ? `<div style="font-weight:800; font-size:12px; color:#000080; text-transform:uppercase; letter-spacing:0.2px;">
            ${companyName}
          </div>` : ''}
          ${companySubtitle ? `<div style="font-size:8.5px; color:#000080; font-weight:600; line-height:1.2; margin-top:2px;">
            ${companySubtitle}
          </div>` : ''}
        </div>
      </div>
      <div style="font-size:10px; border-top:1px solid #000; padding:4px 6px; display:flex; justify-content:space-between;">
        <div>Date : <strong>${dateStr}</strong></div>
        <div>M/c No. : <strong>${mcNo}</strong></div>
      </div>
    </div>

    <div class="header-middle">
      <div style="font-size:14px; font-weight:900; color:#000000; text-transform:uppercase; letter-spacing:0.8px; line-height:1.3;">
        ${reportTitle}
      </div>
    </div>

    <div class="header-right" style="padding:0;">
      <table style="width:100%; border-collapse:collapse; height:100%; font-size:10px; border:none;">
        <tr>
          <td style="font-weight:bold; width:42%; border-right:1px solid #000; border-bottom:1px solid #000; padding:4px 6px; background:#f8fafc; font-size:9.5px;">PART NO.</td>
          <td style="font-weight:bold; padding:4px 6px; border-bottom:1px solid #000; font-size:10.5px;">${partInfo?.partNumber || 'N/A'}</td>
        </tr>
        <tr>
          <td style="font-weight:bold; border-right:1px solid #000; border-bottom:1px solid #000; padding:4px 6px; background:#f8fafc; font-size:9.5px;">PART NAME</td>
          <td style="font-weight:bold; padding:4px 6px; border-bottom:1px solid #000; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${partInfo?.partName || 'N/A'}</td>
        </tr>
        <tr>
          <td style="font-weight:bold; border-right:1px solid #000; padding:4px 6px; background:#f8fafc; font-size:9.5px;">OPERATION NO.</td>
          <td style="font-weight:bold; padding:4px 6px; font-size:10.5px;">${operationInfo?.operationNumber || 'N/A'}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Main Inspection Table + Integrated Footer matching sample.pdf format -->
  <table>
    <thead>
      <tr>
        <th rowspan="2" style="width:3.5%;">S. No.</th>
        <th rowspan="2" style="width:25.0%;">Description</th>
        <th rowspan="2" style="width:6.0%;">MISP NO/SC</th>
        <th rowspan="2" style="width:14.5%;">Specification (Standard)</th>
        <th rowspan="2" style="width:14.5%;">Method of checking</th>
        <th rowspan="2" style="width:7.5%;">Freq. of Inspn.</th>
        <th colspan="2" class="th-shift-a">1st Shift</th>
        <th colspan="2" class="th-shift-b">2nd Shift</th>
        <th colspan="2" class="th-shift-c">3rd Shift</th>
      </tr>
      <tr>
        <th style="width:4.833%;" class="th-shift-a">1 Half</th>
        <th style="width:4.833%;" class="th-shift-a">2 Half</th>
        <th style="width:4.833%;" class="th-shift-b">1 Half</th>
        <th style="width:4.833%;" class="th-shift-b">2 Half</th>
        <th style="width:4.833%;" class="th-shift-c">1 Half</th>
        <th style="width:4.833%;" class="th-shift-c">2 Half</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
      
      <!-- Footer Integrated Table Rows matching sample.pdf format (100% aligned 12 columns) -->
      <tr style="background-color:#fafafa; font-weight:bold;">
        <td colspan="3" style="text-align:center;">Abbreviations</td>
        <td colspan="2" style="text-align:center;">Remarks</td>
        <td style="text-align:center; font-size:8.5px; white-space:nowrap;">Status</td>
        <td style="text-align:center;">${getFooterStatus('Shift A', '1 Half')}</td>
        <td style="text-align:center;">${getFooterStatus('Shift A', '2 Half')}</td>
        <td style="text-align:center;">${getFooterStatus('Shift B', '1 Half')}</td>
        <td style="text-align:center;">${getFooterStatus('Shift B', '2 Half')}</td>
        <td style="text-align:center;">${getFooterStatus('Shift C', '1 Half')}</td>
        <td style="text-align:center;">${getFooterStatus('Shift C', '2 Half')}</td>
      </tr>
      <tr>
        <td style="text-align:center; font-weight:bold;">NP</td>
        <td colspan="2" style="font-weight:500;">No Production</td>
        <td colspan="2" rowspan="3" style="vertical-align:top; font-style:italic; padding:4px; font-size:${fontSize};">
          ${remarksText}
        </td>
        <td style="font-weight:bold; text-align:center; white-space:nowrap; font-size:8.5px; padding:2px;">Inspected by</td>
        <td style="text-align:center;">${getInspectorSignature('Shift A', '1 Half')}</td>
        <td style="text-align:center;">${getInspectorSignature('Shift A', '2 Half')}</td>
        <td style="text-align:center;">${getInspectorSignature('Shift B', '1 Half')}</td>
        <td style="text-align:center;">${getInspectorSignature('Shift B', '2 Half')}</td>
        <td style="text-align:center;">${getInspectorSignature('Shift C', '1 Half')}</td>
        <td style="text-align:center;">${getInspectorSignature('Shift C', '2 Half')}</td>
      </tr>
      <tr>
        <td style="text-align:center; font-weight:bold;">SC</td>
        <td colspan="2" style="font-weight:500;">Significant Characteristic</td>
        <td style="font-weight:bold; text-align:center; white-space:nowrap; font-size:8.5px; padding:2px;">Checked by</td>
        <td colspan="2" style="text-align:center;">${getApproverSignature('Shift A')}</td>
        <td colspan="2" style="text-align:center;">${getApproverSignature('Shift B')}</td>
        <td colspan="2" style="text-align:center;">${getApproverSignature('Shift C')}</td>
      </tr>
      <tr>
        <td colspan="3" style="font-size:8.5px; text-align:center; color:#374151; font-weight:500;">
          ${docNumber} (Rev date: ${revDate})
        </td>
        <td style="font-weight:bold; text-align:center; white-space:nowrap; font-size:8.5px; padding:2px;">Approved by</td>
        <td colspan="2" style="text-align:center;">${getApproverSignature('Shift A')}</td>
        <td colspan="2" style="text-align:center;">${getApproverSignature('Shift B')}</td>
        <td colspan="2" style="text-align:center;">${getApproverSignature('Shift C')}</td>
      </tr>
    </tbody>
  </table>
</div>

</body>
</html>`;
  }

  /**
   * Generates a 100% vector-crisp A4 Landscape PDF Poka Yoke Check Sheet using Puppeteer.
   */
  async generatePokaYokeReportPdf(
    settings: any,
    partInfo: any,
    dateStr: string,
    items: any[],
    transactions: any[],
    shifts: any[],
    startDate?: string,
    endDate?: string
  ): Promise<Buffer> {
    const html = this.buildPokaYokeReportHtml(
      settings,
      partInfo,
      dateStr,
      items,
      transactions,
      shifts,
      startDate,
      endDate
    );

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: {
          top: '3mm',
          bottom: '3mm',
          left: '4mm',
          right: '4mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private buildPokaYokeReportHtml(
    settings: any,
    partInfo: any,
    dateStr: string,
    items: any[],
    transactions: any[],
    shifts: any[],
    startDate?: string,
    endDate?: string
  ): string {
    const logoBase64 = this.resolveLogoBase64(settings.report_logo);
    const companyName = settings.report_company_name !== undefined ? settings.report_company_name : '';
    const companySubtitle = settings.report_company_subtitle !== undefined ? settings.report_company_subtitle : '';
    const reportTitle = settings.pokayoke_report_title || settings.report_title || '';
    const rNo = settings.pokayoke_report_r_no || settings.report_r_no || '03';
    const rDate = settings.pokayoke_report_r_date || settings.report_r_date || '23.04.2023';
    const docNumber = settings.pokayoke_report_doc_number || settings.report_doc_number || 'TAF/P2/9.4';

    // Calculate date columns (up to 31 days)
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();

    if (!startDate && transactions.length > 0) {
      const dates = transactions.map(t => new Date(t.date).getTime()).filter(t => !isNaN(t));
      if (dates.length > 0) {
        start = new Date(Math.min(...dates));
        end = new Date(Math.max(...dates));
      }
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const dateColumns: Date[] = [];
    const current = new Date(start);
    while (current <= end && dateColumns.length < 31) {
      dateColumns.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    if (dateColumns.length === 0) {
      dateColumns.push(new Date());
    }

    const dateColWidth = (52 / dateColumns.length).toFixed(2);

    const getReading = (itemId: string, date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const targetDateStr = `${y}-${m}-${d}`;

      for (let i = transactions.length - 1; i >= 0; i--) {
        const txn = transactions[i];
        const txnDate = new Date(txn.date);
        const txnY = txnDate.getFullYear();
        const txnM = String(txnDate.getMonth() + 1).padStart(2, '0');
        const txnD = String(txnDate.getDate()).padStart(2, '0');
        if (`${txnY}-${txnM}-${txnD}` === targetDateStr && txn.details) {
          const itemDetails = txn.details.filter((detail: any) => detail.pokaYokeItemId === itemId);
          if (itemDetails.length > 0) {
            const passDetail = itemDetails.find((detail: any) => detail.status === 'PASS');
            return passDetail || itemDetails[0];
          }
        }
      }
      return null;
    };

    const getTransactionForDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const targetDateStr = `${y}-${m}-${d}`;

      for (let i = transactions.length - 1; i >= 0; i--) {
        const txn = transactions[i];
        const txnDate = new Date(txn.date);
        const txnY = txnDate.getFullYear();
        const txnM = String(txnDate.getMonth() + 1).padStart(2, '0');
        const txnD = String(txnDate.getDate()).padStart(2, '0');
        if (`${txnY}-${txnM}-${txnD}` === targetDateStr) {
          return txn;
        }
      }
      return null;
    };

    const dateHeadersHtml = dateColumns.map(d => 
      `<th style="width:${dateColWidth}%; text-align:center; padding:3px 1px; font-size:8.5px;">${String(d.getDate()).padStart(2, '0')}</th>`
    ).join('');

    const tableRowsHtml = items.map((item, index) => {
      const dateCellsHtml = dateColumns.map(d => {
        const r = getReading(item.id, d);
        if (!r) {
          return `<td style="text-align:center; padding:2px 1px; color:#9ca3af; font-size:8px;">-</td>`;
        }
        if (r.status === 'PASS') {
          return `<td style="text-align:center; padding:2px 1px;">
            <div style="display:inline-flex; align-items:center; justify-content:center; width:13px; height:13px; border-radius:50%; background:#22c55e; color:#ffffff; font-size:8.5px; font-weight:bold; margin:0 auto; line-height:1;">✓</div>
          </td>`;
        } else {
          return `<td style="text-align:center; padding:2px 1px;">
            <div style="display:inline-flex; align-items:center; justify-content:center; width:13px; height:13px; border-radius:50%; background:#ef4444; color:#ffffff; font-size:8.5px; font-weight:bold; margin:0 auto; line-height:1;">✕</div>
          </td>`;
        }
      }).join('');

      return `
        <tr>
          <td style="text-align:center; font-weight:600; padding:3px 2px; font-size:8.5px;">${index + 1}</td>
          <td style="font-weight:500; padding:3px 4px; font-size:8.5px; word-break:break-word;">${item.operation || '-'}</td>
          <td style="font-weight:600; padding:3px 4px; font-size:8.5px; word-break:break-word;">${item.pokaYokeName || '-'}</td>
          <td style="padding:3px 4px; font-size:8px; word-break:break-word;">${item.checkingMethod || '-'}</td>
          <td style="text-align:center; padding:3px 2px; font-size:8px;">${item.frequency || '-'}</td>
          ${dateCellsHtml}
        </tr>`;
    }).join('');

    const statusCellsHtml = dateColumns.map(d => {
      const txn = getTransactionForDate(d);
      if (!txn) return `<td style="text-align:center; padding:2px 1px; color:#9ca3af; font-size:8px;">-</td>`;
      const isOk = txn.status === 'PASSED' || txn.status === 'APPROVED';
      if (isOk) {
        return `<td style="text-align:center; padding:2px 1px; font-weight:700; color:#16a34a; font-size:8.5px;">OK</td>`;
      } else {
        return `<td style="text-align:center; padding:2px 1px; font-weight:700; color:#dc2626; font-size:8.5px;">NOT OK</td>`;
      }
    }).join('');

    const inspectorCellsHtml = dateColumns.map(d => {
      const txn = getTransactionForDate(d);
      if (!txn) return `<td style="text-align:center; padding:2px 1px; color:#9ca3af; font-size:8px;">-</td>`;
      if (txn?.inspector?.signature) {
        return `<td style="text-align:center; padding:1px 0px;">
          <img src="${txn.inspector.signature}" style="height:18px; max-width:100%; object-fit:contain; display:block; margin:0 auto;" />
        </td>`;
      }
      if (txn?.inspector?.name) {
        return `<td style="text-align:center; padding:2px 1px; font-size:8px; font-weight:600;">${txn.inspector.name}</td>`;
      }
      return `<td style="text-align:center; padding:2px 1px; color:#9ca3af; font-size:8px;">-</td>`;
    }).join('');

    const approverCellsHtml = dateColumns.map(d => {
      const txn = getTransactionForDate(d);
      if (!txn) return `<td style="text-align:center; padding:2px 1px; color:#9ca3af; font-size:8px;">-</td>`;
      if (txn?.adminUser?.signature) {
        return `<td style="text-align:center; padding:1px 0px;">
          <img src="${txn.adminUser.signature}" style="height:18px; max-width:100%; object-fit:contain; display:block; margin:0 auto;" />
        </td>`;
      }
      if (txn?.adminUser?.name) {
        return `<td style="text-align:center; padding:2px 1px; font-size:8px; font-weight:600; color:#16a34a;">${txn.adminUser.name}</td>`;
      }
      return `<td style="text-align:center; padding:2px 1px; color:#9ca3af; font-size:8px;">-</td>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${reportTitle}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 3mm 4mm 3mm 4mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-size: 8.5px;
      width: 100%;
    }
    .report-wrapper {
      width: 100%;
    }
    .header-box {
      border: 1px solid #000;
      display: flex;
      align-items: stretch;
      margin-bottom: -1px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: avoid;
      break-inside: avoid;
      table-layout: fixed;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th, td {
      border: 1px solid #000000;
      padding: 2px 2px;
      font-size: 8.5px;
      vertical-align: middle;
      word-wrap: break-word;
      overflow: hidden;
    }
    th {
      background-color: #f3f4f6;
      font-weight: bold;
      text-align: center;
      font-size: 8.5px;
    }
  </style>
</head>
<body>

<div class="report-wrapper">
  <!-- Header Box -->
  <div class="header-box">
    <div style="width:20%; padding:6px; border-right:1px solid #000; display:flex; align-items:center; justify-content:center;">
      ${logoBase64 ? `<img src="${logoBase64}" style="max-height:46px; max-width:100%; object-fit:contain;" />` : `<div style="border:2px solid #000; border-radius:50%; width:44px; height:44px; display:flex; align-items:center; justify-content:center; font-weight:900; font-style:italic;">TVS</div>`}
    </div>
    <div style="width:80%; padding:8px 12px; display:flex; flex-direction:column; justify-content:center;">
      ${companyName ? `<div style="font-weight:800; font-size:11px; color:#000000; text-transform:uppercase;">${companyName}</div>` : ''}
      ${companySubtitle ? `<div style="font-weight:600; font-size:9px; color:#374151; margin-top:1px;">${companySubtitle}</div>` : ''}
      <div style="font-weight:800; font-size:12px; color:#000000; text-transform:uppercase; margin-top:2px;">${reportTitle}</div>
      <div style="font-weight:800; font-size:11px; color:#000000; text-transform:uppercase; margin-top:2px;">
        PART NUMBER : ${partInfo?.partNumber || ''} ${partInfo?.partName || ''}
      </div>
    </div>
  </div>

  <!-- Poka Yoke Matrix Table -->
  <table>
    <thead>
      <tr>
        <th rowSpan="2" style="width:3.5%;">SI.No</th>
        <th rowSpan="2" style="width:11.5%;">Operation</th>
        <th rowSpan="2" style="width:13.0%;">POKA-YOKE</th>
        <th rowSpan="2" style="width:12.0%;">Checking Method</th>
        <th rowSpan="2" style="width:8.0%;">Frequency</th>
        <th colSpan="${dateColumns.length}" style="text-align:center;">Date</th>
      </tr>
      <tr>
        ${dateHeadersHtml}
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
      
      <!-- Overall Status Row -->
      <tr>
        <td colSpan="5" style="font-weight:700; text-align:right; padding-right:12px; font-size:8.5px;">Overall Status (OK / NOT OK)</td>
        ${statusCellsHtml}
      </tr>

      <!-- Inspected By Row -->
      <tr>
        <td colSpan="3" style="font-weight:700; border-bottom:none; font-size:8.5px;">R.No : ${rNo}</td>
        <td colSpan="2" style="font-weight:700; font-size:8.5px;">INSPECTED BY</td>
        ${inspectorCellsHtml}
      </tr>

      <!-- Approved By Row -->
      <tr>
        <td colSpan="3" style="font-weight:700; border-top:none; font-size:8.5px;">R.Date : ${rDate}</td>
        <td colSpan="2" style="font-weight:700; font-size:8.5px;">APPROVED BY</td>
        ${approverCellsHtml}
      </tr>
    </tbody>
  </table>

  <div style="font-size:8px; font-weight:600; margin-top:4px; color:#374151;">
    ${docNumber}
  </div>
</div>

</body>
</html>`;
  }
}
