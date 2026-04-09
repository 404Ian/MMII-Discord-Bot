import fs from "fs";
import { DefinitionsFile } from "../../config.js";

export default class DefinitionsCache {
    private static instance: DefinitionsCache;
    private cache = new Map<string, any>();

    private constructor() {
        if (fs.existsSync(DefinitionsFile)) {
            const raw = JSON.parse(fs.readFileSync(DefinitionsFile, "utf8"));
            for (const [k, v] of Object.entries(raw)) {
                this.cache.set(k, v);
            }
        }
    }

    public static getInstance(): DefinitionsCache {
        if (!this.instance) {
            this.instance = new DefinitionsCache();
        }
        return this.instance;
    }

    public get(word: string) {
        return this.cache.get(word);
    }

    public set(word: string, data: any) {
        this.cache.set(word, data);
        this.push();
    }

    private push() {
        fs.writeFileSync(DefinitionsFile, JSON.stringify(Object.fromEntries(this.cache), null, 2), "utf8");
    }
}