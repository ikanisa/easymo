import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

// Force detailed logging
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error("Missing credentials in .env");
    process.exit(1);
}

console.log(`Connecting to ${url}...`);
const supabase = createClient(url, key);

async function check() {
    console.log("Checking 'web_sessions' table...");
    // Try to select 0 rows
    const { data, error } = await supabase.from('web_sessions').select('*').limit(1);

    if (error) {
        console.error("Query Failed:", error);
        console.log("ERROR_MESSAGE:", error.message);
    } else {
        console.log("Query Successful. Data found:", data?.length);
    }

    // Also list all tables if possible (requires rpc or permissions, usually redundant if above fails)
}

check();
