export const commands = [
  {
    name: 'debuggroup',
    category: 'Group',
    execute: async ({ sock, from, msg, args }) => {
      try {
        let targetGroupId = from;
        if (args && args.length > 0) {
            const groupIndex = parseInt(args[0]) - 1;
            const groups = await sock.groupFetchAllParticipating();
            const allGroups = Object.values(groups);
            if (groupIndex >= 0 && groupIndex < allGroups.length) {
                targetGroupId = allGroups[groupIndex].id;
            }
        }
        
        const groupMeta = await sock.groupMetadata(targetGroupId);
        const participants = groupMeta.participants;
        
        const first5 = participants.slice(0, 5);
        const debugData = JSON.stringify(first5, null, 2);
        
        await sock.sendMessage(from, { text: `Debug Data:\n\n${debugData}` }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(from, { text: `Error: ${err.message}` }, { quoted: msg });
      }
    }
  }
];
