// :: /events/onReady.ts
import { Events } from 'discord.js';
import logger from '../utils/Logger.js';
import pc from 'picocolors';
let presenceInterval = null;
function clearPresenceInterval() {
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
    }
}
export default {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`Logged in as ${pc.bold(pc.blueBright(pc.underline(client.user.tag)))}`);
        const servers = client.guilds.cache.size;
        const total_members = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const activities = [
            { name: `MMII Games | v1.5.3`, type: 4 },
            { name: `Ian Prod. | ${total_members} Members`, type: 4 },
        ];
        const setRandomActivity = () => {
            if (!client.isReady() || !client.user)
                return;
            const random = activities[Math.floor(Math.random() * activities.length)];
            try {
                client.user.setPresence({
                    activities: [random],
                    status: "dnd"
                });
            }
            catch (err) {
                logger.error('An error occured while setting presence.', err.stack);
            }
        };
        clearPresenceInterval();
        setRandomActivity();
        presenceInterval = setInterval(setRandomActivity, 60_000);
        client.once("destroyed", clearPresenceInterval);
    }
};
export { clearPresenceInterval };
