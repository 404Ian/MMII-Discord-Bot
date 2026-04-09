/* | :: /utils/Logger.ts 
 * - Advanced Logger System
 * - For: Zedtrn V2
 * - By: Ian
 * 
 * - Features: (with colors)
 * | - Normal Console Logging (info, warn, debug, error): with timestamps, 
 * | - Discord Container Presets (container_warn, *_debug, *_error): returns a ContainerBuilder, 
 * | - Discord Channel Logging (info_log, warn_*, debug_*, error_*): via webhook/fallback to bot
 */

import { ContainerBuilder, Client, TextChannel, WebhookClient, MessageFlags, Interaction } from "discord.js"
import pc from "picocolors"
import config from '../config.js';
import fs from "fs";
import path from "path";
import { cwd } from "process";

// -- Helpers
function getTimestamp() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
function discordTimestamp() {
    return Math.floor(Date.now() / 1000);
}
function formatLevel(level: string) {
    switch (level) {
        case "INFO":
            return pc.bold(pc.cyanBright(level))
        case "WARN":
            return pc.bold(pc.yellowBright(level))
        case "ERROR":
            return pc.bold(pc.redBright(level))
        case "DEBUG":
            return pc.bold(pc.greenBright(level))
        default:
            return pc.bold(pc.white(level))
    }
}

export function sanitizeStack(stack?: string) {
    if (!stack) return "";

    const lines = stack.split("\n");
    const errorLine = lines[0];

    const cleaned = lines
        .slice(1)
        .map((line) => {
            if (/node:internal|native/.test(line)) return "";
            if (/Logger\.(ts|js)/.test(line)) return "";

            return line
                .replace(/^.*file:[/\\]+/, "")
                .replace(/\\/g, "/")
                .replace(/[()]/g, "")
                .replace(/^\s*at\s+/, "")
                .replace(/\.js(\?update=\d+)?/, ".js")
                .trim();
        })
        .filter(Boolean);

    const formattedStack = cleaned
        .map((line, i) => {
            const symbol = i === cleaned.length - 1 ? "╚" : "╠";
            return `    ${symbol} ${line}`;
        })
        .join("\n");

    return `\n${errorLine}\n${formattedStack}`;
}

export function stackify(stack?: string) {
    if (!stack) return "";

    const projectRoot = cwd().replace(/\\/g, "/");

    const lines = stack.split("\n");
    const errorLine = lines[1];

    const cleaned = lines
        .slice(2)
        .map((line) => {
            if (/node:internal|native/.test(line)) return "";
            if (/Logger\.(ts|js)/.test(line)) return "";

            return line
                .replace(/^.*file:[/\\]+/, "")
                .replace(projectRoot, "")
                .replace(/\\/g, "/")
                .replace(/[()]/g, "")
                .replace(/^\s*at\s+/, "")
                .replace("/dist/", "/src/")
                .replace(/\.js(\?update=\d+)?/, ".ts")
                .trim();
        })
        .filter(Boolean);

    const formattedStack = cleaned
        .map((line, i) => {
            const symbol = i === cleaned.length - 1 ? "╚" : "╠";
            return `    ${symbol} ${line}`;
        })
        .join("\n");

    return `\n${errorLine}\n${formattedStack}`;
}

// -- Console Logging
function log(level: string, message: string, time: string) {

    const spacing = level.length === 4 ? " " : " "
    const space = level.length === 4 ? " " : ""

    const base =
        space + formatLevel(level) + spacing +
        pc.bgBlue(pc.bold(pc.white(` ${config.Name} `))) +
        pc.black(` │ ${getTimestamp()} │ `)

    const msg =
        level === "INFO"
            ? message
            : level === "WARN"
                ? pc.yellowBright(message)
                : level === "DEBUG"
                    ? pc.greenBright(message)
                    : pc.bold(pc.red(message))

    if (time) {
        console.log(base + msg + pc.black(time))
    } else {
        console.log(base + msg)
    }
}

// -- Container Presets
function container(level: string, message: string, submessage: string, sep: boolean = false) {
    const base =
        level === "WARN"
            ? `**⚠️ ${message}**`
            : level === "ERROR"
                ? `**‼️ ${message}**`
                : level === "DEBUG"
                    ? `❌ ${message}`
                    : level === "INFO"
                        ? `${message}`
                        : message;

    const builder = new ContainerBuilder().addTextDisplayComponents(
        t => t.setContent(base)
    );

    if (submessage) {
        if (sep) builder.addSeparatorComponents(sep => sep);
        builder.addTextDisplayComponents(t => t.setContent(`-# ${submessage}`));
    }

    return builder;
}

const LevelTitles: Record<string, string> = {
    error: "❌ Error",
    warn: "⚠️ Warning",
    debug: "🐛 Debug",
    info: "ℹ️ Info"
};

// -- Webhook/Bot Direct Channel Logs
export async function channel_log(client: Client, interaction: Interaction, level: string, message: string, submessage?: string) {
    const config = await import(`../config.js?update=${Date.now()}`);

    if (!config.LogsChannel || config.LogsChannel === "") {
        return error("❌ Could not send channel log. Channel for logging not provided.");
    }

    const color = config.LogsColors[level.toLowerCase()] || null;
    const title = LevelTitles[level.toLowerCase()] || level.toUpperCase();

    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            t => t.setContent(`### ${title}`),
            t => t.setContent(`-# Happened: <t:${discordTimestamp()}:R>`),
            t => {
                if ('commandName' in interaction && 'commandId' in interaction) {
                    return t.setContent(`-# While using command: </${(interaction as any).commandName}:${(interaction as any).commandId}>`);
                } else {
                    return t.setContent(`-# Interaction type: ${interaction.type}`);
                }
            },
        )
        .addSeparatorComponents(sep => sep)
        .addTextDisplayComponents(
            t => t.setContent(`**${message}**`),
            t => t.setContent(`-# ${submessage ? `${submessage}` : 'None'}`)
        )
        .addSeparatorComponents(sep => sep)
        .addTextDisplayComponents(
            t => t.setContent(`-# Guild: ${interaction.guild ? interaction.guild.name : '`Unknown Guild Name`'} (${interaction.guildId})`),
            t => t.setContent(`-# Channel ID: ${interaction.channelId}`),
            t => t.setContent(`-# User: ${interaction.user.username} (${interaction.user.id})`),

        )

    if (color) container.setAccentColor(parseInt(color, 16));

    if (config.LogsWebhook && config.LogsWebhook !== "") {
        try {
            const webhookClient = new WebhookClient({ url: config.LogsWebhook }) as any;

            try {
                if (webhookClient.name !== `${config.Name} Logger`) {
                    try {
                        await webhookClient.edit({ name: `${config.Name} Logger` });
                    } catch (err: any) {
                        warn("Failed to rename webhook:", `\n${sanitizeStack(err.stack)}`);
                    }
                }
            } catch (err: any) {
                warn("Failed to fetch webhook data:", `\n${sanitizeStack(err.stack)}`);
            }

            try {
                await webhookClient.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    withComponents: true
                });
                return;
            } catch (err: any) {
                warn("Failed to send logs via webhook, falling back to bot message.", `\n${sanitizeStack(err.stack)}`);
            }
        } catch (err: any) {
            warn("Failed to create WebhookClient or fetch info, sending logs with bot.", `\n${sanitizeStack(err.stack)}`);
        }
    } else {
        warn("No webhook provided, sending logs with the bot.");
    }

    const channel = client.channels.cache.get(config.LogsChannel) as TextChannel;
    if (!channel) return error("LogsChannel not found in guild cache.");

    try {
        await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    } catch (err: any) {
        error("Failed to send logs to LogsChannel:", `\n${sanitizeStack(err.stack)}`);
    }
}

export async function write_log(type: string, message: string, time: string = ''): Promise<void> {
    const validTypes = ["debug", "error", "warn"];
    const logType = validTypes.includes(type.toLowerCase()) ? type.toLowerCase() : "debug";

    if (
        message.includes('MongoDB URI not provided') || 
        message.includes('is disabled in config.') ||
        message.includes('is already up to date') ||
        message.includes('is not registered yet.') ||
        message.includes('Modified')
    ) return;

    const date = new Date().toISOString().split("T")[0];
    const logDir = path.resolve("src", "logs", logType);
    const logFile = path.join(logDir, `${date}.log`);

    try {
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const line = `[${getTimestamp()}] ${logType.toUpperCase()} │ ${message}\n`;
        await fs.promises.appendFile(logFile, line, "utf8");

        const files = await fs.promises.readdir(logDir);

        for (const file of files) {
            if (!file.endsWith(".log")) continue;

            const filePath = path.join(logDir, file);
            const content = await fs.promises.readFile(filePath, "utf8");
            const lines = content
                .split("\n")
                .filter(l => l.trim().length > 0);

            if (lines.length > 0 && lines.every(l => l.toLowerCase().trim().endsWith("-- [fixed]") || l.toLowerCase().trim().endsWith("-- fixed"))) {
                await fs.promises.unlink(filePath);
                info(`Deleted log file: ${logType}/${file} | Reason: All issues fixed.`);
            }
            if (lines.length === 0) {
                await fs.promises.unlink(filePath);
                info(`Deleted empty log file (${logType}/${file})`);
            }
        }
    } catch (err: any) {
        error(`Failed to write ${logType} log:`, `\n${sanitizeStack(err.stack)}`);
    }
}

export function info(message: string, time: string = '') {
    log("INFO", message, time)
}

export function warn(message: string, time: string = '') {
    log("WARN", message, time)
    write_log('WARN', message + time)
}

export function error(message: string, time: string = '') {
    const sanitized: string = sanitizeStack(time);
    log("ERROR", message, sanitized)
    write_log('ERROR', message + sanitized)
}

export function debug(message: string, time: string = '') {
    log("DEBUG", message, time)
    write_log('DEBUG', message + time)
}

export function info_container(message: string, submessage: string = '', sep: boolean = false) {
    return container('INFO', message, submessage, sep)
}

export function warn_container(message: string, submessage: string = '', sep: boolean = false) {
    return container('WARN', message, submessage, sep)
}

export function debug_container(message: string, submessage: string = '', sep: boolean = false) {
    return container('DEBUG', message, submessage, sep)
}

export function error_container(message: string, submessage: string = '', sep: boolean = false) {
    return container('ERROR', message, submessage, sep)
}

export async function info_log(client: Client, interaction: Interaction, message: string, submessage?: string) {
    return await channel_log(client, interaction, 'INFO', message, submessage)
}

export async function warn_log(client: Client, interaction: Interaction, message: string, submessage?: string) {
    return await channel_log(client, interaction, 'WARN', message, submessage)
}

export async function debug_log(client: Client, interaction: Interaction, message: string, submessage?: string) {
    return await channel_log(client, interaction, 'DEBUG', message, submessage)
}

export async function error_log(client: Client, interaction: Interaction, message: string, submessage?: string) {
    return await channel_log(client, interaction, 'ERROR', message, submessage)
}

export async function checkConfig() {
    const config = await import(`../config.js?update=${Date.now()}`);
    let foundDisabled = false;
    let disabled = [];
    let foundLogsKey = false;

    for (const [key, value] of Object.entries(config)) {
        if (typeof value === "object" && value !== null && "isEnabled" in value) {
            if (!(value as { isEnabled: boolean }).isEnabled) {
                disabled.push(key)
                foundDisabled = true;
            }
        }

        if (key === 'LogsWebhook' && value === '') {
            warn("WebHook for logging not provided, skipping.");
        }
        if (key === 'LogsChannel' && value === '') {
            warn("Channel for logging not provided, there will be no logs.");
        }

        if (key === 'LogsChannel' || key === 'LogsWebhook') {
            foundLogsKey = true;
        }
    }

    if (!foundLogsKey) {
        warn("No LogsChannel or LogsWebhook found in config.");
    }
    if (disabled.length) {
        warn(`${disabled.join(', ')} is disabled in config.`)
    }

    return !foundDisabled;
}

export default {
    info,
    warn,
    error,
    debug,
    info_container,
    warn_container,
    debug_container,
    error_container,
    info_log,
    warn_log,
    debug_log,
    error_log,
    checkConfig,
    stackify,
    sanitizeStack
}