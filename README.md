# Pike13 Reports

Browser bookmarklet for running and sharing Pike13 admin reports. Queries the Reporting API v3 directly, displays results in a draggable dark-theme panel, and copies formatted tables for pasting into Slack or email.

## Reports

| Report | API Slug(s) | Default Dates | Default Recipient |
|---|---|---|---|
| **Declined Payments** | `invoices` | Last 6 months | lcaploe@musicplace.com |
| **Post-assessment** | `event_occurrences` | Last 4 weeks | jmorris@musicplace.com |
| **Unpaid Invoice Triage** | `invoices` + `invoice_items` + `person_plans` | n/a (current state) | lcaploe@musicplace.com |

### Unpaid Invoice Triage

Replicates the `/today/unpaid_invoices` page and classifies each row as collections-worthy or cleanup-eligible by joining invoice line items to the business-wide active plan set. Three batch report calls, zero per-invoice fetches, completes in ~2 seconds for ~100 invoices.

**Categories:**

- **COLLECT** — Active customer owes money. Recommendation depends on autobill status: failed autobill (3+ attempts) → update payment method, manual bill → send reminder, etc.
- **COLLECT (partial)** — Active customer with partial payment received; collect the remainder.
- **CLEANUP** — No active linked plan, no payment on file. Safe to cancel. Orphans under a year old are flagged "verify before cancelling."
- **CLEANUP (refund)** — No active linked plan, but a payment was made. Refund first, then cancel.

Default sort is Owed descending so the biggest collections opportunities surface first. Correctly handles dependent/recipient plans (e.g. parent paying for a child's lessons) by querying `person_plans` business-wide rather than scoping to the payer.

## Installation

### Option A: Bookmarklet (recommended)

Create a new bookmark with this URL:

```
javascript:void(fetch('https://raw.githubusercontent.com/YOUR_USER/pike13-reports/main/pike13-reports.js').then(r=>r.text()).then(eval))
```

Replace `YOUR_USER` with your GitHub username after creating the repo.

### Option B: Console paste

Copy the contents of `pike13-reports.js` and paste into the browser console on any Pike13 desk page.

## Usage

1. Navigate to any page on `musicplace.pike13.com` (must be logged into the desk)
2. Click the bookmarklet (or paste into console)
3. Select a report from the dropdown
4. Adjust date range if needed, click **Apply** (date-based reports only)
5. **Copy Table** copies a formatted HTML table with a title header to your clipboard
6. Paste into Slack, email (Roundcube), or a doc

### Email workflow

1. Enter a recipient address (defaults are pre-filled per report)
2. Click **Email** — copies the table and opens Roundcube compose with To/Subject filled
3. Ctrl+V to paste the table into the email body

## Requirements

- Must be run from a `*.pike13.com` domain
- Must be logged into the Pike13 desk (admin area)
- Session auth token is extracted automatically from `/desk/reports`

## Features

- Shadow DOM panel (no style conflicts with Pike13)
- Draggable, minimizes to pill
- Per-report date pickers with saved state (date-based reports only)
- Per-report email defaults
- Read-only filter tags showing active query criteria
- Color-coded status badges and inline currency formatting
- Domain guard (alerts if run from wrong site)
- Descriptive error messages for auth failures

## Architecture notes

Each report is defined as a config object in the `REPORTS` array. Date-based reports use the default single-query path: the framework POSTs to `/desk/api/v3/reports/{slug}/queries` with the report's `fields`, `filter`, and `sort`, then renders the response rows through the column definitions.

Reports needing multi-phase queries with client-side joins (currently just Unpaid Invoice Triage) provide a `customFetch(token, queryV3)` hook instead of `slug`/`fields`/`getFilter`/`sort`. The hook receives the auth token and the shared `queryV3` helper, runs whatever sequence of API calls it needs, and returns rows in the standard `{ rows, totalCount, hasMore }` shape — the rest of the framework treats them identically.

Column definitions support `format: 'date' | 'time' | 'currency'`, link callbacks, and per-column `render(r)` / `renderPlain(r)` callbacks for custom HTML or plain-text output. The `render` callback is used by the triage report for the colored status badge and the color-graded fail count.

## Version History

| Version | Date | Notes |
|---|---|---|
| 1.2 | 2026-04-08 | Added **Unpaid Invoice Triage** as third report. Framework extended with `customFetch` hook for multi-phase queries; `queryV3()` extracted as a shared helper; column system gained `render` callbacks and `currency` format. |
| 1.1 | 2026-04-02 | Dark-themed date pickers, dimmed zero values, label contrast improvements. |
| 1.0 | 2026-04-02 | Initial release. Declined Payments + Post-assessment reports. |
