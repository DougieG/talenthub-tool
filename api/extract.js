import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  const imgData = body?.image_base64 || body?.image_b64;

  if (!imgData) {
    return res.status(400).json({ error: "Missing image data" });
  }

  const { page_num, file_name, week_ending } = body;

  const systemPrompt = `You are an invoice data extraction assistant for TalentHub Workforce Inc., a staffing agency.
You extract structured data from scanned invoice pages.

Respond ONLY with a valid JSON object. No markdown, no explanation, no backticks.

Page types:
- "face": A billing/invoice summary page showing employee line items with hours, rate, total for a job code. These pages often contain MULTIPLE employees listed as rows in a table. ANY page with employee names, hours, rates, and total amounts should be classified as "face".
- "timesheet": A page showing employee timesheet grids with daily hour breakdowns (days of the week with time in/out and hours worked). These pages often contain MULTIPLE employee timesheet grids stacked vertically.
- "other": ONLY for pages that are truly blank, cover sheets with no employee data, or completely unrecognizable content. When in doubt, classify as "face" rather than "other".

CRITICAL: Pages frequently contain MULTIPLE employees. You MUST extract ALL of them.

For FACE pages, extract ALL employees as an array:
{
  "page_type": "face",
  "invoice_no": "...",
  "invoice_date": "MM/DD/YY or MM/DD/YYYY",
  "account_no": "...",
  "job_code": "...",
  "client_name": "...",
  "client_number": "...",
  "attn_to": "...",
  "week_ending": "MM/DD/YYYY",
  "employees": [
    {
      "employee_name": "LAST, FIRST",
      "job_title": "...",
      "assignment": "Payroll",
      "hours": 40,
      "bill_rate": 25.00,
      "pay_rate": 18.00,
      "line_total": 1000.00
    },
    {
      "employee_name": "LAST2, FIRST2",
      "job_title": "...",
      "assignment": "Payroll",
      "hours": 35,
      "bill_rate": 22.75,
      "pay_rate": 17.50,
      "line_total": 796.25
    }
  ]
}

IMPORTANT for face pages:
- Extract EVERY employee row you see. Do NOT skip any.
- Each row typically shows: employee name, week ending, assignment (usually "Payroll"), a type indicator like "Reg", hours, bill rate, and total.
- The pay rate is often in a reference line below the employee row in brackets, like "[ Invoice Reference: Job Title $17.50]"
- The job_title is also in that reference line.
- bill_rate and pay_rate are DIFFERENT numbers. bill_rate is the higher rate shown in the main table. pay_rate is the lower rate shown in the reference line.

For TIMESHEET pages, extract ALL employee grids:
{
  "page_type": "timesheet",
  "job_code": "...",
  "invoice_no": "...",
  "timesheets": [
    {
      "employee_name": "LAST, FIRST",
      "week_ending": "MM/DD/YYYY",
      "client_name": "...",
      "tsGrid": [
        {"day": "Mon", "start": "9:00AM", "end": "5:00PM", "lunch": "60 mins", "reg": 7.0, "ot": 0, "dt": 0},
        {"day": "Tue", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
        {"day": "Wed", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
        {"day": "Thu", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
        {"day": "Fri", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
        {"day": "Sat", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
        {"day": "Sun", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0}
      ]
    },
    {
      "employee_name": "LAST2, FIRST2",
      "week_ending": "MM/DD/YYYY",
      "client_name": "...",
      "tsGrid": [
        {"day": "Mon", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
        {"day": "Tue", "start": "8:00AM", "end": "5:00PM", "lunch": "60 mins", "reg": 8.0, "ot": 0, "dt": 0},
        {"day": "Wed", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
        {"day": "Thu", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
        {"day": "Fri", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
        {"day": "Sat", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
        {"day": "Sun", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0}
      ]
    }
  ]
}

CRITICAL - Timesheet day mapping:
- The timesheet grid has columns labeled Mon, Tue, Wed, Thu, Fri, Sat, Sun from LEFT to RIGHT.
- Each column represents ONE specific day. Map data to the CORRECT day column.
- If a column is EMPTY (no time started, no time finished, no hours), that day has NO data — set all fields to empty/0.
- Read each column independently. Do NOT shift data between columns.
- The "Total" or "Total Hours" column at the far right is NOT a day — it is the sum.
- Verify: the sum of reg hours across all days should equal the Total Hours shown.
- Common error: when only some days have data, make sure to place hours in the CORRECT day columns, not just fill from left to right.
- Look carefully at the column headers printed on the page to match each data column to its day.

For OTHER pages:
{
  "page_type": "other"
}

CRITICAL - Job Code extraction: TalentHub invoices have a job code that is an alphanumeric string. Common formats:
- Letter + 7 digits: N1103187, N1234567, H1234567, B1110014, E1101270
- Letter + 7 digits + hyphen + more digits: B1110014-59200
Look for the FULL code (including any suffix after a hyphen) in:
1. A box or field labeled "JOB CODE", "JOB ORDER", "P.O. NUMBER", or "PURCHASE ORDER"
2. At the end of the job title field (e.g. "Temp Budget Analyst N1103187" -> job_code is "N1103187")
3. In the address/client area of the invoice
4. Anywhere on the page that looks like a code starting with a letter followed by digits
IMPORTANT: Extract the COMPLETE code including any suffix (e.g. "B1110014-59200" not just "B1110014").
Always extract the job_code - it is never missing from a face page.

Confidence: "high" if clearly legible, "low" if uncertain or inferred.
Missing text fields: use null. Missing numeric fields: use 0.
If week_ending not found, use: "${week_ending || ""}".`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imgData,
              },
            },
            {
              type: "text",
              text: `Extract ALL invoice data from this page (page ${page_num || "?"} of file: ${file_name || "unknown"}). This page may contain MULTIPLE employees — extract every single one. Return only JSON.`,
            },
          ],
        },
      ],
    });

    const raw = response.content[0]?.text || "{}";
    const clean = raw.replace(/```json\n?|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error("JSON parse error:", e.message, "Raw:", raw.substring(0, 200));
      return res.status(200).json({ page_type: "other", parse_error: true });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Anthropic API error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
