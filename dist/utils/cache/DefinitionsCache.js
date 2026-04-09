import fs from "fs";
import { DefinitionsFile } from "../../config.js";
export default class DefinitionsCache {
    static instance;
    cache = new Map();
    constructor() {
        if (fs.existsSync(DefinitionsFile)) {
            const raw = JSON.parse(fs.readFileSync(DefinitionsFile, "utf8"));
            for (const [k, v] of Object.entries(raw)) {
                this.cache.set(k, v);
            }
        }
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new DefinitionsCache();
        }
        return this.instance;
    }
    get(word) {
        return this.cache.get(word);
    }
    set(word, data) {
        this.cache.set(word, data);
        this.push();
    }
    push() {
        fs.writeFileSync(DefinitionsFile, JSON.stringify(Object.fromEntries(this.cache), null, 2), "utf8");
    }
}
