/* | :: cli.ts
 * - CLI System (Minimalized)
 * - For: Zedtrn V2
 * - By: Ian
 *
 * - Features:
 * | - Hot Reload
 * | - Automatic Build (tsc)
 * | - CLI Restart (update)
 * | - File Watcher
 * | - Dictionary Merger (merge)
 */
import { pathToFileURL } from "url";
import readline from "readline";
import spawn from "cross-spawn";
import path from "path";
import logger from "./utils/Logger.js";
import pc from "picocolors";
import CLIState from './utils/cache/CLIState.js';
import chokidar from "chokidar";
import { execSync } from "child_process";
let rl = null;
let client = null;
let watcher = null;
const fileChanges = new Map();
let lastMessageFile = null;
// ------ Utils ------ //
function cls() {
    const cmd = process.platform === "win32" ? "cls" : "clear";
    execSync(cmd, { stdio: "inherit" });
}
export async function reloadBot() {
    if (client) {
        client.destroy();
        client = null;
    }
    const entryPath = path.resolve("./dist/index.js");
    const entryUrl = pathToFileURL(entryPath).href;
    const module = await import(`${entryUrl}?update=${Date.now()}`);
    if (module.startBot) {
        client = await module.startBot();
    }
    else {
        logger.error("Bot Starter not exported from entry path.");
    }
}
async function buildAndReload() {
    return new Promise((resolve) => {
        const tsc = spawn("npx", ["tsc"], { stdio: "inherit" });
        tsc.on("close", async (code) => {
            if (code === 0) {
                logger.info("Build completed, restarting bot...");
                await reloadBot();
            }
            else {
                logger.error(`tsc failed with code ${code}`);
            }
            resolve();
        });
        tsc.on("error", (err) => {
            logger.error("Failed to start tsc process:", err);
            resolve();
        });
    });
}
function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}
function startWatcher() {
    if (watcher)
        return;
    const State = CLIState.getInstance();
    watcher = chokidar.watch(path.resolve("./src"), {
        ignoreInitial: true,
        persistent: true,
    });
    const debounceReload = debounce((_event, filePath) => {
        const fileName = path.basename(filePath);
        if (fileName.endsWith(".log"))
            return;
        if (lastMessageFile && lastMessageFile !== fileName) {
            fileChanges.clear();
        }
        const count = (fileChanges.get(fileName) || 0) + 1;
        fileChanges.set(fileName, count);
        let message;
        let isManual = false;
        const countText = count > 1 ? ` [${count}x]` : "";
        if (["cli.ts", "main.ts"].includes(fileName)) {
            message = `Modified ${pc.dim(fileName)} — Manual restart required.`;
            isManual = true;
            State.setCLIState(false);
        }
        else {
            message = `Modified ${pc.dim(fileName)} — Type "${pc.cyan("update")}" to apply changes.`;
            State.setCLIState(false);
        }
        if (lastMessageFile === fileName && !State.getCLIState()) {
            process.stdout.write("\u001b[1A");
            process.stdout.write("\u001b[2K");
        }
        State.setCLIState(true);
        isManual ? logger.warn(message, countText) : logger.info(message, countText);
        lastMessageFile = fileName;
    }, 500);
    watcher.on("all", debounceReload);
}
export function CLI() {
    if (rl)
        return;
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "",
    });
    rl.prompt();
    startWatcher();
    rl.on("line", async (line) => {
        const input = line.trim().toLowerCase();
        // -- Help
        if (input.includes("help")) {
            const commands = {
                "help": "Show commands",
                "clear": "Clear console",
                "update": "Build and reload bot",
                "merge [force]": "Merge dictionaries",
                "logs fix (type) [number]": "Fix logs (types: error, debug, warn)"
            };
            console.log(pc.gray("COMMANDS"));
            const longestCmd = Math.max(...Object.keys(commands).map(c => c.length));
            let longestWidth = 0;
            for (const [cmd, desc] of Object.entries(commands)) {
                const padded = cmd.padEnd(longestCmd, " ");
                const fullLine = `  ${padded}  ${desc}`;
                longestWidth = Math.max(longestWidth, fullLine.length);
                console.log(pc.cyan("  " + padded) + pc.dim("  " + desc));
            }
            const legend = "[]: Optional | (): Required";
            const padding = Math.max(0, Math.floor((longestWidth - legend.length) / 2));
            console.log("\n" + " ".repeat(padding) + pc.dim(legend));
            return;
        }
        // -- Clear
        if (input === "clear" || input === "clr") {
            cls();
            return;
        }
        // -- Update
        if (input.startsWith("update") || input.startsWith("up")) {
            console.log(pc.gray("Updating..."));
            if (watcher) {
                await watcher.close();
                watcher = null;
            }
            await buildAndReload();
            return startWatcher();
        }
        // -- Merger
        if (input.startsWith("merge")) {
            console.log(pc.gray("Merging..."));
            if (watcher) {
                await watcher.close();
                watcher = null;
            }
            const funcs = await import(`./utils/CLIFunctions.js?update=${Date.now()}`);
            const parts = input.split(" ");
            if (parts[1] === "force") {
                await funcs.Merge(true);
                await buildAndReload();
            }
            else {
                await funcs.Merge();
            }
            return startWatcher();
        }
        if (input.startsWith("logs fix")) {
            console.log(pc.gray("Fixing logs..."));
            if (watcher) {
                await watcher.close();
                watcher = null;
            }
            const funcs = await import(`./utils/CLIFunctions.js?update=${Date.now()}`);
            const parts = input.split(" ");
            if (parts[2] === "force") {
                await funcs.Merge(true);
                await buildAndReload();
            }
            else {
                await funcs.Merge();
            }
            return startWatcher();
        }
        rl?.prompt();
    });
}
