import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const GERMAN_MONTHS = {
  januar: 1, februar: 2, märz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

function parseGermanDate(raw) {
  const m = raw.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const monthNum = GERMAN_MONTHS[m[2].toLowerCase()];
  const month = String(monthNum).padStart(2, "0");
  const year = m[3];
  if (!monthNum || isNaN(monthNum)) return null;
  return `${year}-${month}-${day}`;
}

async function updateEventDates() {
  const { data, error } = await supabase.from("site_content").select("key, value").eq("key", "reservation_event_dates").single();
  if (error) {
    console.error(error);
    return;
  }
  const lines = (data.value || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const converted = lines.map((line) => {
    if (/^\d{4}-\d{2}-\d{2}/.test(line)) {
      // already has ISO date prefix
      return line;
    }
    const iso = parseGermanDate(line);
    if (iso) return `${iso} | ${line}`;
    return line;
  });
  const newValue = converted.join("\n");
  if (newValue === data.value) {
    console.log("No change needed");
    return;
  }
  const { error: updError } = await supabase.from("site_content").update({ value: newValue }).eq("key", "reservation_event_dates");
  if (updError) {
    console.error(updError);
  } else {
    console.log("Updated reservation_event_dates to:\n" + newValue);
  }
}

updateEventDates();
