import axios from 'axios';

async function listModels() {
    try {
        const apiKey = "AIzaSyCSPq1AsI_IwyPbAbXV-ULUqVyWczkc1sM";
        const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        console.log("Models:", JSON.stringify(res.data.models.map((m: any) => m.name), null, 2));
    } catch (e: any) {
        console.error("Error fetching models:", e.message || e);
    }
}

listModels();
