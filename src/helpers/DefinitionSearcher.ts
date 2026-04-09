import fs from "fs";
import path from "path";
import Cache from "../utils/cache/DefinitionsCache.js";
import picocolors from "picocolors";

function sentenceCase(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function fetchJSON(url: string) {
    try {
        const r = await fetch(url);
        return r.ok ? r.json() : null;
    } catch {
        return null;
    }
}

const noDefCache = new Set<string>();
if (fs.existsSync('./no-definition-words.txt')) {
    for (const line of fs.readFileSync('./no-definition-words.txt', "utf8").split(/\r?\n/)) {
        if (line.trim()) noDefCache.add(line.trim().toLowerCase());
    }
}

function addNoDefWord(word: string) {
    word = word.toLowerCase();
    if (!noDefCache.has(word)) {
        fs.appendFileSync('./no-definition-words.txt', word + "\n", "utf8");
        noDefCache.add(word);
    }
}

export async function getDefinition(word: string) {
    const start = performance.now();
    const lower = word.toLowerCase();
    const cache = Cache.getInstance();

    const cached = cache.get(lower);
    if (cached) return cached;
    if (noDefCache.has(lower)) return null;

    const dictData = await fetchJSON(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${lower}`
    );

    if (dictData?.length) {
        const phonetics = dictData[0].phonetics ?? [];
        const phonetic =
            phonetics.find((p: any) => p.audio) ?? phonetics[0] ?? null;

        const result = {
            word: lower,
            phonetics: phonetic
                ? { text: phonetic.text, audio: phonetic.audio }
                : null,
            source: "DictionaryAPI",
            meanings: dictData[0].meanings.map((m: any) => ({
                partOfSpeech: sentenceCase(m.partOfSpeech),
                definitions: m.definitions.map((d: any) => d.definition),
            })),
        };

        cache.set(lower, result);
        console.log(`${lower}: ${(performance.now() - start).toFixed(2)}ms`);
        return result;
    }

    // Try FreeDictionaryAPI
    const freeDictData = await fetchJSON(
        `https://freedictionaryapi.com/api/v1/entries/en/${lower}`
    );

    if (freeDictData?.entries?.length) {
        const entries = freeDictData.entries;

        let chosenPron = null;
        for (const entry of entries) {
            chosenPron =
                entry.pronunciations?.find(
                    (p: any) =>
                        p.type === "ipa" &&
                        p.tags?.some((t: any) =>
                            ["US", "General Australian", "Canada"].includes(t)
                        )
                ) ?? entry.pronunciations?.[0] ?? null;
            if (chosenPron) break;
        }

        const result = {
            word: lower,
            phonetics: chosenPron ? { text: chosenPron.text, audio: null } : null,
            source: "FreeDictionaryAPI",
            meanings: entries.map((entry: any) => ({
                partOfSpeech: sentenceCase(entry.partOfSpeech),
                definitions: entry.senses.map((s: any) => s.definition),
            })),
        };

        cache.set(lower, result);
        console.log(`${lower}: ${(performance.now() - start).toFixed(2)}ms`);
        return result;
    }

    // Try WikiCheck + AI fallback
//     const wikiCheck = await fetchJSON(
//         `https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=${lower}`
//     );

//     if (wikiCheck?.query?.pages) {
//         const page = Object.values(wikiCheck.query.pages)[0] as any;
//         if (page?.extract) {
//             const AIData = await fetch('https://api.aquadevs.com/v1/chat/completions', {
//                 method: 'POST',
//                 headers: {
//                     'Authorization': 'Bearer aqua_sk_51447afdb52b405ba4549f1e7a5ef8ff',
//                     'Content-Type': 'application/json'
//                 },
//                 body: JSON.stringify({
//                     model: 'nova', // grok - nova
//                     messages: [
//                         {
//                             role: 'user',
//                             content: `
// Define the word "${lower}" in 1-3 concise sentences.
// Include its part of speech and phonetic pronunciation.
// Prefix your response EXACTLY like this:
// [POS: <partOfSpeech>] [PHONETIC: /phonetic/]
// `
//                         }
//                     ]
//                 })
//             });
//             if (!AIData.ok) {
//                 addNoDefWord(lower);

//                 return null;
//             }
//             const AIJson = await AIData.json();
//             const aiResponse = AIJson.message ?? null;
//             if (!aiResponse) {
//                 addNoDefWord(lower);
//                 return null;
//             }

//             const posMatch = aiResponse.match(/\[POS:\s*(.+?)\]/i);
//             const phoneticMatch = aiResponse.match(/\[PHONETIC:\s*(.+?)\]/i);
//             const partOfSpeech = posMatch ? sentenceCase(posMatch[1].trim()) : "Unknown";
//             const phonetic = phoneticMatch ? phoneticMatch[1].trim() : null;
//             const definitionText = aiResponse
//                 .replace(/\[POS:\s*.+?\]/i, '')
//                 .replace(/\[PHONETIC:\s*.+?\]/i, '')
//                 .trim();

//             const result = {
//                 word: lower,
//                 phonetics: phonetic ? { text: phonetic } : null,
//                 source: "Wikipedia + AI | This definition may be inaccurate.",
//                 meanings: [
//                     {
//                         partOfSpeech,
//                         definitions: [definitionText],
//                     },
//                 ],
//             };

//             cache.set(lower, result);
//             console.log(`${lower}: ${(performance.now() - start).toFixed(2)}ms`);
//             return result;
//         }
//     }

    addNoDefWord(lower);
    console.log(picocolors.dim(`${lower}: ${(performance.now() - start).toFixed(2)}ms (no definition)`));
    return null;

}

export default { getDefinition };