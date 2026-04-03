import { GoogleGenAI } from "@google/generative-ai"; // Standard JS import

const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // Vite uses import.meta.env
const genAI = new GoogleGenAI(apiKey);

/**
 * Professional Forensic Analysis Service
 * Converted to standard JavaScript (JSX compatible)
 */
export async function analyzeMedia(base64Image) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Act as SanrakshAN's core Forensic Engine. Perform an enterprise-grade deepfake analysis.

    Examine the provided media for:
    - Biometric consistency (facial landmarks, pupillary reflections).
    - Compression artifacts and double-quantization (indicating re-saves).
    - Frequency domain inconsistencies (AI-generated noise patterns).
    - Lighting and environmental coherence.

    Provide a professional verdict (REAL, SUSPICIOUS, or FAKE) and detailed reasoning.
    The reasoningBullets should be short, authoritative technical points.

    Return JSON only in the following format:
    {
      "score": number,
      "confidence": number,
      "verdict": "REAL" | "SUSPICIOUS" | "FAKE",
      "facesDetected": number,
      "anomalies": string[],
      "explanation": string,
      "reasoningBullets": string[],
      "metadata": { "resolution": "string", "compression": "string", "codec": "string" }
    }
  `;

  try {
    const startTime = Date.now();

    // Process the base64 string
    const imageData = base64Image.split(',')[1] || base64Image;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageData,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    // Clean JSON response (sometimes AI adds markdown blocks)
    const jsonString = text.replace(/```json|```/g, "").trim();
    const forensicData = JSON.parse(jsonString);

    const endTime = Date.now();
    forensicData.metadata.inferenceTime = `${endTime - startTime}ms`;

    return forensicData;
  } catch (error) {
    console.error("SanrakshAN Engine Error:", error);
    throw error;
  }
}