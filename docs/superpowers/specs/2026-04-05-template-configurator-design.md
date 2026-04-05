# TalentHub PDF Template Configurator — Design Spec

## Problem

The TalentHub Invoice Tool generates consolidated PDF invoices using ~120 hardcoded layout constants in pdf-lib (positions, sizes, colors, corner radii, fonts). The client (Kalyn) repeatedly requests pixel-level adjustments. Each change requires a developer to modify code, deploy, and wait for feedback — a cycle that has run for weeks. The root cause: we're recreating the invoice layout from scratch when a blank template already exists.

## Solution

Two changes:

1. **Template-overlay rendering** — Replace all pdf-lib drawing code with a blank PDF template. Overlay only the dynamic text data at configured positions. Eliminates all visual design bugs permanently.

2. **Visual configurator tool** — A standalone HTML app where you load the blank template, click/drag to position each text field, and export a `layout.json`. The main tool reads this config at consolidation time.

## Architecture

```
blank-template.pdf ──┐
                      ├──> configurator.html ──> layout.json
layout.json ──────────┘          │
                                 │
layout.json + invoices[] ──> index.html (consolidation) ──> output PDFs
```

Three independent artifacts:
- `blank-template.pdf` — the source of truth for visual design (never modified by code). Served as a static file at `/blank-template.pdf`.
- `configurator.html` — standalone tool for positioning text fields (used by devs only)
- `layout.json` — the bridge between configurator and consolidation engine

## Part 1: Template-Overlay Rendering

### What changes in `index.html`

**Delete** these functions entirely:
- `drawHeader()`, `drawInfoBoxes()`, `drawClientBlock()`, `drawTableHeader()`
- `drawTotalDueBox()`, `drawFooter()`
- `drawRoundedRect()`, `drawTopRoundedRect()`, `drawBottomRoundedRect()`, `drawRoundedBorder()`

**Delete** these constants:
- `CHARCOAL`, `GREEN`, `MINT`, `GBORDER`, `GRIDLINE` (colors for drawn elements)
- `LOGO_B64`, `BG_B64` (template replaces both)
- `W`, `H` hardcoded page dimensions (read from template)

**Rewrite**:
- `drawEmployeeRows()` — use positions from layout config
- `drawTimesheetBlock()` — use positions from layout config
- `doConsolidate()` — new PDF generation loop using template overlay

**Add**:
- `const LAYOUT = { ... }` — embedded layout config (exported from configurator)
- Template loading via `fetch('/blank-template.pdf')`

### Template details

- **Source**: `blank-template.pdf` (612x792 pts, standard US Letter)
- **Storage**: Served as a separate static file alongside `index.html` (not base64-embedded — keeps `index.html` lean and allows template updates without code changes)
- **Loading**: Fetched at consolidation time via `fetch('/blank-template.pdf')`, loaded as `PDFDocument`
- **Pages**: Single template page used for both face pages and timesheet pages

### Coordinate system

pdf-lib uses **bottom-left origin** (Y=0 is page bottom, Y increases upward). The template is 612x792 pts. All Y values in `layout.json` use this coordinate system. The configurator must convert from canvas coordinates (top-left origin) when exporting: `pdfY = 792 - canvasY`.

### New PDF generation flow

```js
async function buildConsolidatedPDF(emps, layout, clientInfo) {
  const pdfDoc = await PDFLib.PDFDocument.create();

  // Load the blank template
  const templateBytes = await fetch('/blank-template.pdf').then(r => r.arrayBuffer());
  const templateDoc = await PDFLib.PDFDocument.load(templateBytes);
  const [templatePage] = await pdfDoc.embedPages(templateDoc.getPages());

  // Page dimensions from template
  const W = 612, H = 792;

  // Fonts
  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

  function addTemplatePage() {
    const page = pdfDoc.addPage([W, H]);
    page.drawPage(templatePage);
    return page;
  }

  // Helper: draw text with layout config
  function drawField(page, fieldConfig, text, overrides = {}) {
    const f = { ...fieldConfig, ...overrides };
    const usedFont = f.font === 'HelveticaBold' ? fontBold : font;
    const color = hexToRgb(f.color || '#504A4A');
    const opts = { x: f.x, y: f.y, size: f.fontSize, font: usedFont, color };

    if (f.align === 'center') {
      const w = usedFont.widthOfTextAtSize(text, f.fontSize);
      opts.x = f.x - w / 2;
    } else if (f.align === 'right') {
      const w = usedFont.widthOfTextAtSize(text, f.fontSize);
      opts.x = f.x - w;
    }

    page.drawText(text, opts);
  }

  // ... build pages using addTemplatePage() + drawField()
}
```

### Template vs. overlay: what's baked in, what's drawn

| Element | In template | Overlaid as text |
|---------|:-----------:|:----------------:|
| Globe logo, TALENTHUB text, Workforce Inc. | Yes | — |
| Address (295 Madison Ave, phone/fax) | Yes | — |
| ACCOUNT NO. / INVOICE NO. box frames | Yes | Values only |
| INVOICE DATE / P.O. NUMBER box frames | Yes | Values only |
| Table header bar (EMPLOYEE NAME, etc.) | Yes | — |
| Column divider lines | Yes | — |
| Disclaimer text (payment terms) | Yes | — |
| "Please remit to" address | Yes | — |
| TOTAL DUE box frame + label | Yes | Amount only |
| Client info (name, address, job code) | — | Yes |
| Employee rows (names, hours, rates) | — | Yes |
| WeekWorked line | — | Yes |
| Reference lines (job title, pay rate) | — | Yes |
| Page number ("Page N of M") | — | Yes |
| Timesheet grids (lines + data) | — | Yes |
| "Employee Timesheet Adjustment" title | — | Yes |

### Face page pagination

If a job code has more employees than fit on one page, the rendering must paginate. The max employees per face page is calculated from the layout:

```
maxRows = floor((layout.grid.row_start_y - layout.total_due_value.y - 50) / layout.grid.row_height)
```

When employees exceed `maxRows`, continuation face pages are generated using the same template. The TOTAL DUE amount appears only on the final page. Page numbers reflect the total count.

## Part 2: Visual Configurator

### Overview

A standalone `configurator.html` file. Single-page app, no build step. Uses pdf.js 3.11.174 (same version as main tool) to render the blank template as a canvas background. User clicks on the canvas to place text fields, drags them to adjust, and sees a live preview with sample data.

### UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  TalentHub Template Configurator              [Export]  │
├────────────────────────────┬────────────────────────────┤
│                            │  FIELDS                    │
│                            │  ┌──────────────────────┐  │
│    Canvas: blank template  │  │ ● invoice_no_value   │  │
│    with draggable text     │  │ ○ account_no_value   │  │
│    field overlays          │  │ ○ invoice_date_value  │  │
│                            │  │ ○ client_name         │  │
│                            │  │ ○ ...                 │  │
│                            │  └──────────────────────┘  │
│                            │                            │
│                            │  SELECTED FIELD            │
│                            │  X: [490.0] Y: [736.0]    │
│                            │  Font size: [9]            │
│                            │  Align: [left|center|right]│
│                            │  Color: [#504A4A]          │
│                            │                            │
│                            │  PREVIEW DATA              │
│                            │  Value: [1065592]          │
│                            │                            │
│                            │  ────────────────────────  │
│                            │  [Load layout.json]        │
│                            │  [Export layout.json]       │
│                            │  [Undo] [Redo]             │
└────────────────────────────┴────────────────────────────┘
```

### Interaction model

1. **Canvas** renders the blank template at 1:1 PDF scale (scrollable, zoomable)
2. **Field list** on the right shows all text fields with radio-style selection
3. **Click on canvas** = place the selected field at that position (auto-converts canvas Y to PDF Y)
4. **Drag on canvas** = reposition a placed field
5. **Snap-to-grid** at 1pt increments; alignment guides shown when field aligns with another field's X or Y
6. **Sample data** fills each field with realistic placeholder text (e.g., "CASTILLO, ANGELA", "1065592")
7. **Properties panel** shows x, y, font size, alignment, color — editable via inputs with live update
8. **Undo/Redo** — state stack, Ctrl+Z / Ctrl+Shift+Z
9. **Export** downloads `layout.json` file
10. **Load** imports an existing `layout.json` to resume editing

### Reference overlay (for comparison)

- **Upload reference PDF** button — loads one of Kalyn's gold-standard PDFs
- Renders as a semi-transparent overlay on top of the template + text positions
- **Opacity slider** to blend between your version and the reference
- **Toggle** button to flip between yours / reference / overlay

### Deploy workflow

The configurator exports `layout.json` as a download. The developer then:
1. Copies the layout values into the `const LAYOUT = { ... }` block in `index.html`
2. Commits and pushes to deploy

This is simple, explicit, and requires no browser filesystem APIs.

## Part 3: layout.json schema

```json
{
  "version": 1,
  "template": "blank-template.pdf",
  "page": { "width": 612, "height": 792 },

  "info_boxes": {
    "invoice_no":   { "x": 555, "y": 735, "fontSize": 9, "align": "center", "color": "#504A4A", "font": "Helvetica" },
    "account_no":   { "x": 475, "y": 735, "fontSize": 9, "align": "center", "color": "#504A4A", "font": "Helvetica" },
    "invoice_date": { "x": 555, "y": 695, "fontSize": 9, "align": "center", "color": "#504A4A", "font": "Helvetica" },
    "po_number":    { "x": 510, "y": 655, "fontSize": 9, "align": "center", "color": "#504A4A", "font": "Helvetica" }
  },

  "client": {
    "name":    { "x": 63, "y": 664, "fontSize": 10, "align": "left", "color": "#504A4A", "font": "Helvetica" },
    "attn":    { "x": 63, "y": 652, "fontSize": 10, "align": "left", "color": "#504A4A", "font": "Helvetica" },
    "addr1":   { "x": 63, "y": 640, "fontSize": 10, "align": "left", "color": "#504A4A", "font": "Helvetica" },
    "jobcode": { "x": 63, "y": 628, "fontSize": 10, "align": "left", "color": "#504A4A", "font": "Helvetica" },
    "city":    { "x": 63, "y": 616, "fontSize": 10, "align": "left", "color": "#504A4A", "font": "Helvetica" }
  },

  "grid": {
    "row_start_y": 516,
    "row_height": 37,
    "reference_line_offset": 15,
    "week_worked": { "x": 36, "y": 530, "fontSize": 9, "font": "HelveticaBold", "color": "#504A4A" },
    "columns": {
      "employee_name": { "x": 36, "align": "left" },
      "week_ending":   { "x": 195, "align": "left" },
      "assignment":    { "x": 300, "align": "left" },
      "reg_label":     { "x": 385, "align": "left" },
      "hours":         { "x": 458, "align": "right" },
      "rate":          { "x": 510, "align": "right" },
      "total":         { "x": 572, "align": "right" }
    },
    "fontSize": 9,
    "color": "#504A4A",
    "font": "Helvetica",
    "reference": {
      "fontSize": 7.5,
      "color": "#999999",
      "font": "Helvetica"
    }
  },

  "footer": {
    "total_due_value": { "x": 540, "y": 88, "fontSize": 11, "align": "center", "color": "#504A4A", "font": "HelveticaBold" },
    "page_number":     { "x": 26, "y": 34, "fontSize": 7, "align": "left", "color": "#999999", "font": "Helvetica" }
  },

  "timesheet": {
    "title": { "x": 36, "y": 530, "fontSize": 10, "font": "HelveticaBold", "color": "#504A4A" },
    "employee_header": { "x": 36, "fontSize": 9, "font": "HelveticaBold", "color": "#504A4A" },
    "client_header":   { "x": 300, "fontSize": 9, "font": "HelveticaBold", "color": "#504A4A" },
    "grid_columns": [36, 105, 160, 215, 270, 325, 380, 435, 490, 555],
    "grid_col_widths": [69, 55, 55, 55, 55, 55, 55, 55, 65],
    "header_row_height": 16,
    "data_row_height": 14,
    "grid_font_size": 7.5,
    "grid_border_width": 0.5,
    "grid_border_color": "#CCCCCC"
  }
}
```

**Schema rules**:
- Every positionable field has `{ x, y, fontSize, align, color, font }` — consistent shape
- Spacing/dimension values are grouped under their parent section (`grid.row_height`, not a bare number in `fields`)
- Column definitions under `grid.columns` have `{ x, align }` — Y comes from the computed row position
- No duplicate font config — font properties are per-field or per-section, not in a separate `fonts` block
- Version field enables future migration (reject with error if `version !== 1`)

## Part 4: Timesheet Pages

The blank template doesn't include a timesheet grid layout. Use the same blank template as background — it already has header, info boxes, and column bars. Draw the timesheet grid lines and data programmatically below the table header, using positions from `layout.json`'s `timesheet` section.

If Kalyn later provides a separate blank timesheet template, add it as a second template option. The configurator would gain a "Timesheet" tab for positioning those fields.

## File inventory

| File | Purpose | New/Modified |
|------|---------|-------------|
| `configurator.html` | Standalone visual layout editor | New |
| `layout.json` | Text field positions and font config | New |
| `blank-template.pdf` | Served as static asset | New |
| `index.html` | Consolidation engine — rewrite PDF generation | Modified |
| `api/extract.js` | No changes needed | Unchanged |
| `vercel.json` | May need route for blank-template.pdf | Modified |

## Success criteria

1. Generated PDFs are visually identical to Kalyn's gold standards (same template, positioned text)
2. Layout adjustments take seconds (drag in configurator) instead of hours (code + deploy)
3. No more back-and-forth on visual design — the template IS the design
4. Configurator is a self-contained HTML file with no dependencies beyond pdf.js 3.11.174
5. Face pages paginate correctly when employee count exceeds available space
