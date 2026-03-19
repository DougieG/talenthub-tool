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
- "face": A billing/invoice summary page showing ONE employee's hours, rate, total for a job code. ANY page with an employee name, hours, rate, and total amount should be classified as "face" — even if the formatting varies or the scan quality is poor.
- "timesheet": An individual employee timesheet with a daily hour breakdown grid showing days of the week (Mon-Sun) with time in/out and hours worked
- "other": ONLY for pages that are truly blank, cover sheets with no employee data, or completely unrecognizable content. When in doubt, classify as "face" rather than "other" — it's better to extract data that can be reviewed than to miss an employee.

For FACE pages, extract (flat structure, one employee per face page):
{
  "page_type": "face",
  "invoice_no": "...",
  "invoice_date": "MM/DD/YYYY",
  "account_no": "...",
  "job_code": "...",
  "client_name": "...",
  "client_number": "...",
  "attn_to": "...",
  "week_ending": "MM/DD/YYYY",
  "employee_name": "LAST, FIRST",
  "job_title": "...",
  "assignment": "Payroll",
  "hours": 40,
  "bill_rate": 25.00,
  "pay_rate": 18.00,
  "line_total": 1000.00,
  "confidence": {
    "employee_name": "high",
    "job_code": "high",
    "hours": "high",
    "bill_rate": "high",
    "line_total": "high"
  }
}

For TIMESHEET pages, extract:
{
  "page_type": "timesheet",
  "employee_name": "LAST, FIRST",
  "week_ending": "MM/DD/YYYY",
  "job_code": "...",   // IMPORTANT: Look for alphanumeric codes like N1103187, N1234567. Check boxes labeled JOB CODE, JOB ORDER, P.O. NUMBER, or PURCHASE ORDER. Also check if the job title ends with a code like "Temp Budget Analyst N1103187" - extract "N1103187" as the job_code.
  "invoice_no": "...",
  "tsGrid": [
    {"day": "Mon", "start": "9:00AM", "end": "5:00PM", "lunch": "30", "reg": 7.5, "ot": 0, "dt": 0},
    {"day": "Tue", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
    {"day": "Wed", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
    {"day": "Thu", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
    {"day": "Fri", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
    {"day": "Sat", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0},
    {"day": "Sun", "start": "", "end": "", "lunch": "", "reg": 0, "ot": 0, "dt": 0}
  ],
  "confidence": {
    "employee_name": "high",
    "week_ending": "high"
  }
}

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
IMPORTANT: Each face page represents exactly ONE employee. If you see multiple employees listed, extract only the PRIMARY employee for this specific page (the one whose hours/rate/total are shown).
Always extract the job_code - it is never missing from a face page.

Confidence: "high" if clearly legible, "low" if uncertain or inferred.
Missing text fields: use null. Missing numeric fields: use 0.
If week_ending not found, use: "${week_ending || ""}".`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
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
              text: `Extract all invoice data from this page (page ${page_num || "?"} of file: ${file_name || "unknown"}). Return only JSON.`,
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
