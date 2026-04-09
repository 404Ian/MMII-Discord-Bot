import fs from "fs";
import { PendingFile } from "../../config.js";
export default class PendingCache {
    static instance;
    data = {
        addition: {},
        removal: {}
    };
    constructor() {
        if (fs.existsSync(PendingFile)) {
            this.data = JSON.parse(fs.readFileSync(PendingFile, "utf8"));
        }
        else {
            this.push();
        }
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new PendingCache();
        }
        return this.instance;
    }
    push() {
        fs.writeFileSync(PendingFile, JSON.stringify(this.data, null, 2), "utf8");
    }
    has(word) {
        return !!this.data.addition[word] || !!this.data.removal[word];
    }
    get(word) {
        if (this.data.addition[word]) {
            return { type: "addition", value: this.data.addition[word] };
        }
        if (this.data.removal[word]) {
            return { type: "removal", value: this.data.removal[word] };
        }
        return null;
    }
    set(type, word, value) {
        this.data[type][word] = value;
        this.push();
    }
    delete(word) {
        delete this.data.addition[word];
        delete this.data.removal[word];
        this.push();
    }
    getByType(type) {
        return this.data[type];
    }
    add(word, value) {
        this.set("addition", word, value);
    }
    addRemove(word, value) {
        this.set("removal", word, value);
    }
    getAll() {
        return this.data;
    }
}
