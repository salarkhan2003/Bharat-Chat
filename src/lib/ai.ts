import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function summarizeChat(messages: { sender: string, text: string }[]) {
  const history = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Summarize the following chat history briefly in 2-3 sentences:\n\n${history}`,
  });

  return response.text;
}

export async function chatWithAI(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [...history.map(h => ({
      role: h.role,
      parts: h.parts
    })), { role: 'user', parts: [{ text: message }] }]
  });

  return response.text;
}

export async function getSmartReplies(lastMessages: { sender: string, text: string }[]) {
  const history = lastMessages.map(m => `${m.sender}: ${m.text}`).join('\n');
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the following chat conversation, suggest 3 short, context-aware smart replies (1-4 words each) for the user to pick. Return as a JSON array of strings.\n\n${history}`,
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    return JSON.parse(response.text || '[]') as string[];
  } catch (e) {
    return ["Got it!", "Thanks", "Will do"];
  }
}
