import { downloadMediaMessage } from '@whiskeysockets/baileys';

export const commands = [
  {
    name: 'bulksms',
    aliases: ['broadcastlist', 'bulkmsg'],
    description: 'Send a bulk message to contacts from a replied CSV or VCF file.',
    category: 'Owner',
    execute: async ({ sock, from, text, msg, senderNumber }) => {
      // Authorization bypass using hardcoded number since index.js owner logic is broken
      const isAuthorized = senderNumber === '255740906575';
      if (!isAuthorized) {
        return await sock.sendMessage(from, { text: '⛔ Only the bot owner can use this command.' }, { quoted: msg });
      }

      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      
      if (!quoted || !quoted.documentMessage) {
        return await sock.sendMessage(from, { text: '⚠️ Please reply directly to the CSV or V-Card document with the command and your message!\n\nExample: `.bulksms Hello everyone, this is a special announcement!`' }, { quoted: msg });
      }

      if (!text) {
        return await sock.sendMessage(from, { text: '⚠️ You forgot to include the message! Reply to the document like this:\n`.bulksms Your message here`' }, { quoted: msg });
      }

      try {
        await sock.sendMessage(from, { text: '⏳ Downloading file and extracting numbers...' }, { quoted: msg });
        
        const quotedMsg = { message: quoted };
        const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {}, { logger: console });
        const fileContent = buffer.toString('utf-8');

        // Extract all numbers (10 to 15 digits) ignoring plus signs
        const rawNumbers = fileContent.match(/\d{10,15}/g) || [];
        
        // Remove duplicates
        const uniqueNumbers = [...new Set(rawNumbers)];

        if (uniqueNumbers.length === 0) {
            return await sock.sendMessage(from, { text: '❌ Could not find any valid phone numbers in that document.' }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: `🚀 Starting bulk broadcast to ${uniqueNumbers.length} numbers!\n\nTo prevent WhatsApp from banning your account for spam, messages will be sent with a random 2 to 5 second delay between each person. You will be notified when it finishes.` }, { quoted: msg });

        let successCount = 0;
        let failCount = 0;

        for (const number of uniqueNumbers) {
            try {
                const jid = `${number}@s.whatsapp.net`;
                await sock.sendMessage(jid, { text: text });
                successCount++;
                
                // Random delay between 2 and 5 seconds to prevent spam bans
                const delay = Math.floor(Math.random() * (5000 - 2000 + 1) + 2000);
                await new Promise(resolve => setTimeout(resolve, delay));
            } catch (err) {
                failCount++;
            }
        }

        await sock.sendMessage(from, { text: `✅ *Bulk Broadcast Complete!*\n\nSuccessfully sent: ${successCount}\nFailed: ${failCount}` }, { quoted: msg });

      } catch (err) {
        console.error("Bulk SMS error:", err);
        await sock.sendMessage(from, { text: `❌ Failed to process broadcast: ${err.message}` }, { quoted: msg });
      }
    }
  }
];
