import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { image_b64, page_num, file_name, week_ending } = req.body;

  if (!image_b64) {
    return res.status(400).json({ error: "Missing image_b64" });
  }

  const systemPrompt = `You are an invoice data extraction assistant for TalentHub Workforce Inc., a staffing agency. 
You extract structured data from scanned invoice pages.

Respond ONLY with a valid JSON object. No markdown, no explanation, no backticks.

Page types:
- "face": A billing/invoice summary page showing employee names, hours, rates, totals for a job code
- "timesheet": An individual employee timesheet with daily hour breakdown
- "other": Cover sheets, blank pages, or unrecognized content

For FACE pages, extract:
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
  "employees": [
    {
      "employee_name": "LAST, FIRST",
      "week_ending": "MM/DD/YYYY",
      "assignment": "...",
      "hours": 40,
      "bill_rate": 25.00,
      "pay_rate": 18.00,
      "line_total": 1000.00,
      "job_title": "..."
    }
  ],
  "confidence": {
    "invoice_no": "high",
    "invoice_date": "high",
    "job_code": "high",
    "week_ending": "high"
  }
}

For TIMESHEET pages, extract:
{
  "page_type": "timesheet",
  "employee_name": "LAST, FIRST",
  "week_ending": "MM/DD/YYYY",
  "job_code": "...",
  "invoice_no": "...",
  "confidence": {
    "employee_name": "high",
    "week_ending": "high",
    "job_code": "high"
  }
}

For OTHER pages:
{
  "page_type": "other"
}

Confidence is "high" if clearly legible, "low" if uncertain, smudged, or inferred.
For missing fields, use null. For numeric fields (hours, bill_rate, pay_rate, line_total) use numbers not strings.
If week_ending is not found on the page, use the provided fallback: "${week_ending || ""}".`;

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
                data: image_b64,
              },
            },
            {
              type: "text",
              text: `Extract all invoice data from this page (page ${page_num} of file: ${file_name || "unknown"}). Return only JSON.`,
            },
          ],
        },
      ],
    });

    const raw = response.content[0]?.text || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", raw);
      return res.status(200).json({ page_type: "other", parse_error: true });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Anthropic API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
