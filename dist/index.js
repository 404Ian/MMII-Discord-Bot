import { Client, GatewayIntentBits, Collection } from 'discord.js';
import config from './config.js';
import logger from './utils/Logger.js';
// ceates a new client, message listener to "add" channel
export async function startBot() {
    try {
        const logger = await import(`./utils/Logger.js?update=${Date.now()}`);
        const { default: deploy } = await import(`./events/deploy.js?update=${Date.now()}`);
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });
        client.commands = new Collection();
        client.prefix = new Collection();
        if (config.MongoURI) {
            const mongoose = await import('mongoose');
            const start = performance.now();
            await mongoose.connect(config.MongoURI);
            const end = performance.now();
            logger.info('Connected to MongoDB', ` [${((end - start) / 1000).toFixed(2)}s]`);
        }
        else {
            logger.warn('MongoDB URI not provided. Skipped database connection.');
        }
        await logger.checkConfig();
        await deploy(client);
        await client.login(config.Token);
        return client;
    }
    catch (err) {
        logger.error('Failed to initialize bot.', err.stack);
    }
}
