const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testStyleQuiz() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    // Trying 2.5 flash which we skipped earlier due to 503
    const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const answers = ["Casual", "Minimal"];
    const prompt = `Return JSON: { "test": "ok" }. Quiz answers: ${JSON.stringify(answers)}`;

    try {
        console.log("Testing Gemini 2.5 Flash...");
        const result = await flashModel.generateContent(prompt);
        console.log("Response:", result.response.text());
        console.log("SUCCESS");
    } catch (error) {
        console.error("Failed:", error.status || error.message);
    }
}
testStyleQuiz();
