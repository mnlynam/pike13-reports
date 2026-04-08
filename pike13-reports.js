// Pike13 Reports v1.8 - Removed redundant Canvas button (HTML paste does the same thing); human-readable duration formatting
(function() {
'use strict';

const PANEL_ID = 'pike13-reports';
const VERSION = '1.8';
const BUILD_DATE = '2026-04-08';
const SUBDOMAIN = location.hostname.split('.')[0];
const BASE = location.origin;

if (!location.hostname.endsWith('.pike13.com')) {
  alert('Pike13 Reports must be run from a pike13.com page.\n\nNavigate to musicplace.pike13.com first.');
  return;
}

// ===================== HELPERS =====================

function esc(s) {
  if (s == null) return '—';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  return `${hr % 12 || 12}:${m} ${ampm}`;
}

function fmtCurrency(cents) {
  if (cents == null) return '—';
  return '$' + (Number(cents) / 100).toFixed(2);
}

// Convert a raw day count to a human-readable duration with up to two units.
// Examples: 3 → "3d", 7 → "1w", 14 → "2w", 38 → "1mo 1w", 365 → "1y", 3080 → "8y 5mo".
// Approximations: 1 month = 30 days, 1 year = 365 days. Good enough for invoice age display.
function fmtDuration(days) {
  if (days == null) return '—';
  const d = Math.abs(Math.floor(Number(days)));
  if (d < 7) return `${d}d`;
  if (d < 30) {
    const w = Math.floor(d / 7);
    const rem = d % 7;
    return rem > 0 ? `${w}w ${rem}d` : `${w}w`;
  }
  if (d < 365) {
    const mo = Math.floor(d / 30);
    const remW = Math.floor((d % 30) / 7);
    return remW > 0 ? `${mo}mo ${remW}w` : `${mo}mo`;
  }
  const y = Math.floor(d / 365);
  const remMo = Math.floor((d % 365) / 30);
  return remMo > 0 ? `${y}y ${remMo}mo` : `${y}y`;
}

function clsSlug(s) {
  return 'cls-' + String(s).toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
}

// ===================== REPORT DEFINITIONS =====================

const REPORTS = [
  {
    id: 'declined_payments',
    name: 'Declined Payments',
    slug: 'invoices',
    fields: [
      'invoice_payer_name',   // 0
      'invoice_number',       // 1
      'invoice_due_date',     // 2
      'issued_date',          // 3
      'failed_transactions',  // 4
      'invoice_payer_email',  // 5
      'invoice_payer_phone',  // 6
      'invoice_payer_id',     // 7 (hidden, for links)
      'invoice_id',           // 8 (hidden, for links)
      'outstanding_amount'    // 9 (hidden)
    ],
    getFilter: () => ['and', [
      ['gt', 'failed_transactions', 0],
      ['ne', 'invoice_state', ['closed']],
      ['ne', 'invoice_state', ['canceled']],
      ['btw', 'invoice_due_date', [dateStart, dateEnd]]
    ]],
    sort: ['invoice_due_date+'],
    columns: [
      { label: 'Payer',       idx: 0, link: r => `${BASE}/people/${r[7]}/invoices/${r[8]}` },
      { label: 'Invoice #',   idx: 1 },
      { label: 'Due Date',    idx: 2, format: 'date' },
      { label: 'Issued Date', idx: 3, format: 'date' },
      { label: 'Declined',    idx: 4, align: 'center' },
      { label: 'Email',       idx: 5 },
      { label: 'Phone',       idx: 6 },
    ],
    rowNoun: 'invoice',
    emailSubject: () => {
      const m = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
      return `Declined Payments Report – ${m}`;
    },
    emptyMsg: 'No declined payments found.',
    loadingMsg: 'Fetching declined payments…',
    defaultEmail: 'lcaploe@musicplace.com',
    dateRange: true,
    defaultDates: () => {
      const t = new Date();
      return {
        start: fmtDateISO(new Date(t.getFullYear(), t.getMonth() - 6, t.getDate())),
        end: fmtDateISO(t)
      };
    },
    filterTags: () => ['Failed transactions > 0', 'Status ≠ closed', 'Status ≠ canceled'],
  },
  {
    id: 'post_assessment',
    name: 'Post-assessment',
    slug: 'event_occurrences',
    fields: [
      'service_name',                   // 0
      'enrollment_count',               // 1
      'instructor_names',               // 2
      'service_date',                   // 3
      'service_time',                   // 4
      'completed_enrollment_count',     // 5
      'noshowed_enrollment_count',      // 6
      'late_canceled_enrollment_count', // 7
      'event_occurrence_id'             // 8
    ],
    getFilter: () => ['and', [
      ['eq', 'attendance_completed', ['f']],
      ['wo', 'service_category', ['Internal']],
      ['btw', 'service_date', [dateStart, dateEnd]],
      ['eq', 'service_name', ['Personalized Aptitude Assessment']]
    ]],
    sort: ['service_date+'],
    columns: [
      { label: 'Service',      idx: 0 },
      { label: 'Enrolled',     idx: 1, align: 'center' },
      { label: 'Staff',        idx: 2 },
      { label: 'Date',         idx: 3, format: 'date' },
      { label: 'Time',         idx: 4, format: 'time' },
      { label: 'Completed',    idx: 5, align: 'center' },
      { label: 'No Show',      idx: 6, align: 'center' },
      { label: 'Late Cancel',  idx: 7, align: 'center' },
      { label: 'Schedule ID',  idx: 8, link: r => `${BASE}/desk/e/${r[8]}` },
    ],
    rowNoun: 'event',
    emailSubject: () => {
      const f = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `Post-assessment Report – ${f(dateStart)} to ${f(dateEnd)}`;
    },
    emptyMsg: 'No incomplete assessments found.',
    loadingMsg: 'Fetching assessments…',
    defaultEmail: 'jmorris@musicplace.com',
    dateRange: true,
    defaultDates: () => {
      const t = new Date();
      return {
        start: fmtDateISO(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 29)),
        end: fmtDateISO(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1))
      };
    },
    filterTags: () => ['Personalized Aptitude Assessment', 'Attendance not completed', 'Not internal'],
  },
  {
    // ===== Unpaid Invoice Triage =====
    // Replicates /today/unpaid_invoices and classifies each row as collections-worthy
    // or cleanup-eligible by joining invoice line items to the business-wide active plan set.
    // Three batch report calls, zero per-invoice fetches. ~2 seconds for ~100 invoices.
    id: 'unpaid_triage',
    name: 'Unpaid Invoice Triage',
    rowNoun: 'invoice',
    emptyMsg: 'No past-due invoices found. 🎉',
    loadingMsg: 'Triaging unpaid invoices…',
    defaultEmail: 'lcaploe@musicplace.com',
    dateRange: false,
    filterTags: () => ['Matches /today/unpaid_invoices', 'Joined to business-wide active plans'],
    emailSubject: () => {
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `Unpaid Invoice Triage – ${today}`;
    },
    // Plain-text summary prepended when "Include summary" is checked.
    // Returns flowing prose paragraphs separated by blank lines, with no
    // hardcoded line breaks inside paragraphs — each paragraph wraps naturally
    // based on the rendering surface's width. Used by all three copy formats.
    buildExplanation: () => {
      if (rows.length === 0) return '';
      const cats = {
        'COLLECT':           { count: 0, owed: 0, desc: 'active customers owe — chase' },
        'COLLECT (partial)': { count: 0, owed: 0, desc: 'partial paid' },
        'CLEANUP':           { count: 0, owed: 0, desc: 'no active plan, safe to cancel' },
        'CLEANUP (refund)':  { count: 0, owed: 0, desc: 'no active plan, refund first' },
      };
      let totalOwed = 0, urgentCount = 0, urgentOwed = 0;
      for (const r of rows) {
        const cls = r[0], owedC = r[5], autobill = r[10], failedTx = r[11];
        if (cats[cls]) { cats[cls].count++; cats[cls].owed += owedC; }
        totalOwed += owedC;
        if (autobill === 'yes' && failedTx >= 3) { urgentCount++; urgentOwed += owedC; }
      }
      const fmt$ = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const labels = Object.keys(cats).filter(l => cats[l].count > 0);

      // Build the breakdown as a single flowing sentence with proper Oxford-comma joining.
      const parts = labels.map(l => `${cats[l].count} ${l} (${fmt$(cats[l].owed)}, ${cats[l].desc})`);
      let breakdown;
      if (parts.length === 1) breakdown = parts[0];
      else if (parts.length === 2) breakdown = parts.join(' and ');
      else breakdown = parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];

      const paragraphs = [];
      paragraphs.push(`${rows.length} past-due invoices, ${fmt$(totalOwed)} outstanding total.`);
      paragraphs.push(`Breakdown: ${breakdown}.`);
      if (urgentCount > 0) {
        paragraphs.push(`${urgentCount} of these have failed autobills (${fmt$(urgentOwed)}) — these are the urgent ones; the cards on file are declining and the customers likely don't realize.`);
      }
      return paragraphs.join('\n\n');
    },
    columns: [
      { label: 'Status',         idx: 0, render: r => `<span class="cls ${clsSlug(r[0])}">${esc(r[0])}</span>` },
      { label: 'Client',         idx: 3, link: r => `${BASE}/people/${r[4]}` },
      { label: 'Invoice',        idx: 1, link: r => `${BASE}/invoices/${r[2]}` },
      { label: 'Owed',           idx: 5, format: 'currency', align: 'right' },
      { label: 'Past Due',       idx: 8, align: 'center', render: r => fmtDuration(r[8]), renderPlain: r => fmtDuration(r[8]) },
      { label: 'Autobill',       idx: 10, align: 'center' },
      { label: 'Fails',          idx: 11, align: 'center', render: r => {
        const v = r[11];
        if (v >= 3) return `<span style="color:#e89090;font-weight:600">${v}</span>`;
        if (v > 0) return `<span style="color:#f5c878">${v}</span>`;
        return `<span style="color:#555">${v}</span>`;
      }},
      { label: 'Recommendation', idx: 12, slackMax: 50 },
    ],
    customFetch: async (token, queryV3) => {
      // Phase 1: invoices matching /today/unpaid_invoices (KL #235)
      const invAttrs = await queryV3('invoices', {
        page: { limit: 2000 },
        fields: [
          'invoice_id', 'invoice_number', 'invoice_payer_name', 'invoice_payer_id',
          'issued_date', 'expected_amount', 'net_paid_amount', 'outstanding_amount',
          'days_since_invoice_due', 'invoice_autobill', 'failed_transactions'
        ],
        filter: ['and', [
          ['eq', 'invoice_state', 'open'],
          ['gt', 'outstanding_amount', 0],
          ['gt', 'days_since_invoice_due', 0]
        ]]
      }, token);
      const invRows = invAttrs.rows || [];
      if (invRows.length === 0) return { rows: [], totalCount: 0, hasMore: false };

      // Phase 2: line items for those invoices, using hidden plan_id field (KL #234)
      const invIds = invRows.map(r => r[0]);
      const itemAttrs = await queryV3('invoice_items', {
        page: { limit: 2000 },
        fields: ['invoice_id', 'plan_id'],
        filter: ['or', invIds.map(id => ['eq', 'invoice_id', id])]
      }, token);
      const invToPlans = new Map();
      for (const it of (itemAttrs.rows || [])) {
        const [invId, planId] = it;
        if (planId == null) continue;
        if (!invToPlans.has(invId)) invToPlans.set(invId, []);
        invToPlans.get(invId).push(planId);
      }

      // Phase 3: business-wide active plan set (NO person filter — KL #237)
      const planAttrs = await queryV3('person_plans', {
        page: { limit: 2000 },
        fields: ['plan_id'],
        filter: ['and', [
          ['eq', 'is_canceled', 'f'],
          ['eq', 'is_ended', 'f'],
          ['eq', 'is_deactivated', 'f'],
          ['eq', 'is_exhausted', 'f'],
          ['ne', 'plan_type', 'late_cancellation_fee']
        ]]
      }, token);
      const activePlanIds = new Set((planAttrs.rows || []).map(r => r[0]));

      // Classify each invoice
      const out = [];
      for (const r of invRows) {
        const [iid, iNum, payerName, payerId, issued, totalC, paidC, owedC, daysSince, autobill, failedTx] = r;
        const linkedPlans = invToPlans.get(iid) || [];
        const hasActivePlan = linkedPlans.some(p => activePlanIds.has(p));
        const hasPayment = paidC > 0;

        let cls, rec;
        if (hasActivePlan && hasPayment && owedC > 0) {
          cls = 'COLLECT (partial)';
          rec = `Partial paid ($${(paidC/100).toFixed(2)}) — collect $${(owedC/100).toFixed(2)} remaining`;
        } else if (hasActivePlan) {
          cls = 'COLLECT';
          if (autobill === 't' && failedTx >= 3) {
            rec = `Auto-bill failed ${failedTx}× — update payment method or contact customer`;
          } else if (autobill === 't' && failedTx > 0) {
            rec = `Auto-bill failing (${failedTx} attempts) — monitor`;
          } else if (autobill === 't') {
            rec = `Auto-bill pending — will retry`;
          } else {
            rec = `Manual bill — send payment reminder`;
          }
        } else if (hasPayment) {
          cls = 'CLEANUP (refund)';
          rec = `Refund $${(paidC/100).toFixed(2)} (paid by customer), then cancel`;
        } else {
          cls = 'CLEANUP';
          rec = daysSince < 365 ? `Orphan (${fmtDuration(daysSince)}) — verify before cancelling` : `Stale orphan (${fmtDuration(daysSince)}) — safe to cancel`;
        }

        out.push([
          cls,                              // 0  status
          iNum,                             // 1  invoice number
          iid,                              // 2  invoice id (hidden, for link)
          payerName,                        // 3  payer name
          payerId,                          // 4  payer id (hidden, for link)
          owedC,                            // 5  outstanding cents
          totalC,                           // 6  expected cents (hidden)
          paidC,                            // 7  net paid cents (hidden)
          daysSince,                        // 8  days past due
          issued,                           // 9  issued date (hidden)
          autobill === 't' ? 'yes' : 'no',  // 10 autobill
          failedTx,                         // 11 failed_transactions
          rec                               // 12 recommendation
        ]);
      }

      // Sort by Owed descending (collections opportunities first)
      out.sort((a, b) => b[5] - a[5]);
      return { rows: out, totalCount: out.length, hasMore: false };
    }
  }
];

// --- Remove existing instance ---
const existing = document.getElementById(PANEL_ID);
if (existing) existing.remove();

// --- Host + Shadow DOM ---
const host = document.createElement('div');
host.id = PANEL_ID;
host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:999999;';
document.body.appendChild(host);
const shadow = host.attachShadow({ mode: 'open' });

// --- State ---
let authToken = null;
let rows = [];
let currentReportId = REPORTS[0].id;
let isMinimized = false;
let panelX = Math.max(60, window.innerWidth - 1020);
let panelY = 60;
let dragOffset = null;

// Date range state (ISO strings, active values used by getFilter closures)
let dateStart, dateEnd;
const savedDates = {};
REPORTS.forEach(r => {
  if (r.defaultDates) savedDates[r.id] = r.defaultDates();
});
// Initialize from first report's defaults
const _initDates = savedDates[REPORTS[0].id] || { start: '', end: '' };
dateStart = _initDates.start;
dateEnd = _initDates.end;

// Per-report email (initialize from report defaults)
const savedEmails = {};
REPORTS.forEach(r => { savedEmails[r.id] = r.defaultEmail || ''; });

// Per-report "Include summary" checkbox state — defaults to false
const savedExplain = {};
REPORTS.forEach(r => { savedExplain[r.id] = false; });

function report() { return REPORTS.find(r => r.id === currentReportId); }

// ===================== AUTH =====================

async function getAuthToken() {
  const reportUrl = BASE + '/desk/reports';
  let resp;
  try {
    resp = await fetch(reportUrl, { credentials: 'include' });
  } catch (e) {
    throw new Error('Network error fetching /desk/reports. Are you online?');
  }
  if (resp.status === 404) {
    throw new Error('Page /desk/reports not found. Make sure you\'re on the Pike13 desk (try navigating to ' + BASE + '/desk first).');
  }
  if (resp.status === 401 || resp.status === 403) {
    throw new Error('Not authorized. Please log into the Pike13 desk first.');
  }
  if (!resp.ok) {
    throw new Error('/desk/reports returned HTTP ' + resp.status + '. Try refreshing your Pike13 login.');
  }
  const html = await resp.text();
  // Check if we got redirected to a login page
  if (html.includes('sign_in') || html.includes('Log in') || html.includes('login')) {
    throw new Error('Session expired — please log into the Pike13 desk and try again.');
  }
  const m = html.match(/fd\.auth_token\s*=\s*'([0-9a-f-]{36})'/);
  if (!m) throw new Error('Could not extract auth_token. The page loaded but may not be the reports page. Try navigating to ' + BASE + '/desk/reports first.');
  return m[1];
}

// ===================== REPORT QUERY =====================

async function queryV3(slug, attributes, token) {
  const url = `${BASE}/desk/api/v3/reports/${slug}/queries?auth_token=${token}&subdomain=${SUBDOMAIN}`;
  const resp = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'accept': 'application/vnd.api+json',
      'content-type': 'application/vnd.api+json',
      'x-requested-with': 'XMLHttpRequest'
    },
    body: JSON.stringify({ data: { type: 'queries', attributes } })
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`${slug} query failed (${resp.status}): ${body.slice(0, 300)}`);
  }
  const json = await resp.json();
  return json.data.attributes;
}

async function fetchReport(token) {
  const rpt = report();
  // Custom fetch hook for reports that need multi-phase queries / client-side joins
  if (rpt.customFetch) {
    return await rpt.customFetch(token, queryV3);
  }
  // Default single-query path
  const attrs = await queryV3(rpt.slug, {
    page: { limit: 500 },
    fields: rpt.fields,
    total_count: 't',
    filter: rpt.getFilter(),
    sort: rpt.sort
  }, token);
  return {
    rows: attrs.rows || [],
    totalCount: attrs.total_count || 0,
    hasMore: attrs.has_more || false
  };
}

// ===================== CELL FORMATTING =====================

function fmtCell(r, col) {
  if (col.render) return col.render(r);
  const val = r[col.idx];
  if (col.format === 'date') return fmtDate(val);
  if (col.format === 'time') return fmtTime(val);
  if (col.format === 'currency') return fmtCurrency(val);
  if (col.link) {
    const href = col.link(r);
    return `<a href="${href}" target="_blank">${esc(val)}</a>`;
  }
  return esc(val);
}

function fmtCellPlain(r, col) {
  if (col.renderPlain) return col.renderPlain(r);
  const val = r[col.idx];
  if (col.format === 'date') return fmtDate(val);
  if (col.format === 'time') return fmtTime(val);
  if (col.format === 'currency') return fmtCurrency(val);
  if (val == null) return '—';
  return String(val);
}

// ===================== CLIPBOARD / EMAIL =====================

function buildHtmlTable() {
  const rpt = report();
  let html = `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${esc(rpt.emailSubject())}</p>`;
  // Optional summary preamble (toggled by the "Include summary" checkbox).
  // Render each paragraph as a separate <p> so the text wraps naturally
  // based on the rendering width.
  if (savedExplain[currentReportId] && rpt.buildExplanation) {
    const explanation = rpt.buildExplanation();
    if (explanation) {
      for (const para of explanation.split('\n\n')) {
        html += `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;">${esc(para)}</p>`;
      }
    }
  }
  html += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">`;
  html += `<tr style="background:#f0f0f0;font-weight:bold;">`;
  for (const col of rpt.columns) {
    const align = col.align ? ` style="text-align:${col.align}"` : '';
    html += `<td${align}>${col.label}</td>`;
  }
  html += `</tr>`;
  for (const r of rows) {
    html += `<tr>`;
    for (const col of rpt.columns) {
      const align = col.align ? ` style="text-align:${col.align}"` : '';
      html += `<td${align}>${fmtCellPlain(r, col)}</td>`;
    }
    html += `</tr>`;
  }
  html += `</table>`;
  return html;
}

function buildPlainTable() {
  const rpt = report();
  let txt = rpt.emailSubject() + '\n\n';
  if (savedExplain[currentReportId] && rpt.buildExplanation) {
    const explanation = rpt.buildExplanation();
    if (explanation) txt += explanation + '\n\n';
  }
  txt += rpt.columns.map(c => c.label).join('\t') + '\n';
  for (const r of rows) {
    txt += rpt.columns.map(c => fmtCellPlain(r, c)).join('\t') + '\n';
  }
  return txt;
}

function buildSlackTable() {
  // Produces a Slack-friendly message: bold title + row count + a triple-backtick
  // code block with column-aligned monospace text. Slack renders code blocks in
  // a fixed-width font, which is the only way to get tabular data to display as
  // a grid in a Slack message (regular HTML tables get stripped on paste).
  const rpt = report();
  if (rows.length === 0) return '';
  const ELLIPSIS = '…';

  // Extract plain-text cell values, stripping any residual HTML and
  // applying per-column slackMax truncation.
  const cells = rows.map(r => rpt.columns.map(c => {
    let val = fmtCellPlain(r, c);
    val = val.replace(/<[^>]+>/g, '');
    if (c.slackMax && val.length > c.slackMax) {
      val = val.slice(0, c.slackMax - 1) + ELLIPSIS;
    }
    return val;
  }));
  const headers = rpt.columns.map(c => c.label);

  // Auto-size each column to the widest of its header and all cells.
  const widths = headers.map((h, i) => {
    let w = h.length;
    for (const row of cells) w = Math.max(w, row[i].length);
    return w;
  });

  // Alignment: right-align numeric/currency, center-align center cols, left-align rest.
  const align = (text, width, col) => {
    if (col.format === 'currency' || col.align === 'right') return text.padStart(width);
    if (col.align === 'center') {
      const pad = width - text.length;
      const left = Math.floor(pad / 2);
      return ' '.repeat(left) + text + ' '.repeat(pad - left);
    }
    return text.padEnd(width);
  };

  const headerRow = headers.map((h, i) => align(h, widths[i], rpt.columns[i])).join('  ');
  const sep = widths.map(w => '─'.repeat(w)).join('  ');
  const dataRows = cells.map(row =>
    row.map((cell, i) => align(cell, widths[i], rpt.columns[i])).join('  ')
  );

  const title = rpt.emailSubject();
  const noun = rpt.rowNoun || 'row';
  const countLine = `_${rows.length} ${noun}${rows.length !== 1 ? 's' : ''}_`;
  // Optional summary preamble — placed ABOVE the code block as Slack message
  // text. Slack wraps message paragraphs naturally; placing the prose inside
  // the code block would force monospace, which makes long lines wrap badly.
  let preamble = '';
  if (savedExplain[currentReportId] && rpt.buildExplanation) {
    const explanation = rpt.buildExplanation();
    if (explanation) preamble = '\n\n' + explanation;
  }
  return `*${title}*\n${countLine}${preamble}\n\n\`\`\`\n${headerRow}\n${sep}\n${dataRows.join('\n')}\n\`\`\``;
}

async function copyTableToClipboard() {
  const htmlContent = buildHtmlTable();
  const plainContent = buildPlainTable();
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
        'text/plain': new Blob([plainContent], { type: 'text/plain' })
      })
    ]);
    return true;
  } catch (e) {
    console.warn('Clipboard write failed, falling back:', e);
    const ta = document.createElement('textarea');
    ta.value = plainContent;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  }
}

async function copyForSlack() {
  if (rows.length === 0) { showToast('⚠ Nothing to copy'); return; }
  const text = buildSlackTable();
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    console.warn('Slack clipboard write failed, falling back:', e);
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  const charCount = text.length.toLocaleString();
  // Slack's per-message compose limit is 4,000 characters. Messages over this
  // can't be sent — Slack shows an overflow badge in the compose box. v1.6 had
  // this set to 12000 which never fired in the danger zone.
  const overLimit = text.length > 4000;
  if (overLimit) {
    showToast(`⚠ Copied ${charCount} chars — exceeds Slack's 4,000-char message limit. Use 📋 HTML and paste into a Slack Canvas instead for tables this large.`, true);
  } else {
    showToast(`✓ Copied for Slack — paste into Slack message (${charCount} chars)`);
  }
}

function showToast(msg, persistent) {
  shadow.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (persistent ? ' persistent' : '');
  el.innerHTML = persistent
    ? `${msg} <span class="toast-dismiss" style="margin-left:12px;cursor:pointer;opacity:0.6">✕</span>`
    : msg;
  shadow.appendChild(el);
  if (persistent) {
    el.querySelector('.toast-dismiss')?.addEventListener('click', () => el.remove());
  } else {
    setTimeout(() => el.remove(), 3500);
  }
}

async function emailReport() {
  const emailInput = shadow.querySelector('#rpt-email');
  const email = emailInput ? emailInput.value.trim() : '';
  if (!email) {
    showToast('⚠ Enter a recipient email first');
    emailInput?.focus();
    return;
  }
  const ok = await copyTableToClipboard();
  if (!ok) { showToast('⚠ Clipboard copy failed'); return; }
  const subject = encodeURIComponent(report().emailSubject());
  window.open(`https://webmail.musicplace.com/?_task=mail&_action=compose&_to=${encodeURIComponent(email)}&_subject=${subject}`, '_blank');
  showToast('✓ Table copied — Ctrl+V to paste into email body', true);
}

// ===================== RENDER =====================

function renderPanel(status) {
  // Preserve date inputs across re-renders (email is saved in event handlers)
  const startEl = shadow.querySelector('#rpt-date-start');
  const endEl = shadow.querySelector('#rpt-date-end');
  if (startEl) dateStart = startEl.value;
  if (endEl) dateEnd = endEl.value;

  const rpt = report();
  const pillBadge = rows.length > 0 ? ` (${rows.length})` : '';
  const tags = rpt.filterTags ? rpt.filterTags() : [];

  // Build table headers
  const thHtml = rpt.columns.map(c => {
    const style = c.align ? ` style="text-align:${c.align}"` : '';
    return `<th${style}>${c.label}</th>`;
  }).join('');

  // Build table rows
  const trHtml = rows.map(r => {
    const tds = rpt.columns.map(c => {
      const val = r[c.idx];
      const isZero = c.align === 'center' && (val === 0 || val === '0');
      const cls = c.align === 'center' ? ` class="${isZero ? 'num-zero' : 'num'}"` : '';
      return `<td${cls}>${fmtCell(r, c)}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  // Report selector options
  const optionsHtml = REPORTS.map(r =>
    `<option value="${r.id}" ${r.id === currentReportId ? 'selected' : ''}>${r.name}</option>`
  ).join('');

  shadow.innerHTML = `
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  :host { all:initial; }
  .panel {
    position:fixed; top:${panelY}px; left:${panelX}px;
    width:${isMinimized ? 'auto' : '960px'}; max-height:${isMinimized ? 'none' : '80vh'};
    background:#1e1e2e; border:1px solid #444; border-radius:${isMinimized ? '20px' : '10px'};
    color:#e0e0e0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    font-size:13px; display:flex; flex-direction:column;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
  }
  .hdr {
    display:flex; align-items:center; gap:10px;
    padding:${isMinimized ? '6px 14px' : '10px 14px'};
    background:#2a2a3e; border-radius:${isMinimized ? '20px' : '10px 10px 0 0'};
    cursor:move; user-select:none;
  }
  .title { font-weight:600; font-size:14px; color:#fff; white-space:nowrap; }
  .hdr select {
    background:#1a1a2a; border:1px solid #555; color:#e0e0e0;
    padding:3px 8px; border-radius:4px; font-size:12px; font-family:inherit;
    cursor:pointer; color-scheme:dark;
  }
  .hdr select:focus { outline:none; border-color:#667eea; }
  .hdr-btns { display:flex; gap:4px; margin-left:auto; }
  .hdr-btns button {
    background:none; border:none; color:#999; cursor:pointer;
    font-size:15px; padding:2px 6px; border-radius:4px; line-height:1;
  }
  .hdr-btns button:hover { color:#fff; background:rgba(255,255,255,0.1); }
  .toolbar {
    display:flex; align-items:center; gap:8px; flex-wrap:wrap;
    padding:8px 14px; background:#252538; border-bottom:1px solid #333;
  }
  .toolbar label { color:#aaa; font-size:11px; }
  .toolbar input[type="email"] {
    background:#1a1a2a; border:1px solid #444; color:#e0e0e0;
    padding:4px 8px; border-radius:4px; font-size:12px; width:180px;
    font-family:inherit; color-scheme:dark;
  }
  .toolbar input:focus { outline:none; border-color:#667eea; }
  .checkbox-label {
    display:flex; align-items:center; gap:5px;
    color:#aaa; font-size:11px; cursor:pointer; user-select:none;
    padding:4px 6px; border-radius:4px;
  }
  .checkbox-label:hover { color:#ddd; background:rgba(255,255,255,0.04); }
  .checkbox-label input[type="checkbox"] {
    margin:0; cursor:pointer; accent-color:#667eea;
  }
  .btn {
    padding:5px 12px; border-radius:5px; border:none;
    font-size:12px; font-weight:500; cursor:pointer;
    transition:background 0.15s; font-family:inherit;
  }
  .btn-pri { background:#667eea; color:#fff; }
  .btn-pri:hover { background:#5a6fd6; }
  .btn-sec { background:#3a3a50; color:#ccc; }
  .btn-sec:hover { background:#4a4a60; color:#fff; }
  .btn:disabled { opacity:0.5; cursor:not-allowed; }
  .badge {
    background:rgba(102,126,234,0.15); color:#8899ee; padding:2px 10px;
    border-radius:10px; font-size:11px; font-weight:500;
  }
  .info-bar {
    display:flex; align-items:center; gap:8px; flex-wrap:wrap;
    padding:6px 14px; background:#252530; border-bottom:1px solid #333;
    font-size:11px; color:#888;
  }
  .info-bar input[type="date"] {
    background:#1a1a2a; border:1px solid #444; color:#e0e0e0;
    padding:3px 6px; border-radius:4px; font-size:11px; font-family:inherit;
    color-scheme:dark;
  }
  .info-bar input[type="date"]:focus { outline:none; border-color:#667eea; }
  .info-bar .info-label { color:#aaa; font-size:11px; }
  .tag {
    display:inline-block; background:rgba(255,255,255,0.06); color:#999;
    padding:2px 8px; border-radius:3px; font-size:10px;
    border:1px solid rgba(255,255,255,0.08);
  }
  .body { flex:1; overflow:auto; }
  .status-msg { padding:24px; text-align:center; color:#888; }
  .spinner {
    display:inline-block; width:20px; height:20px;
    border:2px solid #444; border-top-color:#667eea;
    border-radius:50%; animation:spin 0.8s linear infinite;
    margin-bottom:8px;
  }
  @keyframes spin { to { transform:rotate(360deg); } }
  table { width:100%; border-collapse:collapse; }
  th {
    position:sticky; top:0; background:#2a2a3e;
    padding:8px 10px; text-align:left; font-size:11px;
    color:#999; text-transform:uppercase; letter-spacing:0.3px;
    border-bottom:2px solid #444; white-space:nowrap;
  }
  td {
    padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.04);
    font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  tbody tr:nth-child(even) td { background:rgba(255,255,255,0.02); }
  tr:hover td { background:rgba(102,126,234,0.08); }
  td a { color:#667eea; text-decoration:none; }
  td a:hover { text-decoration:underline; }
  .num { text-align:center; }
  .num-zero { text-align:center; color:#555; }
  .cls {
    display:inline-block; padding:2px 7px; border-radius:3px;
    font-size:10px; font-weight:600; letter-spacing:0.3px; white-space:nowrap;
  }
  .cls-collect { background:rgba(80,180,120,0.18); color:#7ed4a0; }
  .cls-collect-partial { background:rgba(240,180,80,0.18); color:#f5c878; }
  .cls-cleanup { background:rgba(120,140,200,0.18); color:#9ab0e0; }
  .cls-cleanup-refund { background:rgba(220,120,120,0.18); color:#e89090; }
  .warn { color:#f0a040; font-size:12px; padding:4px 14px; background:#2a2520; }
  .divider { width:1px; height:20px; background:#444; margin:0 4px; }
  .footer {
    padding:6px 14px; text-align:right; border-top:1px solid #333;
  }
  .footer-text { font-size:10px; color:#555; }
  .toast {
    position:fixed; bottom:30px; left:50%; transform:translateX(-50%);
    background:#333; color:#fff; padding:10px 20px; border-radius:8px;
    font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    z-index:1000001; pointer-events:none;
    animation:fadeInOut 3.5s ease forwards;
  }
  .toast.persistent {
    pointer-events:auto; animation:fadeIn 0.3s ease forwards;
    background:#2a4a2a; border:1px solid #4a8a4a;
  }
  @keyframes fadeIn {
    from{opacity:0;transform:translateX(-50%) translateY(10px)}
    to{opacity:1;transform:translateX(-50%) translateY(0)}
  }
  @keyframes fadeInOut {
    0%{opacity:0;transform:translateX(-50%) translateY(10px)}
    12%{opacity:1;transform:translateX(-50%) translateY(0)}
    75%{opacity:1}
    100%{opacity:0}
  }
</style>
<div class="panel">
  <div class="hdr" id="drag-handle">
    <span class="title">📋 Reports${isMinimized ? pillBadge : ''}</span>
    ${!isMinimized ? `<select id="rpt-select">${optionsHtml}</select>` : ''}
    ${!isMinimized && rows.length > 0 ? `<span class="badge">${rows.length} ${rpt.rowNoun || 'row'}${rows.length !== 1 ? 's' : ''}</span>` : ''}
    <div class="hdr-btns">
      <button id="btn-min" title="${isMinimized ? 'Expand' : 'Minimize'}">${isMinimized ? '□' : '—'}</button>
      <button id="btn-close" title="Close">✕</button>
    </div>
  </div>
  ${isMinimized ? '' : `
  <div class="toolbar">
    <button class="btn btn-pri" id="btn-copy" ${rows.length === 0 ? 'disabled' : ''} title="Copy as HTML table — paste into email or any rich-text destination">📋 HTML</button>
    <button class="btn btn-pri" id="btn-copy-slack" ${rows.length === 0 ? 'disabled' : ''} title="Copy as Slack mrkdwn with monospace code block — paste into a Slack message. Best for short tables under 4,000 characters; wide tables (like Unpaid Invoice Triage) won't fit and won't render correctly. Use 📋 HTML and paste into a Slack Canvas instead for those.">💬 Slack</button>
    ${rpt.buildExplanation ? `
    <label class="checkbox-label" title="Prepend a category breakdown / totals to the copied output">
      <input type="checkbox" id="rpt-include-explain" ${savedExplain[currentReportId] ? 'checked' : ''} />
      Include summary
    </label>` : ''}
    <button class="btn btn-sec" id="btn-refresh">↻ Refresh</button>
    <span class="divider"></span>
    <label>To:</label>
    <input type="email" id="rpt-email" placeholder="recipient@email.com" value="${savedEmails[currentReportId] || ''}" />
    <button class="btn btn-sec" id="btn-email" ${rows.length === 0 ? 'disabled' : ''}>✉ Email</button>
  </div>
  ${rpt.dateRange || tags.length ? `
  <div class="info-bar">
    ${rpt.dateRange ? `
      <span class="info-label">From:</span>
      <input type="date" id="rpt-date-start" value="${dateStart}" />
      <span class="info-label">To:</span>
      <input type="date" id="rpt-date-end" value="${dateEnd}" />
      <button class="btn btn-sec" id="btn-apply-dates" style="padding:2px 8px;font-size:11px;">Apply</button>
      ${tags.length ? '<span class="divider"></span>' : ''}
    ` : ''}
    ${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
  </div>
  ` : ''}
  <div class="body" id="body">
    ${status === 'loading' ? `
      <div class="status-msg"><div class="spinner"></div><br>${rpt.loadingMsg}</div>
    ` : status && status.message ? `
      <div class="status-msg" style="color:#e05050;">⚠ ${status.message}</div>
    ` : rows.length === 0 ? `
      <div class="status-msg">${rpt.emptyMsg}</div>
    ` : `
      ${rows._hasMore ? '<div class="warn">⚠ More than 500 results — only first 500 shown.</div>' : ''}
      <table>
        <thead><tr>${thHtml}</tr></thead>
        <tbody>${trHtml}</tbody>
      </table>
    `}
  </div>
  <div class="footer">
    <span class="footer-text">v${VERSION} • ${BUILD_DATE} • ${rpt.name}</span>
  </div>
  `}
</div>`;

  // --- Wire events ---
  shadow.getElementById('btn-close')?.addEventListener('click', () => host.remove());
  shadow.getElementById('btn-min')?.addEventListener('click', () => { isMinimized = !isMinimized; renderPanel(); });
  shadow.getElementById('btn-email')?.addEventListener('click', emailReport);
  shadow.getElementById('btn-copy')?.addEventListener('click', async () => {
    await copyTableToClipboard();
    showToast('✓ HTML table copied — paste into email or rich-text');
  });
  shadow.getElementById('btn-copy-slack')?.addEventListener('click', copyForSlack);
  shadow.getElementById('rpt-include-explain')?.addEventListener('change', e => {
    savedExplain[currentReportId] = e.target.checked;
  });
  shadow.getElementById('btn-refresh')?.addEventListener('click', () => {
    const emailEl = shadow.querySelector('#rpt-email');
    if (emailEl) savedEmails[currentReportId] = emailEl.value;
    loadReport();
  });
  shadow.getElementById('btn-apply-dates')?.addEventListener('click', () => {
    const s = shadow.querySelector('#rpt-date-start');
    const e = shadow.querySelector('#rpt-date-end');
    if (s) dateStart = s.value;
    if (e) dateEnd = e.value;
    savedDates[currentReportId] = { start: dateStart, end: dateEnd };
    loadReport();
  });
  shadow.getElementById('rpt-select')?.addEventListener('change', e => {
    // Preserve inputs before switching
    const emailEl = shadow.querySelector('#rpt-email');
    if (emailEl) savedEmails[currentReportId] = emailEl.value;
    const sEl = shadow.querySelector('#rpt-date-start');
    const eEl = shadow.querySelector('#rpt-date-end');
    if (sEl && eEl) savedDates[currentReportId] = { start: sEl.value, end: eEl.value };
    // Switch report and restore its dates
    currentReportId = e.target.value;
    const dates = savedDates[currentReportId];
    if (dates) { dateStart = dates.start; dateEnd = dates.end; }
    loadReport();
  });

  // --- Dragging ---
  const handle = shadow.getElementById('drag-handle');
  handle?.addEventListener('mousedown', e => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
    const panel = shadow.querySelector('.panel');
    const rect = panel.getBoundingClientRect();
    dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragOffset) return;
    panelX = Math.max(0, e.clientX - dragOffset.x);
    panelY = Math.max(0, e.clientY - dragOffset.y);
    const panel = shadow.querySelector('.panel');
    if (panel) { panel.style.left = panelX + 'px'; panel.style.top = panelY + 'px'; }
  });
  document.addEventListener('mouseup', () => { dragOffset = null; });
}

// ===================== LOAD =====================

async function loadReport() {
  rows = [];
  renderPanel('loading');
  try {
    if (!authToken) authToken = await getAuthToken();
    const result = await fetchReport(authToken);
    rows = result.rows;
    rows._hasMore = result.hasMore;
    renderPanel();
  } catch (e) {
    console.error('[Pike13 Reports]', e);
    renderPanel({ message: esc(e.message) });
  }
}

// --- Boot ---
renderPanel('loading');
loadReport();
console.log(`Pike13 Reports v${VERSION} loaded successfully`);

})();
