/* | :: events/deploy.ts 
 * - Deployment Module
 * - For: Zedtrn V2
 * 
 * - Features:
 * | - Shows reloaded events
 * | - Returns deployment data
 */
import { REST, Routes, Client, Collection } from 'discord.js';
import { readdirSync } from 'node:fs';
import { join, resolve, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";
import pc from 'picocolors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cmd_dir = join(__dirname, '../commands');
const event_dir = join(__dirname, '../events');

export default async function deploy(client: Client) {
    const cmds: any[] = [];
    const events: string[] = [];
    const logger = await import(`../utils/Logger.js?update${Date.now()}`)
    const config = await import(`../config.js?update${Date.now()}`)

    if (!client) {
        logger.error('Unable to deploy, client is undefined.');
        return;
    }

    function getFiles(dir: string, ext = '.js') {
        const files = readdirSync(dir, { withFileTypes: true });
        let allFiles: string[] = [];
        for (const file of files) {
            const filePath = join(dir, file.name);
            if (file.isDirectory()) {
                allFiles = allFiles.concat(getFiles(filePath, ext));
            } else if (file.name.endsWith(ext)) {
                allFiles.push(resolve(filePath));
            }
        }
        return allFiles;
    }

    // --- Commands ---
    // const commandFiles = getFiles(resolve(cmd_dir));
    // if (!client.commands) client.commands = new Collection();
    // client.commands.clear();

    // for (const filePath of commandFiles) {
    //     const { default: command } = await import(`file://${filePath}?update=${Date.now()}`);
    //     if (!command?.data?.name) continue;

    //     command.filePath = filePath;
    //     client.commands.set(command.data.name, command);
    //     cmds.push(command.data.toJSON());
    // }

    // --- Events ---
    const eventFiles = getFiles(resolve(event_dir));
    let interactions: number = 0;
    client.removeAllListeners();

    for (const filePath of eventFiles) {
        const { default: event } = await import(`file://${filePath}?update=${Date.now()}`);
        if (!event?.name || !event?.execute) continue;

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }

        const parentFolder = basename(dirname(filePath));
        const fileName = basename(filePath, extname(filePath));

        if (parentFolder === "interactions") {
            interactions++;
            continue;
        }

        events.push(fileName);
    }

    const start = performance.now();
    try {
        const rest = new REST({ version: '10' }).setToken(config.Token);
        let deployed: any[] = [];

        for (const guildId of config.Guild_ID) {
            const guildDeployed: any = await rest.put(
                Routes.applicationGuildCommands(config.Client_ID, guildId),
                { body: cmds }
            );
            deployed.push(...guildDeployed);
        }
        
        // const globalDeployed: any = await rest.put(
        //     Routes.applicationCommands(config.Client_ID),
        //     { body: cmds }
        // );
        // deployed.push(...globalDeployed);

        const end = performance.now();
        const deployTime = ((end - start) / 1000).toFixed(2);

        logger.info(
            `Reloaded Events: ${interactions}x Interactions, ${events.join(pc.gray(', '))}`
        );

        // logger.info(
        //     'Deployed Commands.',
        //     ` [${deployTime}s] | Total: ${deployed.length / config.Guild_ID.length}`
        // );

        return { deployed, deployTime, events };
    } catch (err: any) {
        logger.error('Failed to deploy commands.', err.stack);
        return { deployed: [], deployTime: 0, events: [] };
    }
}