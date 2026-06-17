export const commands = [
  {
    name: 'extract',
    aliases: ['scrape'],
    description: "Extracts contacts from a group",
    category: 'Group',
    execute: async ({ sock, from, msg, args, senderNumber }) => {
      
      let targetGroupId = from;

      if (args && args.length > 0) {
          const groupIndex = parseInt(args[0]) - 1;
          const groups = await sock.groupFetchAllParticipating();
          const allGroups = Object.values(groups);
          if (groupIndex >= 0 && groupIndex < allGroups.length) {
              targetGroupId = allGroups[groupIndex].id;
          } else {
              await sock.sendMessage(from, { text: '⚠️ Invalid group number. Check your groups list.' }, { quoted: msg });
              return;
          }
      } else if (!from.endsWith('@g.us')) {
        const groups = await sock.groupFetchAllParticipating();
        const allGroups = Object.values(groups);
        let groupListMsg = '📝 *Your Groups List:*\n\n';
        allGroups.forEach((g, index) => {
          groupListMsg += `${index + 1}. ${g.subject}\n`;
        });
        groupListMsg += '\n👉 *To extract, reply with:* `.extract <number>`\nExample: `.extract 1`';
        await sock.sendMessage(from, { text: groupListMsg }, { quoted: msg });
        return;
      }

      try {
        await sock.sendMessage(from, { text: '⏳ Extracting contacts, please wait...' }, { quoted: msg });
        
        const groupMeta = await sock.groupMetadata(targetGroupId);
        const participants = groupMeta.participants;
        
        let vCardData = '';
        const safeGroupName = (groupMeta.subject || 'Group').replace(/[^a-zA-Z0-9]/g, '');
        const prefix = safeGroupName.substring(0, 6).toUpperCase();

        for (const p of participants) {
          const rawId = p.phoneNumber || p.id;
          const number = rawId.split('@')[0];
          const realName = `${prefix}_+${number}`;
          
          csvData += `="+${number}",${realName}\n`;
          vCardData += `BEGIN:VCARD\nVERSION:3.0\nFN:${realName}\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD\n`;
        }


        await sock.sendMessage(from, {
          document: Buffer.from(csvData, 'utf-8'),
          mimetype: 'text/csv',
          fileName: `Extracted_${safeGroupName}.csv`,
          caption: `✅ Extracted ${participants.length} numbers!`
        });

        await sock.sendMessage(from, {
          document: Buffer.from(vCardData, 'utf-8'),
          mimetype: 'text/x-vcard',
          fileName: `Contacts_${safeGroupName}.vcf`,
          caption: `📲 Here is the V-Card file! Tap this on your phone to instantly save all contacts to your address book.`
        });

      } catch (err) {
        console.error("Extraction error:", err);
        await sock.sendMessage(from, { text: '❌ Failed to extract group data.' }, { quoted: msg });
      }
    }
  },
  {
    name: 'extractall',
    aliases: ['scrapeall'],
    description: "Extracts contacts from all groups",
    category: 'Group',
    execute: async ({ sock, from, msg, senderNumber }) => {

      try {
        await sock.sendMessage(from, { text: '⏳ Scanning all your groups to extract contacts...' }, { quoted: msg });
        
        const groups = await sock.groupFetchAllParticipating();
        const allGroups = Object.values(groups);
        
        let uniqueContacts = new Map();
        
        for (const group of allGroups) {
          for (const participant of group.participants) {
            const rawId = participant.phoneNumber || participant.id;
            const number = rawId.split('@')[0];
            const realName = `ATC_+${number}`;
            uniqueContacts.set(rawId, realName);
          }
        }

        let vCardData = '';
        let csvData = 'Phone Number,Name\n';

        uniqueContacts.forEach((realName, rawId) => {
          const number = rawId.split('@')[0];
          csvData += `="+${number}",${realName}\n`;
          vCardData += `BEGIN:VCARD\nVERSION:3.0\nFN:${realName}\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD\n`;
        });

        await sock.sendMessage(from, {
          document: Buffer.from(csvData, 'utf-8'),
          mimetype: 'text/csv',
          fileName: `All_Leads.csv`,
          caption: `✅ Extracted ${uniqueContacts.size} UNIQUE contacts!`
        });

        await sock.sendMessage(from, {
          document: Buffer.from(vCardData, 'utf-8'),
          mimetype: 'text/x-vcard',
          fileName: `All_Contacts.vcf`,
          caption: `📲 Tap to save all leads to your phone contacts at once.`
        });

      } catch (err) {
        console.error("Extraction error:", err);
        await sock.sendMessage(from, { text: '❌ Failed to extract groups.' }, { quoted: msg });
      }
    }
  }
];
