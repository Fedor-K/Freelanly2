// Check DashaMail transactional email stats

const DASHAMAIL_API_URL = "https://api.dashamail.com";
const API_KEY = process.env.DASHAMAIL_API_KEY;

async function apiCall(method: string, params: Record<string, unknown> = {}) {
  const formData = new FormData();
  formData.append("method", method);
  formData.append("api_key", API_KEY || "");
  formData.append("format", "json");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      formData.append(key, String(value));
    }
  }

  const response = await fetch(DASHAMAIL_API_URL, {
    method: "POST",
    body: formData,
  });

  return response.json();
}

async function main() {
  console.log("=== DashaMail Transactional Stats ===\n");

  // Get transactional stats
  const stats = await apiCall("transactional.get_stat");
  console.log("Stats response:", JSON.stringify(stats, null, 2));

  // Get recent transactional emails
  const recent = await apiCall("transactional.get_log", { limit: 10 });
  console.log("\nRecent emails:", JSON.stringify(recent, null, 2));

  // Also check lists
  const lists = await apiCall("lists.get");
  console.log("\nLists:", JSON.stringify(lists, null, 2));
}

main().catch(console.error);
