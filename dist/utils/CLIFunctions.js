import fs from 'fs';
import https from 'https';
import path from 'path';
import readline from 'readline';
import pc from 'picocolors';
import { performance } from 'perf_hooks';
const WORD_RE = /^[a-z]+$/;
// ------ Utility Funcs ------ //
function MergerReformat(source) {
    try {
        if (source.startsWith('http')) {
            const u = new URL(source);
            const parts = u.pathname.split('/').filter(Boolean);
            return `${pc.blueBright(pc.bold(parts[0]))} ${pc.dim('→')} ${pc.blue(parts.at(-1))}`;
        }
        return pc.greenBright(pc.bold(path.basename(source)));
    }
    catch {
        return source;
    }
}
function MergerStreamHTTP(url, onLine) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            const rl = readline.createInterface({ input: res });
            rl.on('line', onLine);
            rl.on('close', resolve);
        }).on('error', reject);
    });
}
function MergerStreamFile(file, onLine) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: fs.createReadStream(file),
            crlfDelay: Infinity
        });
        rl.on('line', onLine);
        rl.on('close', resolve);
    });
}
/* ----------------------------- MERGE ----------------------------- */
export async function Merge(overrideMain) {
    const allWords = new Set();
    const fileStats = [];
    let { fileToOverwrite, Sources } = await import(`../config.js?update=${Date.now()}`);
    if (fileToOverwrite !== './words/main.txt' && overrideMain) {
        fileToOverwrite = './words/main.txt';
    }
    const start = performance.now();
    let linesProcessed = 0;
    for (const source of Sources) {
        const before = allWords.size;
        let lines = 0;
        const handleLine = (line) => {
            lines++;
            linesProcessed++;
            const lw = line.toLowerCase().trim();
            if (!lw || !WORD_RE.test(lw))
                return;
            allWords.add(lw);
        };
        try {
            if (source.startsWith('http')) {
                await MergerStreamHTTP(source, handleLine);
            }
            else {
                await MergerStreamFile(source, handleLine);
            }
            fileStats.push({
                url: MergerReformat(source),
                count: lines,
                newWords: allWords.size - before
            });
        }
        catch (err) {
            console.error(`❌ Failed to process ${source}:`, err);
        }
    }
    const finalWords = Array.from(allWords).sort();
    fs.writeFileSync(fileToOverwrite, finalWords.join('\n'), 'utf8');
    for (const stat of fileStats) {
        console.log(pc.dim('• ') +
            stat.url +
            pc.dim(`: Total ${stat.count.toLocaleString()} | `) +
            pc.yellow(`Added ${stat.newWords.toLocaleString()}`));
    }
    const end = performance.now();
    console.log(pc.dim(`\nDone in ${((end - start) / 1000).toFixed(2)}s`));
    console.log(pc.dim(`${linesProcessed.toLocaleString()} lines processed`));
    console.log(pc.yellow(pc.bold(`Total unique words: ${finalWords.length.toLocaleString()}`)), pc.italic(pc.dim(`| written to ${fileToOverwrite}`)));
}
export default { Merge };
