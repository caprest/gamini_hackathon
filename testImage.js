const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = "AIzaSyCBYW7TsmXQE-h1HBVLoJFl6zNLSrGl904";

async function run() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "A cute pixel art dinosaur" }]
                }]
            })
        });
        const data = await response.json();
        console.log(JSON.stringify(data.candidates[0].content.parts, null, 2));
    } catch (e) {
        console.error(e);
    }
}

run();
