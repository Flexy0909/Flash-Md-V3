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
    'price': "🧺 *Urban Washers Pricing:*\n\n• Single clothes wash – 500 TZS\n• Shuka/Bedsheet – 1,000 TZS\n• Kanzu – 1,000 TZS\n• Towel – 1,000 TZS\n• Blanket/Duvet – 5,000 TZS\n\n*Service Options:*\n- Standard: 48 Hours\n- Express: Priority (Extra Cost)\n\nReply with *Order* to schedule a pickup!",
    'location': "📍 *Our Service Area:*\n\nWe provide **FREE Pickup & Delivery** directly to student hostels, rented rooms, and student residences at Arusha Technical College!\n\nYou don't need to come to us; we come to you. Reply with *Order* to request a pickup.",
    'menu': "📋 *Main Menu:*\n\nPlease reply with one of the following words:\n👉 *Price*\n👉 *Location*\n👉 *Order*\n👉 *Contact*",
    'order': "🚀 *Ready to place an order?*\n\nPlease reply with your Hostel Name, Room Number, and the best time for us to come pick up your laundry!",
    'contact': "📞 *Contact Urban Washers:*\n\nYou can call or WhatsApp us at:\n+255 687 771 750\n+255 797 095 607"
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
        
        // Inject Business Knowledge into AI
        const businessInfo = `
Business Name: Urban Washers
Target Audience: Students of Arusha Technical College living in hostels and rented rooms.
Core Service: Premium laundry pickup and delivery service that saves students time.
Service Model: FREE Pickup and Delivery directly from student hostels. We do NOT have a physical shop location for drop-offs. We come directly to the customer.
Pricing:
- Single clothes wash: 500 TZS
- Shuka/Bedsheet: 1,000 TZS
- Kanzu: 1,000 TZS
- Towel: 1,000 TZS
- Blanket/Duvet: 5,000 TZS
Turnaround Time: Standard Service is 48 Hours. Express Service is available at an extra cost.
Contact Info: +255 687 771 750 or +255 797 095 607
`;
        
        const aiPrompt = `You are a professional, friendly AI customer service agent for a laundry business. 
Here is the official information about your business:
${businessInfo}

A customer just sent this message: "${body}"
Please reply politely and concisely. Use ONLY the business information provided above to answer their questions. If they ask where your shop is, politely explain that you operate exclusively via free pickup and delivery at hostels. Do not make up prices or products. If they want to order, tell them to reply with "Order". If they ask something not covered, politely tell them a human agent will assist them shortly.`;

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
