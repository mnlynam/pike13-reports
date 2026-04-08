// Pike13 Reports v1.11 - Duration normalization fixes, 14-day threshold, dash and multiplication-sign purge, formatted human-written summary
(function() {
'use strict';

const PANEL_ID = 'pike13-reports';
const VERSION = '1.11';
const BUILD_DATE = '2026-04-08';
const SUBDOMAIN = location.hostname.split('.')[0];
const BASE = location.origin;

if (!location.hostname.endsWith('.pike13.com')) {
  alert('Pike13 Reports must be run from a pike13.com page.\n\nNavigate to musicplace.pike13.com first.');
  return;
}

// ===================== HELPERS =====================

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(d) {
  if (!d) return '';
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
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  return `${hr % 12 || 12}:${m} ${ampm}`;
}

function fmtCurrency(cents) {
  if (cents == null) return '';
  return '$' + (Number(cents) / 100).toFixed(2);
}

// Convert a raw day count to a human-readable duration with up to two units.
// Under 14 days: raw day count (e.g. "3d", "13d"). 14-29 days: weeks plus
// leftover days (e.g. "2w", "2w 3d"). 30-364 days: months plus leftover weeks
// (e.g. "3mo", "5mo 1w"). 365+ days: years plus leftover months (e.g. "2y",
// "8y 5mo"). Approximations: 1 month = 30 days, 1 year = 365 days. The >=4w
// and >=12mo normalizations prevent edge cases like "6mo 4w" (which should be
// "7mo") or "1y 12mo" (which should be "2y") that the naive modular math
// would otherwise produce.
function fmtDuration(days) {
  if (days == null) return '';
  const d = Math.abs(Math.floor(Number(days)));
  if (d < 14) return `${d}d`;
  if (d < 30) {
    const w = Math.floor(d / 7);
    const rem = d % 7;
    return rem > 0 ? `${w}w ${rem}d` : `${w}w`;
  }
  if (d < 365) {
    let mo = Math.floor(d / 30);
    let remW = Math.floor((d % 30) / 7);
    if (remW >= 4) { mo++; remW = 0; }
    return remW > 0 ? `${mo}mo ${remW}w` : `${mo}mo`;
  }
  let y = Math.floor(d / 365);
  let remMo = Math.floor((d % 365) / 30);
  if (remMo >= 12) { y++; remMo = 0; }
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
      return `Declined Payments Report for ${m}`;
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
      return `Post-assessment Report for ${f(dateStart)} to ${f(dateEnd)}`;
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
      return `Unpaid Invoice Triage for ${today}`;
    },
    // Returns a structured array of content blocks for the summary preamble,
    // written as a short human-readable report: an intro sentence, a labeled
    // bullet list of categories, and (if applicable) an urgent-subset callout.
    // Each builder renders the blocks into its own output format. HTML wraps
    // each paragraph in <p> and each list in <ul><li>, and the plain-text and
    // Slack-mrkdwn outputs render bullets with a bullet character.
    buildExplanation: () => {
      if (rows.length === 0) return [];
      const cats = {
        'COLLECT':           { count: 0, owed: 0, desc: 'active customers who still owe. Chase these.' },
        'COLLECT (partial)': { count: 0, owed: 0, desc: 'active customers, partial payment received. Collect the balance.' },
        'CLEANUP':           { count: 0, owed: 0, desc: 'no active plan linked. Safe to cancel.' },
        'CLEANUP (refund)':  { count: 0, owed: 0, desc: 'no active plan, payment on file. Refund first, then cancel.' },
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

      const blocks = [];
      blocks.push({
        type: 'paragraph',
        text: `${rows.length} past-due invoices in the queue today, totaling ${fmt$(totalOwed)} outstanding.`
      });
      blocks.push({
        type: 'list',
        intro: 'How they break down:',
        items: labels.map(l => {
          const c = cats[l];
          return `${c.count} ${l} (${fmt$(c.owed)}): ${c.desc}`;
        })
      });
      if (urgentCount > 0) {
        blocks.push({
          type: 'paragraph',
          text: `${urgentCount} of these have failed autobills totaling ${fmt$(urgentOwed)}. These are the most urgent: the cards on file are declining and the customers probably don't know yet.`
        });
      }
      return blocks;
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
        if (v >= 3) return `<span style="color:#dc2626;font-weight:700">${v}</span>`;
        if (v > 0) return `<span style="color:#d97706;font-weight:600">${v}</span>`;
        return `<span style="color:#9ca3af">${v}</span>`;
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

      // Phase 3: business-wide active plan set (NO person filter, KL #237)
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
          rec = `Partial paid ($${(paidC/100).toFixed(2)} of $${(totalC/100).toFixed(2)}): collect $${(owedC/100).toFixed(2)} balance`;
        } else if (hasActivePlan) {
          cls = 'COLLECT';
          if (autobill === 't' && failedTx >= 3) {
            rec = `Auto-bill failed ${failedTx} times: update payment method or contact customer`;
          } else if (autobill === 't' && failedTx > 0) {
            rec = `Auto-bill failing (${failedTx} attempts): monitor`;
          } else if (autobill === 't') {
            rec = `Auto-bill pending: will retry`;
          } else {
            rec = `Manual bill: send payment reminder`;
          }
        } else if (hasPayment) {
          cls = 'CLEANUP (refund)';
          rec = `Refund $${(paidC/100).toFixed(2)} (paid by customer), then cancel`;
        } else {
          cls = 'CLEANUP';
          rec = daysSince < 365 ? `Orphan (${fmtDuration(daysSince)}): verify before cancelling` : `Stale orphan (${fmtDuration(daysSince)}): safe to cancel`;
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

// Per-report "Include summary" checkbox state, defaults to false
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
    throw new Error('Session expired. Please log into the Pike13 desk and try again.');
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
  if (val == null) return '';
  return String(val);
}

// Used by buildHtmlTable for clipboard output. Same as fmtCellPlain but
// preserves links on columns that define a `link` callback. Does NOT invoke
// the `render` callbacks (which produce panel-internal HTML with CSS classes
// that won't carry over to email/Canvas destinations); instead it prefers
// `renderPlain` when available, falling back to the val-based formatters.
function fmtCellClipboardHtml(r, col) {
  if (col.renderPlain) return esc(col.renderPlain(r));
  const val = r[col.idx];
  if (col.format === 'date') return esc(fmtDate(val));
  if (col.format === 'time') return esc(fmtTime(val));
  if (col.format === 'currency') return esc(fmtCurrency(val));
  if (col.link) {
    const href = col.link(r);
    return `<a href="${esc(href)}">${esc(val)}</a>`;
  }
  return esc(val);
}

// ===================== CLIPBOARD / EMAIL =====================

// Render a structured explanation blocks array as HTML (<p>, <ul><li>) for
// the clipboard output. Each format builder reads the same blocks and emits
// its own format-appropriate markup.
function renderExplanationAsHtml(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  let html = '';
  for (const b of blocks) {
    if (b.type === 'paragraph') {
      html += `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;">${esc(b.text)}</p>`;
    } else if (b.type === 'list') {
      if (b.intro) {
        html += `<p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;">${esc(b.intro)}</p>`;
      }
      html += '<ul style="margin:0 0 8px 20px;padding:0;font-family:Arial,sans-serif;font-size:13px;">';
      for (const item of b.items) {
        html += `<li style="margin:2px 0;">${esc(item)}</li>`;
      }
      html += '</ul>';
    }
  }
  return html;
}

// Render the same blocks as plain text for clipboard and Slack-mrkdwn outputs.
// Paragraphs are joined by blank lines, lists are rendered with a bullet
// character followed by each item on its own line underneath an optional intro.
function renderExplanationAsPlainText(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  const parts = [];
  for (const b of blocks) {
    if (b.type === 'paragraph') {
      parts.push(b.text);
    } else if (b.type === 'list') {
      let s = '';
      if (b.intro) s += b.intro + '\n';
      s += b.items.map(i => '• ' + i).join('\n');
      parts.push(s);
    }
  }
  return parts.join('\n\n');
}

function buildHtmlTable() {
  const rpt = report();
  let html = `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${esc(rpt.emailSubject())}</p>`;
  // Optional summary preamble (toggled by the "Include summary" checkbox).
  // Rendered as real <p> and <ul><li> elements so it renders as a proper
  // formatted document in email / Canvas / any rich-text destination.
  if (savedExplain[currentReportId] && rpt.buildExplanation) {
    html += renderExplanationAsHtml(rpt.buildExplanation());
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
      html += `<td${align}>${fmtCellClipboardHtml(r, col)}</td>`;
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
    const ex = renderExplanationAsPlainText(rpt.buildExplanation());
    if (ex) txt += ex + '\n\n';
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
  // Optional summary preamble placed ABOVE the code block as Slack message
  // text. Slack wraps message paragraphs naturally; placing the prose inside
  // the code block would force monospace, which makes long lines wrap badly.
  let preamble = '';
  if (savedExplain[currentReportId] && rpt.buildExplanation) {
    const ex = renderExplanationAsPlainText(rpt.buildExplanation());
    if (ex) preamble = '\n\n' + ex;
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
  // can't be sent; Slack shows an overflow badge in the compose box. v1.6 had
  // this set to 12000 which never fired in the danger zone.
  const overLimit = text.length > 4000;
  if (overLimit) {
    showToast(`⚠ Copied ${charCount} chars, which exceeds Slack's 4,000-char message limit. Use 📋 HTML and paste into a Slack Canvas instead for tables this large.`, true);
  } else {
    showToast(`✓ Copied for Slack. Paste into Slack message (${charCount} chars)`);
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
  showToast('✓ Table copied. Ctrl+V to paste into email body', true);
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
    background:#ffffff; border-radius:${isMinimized ? '20px' : '12px'};
    color:#111827;
    font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size:13px; line-height:1.5;
    display:flex; flex-direction:column; overflow:hidden;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.10),
      0 6px 20px rgba(0,0,0,0.14),
      0 24px 56px rgba(0,0,0,0.12);
  }
  .accent-bar {
    height:4px; flex-shrink:0;
    background:linear-gradient(90deg, #2563eb 0%, #0ea5e9 100%);
  }
  .hdr {
    display:flex; align-items:center; gap:10px;
    padding:${isMinimized ? '8px 14px' : '12px 14px 10px'};
    background:#ffffff;
    border-bottom:${isMinimized ? 'none' : '1px solid #e5e7eb'};
    cursor:grab; user-select:none;
    flex-shrink:0;
  }
  .hdr:active { cursor:grabbing; }
  .logo {
    display:flex; align-items:center; justify-content:center;
    width:34px; height:34px;
    background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:8px;
    font-size:16px; flex-shrink:0;
  }
  .title-block { display:flex; flex-direction:column; }
  .title {
    font-size:14px; font-weight:700; color:#111827;
    letter-spacing:-0.2px; line-height:1.2; white-space:nowrap;
  }
  .subtitle {
    font-size:10px; color:#9ca3af; margin-top:1px;
    font-family:ui-monospace, Menlo, Monaco, Consolas, monospace;
    letter-spacing:0.2px;
  }
  .hdr select {
    background:#f9fafb; border:1.5px solid #d1d5db; color:#111827;
    padding:6px 10px; border-radius:7px; font-size:12px; font-weight:600;
    font-family:inherit; cursor:pointer;
    transition:border-color 0.15s, box-shadow 0.15s;
  }
  .hdr select:hover { border-color:#9ca3af; }
  .hdr select:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }
  .hdr-btns { display:flex; gap:6px; margin-left:auto; }
  .hdr-btns button {
    display:flex; align-items:center; justify-content:center;
    width:28px; height:28px;
    background:none; border:1.5px solid #e5e7eb; border-radius:6px;
    color:#9ca3af; cursor:pointer;
    font-size:12px; font-family:inherit; line-height:1;
    transition:border-color 0.15s, color 0.15s, background 0.15s;
  }
  .hdr-btns button:hover { border-color:#2563eb; color:#2563eb; background:#eff6ff; }

  .toolbar {
    display:flex; align-items:center; gap:8px; flex-wrap:wrap;
    padding:10px 14px; background:#f9fafb; border-bottom:1px solid #e5e7eb;
  }
  .toolbar label { color:#6b7280; font-size:11px; font-weight:600; }
  .toolbar input[type="email"] {
    background:#ffffff; border:1.5px solid #d1d5db; color:#111827;
    padding:6px 10px; border-radius:7px; font-size:12px; width:200px;
    font-family:inherit;
    transition:border-color 0.15s, box-shadow 0.15s;
  }
  .toolbar input[type="email"]:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }
  .checkbox-label {
    display:flex; align-items:center; gap:6px;
    color:#374151; font-size:12px; font-weight:600;
    cursor:pointer; user-select:none;
    padding:5px 8px; border-radius:6px;
    transition:background 0.15s, color 0.15s;
  }
  .checkbox-label:hover { background:#eff6ff; color:#1d4ed8; }
  .checkbox-label input[type="checkbox"] {
    margin:0; cursor:pointer; accent-color:#2563eb;
  }

  .btn {
    padding:7px 14px; border-radius:7px; border:none;
    font-size:12px; font-weight:600; cursor:pointer;
    font-family:inherit;
    transition:background 0.15s, box-shadow 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
  }
  .btn-pri {
    background:#2563eb; color:#fff;
    box-shadow:0 2px 8px rgba(37,99,235,0.30);
  }
  .btn-pri:hover { background:#1d4ed8; box-shadow:0 4px 14px rgba(37,99,235,0.40); }
  .btn-pri:active { transform:scale(0.98); }
  .btn-pri:disabled {
    background:#93c5fd; cursor:not-allowed; box-shadow:none; transform:none;
  }
  .btn-sec {
    background:#ffffff; color:#374151; border:1.5px solid #d1d5db;
  }
  .btn-sec:hover { border-color:#2563eb; color:#2563eb; background:#eff6ff; }
  .btn-sec:disabled { opacity:0.5; cursor:not-allowed; }

  .badge {
    background:#eff6ff; color:#1d4ed8;
    padding:3px 10px; border-radius:99px;
    font-size:11px; font-weight:700;
    border:1.5px solid #bfdbfe;
  }

  .info-bar {
    display:flex; align-items:center; gap:8px; flex-wrap:wrap;
    padding:8px 14px; background:#ffffff; border-bottom:1px solid #e5e7eb;
    font-size:11px; color:#6b7280;
  }
  .info-bar input[type="date"] {
    background:#f9fafb; border:1.5px solid #d1d5db; color:#111827;
    padding:5px 8px; border-radius:6px; font-size:11px;
    font-family:ui-monospace, Menlo, Monaco, Consolas, monospace;
    transition:border-color 0.15s, box-shadow 0.15s;
  }
  .info-bar input[type="date"]:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }
  .info-bar .info-label { color:#6b7280; font-size:11px; font-weight:600; }
  .tag {
    display:inline-block;
    background:#f3f4f6; color:#6b7280;
    padding:3px 8px; border-radius:4px;
    font-size:10px; font-weight:600;
    border:1px solid #e5e7eb;
    letter-spacing:0.2px;
  }
  .divider { width:1px; height:20px; background:#e5e7eb; margin:0 4px; }

  .body { flex:1; overflow:auto; background:#ffffff; }
  .status-msg { padding:28px; text-align:center; color:#6b7280; }
  .spinner {
    display:inline-block; width:20px; height:20px;
    border:2px solid #e5e7eb; border-top-color:#2563eb;
    border-radius:50%; animation:spin 0.8s linear infinite;
    margin-bottom:10px;
  }
  @keyframes spin { to { transform:rotate(360deg); } }

  table { width:100%; border-collapse:collapse; }
  th {
    position:sticky; top:0; background:#f9fafb;
    padding:10px; text-align:left;
    font-size:10px; font-weight:700;
    color:#9ca3af; text-transform:uppercase; letter-spacing:0.8px;
    border-bottom:2px solid #e5e7eb;
    white-space:nowrap;
  }
  td {
    padding:8px 10px;
    border-bottom:1px solid #f3f4f6;
    font-size:12px; color:#111827;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  tbody tr:nth-child(even) td { background:#fafbfc; }
  tr:hover td { background:#eff6ff; }
  td a { color:#2563eb; text-decoration:none; font-weight:500; }
  td a:hover { text-decoration:underline; color:#1d4ed8; }
  .num { text-align:center; }
  .num-zero { text-align:center; color:#9ca3af; }

  .cls {
    display:inline-block;
    padding:3px 8px; border-radius:99px;
    font-size:10px; font-weight:700; letter-spacing:0.3px;
    white-space:nowrap;
    border:1.5px solid transparent;
  }
  .cls-collect         { background:#f0fdf4; color:#059669; border-color:#86efac; }
  .cls-collect-partial { background:#fffbeb; color:#92400e; border-color:#fcd34d; }
  .cls-cleanup         { background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; }
  .cls-cleanup-refund  { background:#fee2e2; color:#b91c1c; border-color:#fca5a5; }

  .warn {
    color:#92400e; font-size:12px; font-weight:600;
    padding:8px 14px; background:#fffbeb;
    border-bottom:1px solid #fcd34d;
  }

  .toast {
    position:fixed; bottom:30px; left:50%; transform:translateX(-50%);
    background:#111827; color:#fff;
    padding:12px 20px; border-radius:10px;
    font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    font-weight:500;
    box-shadow:0 8px 24px rgba(0,0,0,0.25);
    z-index:1000001; pointer-events:none;
    animation:fadeInOut 3.5s ease forwards;
    max-width:90%;
  }
  .toast.persistent {
    pointer-events:auto; animation:fadeIn 0.3s ease forwards;
    background:#f0fdf4; color:#059669;
    border:1.5px solid #86efac;
    box-shadow:0 8px 24px rgba(0,0,0,0.12);
  }
  @keyframes fadeIn {
    from { opacity:0; transform:translateX(-50%) translateY(10px); }
    to   { opacity:1; transform:translateX(-50%) translateY(0); }
  }
  @keyframes fadeInOut {
    0%   { opacity:0; transform:translateX(-50%) translateY(10px); }
    12%  { opacity:1; transform:translateX(-50%) translateY(0); }
    75%  { opacity:1; }
    100% { opacity:0; }
  }
</style>
<div class="panel">
  ${isMinimized ? '' : '<div class="accent-bar"></div>'}
  <div class="hdr" id="drag-handle">
    <div class="logo">📋</div>
    <div class="title-block">
      <span class="title">Reports${isMinimized ? pillBadge : ''}</span>
      ${!isMinimized ? `<span class="subtitle">Pike13 · v${VERSION} · ${BUILD_DATE}</span>` : ''}
    </div>
    ${!isMinimized ? `<select id="rpt-select">${optionsHtml}</select>` : ''}
    ${!isMinimized && rows.length > 0 ? `<span class="badge">${rows.length} ${rpt.rowNoun || 'row'}${rows.length !== 1 ? 's' : ''}</span>` : ''}
    <div class="hdr-btns">
      <button id="btn-min" title="${isMinimized ? 'Expand' : 'Minimize'}">${isMinimized ? '□' : '─'}</button>
      <button id="btn-close" title="Close">✕</button>
    </div>
  </div>
  ${isMinimized ? '' : `
  <div class="toolbar">
    <button class="btn btn-pri" id="btn-copy" ${rows.length === 0 ? 'disabled' : ''} title="Copy as HTML table. Paste into email or any rich-text destination.">📋 HTML</button>
    <button class="btn btn-pri" id="btn-copy-slack" ${rows.length === 0 ? 'disabled' : ''} title="Copy as Slack mrkdwn with monospace code block. Paste into a Slack message. Best for short tables under 4,000 characters; wide tables (like Unpaid Invoice Triage) will not fit and will not render correctly. Use 📋 HTML and paste into a Slack Canvas instead for those.">💬 Slack</button>
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
      <button class="btn btn-sec" id="btn-apply-dates" style="padding:4px 10px;font-size:11px;">Apply</button>
      ${tags.length ? '<span class="divider"></span>' : ''}
    ` : ''}
    ${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
  </div>
  ` : ''}
  <div class="body" id="body">
    ${status === 'loading' ? `
      <div class="status-msg"><div class="spinner"></div><br>${rpt.loadingMsg}</div>
    ` : status && status.message ? `
      <div class="status-msg" style="color:#b91c1c;">⚠ ${status.message}</div>
    ` : rows.length === 0 ? `
      <div class="status-msg">${rpt.emptyMsg}</div>
    ` : `
      ${rows._hasMore ? '<div class="warn">⚠ More than 500 results. Only first 500 shown.</div>' : ''}
      <table>
        <thead><tr>${thHtml}</tr></thead>
        <tbody>${trHtml}</tbody>
      </table>
    `}
  </div>
  `}
</div>`;

  // --- Wire events ---
  shadow.getElementById('btn-close')?.addEventListener('click', () => host.remove());
  shadow.getElementById('btn-min')?.addEventListener('click', () => { isMinimized = !isMinimized; renderPanel(); });
  shadow.getElementById('btn-email')?.addEventListener('click', emailReport);
  shadow.getElementById('btn-copy')?.addEventListener('click', async () => {
    await copyTableToClipboard();
    showToast('✓ HTML table copied. Paste into email or rich-text');
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
