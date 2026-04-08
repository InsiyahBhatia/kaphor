const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testStyleQuiz() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const answers = ["Casual", "Timeless & classic", "Loose/Relaxed", "Neutrals (black, white, beige)"];
    const prompt = `Analyze these fashion style quiz answers and return ONLY valid JSON (no markdown) with this exact shape:
{
  "styleVector": [/* 16 floats between 0 and 1 */],
  "styleAesthetic": "MINIMALIST|VINTAGE|BOLD|ETHNIC|STREETWEAR|LUXURY",
  "recommendedBrands": ["brand1","brand2","brand3"],
  "preferredCategories": ["category1","category2"],
  "colorPalette": ["#hex1","#hex2","#hex3","#hex4"],
  "summary": "2-3 sentence style personality description"
}
Quiz answers: ${JSON.stringify(answers)}`;

    try {
        console.log("Starting generation...");
        const result = await flashModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
        });

        const raw = result.response.text();
        console.log("Raw Response:", raw);
        const profile = JSON.parse(raw);
        console.log("Parsed Profile Success:", profile.styleAesthetic);
        console.log("Summary:", profile.summary);
    } catch (error) {
        console.error("Test Failed:", error.message || error);
    }
}

testStyleQuiz();
