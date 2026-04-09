import fs from "fs";
import { PendingFile } from "../../config.js";

type PendingType = "addition" | "removal";

interface PendingStructure {
    addition: Record<string, string>;
    removal: Record<string, string>;
}

export default class PendingCache {
    private static instance: PendingCache;
    private data: PendingStructure = {
        addition: {},
        removal: {}
    };

    private constructor() {
        if (fs.existsSync(PendingFile)) {
            this.data = JSON.parse(fs.readFileSync(PendingFile, "utf8"));
        } else {
            this.push();
        }
    }

    public static getInstance(): PendingCache {
        if (!this.instance) {
            this.instance = new PendingCache();
        }
        return this.instance;
    }

    private push() {
        fs.writeFileSync(PendingFile, JSON.stringify(this.data, null, 2), "utf8");
    }

    public has(word: string): boolean {
        return !!this.data.addition[word] || !!this.data.removal[word];
    }

    public get(word: string) {
        if (this.data.addition[word]) {
            return { type: "addition", value: this.data.addition[word] };
        }

        if (this.data.removal[word]) {
            return { type: "removal", value: this.data.removal[word] };
        }

        return null;
    }

    public set(type: PendingType, word: string, value: string) {
        this.data[type][word] = value;
        this.push();
    }

    public delete(word: string) {
        delete this.data.addition[word];
        delete this.data.removal[word];
        this.push();
    }

    public getByType(type: PendingType) {
        return this.data[type];
    }

    public add(word: string, value: string) {
        this.set("addition", word, value);
    }

    public addRemove(word: string, value: string) {
        this.set("removal", word, value);
    }

    public getAll() {
        return this.data;
    }
}