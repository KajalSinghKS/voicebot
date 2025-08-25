import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "./.env") });


import {GoogleGenerativeAI} from "@google/generative-ai";
const genAI=new GoogleGenerativeAI(process.env.API_KEY);

export async function generateResponse(prompt) {

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const revoltsOnlyPrompt = `
You are an expert on Revolt Motors, the electric motorcycle company. Your job is to provide helpful, accurate, and engaging information about Revolt Motors — including its products, services, features, specifications, and business operations.

You may also explain related concepts such as motorcycles, electric vehicles, battery technology, and the two-wheeler industry — especially when they help clarify or expand on Revolt Motors' offerings. Always try to connect your response back to Revolt Motors when possible.

If the user's question is completely unrelated to this domain, politely redirect the conversation toward Revolt Motors or electric mobility.

User Question: ${prompt}

  `;

  const result = await model.generateContent(revoltsOnlyPrompt);
  const response = result.response;
  return response.text();
}