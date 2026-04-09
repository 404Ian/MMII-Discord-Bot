import {
    Client,
    Events,
    ContainerBuilder,
    Message,
    MessageFlags,
    ButtonStyle,
    ButtonBuilder,
    Interaction,
    ButtonInteraction
} from "discord.js";
import logger from "../utils/Logger.js";
import PendingCache from "../utils/cache/PendingCache.js";

async function BuildContainer(interaction: ButtonInteraction | Message, type: string, page: number | string, additions: string[], removals: string[]) {
    let nextType: "addition" | "removal" | "all";
    let buttonLabel: string;

    console.log(type, page)
    if (type === "all") {
        nextType = "addition";
        buttonLabel = "+";
    } else if (type === "addition") {
        nextType = "removal";
        buttonLabel = "-";
    } else {
        nextType = "all";
        buttonLabel = "a";
    }

    const allWords =
        type === "all"
            ? [...additions.map(w => `+ ${w}`), ...removals.map(w => `- ${w}`)]
            : type === "addition"
                ? additions.map(w => `+ ${w}`)
                : removals.map(w => `- ${w}`);

    const pageData = await paginate(allWords, page);
    const content =
        pageData.data.length > 0
            ? pageData.data.join("\n")
            : "> No pending words.";
    const userId = interaction instanceof ButtonInteraction
        ? interaction.user.id
        : interaction.author.id;

    const container = new ContainerBuilder()
        .addTextDisplayComponents(t =>
            t.setContent(`### Pending Words (${type === "all" ? "Additions & Removals" : type === "addition" ? "Additions" : "Removals"})`)
        )
        .addSeparatorComponents(sep => sep)
        .addTextDisplayComponents(t =>
            t.setContent(!content.startsWith(">") ? `\`\`\`diff\n${content}\`\`\`` : content)
        )
        .addSeparatorComponents(sep => sep)
        .addTextDisplayComponents(t =>
            t.setContent(`-# Page ${pageData.page} of ${pageData.totalPages}`)
        );

    return container.addActionRowComponents(row =>
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`cmd-page|${type}|first|${userId}`)
                .setLabel("<<")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pageData.page === 1),
            new ButtonBuilder()
                .setCustomId(`cmd-page|${type}|prev|${pageData.page}|${userId}`)
                .setLabel("<")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pageData.page === 1),
            new ButtonBuilder()
                .setCustomId(`cmd-type|${nextType}|${pageData.page}|${userId}`)
                .setLabel(buttonLabel)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`cmd-page|${type}|next|${pageData.page}|${userId}`)
                .setLabel(">")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pageData.page === pageData.totalPages),
            new ButtonBuilder()
                .setCustomId(`cmd-page|${type}|last|${userId}`)
                .setLabel(">>")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pageData.page === pageData.totalPages)
        )
    );
}

async function paginate(words: string[], page: number | string) {
    const { default: config } = await import(`../config.js?update=${Date.now()}`);
    const totalPages = Math.max(1, Math.ceil(words.length / config.wordsPerPage));
    let currentPage: number;

    if (page === "first") currentPage = 1;
    else if (page === "last") currentPage = totalPages;
    else currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);

    const start = (currentPage - 1) * config.wordsPerPage;
    return {
        page: currentPage,
        totalPages,
        data: words.slice(start, start + config.wordsPerPage)
    };
}

export async function handlePageInteraction(interaction: ButtonInteraction, type: string, page: number | "first" | "last") {

    const pendingCache = PendingCache.getInstance();

    const additions = Object.keys(pendingCache.getByType("addition") || {});
    const removals = Object.keys(pendingCache.getByType("removal") || {});
    const container = await BuildContainer(interaction, type, page, additions, removals);

    return interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2
    });
}

export async function handleTypeInteraction(interaction: ButtonInteraction, type: string, page: number | "first" | "last") {
    return handlePageInteraction(interaction, type, page);
}

export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: Client) {
        if (message.author.bot) return;
        if (message.channel.id !== "1478448857842188368") return;
        if (!message.content.startsWith(".")) return;

        const [command, ...args] = message.content.trim().split(/\s+/);
        const cmd = command.toLowerCase();

        const config = await import(`../config.js?update=${Date.now()}`);
        const pendingCache = PendingCache.getInstance();

        if (cmd === ".ping") {
            const sent = await message.reply("Pinging...");
            const latency = sent.createdTimestamp - message.createdTimestamp;
            return sent.edit(`Pong! Latency: ${latency}ms`);
        }

        if (cmd === ".view") {

            const typeArg = args[0]?.toLowerCase();

            const pageArg =
                args[1] === "first"
                    ? "first"
                    : args[1] === "last"
                        ? "last"
                        : parseInt(args[1]) || 1;

            const type: "addition" | "removal" | "all" =
                typeArg === "add"
                    ? "addition"
                    : typeArg === "remove"
                        ? "removal"
                        : "all";

            const additions = Object.keys(pendingCache.getByType("addition") || {});
            const removals = Object.keys(pendingCache.getByType("removal") || {});

            const allWords =
                type === "all"
                    ? [...additions.map(w => `+ ${w} `), ...removals.map(w => `- ${w} `)]
                    : type === "addition"
                        ? additions
                        : removals;

            const pageData = await paginate(allWords, pageArg);
            const container = await BuildContainer(message, type, pageArg, additions, removals);

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (cmd === ".define" && args.length > 0) {
            const word = args[0].toLowerCase();
            const definitions = await import(`../helpers/DefinitionSearcher.js?update=${Date.now()}`);
            const def = await definitions.getDefinition(word);

            if (!def) {
                return message.reply({
                    components: [logger.info_container(`### No definition found for "${word}".`, "This word may be archaic, or regional.", true)],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            const phonetic = def.phonetics?.text ?? "";
            const content = def.meanings
                .slice(0, 3)
                .map((m: any) =>
                    `**${m.partOfSpeech}**\n` +
                    m.definitions.slice(0, 2).map((d: string) => `> ${d}`).join("\n")
                )
                .join("\n");

            const container = new ContainerBuilder()
                .addTextDisplayComponents(t => t.setContent(`### ${def.word} ${phonetic ? "• " + phonetic : ""}`))
                .addSeparatorComponents(sep => sep)
                .addTextDisplayComponents(t => t.setContent(content))
                .addSeparatorComponents(sep => sep)
                .addTextDisplayComponents(t => t.setContent(`-# Source: ${def.source}`));

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        if (cmd === ".clear") {

            if (!message.member?.permissions.has("Administrator")) {
                return message.reply({
                    components: [logger.warn_container("Unauthorized Command", "You do not have permission to use this command.", true)],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            const typeArg = args[0]?.toLowerCase();

            const type: "addition" | "removal" | "all" =
                typeArg === "add"
                    ? "addition"
                    : typeArg === "remove"
                        ? "removal"
                        : "all";

            if (type === "all") {

                pendingCache.getAll().addition = {};
                pendingCache.getAll().removal = {};
                pendingCache["push"]();

                return message.reply({
                    components: [logger.info_container("Pending Cleared", "All pending words have been cleared.")],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            pendingCache.getAll()[type] = {};
            pendingCache["push"]();

            return message.reply({
                components: [logger.info_container("Pending Cleared", `All pending words in "${type}" have been cleared.`)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (cmd === ".del") {

            if (!message.member?.permissions.has("Administrator")) {
                return message.reply({
                    components: [logger.warn_container("Unauthorized Command", "You do not have permission to use this command.", true)],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            const word = args[0]?.toLowerCase();

            if (!word) {
                return message.reply({
                    components: [logger.info_container("Missing Word", "Please specify the word to delete from pending.")],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            if (!pendingCache.has(word)) {
                return message.reply({
                    components: [logger.info_container("Word Not Found", `The word "${word}" does not exist in pending.`)],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            pendingCache.delete(word);

            return message.reply({
                components: [logger.info_container("Word Removed", `The word "${word}" has been removed from pending.`)],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};