const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI("AIzaSyBving6L5pboJ2VtgA57QJ24VKW4b3pNO8");

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyBving6L5pboJ2VtgA57QJ24VKW4b3pNO8`);
        const data = await response.json();
        console.log(data);
    } catch (e) {
        console.error(e);
    }
}

listModels();
