# Previewing a test PDF (without uploading / AI extraction)

You don't need to run the full upload → extract → review flow to see how the
generated PDFs look. The tool ships with a built-in dev preview that fills in
sample data and runs the *real* PDF generator, so what you see is exactly what
the tool produces.

## Steps

1. Open a terminal in this folder and start a simple static server:

   ```sh
   python3 -m http.server 8000
   ```

   (Any static server works — the only reason you need one is so the page can
   load `layout.json`. Opening `index.html` straight from disk won't work.)

2. In your browser, go to:

   ```
   http://localhost:8000/?dev
   ```

3. Click the green **🧪 Generate Test PDF** button in the bottom-right corner.
   A sample invoice (job code N1103189, two employees with timesheets) opens in
   a new tab.

   You can also run `generateTestPDF()` from the browser console instead of
   using the button.

## Adjusting the look, then re-checking

- **Text sizes:** edit the `PDF_FONT_SIZES` block near the top of the `<script>`
  in `index.html` (all sizes are plain numbers, in points).
- **Positions, colors, borders:** edit `layout.json`.

After any change: **save the file, reload the browser tab** (so the new code /
config loads), then click **Generate Test PDF** again.

## Changing the sample data

The sample invoice is defined in the `generateTestPDF()` function in
`index.html` — edit the `invoices = [ ... ]` array there to preview different
names, rates, hours, job titles, or timesheet grids.
