import fs from 'fs';
import path from 'path';
import { callGeminiAPI } from '../france/index.js';

const welcomedUsersFile = path.join(process.cwd(), 'data', 'welcomed.json');
const leadsFile = path.join(process.cwd(), 'data', 'New_Leads.csv');

function getWelcomedUsers() {
    if (fs.existsSync(welcomedUsersFile)) {
        try {
            return new Set(JSON.parse(fs.readFileSync(welcomedUsersFile, 'utf-8')));
        } catch {
            return new Set();
        }
    }
    return new Set();
}

function saveWelcomedUser(number) {
    const users = getWelcomedUsers();
    users.add(number);
    const dir = path.dirname(welcomedUsersFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(welcomedUsersFile, JSON.stringify([...users]));
}

function saveLead(number) {
    const dir = path.dirname(leadsFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(leadsFile)) {
        fs.writeFileSync(leadsFile, 'Phone Number,Name\n');
    }
    // Check if number is already in leads to avoid duplicates
    const content = fs.readFileSync(leadsFile, 'utf-8');
    if (!content.includes(`="+${number}"`)) {
        fs.appendFileSync(leadsFile, `="+${number}",Customer_${number}\n`);
    }
}

const KEYWORDS = {
    'price': "🛒 *Our Pricing:*\n\n1. Standard Package - $10\n2. Premium Package - $20\n3. VIP Package - $50\n\nPlease let me know which one you prefer!",
    'location': "📍 *Our Location:*\n\nWe are located at 123 Main Business Street. We are open Monday to Friday, 9 AM to 5 PM.",
    'menu': "📋 *Main Menu:*\n\nPlease reply with one of the following words:\n👉 *Price*\n👉 *Location*\n👉 *Contact*",
    'contact': "📞 *Contact Us:*\n\nYou can call our support line at +255687771750."
};

// Anti-Ban Rate Limiter (Cooldown)
const RATE_LIMIT_MAP = new Map();
const COOLDOWN_MS = 8000; // 8 seconds cooldown between bot replies

// Helper function to simulate human typing
async function simulateTyping(sock, from, ms = 2500) {
    await sock.sendPresenceUpdate('composing', from);
    await new Promise(resolve => setTimeout(resolve, ms));
    await sock.sendPresenceUpdate('paused', from);
}

export async function handleBusinessLogic(sock, msg, from, body, senderNumber) {
    if (!body) return true; // Ignore media without captions

    // Anti-Ban: Check rate limit to prevent spam
    const lastMessageTime = RATE_LIMIT_MAP.get(senderNumber) || 0;
    if (Date.now() - lastMessageTime < COOLDOWN_MS) {
        return true; // Silently ignore spam to protect account from bans
    }

    const lowerBody = body.toLowerCase().trim();

    // 1. CRM Lead Harvesting & Welcome Message
    const users = getWelcomedUsers();
    if (!users.has(senderNumber)) {
        saveLead(senderNumber);
        saveWelcomedUser(senderNumber);

        await simulateTyping(sock, from, 3000); // 3 seconds typing delay
        const welcomeMessage = `👋 *Welcome to our Business!* \n\nWe are currently online and ready to assist you. \n\nReply with one of the following keywords for instant info:\n👉 *Price*\n👉 *Location*\n👉 *Contact*\n\nOr just ask any question and our AI assistant will help you!`;
        await sock.sendMessage(from, { text: welcomeMessage }, { quoted: msg });
        RATE_LIMIT_MAP.set(senderNumber, Date.now());
        return true;
    }

    // 2. Keyword Auto-Replies
    for (const [keyword, response] of Object.entries(KEYWORDS)) {
        if (lowerBody === keyword || lowerBody.includes(keyword)) {
            await simulateTyping(sock, from, 2000);
            await sock.sendMessage(from, { text: response }, { quoted: msg });
            RATE_LIMIT_MAP.set(senderNumber, Date.now());
            return true;
        }
    }

    // 3. AI Customer Support (Fallback for general questions)
    try {
        // Show "typing..." while AI generates response (looks 100% human)
        await sock.sendPresenceUpdate('composing', from);
        
        const aiPrompt = `You are a helpful customer service assistant for a business. A customer just said: "${body}". Please provide a helpful, polite, and concise reply.`;
        const response = await callGeminiAPI(aiPrompt);
        
        await sock.sendPresenceUpdate('paused', from);

        if (response) {
            await sock.sendMessage(from, { text: `🤖 *Assistant:*\n\n${response}` }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: `We received your message and an agent will reply shortly!` }, { quoted: msg });
        }
        RATE_LIMIT_MAP.set(senderNumber, Date.now());
    } catch (err) {
        console.error("Business AI Error:", err);
    }

    return true; // We always return true to consume the message so the bot doesn't process it further
}
