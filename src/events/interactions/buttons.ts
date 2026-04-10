// :: /events/interactionCreate.ts
import {
    ButtonInteraction,
    Events,
    MessageFlags,
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle
} from "discord.js";
import logger from "../../utils/Logger.js";
import config from "../../config.js";
import PendingCache from "../../utils/cache/PendingCache.js";
import DefinitionsCache from "../../utils/cache/DefinitionsCache.js";
import fs from "fs";
import path from "path";

export default {
    name: Events.InteractionCreate,
    async execute(interaction: ButtonInteraction) {
        if (!interaction.isButton()) return;
        if (!config.Owner_IDS.includes(interaction.user.id)) {
            return interaction.reply({
                components: [logger.warn_container("Unauthorized Interaction", "You do not have permission to use this button.", true)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
        }
        try {
            const { customId } = interaction;
            if (customId.startsWith('define')) {
                const [action, word] = customId.split("|");
                const type = action.includes("add") ? "add" : "remove";

                const definitions = await import(`../../helpers/DefinitionSearcher.js?update=${Date.now()}`)
                const def = await definitions.getDefinition(word);

                if (!def) {
                    return interaction.reply({
                        components: [logger.info_container(`### No definition found for "${word}".`, 'This word may be archaic, or regional.', true)],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                    });
                }

                const phonetic = def.phonetics?.text ?? '';
                const content = def.meanings
                    .slice(0, 3)
                    .map((m: any) =>
                        `**${m.partOfSpeech}**\n` +
                        m.definitions.slice(0, 2).map((d: string) => `> ${d}`).join("\n")
                    )
                    .join("\n");

                const container = new ContainerBuilder()
                    .addTextDisplayComponents(t => t.setContent(`### ${def.word} ${phonetic ? '• ' + phonetic : ''}`))
                    .addSeparatorComponents(sep => sep)
                    .addTextDisplayComponents(t => t.setContent(content))
                    .addSeparatorComponents(sep => sep)
                    .addTextDisplayComponents(t => t.setContent(`-# Source: ${def.source}`));

                return interaction.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                });

            }

            if (customId.startsWith('approve') || customId.startsWith('deny')) {
                const [action, word] = customId.split("|");
                const pendingCache = PendingCache.getInstance();
                const type = action.includes("add") ? "add" : "remove";
                const pendingType = type === "add" ? "addition" : "removal";

                const args = customId.split("|");
                const userId = args[args.length - 1];

                if (userId !== interaction.user.id) {
                    return interaction.reply({
                        components: [logger.info_container('This interaction is not for you.')],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                    });
                }

                const pending = pendingCache.get(word);
                if (!pending) {
                    return interaction.reply({
                        content: `❌ **${word}** is not pending any action.`,
                        ephemeral: true
                    });
                }

                const data = JSON.parse(pending.value)
                const msgId = data.msgId;

                const dictPath = path.resolve("./dict_v3.txt");
                let dictionary: string[] = [];
                if (fs.existsSync(dictPath)) {
                    dictionary = fs.readFileSync(dictPath, "utf8")
                        .split(/\r?\n/)
                        .map(w => w.trim())
                        .filter(Boolean);
                }

                if (customId.startsWith('approve') || customId.startsWith('deny')) {
                const args = customId.split("|");
                const action = args[0];
                const word = args[1];
                const userId = args[args.length - 1];
                const type = action.includes("add") ? "add" : "remove";
                const pendingType = type === "add" ? "addition" : "removal";
                if (userId !== interaction.user.id) {
                    return interaction.reply({
                        components: [logger.info_container('This interaction is not for you.')],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                    });
                }

                const pendingCache = PendingCache.getInstance();
                const pending = pendingCache.get(word);

                if (!pending) {
                    return interaction.reply({
                        content: `❌ **${word}** is not pending any action.`,
                        ephemeral: true
                    });
                }

                const data = JSON.parse(pending.value);
                const msgId = data.msgId;
                const channelId = type === "add" ? config.AddChannel : config.RemoveChannel;

                async function reactToOriginal(emoji: string) {
                    if (!msgId) {console.log("Returning early: msgId is falsy"); return;}
                    try {
                        const targetChannel = await interaction.client.channels.fetch(channelId);

                        if (targetChannel && targetChannel.isTextBased()) {
                            const msg = await targetChannel.messages.fetch(msgId);
                            await msg.reactions.removeAll().catch(() => { });
                            await msg.react(emoji);
                        }
                    } catch (err) {
                        console.log("Failed to fetch/react message:", err);
                    }
                }

                // Load dictionary
                let dictionary: string[] = [];
                if (fs.existsSync(config.DictionaryFile)) {
                    dictionary = fs.readFileSync(config.DictionaryFile, "utf8")
                        .split(/\r?\n/)
                        .map(w => w.trim())
                        .filter(Boolean);
                }

                if (action.startsWith('approve')) {
                    if (type === 'add') {
                        await reactToOriginal("✅");
                        if (!dictionary.includes(word)) dictionary.push(word);
                    } else {
                        await reactToOriginal("✅");
                        dictionary = dictionary.filter(w => w.toLowerCase() !== word.toLowerCase());
                    }

                    fs.writeFileSync(config.DictionaryFile, dictionary.join("\n"), "utf8");
                    pendingCache.delete(word);
                    return interaction.update({
                        components: [logger.info_container(`✅ **${word}** has been approved for ${pendingType}.`, `Accepted by ${interaction.user.tag}.`, true)],
                        flags: MessageFlags.IsComponentsV2
                    });
                }

                if (action.startsWith('deny')) {
                    pendingCache.delete(word);
                    await reactToOriginal("❌");
                    return interaction.update({
                        components: [logger.info_container(`❌ **${word}** has been denied.`, `Denied by ${interaction.user.tag}.`, true)],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }

            if (customId.startsWith("cmd-")) {
                const [str, type, page, userId] = customId.split("|");
                const cmd = str.slice(4);
                const cmds = await import(`../msgCommands.js?update=${Date.now()}`);

                if (customId) {
                    const args = customId.split("|");
                    const userId = args[args.length - 1];

                    if (userId !== interaction.user.id) {
                        return interaction.reply({
                            components: [logger.info_container('This interaction is not for you.')],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                        });
                    }
                }

                if (cmd.startsWith("page")) {
                    const [, type, action, currentPage] = customId.split("|");
                    let page;
                    if (action === "first") page = "first";
                    else if (action === "last") page = "last";
                    else if (action === "prev") page = Number(currentPage) - 1;
                    else if (action === "next") page = Number(currentPage) + 1;

                    return cmds.handlePageInteraction(interaction, type, page);
                }

                if (cmd.startsWith('type')) {
                    const [, type] = customId.split("|");
                    return cmds.handleTypeInteraction(interaction, type);
                }
            }

            logger.warn(`Unhandled button interaction: ${customId}`);
            return interaction.reply({
                components: [logger.warn_container("Unable to handle this button interaction.", "This button has no response yet, please try again later.")],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        } catch (err: any) {
            logger.error("Unable to handle button interaction.", err.stack);
            logger.error_log(interaction.client, interaction, 'Unable to handle button interaaction.')

            if (interaction.deferred || interaction.replied) {
                return interaction.followUp({
                    components: [logger.error_container('An error occured while handling this button interaction.', 'Please try again later.', true)],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            } else {
                return interaction.reply({
                    components: [logger.error_container('An error occured while handling this button interaction.', 'Please try again later.', true)],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }
        }
    }
};
