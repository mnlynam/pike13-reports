# Pike13 Reports

Browser bookmarklet for running and sharing Pike13 admin reports. Queries the Reporting API v3 directly, displays results in a draggable dark-theme panel, and copies formatted tables for pasting into Slack or email.

## Reports

| Report | API Slug | Default Dates | Default Recipient |
|---|---|---|---|
| **Declined Payments** | `invoices` | Last 6 months | lcaploe@musicplace.com |
| **Post-assessment** | `event_occurrences` | Last 4 weeks | jmorris@musicplace.com |

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
4. Adjust date range if needed, click **Apply**
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
- Per-report date pickers with saved state
- Per-report email defaults
- Read-only filter tags showing active query criteria
- Domain guard (alerts if run from wrong site)
- Descriptive error messages for auth failures

## Version History

| Version | Date | Notes |
|---|---|---|
| 1.1 | 2026-04-02 | Dark-themed date pickers, dimmed zero values, label contrast improvements. |
| 1.0 | 2026-04-02 | Initial release. Declined Payments + Post-assessment reports. |
