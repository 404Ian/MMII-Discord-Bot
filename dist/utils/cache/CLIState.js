export class StateCache {
    static instance;
    overwrite = false;
    constructor() { }
    static getInstance() {
        if (!this.instance) {
            this.instance = new StateCache();
        }
        return this.instance;
    }
    setCLIState(value) {
        this.overwrite = value;
    }
    getCLIState() {
        return this.overwrite;
    }
}
export default StateCache;
