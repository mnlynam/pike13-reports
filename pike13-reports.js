// Pike13 Reports v1.12 - UIT classifier rebuilt: plan_id join, 3-year cutoff, account-activity check, two-class flattening with separate Modifiers column
(function() {
'use strict';

const PANEL_ID = 'pike13-reports';
const VERSION = '1.12';
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

// Convert a raw day count to a human-readable duration. See v1.11 for the
// full rationale and edge case notes.
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Run an async function over a list of items with bounded concurrency.
async function runConcurrent(items, concurrency, fn) {
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    await Promise.all(chunk.map(fn));
  }
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
    loadingMsg: 'Fetching declined payments...',
    defaultEmail: 'lcaploe@musicplace.com',
    dateRange: true,
    defaultDates: () => {
      const t = new Date();
      return {
        start: fmtDateISO(new Date(t.getFullYear(), t.getMonth() - 6, t.getDate())),
        end: fmtDateISO(t)
      };
    },
    filterTags: () => ['Failed transactions > 0', 'Status not closed', 'Status not canceled'],
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
    loadingMsg: 'Fetching assessments...',
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
    // ===== Unpaid Invoice Triage (v1.12 rebuild) =====
    // Rebuilt classification pipeline (ported from pike13-invoice-cleanup v1.08):
    //   1. Pull invoice_items with plan_id (undocumented but accepted v3 field)
    //   2. Pull person_plans for the linked plan_ids only (or-eq filter shape;
    //      'in' shape is rejected)
    //   3. Fetch dependents for each unique payer via desk API (parallelized
    //      at concurrency 5)
    //   4. Pull clients.last_visit_date for payers + dependents
    //   5. Pull recent transactions filtered by invoice_payer_id and
    //      transaction_date > 3 years ago
    //   6. Classify each invoice as COLLECT or CLEANUP with modifier tags
    //
    // Two-class flattening: every row is either COLLECT or CLEANUP at the
    // top level. Sub-types live in a separate Modifiers column. The promotion
    // rule: any account with recent activity (visits or payments by the payer
    // or their dependents in the last 3 years) is COLLECT regardless of plan
    // age, including refund-required cases. Refund cases promote to COLLECT
    // because the customer is reachable and the service was delivered.
    id: 'unpaid_triage',
    name: 'Unpaid Invoice Triage',
    rowNoun: 'invoice',
    emptyMsg: 'No past-due invoices found.',
    loadingMsg: 'Triaging unpaid invoices (this may take 30-60 seconds)...',
    defaultEmail: 'lcaploe@musicplace.com',
    dateRange: false,
    filterTags: () => ['Matches /today/unpaid_invoices', 'Joined to plan records by plan_id', '3-year cutoff', 'Activity check on payer + dependents'],
    emailSubject: () => {
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `Unpaid Invoice Triage for ${today}`;
    },
    buildExplanation: () => {
      if (rows.length === 0) return [];
      const cats = {
        'COLLECT': { count: 0, owed: 0 },
        'CLEANUP': { count: 0, owed: 0 },
      };
      const modifierCounts = {};
      let totalOwed = 0, urgentCount = 0, urgentOwed = 0;
      for (const r of rows) {
        const cls = r[0], owedC = r[5], autobill = r[10], failedTx = r[11], modifiers = r[13] || [];
        if (cats[cls]) { cats[cls].count++; cats[cls].owed += owedC; }
        totalOwed += owedC;
        for (const m of modifiers) {
          modifierCounts[m] = (modifierCounts[m] || 0) + 1;
        }
        if (autobill === 'yes' && failedTx >= 3) { urgentCount++; urgentOwed += owedC; }
      }
      const fmt$ = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const blocks = [];
      blocks.push({
        type: 'paragraph',
        text: `${rows.length} past-due invoices in the queue today, totaling ${fmt$(totalOwed)} outstanding.`
      });

      const items = [];
      if (cats.COLLECT.count > 0) {
        items.push(`${cats.COLLECT.count} COLLECT (${fmt$(cats.COLLECT.owed)}): customers are reachable, follow up to collect.`);
      }
      if (cats.CLEANUP.count > 0) {
        items.push(`${cats.CLEANUP.count} CLEANUP (${fmt$(cats.CLEANUP.owed)}): customers are gone, safe to write off.`);
      }
      blocks.push({ type: 'list', intro: 'How they break down:', items });

      // Modifier breakdown if any are present
      const modifierItems = [];
      const modifierLabels = {
        'partial':       'partial-paid (collect the balance)',
        'old bill':      'old bills, customer still active (gentle follow-up)',
        'refund needed': 'refund required first (paid invoice on a dead plan)',
        'non-plan':      'non-plan items (retail, signup fees, etc.)',
      };
      for (const key of ['partial', 'old bill', 'refund needed', 'non-plan']) {
        if (modifierCounts[key]) {
          modifierItems.push(`${modifierCounts[key]} ${modifierLabels[key]}`);
        }
      }
      if (modifierItems.length > 0) {
        blocks.push({ type: 'list', intro: 'Modifiers worth noting:', items: modifierItems });
      }

      if (urgentCount > 0) {
        blocks.push({
          type: 'paragraph',
          text: `${urgentCount} of these have failed autobills totaling ${fmt$(urgentOwed)}. These are the most urgent: the cards on file are declining and the customers probably do not know yet.`
        });
      }
      return blocks;
    },
    columns: [
      { label: 'Status',         idx: 0, render: r => `<span class="cls ${clsSlug(r[0])}">${esc(r[0])}</span>` },
      { label: 'Modifiers',      idx: 13, render: r => {
        const mods = r[13] || [];
        if (mods.length === 0) return '<span style="color:#cbd5e1;">-</span>';
        return mods.map(m => `<span class="mod mod-${m.replace(/\s+/g, '-')}">${esc(m)}</span>`).join(' ');
      }, renderPlain: r => (r[13] || []).join(', ') },
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
      // Phase 1: invoice_items with plan_id (filtered server-side to past-due
      // open invoices with positive outstanding amount). Single bulk query.
      const itemAttrs = await queryV3('invoice_items', {
        page: { limit: 2000 },
        fields: [
          'invoice_id', 'invoice_item_id',
          'invoice_payer_id', 'invoice_payer_name',
          'invoice_number', 'issued_date', 'days_since_invoice_due',
          'product_name', 'product_type',
          'plan_id',
          'expected_amount', 'net_paid_amount', 'outstanding_amount',
          'invoice_autobill', 'failed_transactions'
        ],
        filter: ['and', [
          ['eq', 'invoice_state', 'open'],
          ['gt', 'outstanding_amount', 0],
          ['gt', 'days_since_invoice_due', 0]
        ]]
      }, token);
      const itemRows = itemAttrs.rows || [];
      if (itemRows.length === 0) return { rows: [], totalCount: 0, hasMore: false };

      // Phase 2: For each unique linked plan_id, pull the plan record.
      // Uses ['or', [['eq','plan_id', X], ...]] filter shape (the ['in', ...]
      // shape is rejected). Chunked at 100 plan_ids per query for safety.
      const linkedPlanIds = [...new Set(itemRows.map(r => r[9]).filter(p => p != null))];
      const planRows = [];
      if (linkedPlanIds.length > 0) {
        const CHUNK = 100;
        for (let i = 0; i < linkedPlanIds.length; i += CHUNK) {
          const chunk = linkedPlanIds.slice(i, i + CHUNK);
          const planAttrs = await queryV3('person_plans', {
            page: { limit: 200 },
            fields: ['plan_id', 'plan_name', 'start_date', 'end_date', 'is_canceled', 'is_ended', 'person_id', 'full_name'],
            filter: ['or', chunk.map(pid => ['eq', 'plan_id', pid])]
          }, token);
          planRows.push(...(planAttrs.rows || []));
        }
      }
      const planById = new Map();
      for (const p of planRows) planById.set(p[0], p);

      // Phase 3: Group line items by invoice
      const invoiceMap = new Map();
      for (const row of itemRows) {
        const [invId, itemId, payerId, payerName, invNum, issued, daysSince, productName, productType, planId, expectedC, paidC, owedC, autobill, failedTx] = row;
        if (!invoiceMap.has(invId)) {
          invoiceMap.set(invId, {
            invoiceId: invId,
            invoiceNumber: invNum,
            payerId,
            payerName,
            issuedDate: issued,
            daysSince,
            autobill,
            failedTx,
            totalExpectedCents: 0,
            totalPaidCents: 0,
            totalOwedCents: 0,
            lineItems: []
          });
        }
        const inv = invoiceMap.get(invId);
        inv.totalExpectedCents += expectedC;
        inv.totalPaidCents += paidC;
        inv.totalOwedCents += owedC;
        inv.lineItems.push({ productName, productType, planId });
      }

      // Compute the 3-year cutoff once
      const today = new Date();
      const threeYearsAgo = new Date(today);
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      const threeYearsAgoStr = threeYearsAgo.toISOString().slice(0, 10);

      // Phase 4: Annotate each invoice with recent-account-activity
      // (whether the payer or any dependents has had visits or payments in
      // the last 3 years). Used to promote old-bill cases from CLEANUP to
      // COLLECT. Ported from cleanup tool v1.08.
      const allInvoices = [...invoiceMap.values()];
      const payerIds = [...new Set(allInvoices.map(i => i.payerId))];
      const payerToDependents = new Map();
      await runConcurrent(payerIds, 5, async (payerId) => {
        try {
          const resp = await fetch(`${BASE}/api/v2/desk/people/${payerId}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          if (!resp.ok) {
            payerToDependents.set(payerId, []);
            return;
          }
          const json = await resp.json();
          const person = json.people?.[0];
          const depIds = (person?.dependents || []).map(d => d.id).filter(id => id != null);
          payerToDependents.set(payerId, depIds);
        } catch (e) {
          payerToDependents.set(payerId, []);
        }
      });

      const allRelevantIds = new Set();
      for (const pid of payerIds) {
        allRelevantIds.add(pid);
        for (const depId of (payerToDependents.get(pid) || [])) {
          allRelevantIds.add(depId);
        }
      }

      const lastVisitByPerson = new Map();
      const idArray = [...allRelevantIds];
      const ID_CHUNK = 100;
      for (let i = 0; i < idArray.length; i += ID_CHUNK) {
        const chunk = idArray.slice(i, i + ID_CHUNK);
        const clients = await queryV3('clients', {
          page: { limit: 200 },
          fields: ['person_id', 'last_visit_date'],
          filter: ['or', chunk.map(id => ['eq', 'person_id', id])]
        }, token);
        for (const row of (clients.rows || [])) {
          lastVisitByPerson.set(row[0], row[1]);
        }
      }

      const payersWithRecentPayments = new Set();
      for (let i = 0; i < payerIds.length; i += ID_CHUNK) {
        const chunk = payerIds.slice(i, i + ID_CHUNK);
        const txns = await queryV3('transactions', {
          page: { limit: 200 },
          fields: ['invoice_payer_id', 'transaction_date'],
          filter: ['and', [
            ['gt', 'transaction_date', threeYearsAgoStr],
            ['or', chunk.map(id => ['eq', 'invoice_payer_id', id])]
          ]]
        }, token);
        for (const row of (txns.rows || [])) {
          payersWithRecentPayments.add(row[0]);
        }
      }

      // Helper: does any line item have a covering plan?
      // A plan covers if it was alive at issued_date AND ended within the
      // last 3 years (or is still active / never ended).
      function hasCoveringPlan(inv) {
        return inv.lineItems.some(li => {
          if (li.planId == null) return false;
          const plan = planById.get(li.planId);
          if (!plan) return false;
          const end = plan[3];
          if (end && end < inv.issuedDate) return false; // ended before invoice issued
          if (end && end < threeYearsAgoStr) return false; // ended >3y ago
          return true;
        });
      }

      // Helper: does any line item lack a plan_id?
      function hasNonPlanItem(inv) {
        return inv.lineItems.some(li => li.planId == null);
      }

      // Helper: is the account active?
      function isAccountActive(inv) {
        const depIds = payerToDependents.get(inv.payerId) || [];
        for (const id of [inv.payerId, ...depIds]) {
          const lastVisit = lastVisitByPerson.get(id);
          if (lastVisit && lastVisit >= threeYearsAgoStr) return true;
        }
        if (payersWithRecentPayments.has(inv.payerId)) return true;
        return false;
      }

      // Phase 5: Classify each invoice
      const out = [];
      for (const inv of allInvoices) {
        const covered = hasCoveringPlan(inv);
        const hasPayment = inv.totalPaidCents > 0;
        const isActive = isAccountActive(inv);
        const nonPlan = hasNonPlanItem(inv);

        let cls;
        const modifiers = [];

        // Classification logic (two-class with promotion):
        // - covered AND no payment = COLLECT (fresh-billed, customer should pay)
        // - covered AND partial payment = COLLECT + 'partial'
        // - uncovered AND active = COLLECT + 'old bill' (promotion rule 1)
        // - uncovered AND payment AND active = COLLECT + 'refund needed' + 'old bill' (promotion rule 2)
        // - uncovered AND no payment AND not active = CLEANUP (true write-off)
        // - uncovered AND payment AND not active = CLEANUP + 'refund needed'
        if (covered) {
          cls = 'COLLECT';
          if (hasPayment && inv.totalOwedCents > 0) modifiers.push('partial');
        } else if (isActive) {
          cls = 'COLLECT';
          modifiers.push('old bill');
          if (hasPayment) modifiers.push('refund needed');
        } else if (hasPayment) {
          cls = 'CLEANUP';
          modifiers.push('refund needed');
        } else {
          cls = 'CLEANUP';
        }

        if (nonPlan) modifiers.push('non-plan');

        // Build recommendation text
        let rec;
        if (cls === 'COLLECT') {
          if (modifiers.includes('refund needed')) {
            rec = `Refund $${(inv.totalPaidCents/100).toFixed(2)} first, then collect $${(inv.totalOwedCents/100).toFixed(2)} balance`;
          } else if (modifiers.includes('partial')) {
            rec = `Partial paid ($${(inv.totalPaidCents/100).toFixed(2)} of $${(inv.totalExpectedCents/100).toFixed(2)}): collect $${(inv.totalOwedCents/100).toFixed(2)} balance`;
          } else if (modifiers.includes('old bill')) {
            rec = `Old bill (${fmtDuration(inv.daysSince)}), customer still active: gentle follow-up`;
          } else if (inv.autobill === 't' && inv.failedTx >= 3) {
            rec = `Auto-bill failed ${inv.failedTx} times: update payment method or contact customer`;
          } else if (inv.autobill === 't' && inv.failedTx > 0) {
            rec = `Auto-bill failing (${inv.failedTx} attempts): monitor`;
          } else if (inv.autobill === 't') {
            rec = `Auto-bill pending: will retry`;
          } else {
            rec = `Manual bill: send payment reminder`;
          }
        } else {
          if (modifiers.includes('refund needed')) {
            rec = `Refund $${(inv.totalPaidCents/100).toFixed(2)} (paid by customer), then cancel`;
          } else {
            rec = `Stale orphan (${fmtDuration(inv.daysSince)}): safe to cancel`;
          }
        }

        out.push([
          cls,                                    // 0  status
          inv.invoiceNumber,                      // 1  invoice number
          inv.invoiceId,                          // 2  invoice id (hidden, for link)
          inv.payerName,                          // 3  payer name
          inv.payerId,                            // 4  payer id (hidden, for link)
          inv.totalOwedCents,                     // 5  outstanding cents
          inv.totalExpectedCents,                 // 6  expected cents (hidden)
          inv.totalPaidCents,                     // 7  net paid cents (hidden)
          inv.daysSince,                          // 8  days past due
          inv.issuedDate,                         // 9  issued date (hidden)
          inv.autobill === 't' ? 'yes' : 'no',    // 10 autobill
          inv.failedTx,                           // 11 failed_transactions
          rec,                                    // 12 recommendation
          modifiers                               // 13 modifiers array
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

let dateStart, dateEnd;
const savedDates = {};
REPORTS.forEach(r => {
  if (r.defaultDates) savedDates[r.id] = r.defaultDates();
});
const _initDates = savedDates[REPORTS[0].id] || { start: '', end: '' };
dateStart = _initDates.start;
dateEnd = _initDates.end;

const savedEmails = {};
REPORTS.forEach(r => { savedEmails[r.id] = r.defaultEmail || ''; });

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
    throw new Error('Page /desk/reports not found. Make sure you are on the Pike13 desk (try navigating to ' + BASE + '/desk first).');
  }
  if (resp.status === 401 || resp.status === 403) {
    throw new Error('Not authorized. Please log into the Pike13 desk first.');
  }
  if (!resp.ok) {
    throw new Error('/desk/reports returned HTTP ' + resp.status + '. Try refreshing your Pike13 login.');
  }
  const html = await resp.text();
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
  if (rpt.customFetch) {
    return await rpt.customFetch(token, queryV3);
  }
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

function renderExplanationAsPlainText(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  const parts = [];
  for (const b of blocks) {
    if (b.type === 'paragraph') {
      parts.push(b.text);
    } else if (b.type === 'list') {
      let s = '';
      if (b.intro) s += b.intro + '\n';
      s += b.items.map(i => '* ' + i).join('\n');
      parts.push(s);
    }
  }
  return parts.join('\n\n');
}

function buildHtmlTable() {
  const rpt = report();
  let html = `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${esc(rpt.emailSubject())}</p>`;
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
  const rpt = report();
  if (rows.length === 0) return '';
  const ELLIPSIS = '...';

  const cells = rows.map(r => rpt.columns.map(c => {
    let val = fmtCellPlain(r, c);
    val = val.replace(/<[^>]+>/g, '');
    if (c.slackMax && val.length > c.slackMax) {
      val = val.slice(0, c.slackMax - 1) + ELLIPSIS;
    }
    return val;
  }));
  const headers = rpt.columns.map(c => c.label);

  const widths = headers.map((h, i) => {
    let w = h.length;
    for (const row of cells) w = Math.max(w, row[i].length);
    return w;
  });

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
  const sep = widths.map(w => '-'.repeat(w)).join('  ');
  const dataRows = cells.map(row =>
    row.map((cell, i) => align(cell, widths[i], rpt.columns[i])).join('  ')
  );

  const title = rpt.emailSubject();
  const noun = rpt.rowNoun || 'row';
  const countLine = `_${rows.length} ${noun}${rows.length !== 1 ? 's' : ''}_`;
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
  if (rows.length === 0) { showToast('Nothing to copy'); return; }
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
  const overLimit = text.length > 4000;
  if (overLimit) {
    showToast(`Copied ${charCount} chars, which exceeds Slack's 4,000-char message limit. Use HTML and paste into a Slack Canvas instead for tables this large.`, true);
  } else {
    showToast(`Copied for Slack. Paste into Slack message (${charCount} chars)`);
  }
}

function showToast(msg, persistent) {
  shadow.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (persistent ? ' persistent' : '');
  el.innerHTML = persistent
    ? `${msg} <span class="toast-dismiss" style="margin-left:12px;cursor:pointer;opacity:0.6">x</span>`
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
    showToast('Enter a recipient email first');
    emailInput?.focus();
    return;
  }
  const ok = await copyTableToClipboard();
  if (!ok) { showToast('Clipboard copy failed'); return; }
  const subject = encodeURIComponent(report().emailSubject());
  window.open(`https://webmail.musicplace.com/?_task=mail&_action=compose&_to=${encodeURIComponent(email)}&_subject=${subject}`, '_blank');
  showToast('Table copied. Ctrl+V to paste into email body', true);
}

// ===================== RENDER =====================

function renderPanel(status) {
  const startEl = shadow.querySelector('#rpt-date-start');
  const endEl = shadow.querySelector('#rpt-date-end');
  if (startEl) dateStart = startEl.value;
  if (endEl) dateEnd = endEl.value;

  const rpt = report();
  const pillBadge = rows.length > 0 ? ` (${rows.length})` : '';
  const tags = rpt.filterTags ? rpt.filterTags() : [];

  const thHtml = rpt.columns.map(c => {
    const style = c.align ? ` style="text-align:${c.align}"` : '';
    return `<th${style}>${c.label}</th>`;
  }).join('');

  const trHtml = rows.map(r => {
    const tds = rpt.columns.map(c => {
      const val = r[c.idx];
      const isZero = c.align === 'center' && (val === 0 || val === '0');
      const cls = c.align === 'center' ? ` class="${isZero ? 'num-zero' : 'num'}"` : '';
      return `<td${cls}>${fmtCell(r, c)}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  const optionsHtml = REPORTS.map(r =>
    `<option value="${r.id}" ${r.id === currentReportId ? 'selected' : ''}>${r.name}</option>`
  ).join('');

  shadow.innerHTML = `
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  :host { all:initial; }
  .panel {
    position:fixed; top:${panelY}px; left:${panelX}px;
    width:${isMinimized ? 'auto' : '1020px'}; max-height:${isMinimized ? 'none' : '80vh'};
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
  .cls-collect { background:#f0fdf4; color:#059669; border-color:#86efac; }
  .cls-cleanup { background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; }

  .mod {
    display:inline-block;
    padding:2px 6px; border-radius:4px;
    font-size:9px; font-weight:700; letter-spacing:0.2px;
    text-transform:uppercase;
    margin-right:3px; white-space:nowrap;
    border:1px solid transparent;
  }
  .mod-partial       { background:#fffbeb; color:#92400e; border-color:#fcd34d; }
  .mod-old-bill      { background:#f5f3ff; color:#6d28d9; border-color:#ddd6fe; }
  .mod-refund-needed { background:#fee2e2; color:#b91c1c; border-color:#fca5a5; }
  .mod-non-plan      { background:#fef3c7; color:#92400e; border-color:#fcd34d; }

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
    <button class="btn btn-pri" id="btn-copy-slack" ${rows.length === 0 ? 'disabled' : ''} title="Copy as Slack mrkdwn with monospace code block. Paste into a Slack message. Best for short tables under 4,000 characters; wide tables (like Unpaid Invoice Triage) will not fit and will not render correctly. Use HTML and paste into a Slack Canvas instead for those.">💬 Slack</button>
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
      <div class="status-msg" style="color:#b91c1c;">${status.message}</div>
    ` : rows.length === 0 ? `
      <div class="status-msg">${rpt.emptyMsg}</div>
    ` : `
      ${rows._hasMore ? '<div class="warn">More than 500 results. Only first 500 shown.</div>' : ''}
      <table>
        <thead><tr>${thHtml}</tr></thead>
        <tbody>${trHtml}</tbody>
      </table>
    `}
  </div>
  `}
</div>`;

  shadow.getElementById('btn-close')?.addEventListener('click', () => host.remove());
  shadow.getElementById('btn-min')?.addEventListener('click', () => { isMinimized = !isMinimized; renderPanel(); });
  shadow.getElementById('btn-email')?.addEventListener('click', emailReport);
  shadow.getElementById('btn-copy')?.addEventListener('click', async () => {
    await copyTableToClipboard();
    showToast('HTML table copied. Paste into email or rich-text');
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
    const emailEl = shadow.querySelector('#rpt-email');
    if (emailEl) savedEmails[currentReportId] = emailEl.value;
    const sEl = shadow.querySelector('#rpt-date-start');
    const eEl = shadow.querySelector('#rpt-date-end');
    if (sEl && eEl) savedDates[currentReportId] = { start: sEl.value, end: eEl.value };
    currentReportId = e.target.value;
    const dates = savedDates[currentReportId];
    if (dates) { dateStart = dates.start; dateEnd = dates.end; }
    loadReport();
  });

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

renderPanel('loading');
loadReport();
console.log(`Pike13 Reports v${VERSION} loaded successfully`);

})();
