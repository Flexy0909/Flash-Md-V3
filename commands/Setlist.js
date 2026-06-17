import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';

export const commands = [
  {
    name: 'setlist',
    aliases: ['setcsv', 'settarget'],
    description: 'Set the target list of contacts for broadcasting from a replied CSV or VCF file.',
    category: 'Owner',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      
      let isDoc = false;
      if (quoted) {
        if (quoted.documentMessage) isDoc = true;
        else if (quoted.documentWithCaptionMessage) isDoc = true;
      }

      if (!isDoc) {
        return await sock.sendMessage(from, { text: '⚠️ Please reply directly to the CSV or V-Card document with the command: `.setlist`\n\n(Make sure you swipe right on the actual file bubble!)' }, { quoted: msg });
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

        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const targetFile = path.join(dataDir, 'target_list.json');
        fs.writeFileSync(targetFile, JSON.stringify(uniqueNumbers));

        await sock.sendMessage(from, { text: `✅ *Target List Saved!*\n\nSuccessfully saved ${uniqueNumbers.length} unique numbers into the broadcasting memory.\n\nYou can now reply to any Image, Video, or Text message with \`.blast\` to send it to everyone on this list!` }, { quoted: msg });

      } catch (err) {
        console.error("Set List error:", err);
        return await sock.sendMessage(from, { text: '❌ Failed to process the document. Make sure it is a valid CSV or V-Card file.' }, { quoted: msg });
      }
    }
  }
];
