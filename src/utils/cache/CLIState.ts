export class StateCache {
    private static instance: StateCache;
    private overwrite: boolean | false = false;

    private constructor() {}

    public static getInstance(): StateCache {
        if (!this.instance) {
            this.instance = new StateCache();
        }
        return this.instance;
    }

    public setCLIState(value: boolean) {
        this.overwrite = value;
    }
    public getCLIState(): boolean {
        return this.overwrite;
    }
}

export default StateCache