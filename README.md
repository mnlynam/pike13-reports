# Pike13 Reports

Browser bookmarklet for running and sharing Pike13 admin reports. Queries the Reporting API v3 directly, displays results in a draggable light-theme panel, and copies formatted tables for pasting into email, Google Docs, or Slack Canvases.

## Reports

| Report | API Slug(s) | Default Dates | Default Recipient |
|---|---|---|---|
| **Declined Payments** | `invoices` | Last 6 months | lcaploe@musicplace.com |
| **Post-assessment** | `event_occurrences` | Last 4 weeks | jmorris@musicplace.com |
| **Unpaid Invoice Triage** | `invoice_items` + `person_plans` + `clients` + `transactions` + desk API | n/a (current state) | lcaploe@musicplace.com |

### Unpaid Invoice Triage

Replicates the `/today/unpaid_invoices` page and classifies each row as either COLLECT (the customer is reachable, follow up to collect) or CLEANUP (the customer is gone, safe to write off). The classification pipeline joins invoice line items to their linked plan records by `plan_id`, checks the temporal coverage of each plan against the invoice's issued date and a 3-year cutoff, and then runs an account-activity check to promote reachable customers from CLEANUP to COLLECT regardless of plan age. Wall time is 30 to 60 seconds because of the account-activity phase, which fetches dependents per payer via the desk API and runs a transactions query against the Reporting API.

The tool operates as a read-only triage view. For the destructive-write companion that actually bulk-cancels CLEANUP invoices with a per-row confirmation step and post-cancel verification, see [`pike13-invoice-cleanup`](https://github.com/mnlynam/pike13-invoice-cleanup).

**Two top-level classifications plus modifiers:**

Every row is either COLLECT or CLEANUP. Sub-types live in a separate Modifiers column as small colored badges. A row can have more than one modifier.

- **COLLECT**: The customer is reachable. Follow up to collect.
- **CLEANUP**: The customer is gone, the linked plan (if any) ended more than 3 years ago, and no one on the account has had a visit or payment in that window. Safe to write off.

**Modifiers:**

- **partial**: Partial payment received on a live plan. Collect the balance.
- **old bill**: Bill is uncovered by any current plan, but the customer or their dependents are still active. Gentle follow-up.
- **refund needed**: A payment exists on a dead plan. Refund first, then decide whether to collect (if the customer is still active) or cancel (if they are not).
- **non-plan**: At least one line item lacks a `plan_id` (retail item, signup fee, or other one-off charge).

**Classification rule:**

A bill counts as COLLECT if any of these are true:

- Every line item is linked to a plan that was alive when the invoice was issued and ended within the last 3 years (or is still active).
- The payer or any of their dependents has had a visit in the last 3 years. This is the "customer is reachable" promotion rule that moves old bills from CLEANUP to COLLECT.
- The payer has had any kind of successful payment processed in the last 3 years. Same promotion rule, different signal.

A bill counts as CLEANUP only if all of these are true:

- Every line item either lacks a `plan_id` or is linked to a plan that ended more than 3 years ago (or ended before the invoice was issued).
- No one on the account (payer or dependents) has had a visit in the last 3 years.
- The payer has had no successful payments in the last 3 years.

The temporal coverage check deliberately does not look at `start_date`. Pike13 pre-bills recurring plans before the billing period starts, so an invoice issued March 19 for an April 1 to 30 plan period would have looked like an orphan under a naive "plan started after invoice" rule. The `plan_id` linkage itself is sufficient evidence of association; only `end_date` is checked.

The line-item-to-plan join goes through `plan_id` directly rather than through `(person_id, plan_name)`. This is what makes family billing work correctly: a plan that lives on a child's record matches an invoice billed to the parent because the join key is the plan ID, not anything about the people involved. The `plan_id` field on `invoice_items` is technically undocumented in Pike13's public API reference but is accepted by the v3 query layer.

**Last Activity and Activity Type columns:**

Added in v1.13. Last Activity shows the most recent date of any visit (by the payer or any of their dependents) or payment (by the payer) within the last 3 years. Activity Type shows whether that most recent activity was a visit, a payment, or both. Rows with no activity in the window show "never" in grey. Use these columns to judge how reachable a customer is before starting follow-up.

Default sort is Owed descending so the biggest collections opportunities surface first. Click any column header to sort by that column; click again to reverse direction; click a third time to return to the default.

## Installation

### Option A: Bookmarklet (recommended)

Create a new bookmark with this URL:

```
javascript:void(fetch('https://raw.githubusercontent.com/mnlynam/pike13-reports/main/pike13-reports.js?t='+Date.now()).then(r=>r.text()).then(eval))
```

The `?t=` cache-buster forces a fresh fetch on every click, so pushing a new version to `main` is live immediately.

### Option B: Console paste

Copy the contents of `pike13-reports.js` and paste into the browser console on any Pike13 desk page.

## Usage

1. Navigate to any page on `musicplace.pike13.com` (must be logged into the desk)
2. Click the bookmarklet (or paste into console)
3. Select a report from the dropdown
4. Adjust date range if needed, click **Apply** (date-based reports only)
5. Click any column header to sort the table; click again to reverse, click a third time to return to the default sort
6. Optionally tick **Include summary** to prepend a category breakdown to the copied output (only shown when the active report defines a summary; currently the Unpaid Invoice Triage report)
7. Click **📋 HTML** to copy the table
8. Paste into email, Google Docs, a Slack Canvas, or any rich-text destination

### Sortable headers

Click any column header to sort the table by that column. The active sort column shows a small ▲ or ▼ arrow next to its label and gets highlighted in blue. First click sorts ascending, second click sorts descending, third click returns to the report's default sort.

Sorting operates on the underlying data values rather than the display strings, so Past Due sorts by day count (not alphabetically by "8y 5mo"), Owed sorts by cents, Last Activity sorts by ISO date, and so on. Sort state persists per report within the session: switching between reports remembers each one's last sort, and clicking Refresh preserves the current sort rather than resetting to the default. Sort state is reset when the bookmarklet is closed.

The copied output (HTML and plain text) matches the current on-screen sort.

### Email workflow

1. Enter a recipient address (defaults are pre-filled per report)
2. Click **Email**. Copies the HTML table and opens Roundcube compose with To/Subject filled
3. Ctrl+V to paste the table into the email body

### Slack Canvas workflow

1. Click **📋 HTML** to copy the table
2. Open Slack and navigate to the channel or DM where you want the canvas
3. Click the **+** button near the message input and choose **Create a canvas** (or open an existing channel canvas)
4. Paste. The HTML renders as a real native Canvas table block with proper columns, borders, and alternating row treatment. The heading and any summary paragraphs above the table render as Canvas heading and paragraph blocks. Client names and invoice numbers render as clickable links that jump straight to the corresponding Pike13 pages

The Slack button (which copied a mrkdwn-formatted monospace code block) was removed in v1.13. It never worked well for the Unpaid Invoice Triage report because Slack's 4,000-character message limit is smaller than the triage table, and Slack Canvas does not render monospace code blocks as tables anyway. The HTML button plus Canvas paste is the one right answer for every destination.

## Requirements

- Must be run from a `*.pike13.com` domain
- Must be logged into the Pike13 desk (admin area)
- Session auth token is extracted automatically from `/desk/reports`

## Features

- Shadow DOM panel (no style conflicts with Pike13)
- Draggable, minimizes to pill
- Per-report date pickers with saved state (date-based reports only)
- Per-report email defaults
- Per-report **Include summary** preamble (prepended to copied output as a short formatted report with intro paragraph, bulleted category breakdown, modifier sub-breakdown when applicable, and urgent-subset callout)
- Per-report sortable column headers with persistent sort state
- Read-only filter tags showing active query criteria
- Color-coded status badges, separate Modifiers column with its own badges, Last Activity and Activity Type columns on the triage report, inline currency formatting
- HTML clipboard copy with clickable invoice and client links, for pasting into email, Google Docs, Slack Canvas, or any rich-text destination
- Domain guard (alerts if run from wrong site)
- Descriptive error messages for auth failures

## Architecture notes

Each report is defined as a config object in the `REPORTS` array. Date-based reports use the default single-query path: the framework POSTs to `/desk/api/v3/reports/{slug}/queries` with the report's `fields`, `filter`, and `sort`, then renders the response rows through the column definitions.

Reports needing multi-phase queries with client-side joins (currently just Unpaid Invoice Triage) provide a `customFetch(token, queryV3)` hook instead of `slug`/`fields`/`getFilter`/`sort`. The hook receives the auth token and the shared `queryV3` helper, runs whatever sequence of API calls it needs, and returns rows in the standard `{ rows, totalCount, hasMore }` shape. The rest of the framework treats them identically.

The Unpaid Invoice Triage `customFetch` runs a five-phase pipeline: it pulls invoice_items with the undocumented `plan_id` field to identify line-item-to-plan links, pulls person_plans for the linked plan_ids only (chunked at 100 plan_ids per query using the or-eq filter shape), fetches dependents for each unique payer in parallel via `/api/v2/desk/people/{id}` at concurrency 5, queries the clients report for `last_visit_date` for payers and dependents, and queries the transactions report filtered by `invoice_payer_id` and `transaction_date > 3 years ago` to track the most recent payment per payer. The classification loop then applies the two-class rule with promotion based on recent activity.

Reports can optionally provide a `buildExplanation()` hook that returns an array of structured content blocks. Each block is either a `paragraph` (with a `text` property) or a `list` (with an optional `intro` string and an `items` array of strings). Two helper functions, `renderExplanationAsHtml` and `renderExplanationAsPlainText`, translate the blocks into format-appropriate output: the HTML builder produces real `<p>` and `<ul><li>` elements so the preamble renders as a properly formatted document when pasted into email or a Slack Canvas, and the plain-text builder uses bullet characters and newlines. The **Include summary** checkbox in the toolbar only appears when the active report defines `buildExplanation`.

Column definitions support `format: 'date' | 'time' | 'currency'`, link callbacks, per-column `render(r)` / `renderPlain(r)` callbacks for custom HTML or plain-text output. The `render` callback is used by the triage report for the colored status badge, the modifier badges, the color-graded fail count, and the Last Activity / Activity Type rendering.

Sortable column headers are handled generically at the framework level. Every column header gets a click handler that cycles through ascending, descending, and default sort. A `compareForSort` helper handles numbers, nulls (always sorted last), strings, arrays (compared by joined string), and ISO date strings. A `getSortedRows` helper is used by the panel renderer and the HTML / plain-text copy builders so that copied output matches what is on screen. Sort state is stored per report in a `savedSort` map with the shape `{ colIdx, dir }` or `null` for "use the report's default sort."

## API findings

A few things about Pike13's Reporting API v3 that are not in the [public Pike13 API docs](https://developer.pike13.com/) and that the triage pipeline depends on:

- The `invoice_items` report accepts `plan_id` as a queryable field, even though it is not in the documented v3 alias list. This is essential for joining line items to their underlying plan records without having to walk family relationships.
- Multi-value filters on `plan_id` (and probably other fields) require the `['or', [['eq', 'plan_id', X], ['eq', 'plan_id', Y], ...]]` shape. The `['in', 'plan_id', [X, Y, ...]]` shape is rejected with a 422.
- The `page.limit` parameter caps at 2000. Going higher returns a 422 with the message `Limit must be greater than or equal 1 and less than or equal to 2000, if provided`.
- Date filters use `gt` and `lt`, not `gte` and `lte`. The latter are rejected with `Unsupported operation: "gte"`.
- The `clients` report's v3 query layer accepts `person_id` as a field name but rejects `id` even though `id` appears in the canonical column list. The v3 API has its own subset of accepted field names that does not always match the underlying schema.

## Version History

| Version | Date | Notes |
|---|---|---|
| 1.13 | 2026-04-08 | Added **Last Activity** and **Activity Type** columns to the Unpaid Invoice Triage report, surfacing data that v1.12 was already fetching but not displaying. Widened the transactions query to track the most recent payment date per payer instead of just a boolean. Added sortable column headers on all three reports with a three-state cycle (ascending, descending, default), per-report persistent sort state, visual indicator (arrow plus highlight), and data-value-based sorting so Past Due sorts by day count rather than alphabetically. The copied output matches the on-screen sort. Removed the **💬 Slack** button and all of its supporting code (`buildSlackTable`, `copyForSlack`, the toolbar button, the character-limit toast). The Slack button never worked well for the triage report because Slack's 4,000-character message limit was smaller than the table and Slack Canvas does not render monospace code blocks as tables; the HTML button plus Canvas paste workflow is the one right answer for every destination. Roughly 100 lines removed. |
| 1.12 | 2026-04-08 | Full rebuild of the Unpaid Invoice Triage classifier, adopting the same classification logic now in [`pike13-invoice-cleanup`](https://github.com/mnlynam/pike13-invoice-cleanup) v1.08. The old 3-phase pipeline (invoices report, then invoice_items, then a business-wide active plan set) was wrong in several ways: it failed on family billing because the active-plan check could not span a parent invoice and a child plan, it broke on pre-billed recurring invoices where the plan start_date was after the invoice issued_date, it had no concept of a customer being recently active versus long gone, and it used a hardcoded page.limit that exceeds Pike13's 2000-row cap. The new 5-phase pipeline pulls invoice_items with the undocumented plan_id field, fetches person_plans for the linked plan_ids only via the or-eq filter shape, fetches each unique payer's dependents via the desk API at concurrency 5, pulls clients.last_visit_date for payers and dependents, and pulls recent transactions filtered by invoice_payer_id and transaction_date. Two-class flattening: every row is now either COLLECT or CLEANUP at the top level. Sub-types live in a new Modifiers column with badges for partial, old bill, refund needed, and non-plan. Promotion rule: any row with recent account activity gets promoted to COLLECT regardless of plan age, including refund-required cases, because if the customer received service and they are still around, collect. Panel width bumped from 960px to 1020px to fit the new Modifiers column. Wall time on first run is 30 to 60 seconds because of the activity-check phases. |
| 1.11 | 2026-04-08 | Three bug fixes plus a formatted-summary rewrite and a full typography pass. Fixed two `fmtDuration` bugs that produced nonsensical output: 209 days used to render as `6mo 4w` (four weeks is a month, should have been `7mo`) and 727 days used to render as `1y 12mo` (twelve months is a year, should have been `2y`). Both are fixed with post-hoc normalization. Changed the duration threshold so day counts under 14 now render as raw days (`7d`, `13d`) instead of being converted to weeks; the week format kicks in at 14 days, which matches how a weekly-billed studio actually talks about past-due age. Fixed the partial-paid recommendation string: the old `Partial paid ($35.00), collect $105.00 remaining` was ambiguous about whether the $105 was on top of the $35 or included it; the new format spells out the relationship as `Partial paid ($35.00 of $140.00): collect $105.00 balance`. Rewrote the **Include summary** preamble from a flowing prose chunk to a short formatted report with an intro sentence, a bulleted category breakdown with one complete actionable sentence per bullet, and an urgent-subset callout paragraph when any invoices have three or more failed autobills. `buildExplanation` now returns an array of structured content blocks instead of a joined string; two new helpers, `renderExplanationAsHtml` and `renderExplanationAsPlainText`, translate the blocks into format-appropriate output. Typography pass: removed every em-dash, en-dash, and multiplication sign from the file. |
| 1.10 | 2026-04-08 | Visual restyle to match the Client Rates Audit tool's palette. The old dark theme (background `#1e1e2e`, text `#e0e0e0`, indigo accents) was hard to read against bright Pike13 pages and inconsistent with CRA's look. Moved to CRA's light treatment: white panel background, near-black body text, gray hierarchy for secondary and muted text, and CRA's blue accent (`#2563eb`) for primary actions, focus rings, and links. Header restructured to match CRA: a 4px blue-to-cyan gradient accent bar across the top, a 34px light-blue logo square containing the clipboard emoji, and a title/subtitle block where the subtitle holds the version and build date in small monospace. Bottom footer removed since the version info lives in the header now. Status badges got the biggest contrast improvement: pill-shaped with thicker colored borders, mapped to a traffic-light palette. No behavior changes; pure visual refresh. |
| 1.9 | 2026-04-08 | Client names and invoice numbers now render as clickable links in the HTML clipboard output. Previously the panel view showed these as links but `buildHtmlTable` used `fmtCellPlain`, which stripped all HTML and produced plain-text cells in the copied output. A new `fmtCellClipboardHtml` helper preserves the link callbacks in the clipboard path while intentionally skipping the panel-internal `render` callbacks. Practical effect for the Unpaid Invoice Triage workflow: pasting the table into a Slack Canvas gives Lisa a real table where clicking an invoice number jumps to the Pike13 invoice page and clicking a client name jumps to their profile, one less manual step per row during triage. |
| 1.8 | 2026-04-08 | Removed the **📝 Canvas** copy button. Empirical testing showed Slack Canvas does not parse GFM markdown table syntax on paste. However, Canvas does accept the `text/html` clipboard payload that the HTML button already produces and renders it as a real native Canvas table block. Also added human-readable duration formatting for the Unpaid Invoice Triage "Past Due" column: raw day counts like `3080d` now render as `8y 5mo`. |
| 1.7 | 2026-04-08 | Fixed the Slack message length warning to fire at the correct threshold. v1.6 warned only when output exceeded 12,000 characters, but Slack's actual per-message limit is 4,000, so the warning never fired in the danger zone. Removed along with the rest of the Slack button in v1.13. |
| 1.6 | 2026-04-08 | Rewrote the **Include summary** preamble as flowing prose paragraphs instead of a pseudo-table with monospace column padding. The earlier layout depended on the rendering surface using a fixed-width font and respecting literal whitespace, which broke outside code blocks. |
| 1.5 | 2026-04-08 | Added **📝 Canvas** copy button producing GitHub-flavored Markdown, on the (later disproven, see v1.8) assumption that Slack Canvas would render GFM table syntax as a native table. Removed in v1.8. |
| 1.4 | 2026-04-08 | Renamed "📋 Copy Table" to "📋 HTML" with an explicit format label and tooltip. Added an **Include summary** checkbox that prepends a category breakdown to the copied output when the active report defines a `buildExplanation()` hook. |
| 1.3 | 2026-04-08 | Added **💬 Slack** copy button producing Slack mrkdwn with a monospace code block. Removed in v1.13. |
| 1.2 | 2026-04-08 | Added **Unpaid Invoice Triage** as third report. Framework extended with `customFetch` hook for multi-phase queries; `queryV3()` extracted as a shared helper; column system gained `render` callbacks and `currency` format. |
| 1.1 | 2026-04-02 | Dark-themed date pickers, dimmed zero values, label contrast improvements. |
| 1.0 | 2026-04-02 | Initial release. Declined Payments + Post-assessment reports. |

## Known limitations and parked work

- The activity check does not catch the case where a customer's payments come from a credit card that has been expired for years and they have not actually paid anything in that window. A customer who is "active" only because of failed autobill attempts may still be a real write-off candidate. This has not come up in practice yet.
- The Reporting API runs on a delayed feed behind Pike13's operational database. Invoices that are cancelled via the [`pike13-invoice-cleanup`](https://github.com/mnlynam/pike13-invoice-cleanup) tool may continue to appear in the Unpaid Invoice Triage report for 15 to 30 minutes after the cancel. The triage report is not a real-time view; it is a batched analytics view.
- The activity-check phase adds 20 to 50 seconds to the wall time of the Unpaid Invoice Triage report, depending on the number of unique payers in the candidate set. For a list of 30 to 50 payers this is fine. For a list of 200+ payers the activity check would become the slow step, but we have not hit that scale yet.
- The per-report sort state resets when the bookmarklet is closed. There is no persistence across sessions. This is intentional; the defaults are chosen to be the most useful starting point for each report.
