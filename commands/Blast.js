import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';

export const commands = [
  {
    name: 'blast',
    aliases: ['broadcastimage', 'blastall'],
    description: 'Broadcasts a replied image or text to the currently saved target list.',
    category: 'Owner',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      
      if (!quoted) {
        return await sock.sendMessage(from, { text: '⚠️ Please upload your Poster/Image with a caption, and then REPLY to it with the `.blast` command.' }, { quoted: msg });
      }

      const targetFile = path.join(process.cwd(), 'data', 'target_list.json');
      if (!fs.existsSync(targetFile)) {
        return await sock.sendMessage(from, { text: '❌ No Target List found! Please reply to a CSV file with `.setlist` first.' }, { quoted: msg });
      }

      const uniqueNumbers = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));

      if (uniqueNumbers.length === 0) {
          return await sock.sendMessage(from, { text: '❌ Your Target List is empty.' }, { quoted: msg });
      }

      try {
        let mediaBuffer = null;
        let isImage = false;

        if (quoted.imageMessage) {
            isImage = true;
            await sock.sendMessage(from, { text: '⏳ Downloading your poster in high quality...' }, { quoted: msg });
            const quotedMsg = { message: quoted };
            mediaBuffer = await downloadMediaMessage(quotedMsg, 'buffer', {}, { logger: console });
        }

        // Get the caption from the original image if they didn't provide text in the blast command
        const captionText = text || quoted.imageMessage?.caption || quoted.conversation || quoted.extendedTextMessage?.text || '';

        await sock.sendMessage(from, { text: `🚀 Starting Image Broadcast to ${uniqueNumbers.length} numbers!\n\nTo prevent WhatsApp bans, messages will be sent with a random 2 to 5 second delay between each person. You will be notified when it finishes.` }, { quoted: msg });

        let successCount = 0;
        let failCount = 0;

        for (const number of uniqueNumbers) {
            try {
                const jid = `${number}@s.whatsapp.net`;
                
                if (isImage && mediaBuffer) {
                    await sock.sendMessage(jid, { image: mediaBuffer, caption: captionText });
                } else {
                    await sock.sendMessage(jid, { text: captionText });
                }
                
                successCount++;
                
                // Random delay between 2 and 5 seconds to prevent spam bans
                const delay = Math.floor(Math.random() * (5000 - 2000 + 1) + 2000);
                await new Promise(resolve => setTimeout(resolve, delay));
            } catch (err) {
                failCount++;
            }
        }

        await sock.sendMessage(from, { text: `✅ *Image Broadcast Complete!*\n\nSuccessfully sent: ${successCount}\nFailed: ${failCount}` }, { quoted: msg });

      } catch (err) {
        console.error("Blast error:", err);
        return await sock.sendMessage(from, { text: '❌ Failed to broadcast the message. Ensure you replied to a valid image.' }, { quoted: msg });
      }
    }
  }
];
