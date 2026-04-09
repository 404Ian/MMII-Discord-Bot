// :: /events/onMessage.ts
import {
    Events,
    Message,
    Client,
    WebhookClient,
    MessageFlags,
    ContainerBuilder,
    TextChannel,
    ButtonBuilder,
    ButtonStyle,
    InteractionCallback
} from 'discord.js';
import logger from '../utils/Logger.js';
import PendingCache from "../utils/cache/PendingCache.js";

const timeoutMs = 15_000; // 15 seconds

export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: Client) {
        if (message.author.bot) return;
        if (!["1478425188117905528", "1478425167519678504", "1478448857842188368"].includes(message.channel.id)) return;
        if (!message.channel.isTextBased() || !('name' in message.channel)) return;
        if (!/^[a-z]+(?:\s*(?:-|:)\s*[a-z :#-]+|\n-#\s*[a-z :#-]+)$/i.test(message.content)) return;

        const pendingCache = PendingCache.getInstance();
        const config = await import(`../config.js?update=${Date.now()}`);
        const name = message.channel.name || "unk";
        const type = name.includes("add") ? "add" : name.includes("remove") ? "remove" : "unk";
        const separators = ["-#", ":", "-"];
        let separatorIndex = -1;
        let usedSeparator: string | null = null;

        for (const sep of separators) {
            const idx = message.content.indexOf(sep);
            if (idx !== -1) {
                separatorIndex = idx;
                usedSeparator = sep;
                break;
            }
        }

        if (separatorIndex === -1 || !usedSeparator) return;
        let [word, reason] = message.content.split(usedSeparator);
        word = word.trim().toLowerCase();
        reason = reason.trim();

        if (type === "unk") return; // Unknown channel type, ignore
        if (!word) {
            const reply = await message.reply({
                components: [logger.info_container(`Please provide a word.`, `Usage: \`<word>: <reason (optional)>\``)],
                flags: MessageFlags.IsComponentsV2
            });

            setTimeout(() => {
                reply.delete().catch(() => { });
                message.delete().catch(() => { });
            }, timeoutMs);

            return;
        }

        if (reason.length > 500) {
            const reply = await message.reply({
                components: [logger.info_container(`Reason is too long.`, `Please limit the reason to 500 characters.`)],
                flags: MessageFlags.IsComponentsV2
            });

            setTimeout(() => {
                reply.delete().catch(() => { });
                message.delete().catch(() => { });
            }, timeoutMs);
            return;
        }

        // Check if word is already pending
        const existing =
            pendingCache.getByType("addition")?.[word] ||
            pendingCache.getByType("removal")?.[word];

        if (existing) {
            await message.react("❌");
            const pendingTypeFound = pendingCache.getByType("addition")?.[word] ? "addition" : "removal";
            const reply = await message.reply({
                components: [logger.info_container(
                    `Word is already pending for ${pendingTypeFound}.`
                )],
                flags: MessageFlags.IsComponentsV2
            });

            setTimeout(() => {
                reply.delete().catch(() => { });
                message.delete().catch(() => { });
            }, timeoutMs);

            return;
        }

        // Add word to pending cache
        const pendingType = type === "add" ? "addition" : "removal";
        const currentTypeData = pendingCache.getByType(pendingType) || {};
        currentTypeData[word] = JSON.stringify({
            t: Date.now(),
            user: message.author.id,
            msgId: message.id,
            reason
        });
        pendingCache.set(pendingType, word, currentTypeData[word]);

        // Create message container
        const container = new ContainerBuilder()
            .addTextDisplayComponents(t => t.setContent(`### Request to ${type.toLowerCase()} word`))
            .addSeparatorComponents(sep => sep)
            .addTextDisplayComponents(t => t.setContent(`**${word}**\n> ${reason}`))
            .addSeparatorComponents(sep => sep)
            .addTextDisplayComponents(t => t.setContent(`-# **Requested by:** ${message.author.tag} (${message.author.id})`));

        container.addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`approve-${type}|${word}|${message.author.id}`)
                    .setLabel(`✅`)
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`deny-${type}|${word}|${message.author.id}`)
                    .setLabel(`❌`)
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`define-${type}|${word}|${message.author.id}`)
                    .setLabel(`ℹ️`)
                    .setStyle(ButtonStyle.Secondary)
            )
        );

        // Try sending via webhook first
        try {
            const webhookClient = new WebhookClient({ url: type === "add" ? config.AddWebhook : config.RemoveWebhook }) as any;
            try {
                if (webhookClient.name !== `Words to ${type}`) {
                    await webhookClient.edit({ name: `Words to ${type}` }).catch(() => { }); // set name
                }
            } catch { }

            await message.react("⌛");
            await webhookClient.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                withComponents: true
            });

            return;
        } catch {
            // fallback: normal message
        }

        // Fallback
        const channel = client.channels.cache.get(config.WordsChannel) as TextChannel;
        if (!channel) return logger.error(`${type} channel not found in cache.`);

        try {
            await message.react("⌛");
            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (err: any) {
            logger.error(`Failed to send logs to ${type} channel:`, `\n${logger.sanitizeStack(err.stack)}`);
        }
    }
};
