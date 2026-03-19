# TalentHub Invoice Tool — Project Handoff Document

**Last Updated:** March 19, 2026
**Developer:** Doug Goldstein (917-841-7717)
**Client Company:** TalentHub Workforce Inc.
**Primary Client Contact:** Kalyn Rosado (Kalyn@talenthubworkforce.com)
**Client Supervisor:** Diane Porembski (diane@talenthubworkforce.com)
**Live Tool:** https://talenthub-tool.vercel.app
**GitHub Repo:** https://github.com/DougieG/talenthub-tool

---

## 1. What This Project Is (Plain English)

TalentHub is a staffing agency. Every week, their payroll system spits out big multi-page scanned PDFs containing timesheets for many employees. Kalyn Rosado currently spends hours every week manually splitting these apart, correcting data, and reassembling them into clean per-job-code invoices using Adobe Acrobat.

**Our tool automates that.** The user uploads a batch PDF → AI extracts all the employee/invoice data → the user reviews and corrects anything wrong → the tool generates clean consolidated invoices grouped by job code → downloads as a ZIP file.

The critical requirement: **the tool's PDF output must look exactly like what Kalyn produces by hand.** She has been doing this manually for a long time and the client (Fund for Public Health) expects that specific format. We have gold-standard reference PDFs from Kalyn in the project files.

---

## 2. Current Status

### ✅ What's Done
- Full working tool deployed at https://talenthub-tool.vercel.app
- AI-powered data extraction from scanned batch PDFs
- Editable review screen with all fields (names, rates, hours, codes, client info)
- PDF generation that consolidates employees by job code
- All 12 bugs from Kalyn's March 6 feedback have been addressed in code
- **PR #1** is open and ready for merge: https://github.com/DougieG/talenthub-tool/pull/1

### ⚠️ What Still Needs to Happen
1. **Merge PR #1** to the `main` branch (this deploys automatically via Vercel)
2. **Kalyn tests the updated tool** with her real weekly batch PDFs
3. **Visual QA** — compare Kalyn's output against reference files to confirm pixel-level accuracy
4. **Iterate on any remaining visual differences** Kalyn identifies

### 🔴 Known Risk
After the first round of 12 bug fixes, initial visual comparison suggests the output is very close but may not yet be a perfect pixel-level match to Kalyn's originals. Kalyn's testing will confirm. Expect potentially 1–2 more rounds of minor visual tweaks.

---

## 3. Project Timeline / Journey

| Date | What Happened |
|------|--------------|
| **Feb 17** | Diane introduced Doug to Kalyn to analyze the invoice process |
| **Feb 20** | First demo sent. Kalyn: "This is not what we need" — needed per-code grouping |
| **Feb 20** | Second demo. Kalyn: "Almost there!" Sent batch files + corrected invoices |
| **Feb 23** | Doug identified 7 missing employees, asked detailed format questions |
| **Feb 24** | Tool deployed live at talenthub-tool.vercel.app, sent for testing |
| **Feb 25** | Kalyn tested. Errors on first try. Clarified: batches go in, not corrected PDFs |
| **Feb 25** | Doug added AI extraction + review screen with yellow low-confidence highlights |
| **Feb 27** | Kalyn tested again. Attached her version vs tool output. Listed 12 corrections |
| **Mar 2** | Doug: "I believe I've hit all your action items. Please test." |
| **Mar 6** | **Kalyn's latest feedback** — 12 bugs still outstanding. This is the current bug list. |
| **Mar 18** | All 12 bugs addressed in code. PR #1 created. |
| **Mar 19** | Handoff document created. Ready for merge + test cycle. |

---

## 4. The 12 Bugs (Mar 6 Feedback) — All Addressed in PR #1

| # | Bug (Kalyn's Words) | What It Means | Fix Applied |
|---|---------------------|---------------|-------------|
| 1 | Job code not appearing on invoices | The code (e.g., N1101230) should show in the client address block on every page | Code now appears on its own line, replaces "SUITE 802" |
| 2 | Client box not editable | User needs to edit the client address, and changes must show on every page | Client panel added — edits propagate to all pages |
| 3 | Font size inconsistent | Employee info was a different size than the rest of the document | Standardized: 10pt client, 9pt employee, 7.5pt reference |
| 4 | Account # still showing on timesheets | An "Account #" box from the original scans was leaking through | Timesheets now rendered from scratch — Account # gone |
| 5 | Invoice/date/total boxes appear black | The info boxes rendered with a solid black background | Fixed color code bug (was using `rgb(0,0,0,0)` = solid black) |
| 6 | Edit field keyboard bug | Typing one letter in an edit field would jump the page to the top | Changed update function to modify in-place instead of re-rendering |
| 7 | Timesheet edits not reflected in output | User edits timesheet data but output still shows original values | Output now renders from the data model, not original scans |
| 8 | Missing employees in extraction | Some employees weren't being detected by the AI | Improved AI prompt for page classification |
| 9 | Full code not appearing | Code like B1110014-59200 was getting truncated | AI prompt now extracts full codes including hyphen suffixes |
| 10 | Timesheets not being combined | Original scanned pages were just appended instead of merged | Timesheets now combined: 2 employee grids per page |
| 11 | Incorrect total placement | Total appeared on a duplicate face page instead of the final page | TOTAL DUE amount now only on final page |
| 12 | Code cross-contamination | Employees from one code were appearing in another code's output | AI prompt clarified to extract only primary employee per page |

---

## 5. How the Tool Works (For Non-Technical People)

### The User Flow
1. **Upload** — Kalyn drops one or more batch PDFs onto the upload page
2. **Set Week Ending Date** — Picks the week ending date for the invoices
3. **AI Extraction** — The tool reads the scanned pages and pulls out all employee data (names, rates, hours, job codes, etc.)
4. **Review & Edit** — Everything appears in an editable form. Yellow-highlighted fields = the AI was less confident about those values. Kalyn can correct anything.
5. **Consolidate** — Click the button and the tool groups employees by job code and generates one PDF per code
6. **Download** — A ZIP file with all the per-code PDFs

### What Each Output PDF Contains
- **Page 1 (Face Page):** TalentHub header, client info, job code, and a table of all employees on that code with their rates/hours
- **Pages 2–N (Timesheets):** Combined timesheet grids (2 employees per page, merged together — not the original scanned pages)
- **Last Page:** Grand total for the entire invoice

---

## 6. Key Files & Folders

| Location | What It Is |
|----------|-----------|
| `3-reference-kalyn-originals/` | **THE GOLD STANDARD.** Kalyn's manually-produced invoices. Our tool must replicate these exactly. |
| `4-reference-tool-outputs/` | What our tool previously produced (before bug fixes). Compare against folder 3 to see the problems. |
| `1-inputs-batches/` | Raw batch PDFs from payroll — these are what Kalyn uploads into the tool |
| `2-inputs-corrected-individuals/` | Kalyn's per-employee corrected invoices — reference for data accuracy |
| `SPEC.docx` | Full project specification with bug list, email history, and acceptance criteria |
| `index.html` | The entire front-end application (single HTML file with embedded JS/CSS) |
| `api/extract.js` | Server-side AI extraction endpoint (runs on Vercel) |

---

## 7. How to Process Client Feedback

When Kalyn sends feedback, here's how to turn it into actionable items for Doug:

### Step 1: Categorize the Issue
- **Visual mismatch** → "The [element] on page [X] doesn't look like it does in the gold standard file [filename]." Include a screenshot if possible.
- **Data extraction issue** → "Employee [name] is missing / has wrong [field]." Include which batch PDF was uploaded.
- **Edit screen issue** → "When I try to [action], [problem] happens."
- **Logic issue** → "Employees are showing up under the wrong code" or "Total is wrong."

### Step 2: Get the Right Details
For every issue, try to capture:
1. Which batch PDF was uploaded (the filename)
2. Which job code / employee is affected
3. Screenshot of the problem
4. Screenshot of what it should look like (from folder 3 gold standards)

### Step 3: Write It Up for Doug
Format:
```
BUG: [Short title]
BATCH FILE: [filename that was uploaded]
JOB CODE: [if applicable]
WHAT HAPPENS: [description]
WHAT SHOULD HAPPEN: [description]
SCREENSHOT: [attached]
REFERENCE: [which gold standard file to compare against]
```

---

## 8. Path Forward — What Happens Next

### Immediate (This Week)
1. **Doug merges PR #1** — this automatically deploys the 12 bug fixes to https://talenthub-tool.vercel.app
2. **Kalyn tests** — she uploads a real weekly batch and compares output against her manual version
3. **Collect feedback** — any visual differences, missing data, or UX issues

### Short Term (Next 1–2 Weeks)
4. **Visual polish round** — address any remaining differences between tool output and gold standard
5. **Edge case testing** — test with different batch sizes, unusual codes (with hyphens like B1110014-59200), employees with missing data
6. **Sign-off** — Kalyn confirms: "This matches what I produce manually"

### Acceptance Criteria (Definition of Done)
The tool is complete when:
- ✅ Output is visually indistinguishable from Kalyn's manual versions
- ✅ All 12 March 6 bugs are resolved
- ✅ Every editable field works without keyboard/scroll bugs
- ✅ Timesheets are properly combined (not appended)
- ✅ Single total on final page only
- ✅ Job codes correctly separated, no cross-contamination
- ✅ All employees in a batch are extracted
- ✅ Client box, invoice #, and headers propagate to every page when edited

---

## 9. Key Client Communication Notes

- **Kalyn is detail-oriented.** She has been doing this manually for a long time and knows exactly what the output should look like. Trust her visual feedback.
- **"Pixel-level replica"** is the standard. Close enough isn't enough — the output must match her originals.
- **She uses Adobe Acrobat on Windows** to view the PDFs. If something looks off, it may be a rendering difference between browsers and Acrobat.
- **The client name is NOT bold.** This was called out specifically.
- **The job code goes in the address block**, on its own line above "New York, NY 10007", replacing where "SUITE 802" used to be.
- **Kalyn's terminology:** "Pay rate" = amount under the employee's name. "Bill rate" = amount under the rate column on the right side.
- **Response cadence:** Kalyn typically responds within a day. Doug has generally turned around fixes within 1–2 days.
- **Diane (supervisor) is CC'd** on emails but Kalyn is the primary point of contact.

---

## 10. Quick Reference — Who to Contact

| Question | Who |
|----------|-----|
| Technical implementation, bug fixes, deployment | **Doug Goldstein** |
| Testing, visual feedback, format requirements | **Kalyn Rosado** (Kalyn@talenthubworkforce.com) |
| Project oversight / escalation | **Diane Porembski** (diane@talenthubworkforce.com) |

---

*This document is current as of March 19, 2026. The most up-to-date technical spec is in `SPEC.docx` in the project repository.*
