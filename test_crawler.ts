
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const urls = [
  "https://www.keepmeposted.com.mt",
  "https://www.remax.com.mt"
];

async function testCrawl() {
  for (const url of urls) {
    console.log(`Testing URL: ${url}`);
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      console.log(`Status: ${response.status}`);
      if (!response.ok) {
        console.error(`Failed to fetch`);
        continue;
      }
      
      const html = await response.text();
      console.log(`HTML Length: ${html.length}`);
      
      const doc = new DOMParser().parseFromString(html, "text/html");
      const text = doc?.body?.textContent || "";
      const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 500);
      
      console.log(`Extracted Text Sample: ${cleanText}`);
      
    } catch (e) {
      console.error(`Error: ${e}`);
    }
    console.log("---");
  }
}

testCrawl();
