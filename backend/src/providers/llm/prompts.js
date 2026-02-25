/**
 * LLM prompt templates for structured data extraction.
 * Placeholders: {{COMPANY_NAME}}, {{CONTENT}}
 */

export const LEADERSHIP_PROMPT = `You are a mining industry intelligence analyst. Extract all executives and board members for the company "{{COMPANY_NAME}}" from the following web page content.

For each person, provide:
- "name": Full name
- "title": Their role/title at the company (e.g., "CEO", "Non-Executive Director", "Chief Financial Officer")
- "expertise_tags": An array of 1-4 expertise areas from this list: Geology, Metallurgy, Mining Engineering, Finance, Corporate Governance, Environmental, Legal, Marketing, Operations, Human Resources, Technology, Exploration, Project Development, Health & Safety. Only assign tags that are clearly supported by their bio.
- "summary_bullets": Exactly 3 short bullet points (1 sentence each) focusing on their project experience, operational history, and technical accomplishments in mining/resources. If info is limited, summarize what is available.

Return ONLY a JSON array. No markdown, no explanation. Example format:
[
  {
    "name": "John Smith",
    "title": "Chief Executive Officer",
    "expertise_tags": ["Mining Engineering", "Operations", "Finance"],
    "summary_bullets": [
      "Led development of the Sunrise Gold Project from feasibility to production.",
      "Over 25 years of operational experience across gold and copper mining in Australia.",
      "Previously served as COO at Pacific Mining Ltd managing 3 operating sites."
    ]
  }
]

If no leadership/board data is found, return an empty array: []

Web page content:
{{CONTENT}}`;

export const ASSETS_PROMPT = `You are a mining industry intelligence analyst. Extract all mining assets, operations, and projects for the company "{{COMPANY_NAME}}" from the following web page content.

For each asset/mine/project, provide:
- "name": Name of the mine or project
- "commodities": Array of commodities produced (e.g., ["gold"], ["copper", "gold"], ["lithium"])
- "status": One of: "operating", "developing", "exploration", "closed", "care_and_maintenance", "unknown"
- "country": Country where the asset is located
- "state_province": State or province (if available)
- "town": Nearest town or locality (if available)
- "latitude": Geographic latitude as a number (if mentioned or you can determine it from the location). Use null if unknown.
- "longitude": Geographic longitude as a number (if mentioned or you can determine it from the location). Use null if unknown.

IMPORTANT:
- Only include coordinates if you are confident they are correct for the specific mine site.
- If the page only mentions a general region, set coordinates to null rather than guessing.
- Extract EVERY asset, mine, operation, and project mentioned. The page may list 15-30+ assets (e.g., Queensland Coal, BMA, Blackwater, Olympic Dam, Escondida, Spence, Jansen). Do not stop early - return all of them.
- Include regional operations (e.g., "BMA Australia", "Queensland Coal") even if they are groupings of multiple mines.

Return ONLY a JSON array. No markdown, no explanation. Example format:
[
  {
    "name": "Pilgangoora Lithium-Tantalum Project",
    "commodities": ["lithium", "tantalum"],
    "status": "operating",
    "country": "Australia",
    "state_province": "Western Australia",
    "town": "Port Hedland",
    "latitude": -21.07,
    "longitude": 118.82
  }
]

If no assets are found, return an empty array: []

Web page content:
{{CONTENT}}`;
