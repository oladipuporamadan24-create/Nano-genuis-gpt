import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helpers for base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const result = reader.result as string;
        // Remove data url prefix (e.g. "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export const streamTextChat = async (
  history: Message[], 
  newMessage: string
): Promise<AsyncGenerator<string, void, unknown>> => {
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: history
      .filter(msg => !msg.isError && msg.text) // Filter out error/empty text messages
      .map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text || '' }],
      })),
  });

  const result = await chat.sendMessageStream({ message: newMessage });

  async function* generator() {
    for await (const chunk of result) {
      const c = chunk as GenerateContentResponse;
      if (c.text) {
        yield c.text;
      }
    }
  }

  return generator();
};

export const generateOrEditImage = async (
  prompt: string,
  base64Image?: string,
  mimeType: string = 'image/png'
): Promise<{ text?: string; imageUrl?: string }> => {
  const parts: any[] = [];
  
  // If we have an image, add it first (for editing/variation)
  if (base64Image) {
    parts.push({
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    });
  }

  // Add the text prompt
  parts.push({
    text: prompt,
  });

  // Use 'gemini-2.5-flash-image' for image tasks (Nano banana)
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: parts,
    },
    // Note: responseMimeType is not supported for this model
  });

  let resultText = '';
  let resultImageUrl = '';

  // Parse response for both text and image parts
  if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        resultText += part.text;
      }
      if (part.inlineData) {
        const base64 = part.inlineData.data;
        // Construct a data URL for display
        resultImageUrl = `data:image/png;base64,${base64}`;
      }
    }
  }

  return { text: resultText, imageUrl: resultImageUrl };
};
