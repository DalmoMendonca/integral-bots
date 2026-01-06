import { loadConfig } from "./lib/config.js";

async function test() {
  const config = loadConfig();
  if (!config.openaiApiKey) {
    console.error("Error: OPENAI_API_KEY is not set.");
    process.exit(1);
  }

  console.log("Testing OpenAI import and connectivity...");
  try {
    const mod = await import("openai");
    const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
    const client = new OpenAI({ apiKey: config.openaiApiKey });

    const resp = await client.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: "user", content: "Say 'Hello, OpenAI is working!'" }],
    });

    console.log("Response:", resp.choices[0].message.content);
    console.log("SUCCESS: OpenAI is configured correctly.");
  } catch (e) {
    console.error("FAILURE:", e.message);
    if (e.message.includes("401")) {
      console.error("Tip: Check if your API key is valid and has not expired.");
    }
  }
}

test();
