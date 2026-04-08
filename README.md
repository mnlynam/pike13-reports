# Pike13 Reports

Browser bookmarklet for running and sharing Pike13 admin reports. Queries the Reporting API v3 directly, displays results in a draggable dark-theme panel, and copies formatted tables for pasting into email, Slack messages, or Slack Canvases.

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
5. Optionally tick **Include summary** to prepend a category breakdown to the copied output (only shown when the active report defines a summary; currently the Unpaid Invoice Triage report)
6. Click one of the two copy buttons (see below) to copy the data in the format you need
7. Paste into the destination

### Choosing a copy format

| Button | Format | Best for | Notes |
|---|---|---|---|
| **📋 HTML** | HTML `<table>` with `text/html` + `text/plain` clipboard payloads | Email (Roundcube), Google Docs, Outlook, **Slack Canvas**, or any rich-text destination | Renders as a proper native table in every rich-text surface tested, including Slack Canvas. Client names and invoice numbers render as clickable links to the corresponding Pike13 pages. Use this for Unpaid Invoice Triage — the full triage table renders as a real Canvas table block with proper columns, borders, and cell selection, and Lisa can click any row's invoice number or client name to jump straight to Pike13 without leaving Slack. |
| **💬 Slack** | Slack mrkdwn with monospace code block | Short tables pasted inline in a Slack message or DM | Slack messages have a 4,000-character limit and code blocks wrap at narrow widths, so this format only works for small tables (typically Declined Payments or Post-assessment results with few rows). For the Unpaid Invoice Triage table or any wide/long data, use HTML and paste into a Slack Canvas instead. |

### Email workflow

1. Enter a recipient address (defaults are pre-filled per report)
2. Click **Email** — copies the HTML table and opens Roundcube compose with To/Subject filled
3. Ctrl+V to paste the table into the email body

### Slack Canvas workflow

1. Click **📋 HTML** to copy the table
2. Open Slack and navigate to the channel or DM where you want the canvas
3. Click the **+** button near the message input and choose **Create a canvas** (or open an existing channel canvas)
4. Paste — the HTML renders as a real native Canvas table block with proper columns, borders, and alternating row treatment. The heading and any summary paragraphs above the table render as Canvas heading and paragraph blocks

## Requirements

- Must be run from a `*.pike13.com` domain
- Must be logged into the Pike13 desk (admin area)
- Session auth token is extracted automatically from `/desk/reports`

## Features

- Shadow DOM panel (no style conflicts with Pike13)
- Draggable, minimizes to pill
- Per-report date pickers with saved state (date-based reports only)
- Per-report email defaults
- Per-report **Include summary** preamble (prepended to copied output as a short formatted report with intro paragraph, bulleted category breakdown, and urgent-subset callout)
- Read-only filter tags showing active query criteria
- Color-coded status badges and inline currency formatting
- Two copy formats: HTML for email / Google Docs / Slack Canvases / any rich-text destination, and Slack mrkdwn for short inline Slack messages
- Domain guard (alerts if run from wrong site)
- Descriptive error messages for auth failures

## Architecture notes

Each report is defined as a config object in the `REPORTS` array. Date-based reports use the default single-query path: the framework POSTs to `/desk/api/v3/reports/{slug}/queries` with the report's `fields`, `filter`, and `sort`, then renders the response rows through the column definitions.

Reports needing multi-phase queries with client-side joins (currently just Unpaid Invoice Triage) provide a `customFetch(token, queryV3)` hook instead of `slug`/`fields`/`getFilter`/`sort`. The hook receives the auth token and the shared `queryV3` helper, runs whatever sequence of API calls it needs, and returns rows in the standard `{ rows, totalCount, hasMore }` shape — the rest of the framework treats them identically.

Reports can optionally provide a `buildExplanation()` hook that returns an array of structured content blocks — each block is either a `paragraph` (with a `text` property) or a `list` (with an optional `intro` string and an `items` array of strings). Two helper functions, `renderExplanationAsHtml` and `renderExplanationAsPlainText`, translate the blocks into format-appropriate output: the HTML builder produces real `<p>` and `<ul><li>` elements so the preamble renders as a properly formatted document when pasted into email or a Slack Canvas, and the Slack mrkdwn and plain-text builders use bullet characters and newlines. The Slack mrkdwn output places the preamble in the message body above the code block (not inside it, since paragraphs inside a monospace code block wrap badly). The **Include summary** checkbox in the toolbar only appears when the active report defines `buildExplanation`.

Column definitions support `format: 'date' | 'time' | 'currency'`, link callbacks, per-column `render(r)` / `renderPlain(r)` callbacks for custom HTML or plain-text output, and an optional `slackMax: N` for length-truncating long cells in the Slack mrkdwn format only. The `render` callback is used by the triage report for the colored status badge and the color-graded fail count.

## Version History

| Version | Date | Notes |
|---|---|---|
| 1.11 | 2026-04-08 | Three bug fixes plus a formatted-summary rewrite and a full typography pass. Fixed two `fmtDuration` bugs that produced nonsensical output: 209 days used to render as `6mo 4w` (four weeks is a month, should have been `7mo`) and 727 days used to render as `1y 12mo` (twelve months is a year, should have been `2y`). Both are fixed with post-hoc normalization. Changed the duration threshold so day counts under 14 now render as raw days (`7d`, `13d`) instead of being converted to weeks; the week format kicks in at 14 days, which matches how a weekly-billed studio actually talks about past-due age. Fixed the partial-paid recommendation string: the old `Partial paid ($35.00) — collect $105.00 remaining` was ambiguous about whether the $105 was on top of the $35 or included it; the new format spells out the relationship as `Partial paid ($35.00 of $140.00): collect $105.00 balance`. Rewrote the **Include summary** preamble from a flowing prose chunk to a short formatted report with an intro sentence, a bulleted category breakdown with one complete actionable sentence per bullet, and an urgent-subset callout paragraph when any invoices have three or more failed autobills. `buildExplanation` now returns an array of structured content blocks instead of a joined string; two new helpers, `renderExplanationAsHtml` and `renderExplanationAsPlainText`, translate the blocks into format-appropriate output. Typography pass: removed every em-dash, en-dash, and multiplication sign from the file. Replacements were context-appropriate — colons where a status tag preceded an action (`Manual bill: send payment reminder`, `Stale orphan (8y 5mo): safe to cancel`), periods where the two halves were independent thoughts, the word "for" where a date range followed a title (`Unpaid Invoice Triage for Apr 8, 2026`), and `3 times` where the old code had `3×`. |
| 1.10 | 2026-04-08 | Visual restyle to match the Client Rates Audit tool's palette. The old dark theme (background `#1e1e2e`, text `#e0e0e0`, indigo accents) was hard to read against bright Pike13 pages and inconsistent with CRA's look. Moved to CRA's light treatment: white panel background, near-black body text, gray hierarchy for secondary and muted text, and CRA's blue accent (`#2563eb`) for primary actions, focus rings, and links. Header restructured to match CRA: a 4px blue-to-cyan gradient accent bar across the top, a 34px light-blue logo square containing the clipboard emoji, and a title/subtitle block where the subtitle holds the version and build date in small monospace. Bottom footer removed since the version info lives in the header now. Status badges got the biggest contrast improvement: pill-shaped with thicker colored borders, mapped to a traffic-light palette — COLLECT green, COLLECT (partial) amber, CLEANUP blue, CLEANUP (refund) red — so the category of a row is readable at a glance. No behavior changes; pure visual refresh. The invoice-link change from v1.9 and the duration formatting from v1.8 are both still in place. |
| 1.9 | 2026-04-08 | Client names and invoice numbers now render as clickable links in the HTML clipboard output. Previously the panel view showed these as links (via `fmtCell`) but `buildHtmlTable` used `fmtCellPlain`, which stripped all HTML and produced plain-text cells in the copied output. A new `fmtCellClipboardHtml` helper preserves the link callbacks in the clipboard path while intentionally skipping the panel-internal `render` callbacks (which produce classed spans that wouldn't carry over anyway). Practical effect for the Unpaid Invoice Triage workflow: pasting the table into a Slack Canvas gives Lisa a real table where clicking an invoice number jumps to the Pike13 invoice page and clicking a client name jumps to their profile — one less manual step per row during triage. |
| 1.8 | 2026-04-08 | Removed the **📝 Canvas** copy button. Empirical testing showed Slack Canvas does not parse GFM markdown table syntax (`\| col \| col \|`) on paste — it renders the pipes and dashes literally. However, Canvas *does* accept the `text/html` clipboard payload that the HTML button already produces and renders it as a real native Canvas table block. So the Canvas button was solving a non-problem with the wrong tool; the HTML button was the right answer all along. Also added human-readable duration formatting for the Unpaid Invoice Triage "Past Due" column (was "Days"): raw day counts like `3080d` now render as `8y 5mo`, `1407d` as `3y 10mo`, `158d` as `5mo 1w`, etc. The recommendation strings ("Stale orphan (...d) — safe to cancel") use the same formatter. |
| 1.7 | 2026-04-08 | Fixed the Slack message length warning to fire at the correct threshold. v1.6 warned only when output exceeded 12,000 characters, but Slack's actual per-message limit is 4,000, so the warning never fired in the danger zone. The over-limit toast now names a specific remedy (use HTML + paste into Canvas) rather than the previous vague "may exceed" wording. |
| 1.6 | 2026-04-08 | Rewrote the **Include summary** preamble as flowing prose paragraphs instead of a pseudo-table with monospace column padding. The earlier layout depended on the rendering surface using a fixed-width font and respecting literal whitespace, which broke outside code blocks. Each builder now places the paragraphs as native paragraphs of its target format. The Slack mrkdwn output places the explanation in the message body above the code block instead of injecting it inside, so it wraps to message bubble width naturally. |
| 1.5 | 2026-04-08 | Added **📝 Canvas** copy button producing GitHub-flavored Markdown, on the (later disproven — see v1.8) assumption that Slack Canvas would render GFM table syntax as a native table. Removed in v1.8. |
| 1.4 | 2026-04-08 | Renamed "📋 Copy Table" to "📋 HTML" with an explicit format label and tooltip. Added an **Include summary** checkbox (between the copy buttons and Refresh) that prepends a category breakdown to the copied output when the active report defines a `buildExplanation()` hook. Currently wired up for Unpaid Invoice Triage. State persists per report. |
| 1.3 | 2026-04-08 | Added **💬 Slack** copy button producing Slack mrkdwn with a monospace code block. Useful for short tables; wide tables need HTML + a Slack Canvas paste instead (see v1.8). |
| 1.2 | 2026-04-08 | Added **Unpaid Invoice Triage** as third report. Framework extended with `customFetch` hook for multi-phase queries; `queryV3()` extracted as a shared helper; column system gained `render` callbacks and `currency` format. |
| 1.1 | 2026-04-02 | Dark-themed date pickers, dimmed zero values, label contrast improvements. |
| 1.0 | 2026-04-02 | Initial release. Declined Payments + Post-assessment reports. |
