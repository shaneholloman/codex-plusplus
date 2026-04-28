export interface DiskStorage {
    get<T>(key: string, defaultValue?: T): T;
    set(key: string, value: unknown): void;
    delete(key: string): void;
    all(): Record<string, unknown>;
    flush(): void;
}
export declare function createDiskStorage(rootDir: string, id: string): DiskStorage;
