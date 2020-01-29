import {
    MemoryDb,
    MinimongoCollection
} from 'minimongo';
import { Human, MongoQuery } from './types';

const COLLECTION_NAME = 'humans';
export function getMinimongoCollection(): MinimongoCollection<Human> {
    const db: MemoryDb = new MemoryDb();
    db.addCollection(COLLECTION_NAME);
    const collection: MinimongoCollection<Human> = db.collections[COLLECTION_NAME];
    return collection;
}

export async function minimongoUpsert<DocType>(
    collection: MinimongoCollection<DocType>,
    doc: DocType
): Promise<void> {
    await new Promise(
        (resolve, reject) => collection.upsert(doc, resolve, reject)
    );
}

export async function minimongoRemove<DocType>(
    collection: MinimongoCollection<DocType>,
    id: string
): Promise<void> {
    await new Promise(
        (resolve, reject) => collection.remove(id, resolve, reject)
    );
}

export async function minimongoFind<DocType>(
    collection: MinimongoCollection<DocType>,
    query: MongoQuery
): Promise<DocType[]> {
    const results: DocType[] = await new Promise(
        (resolve, reject) => collection.find(
            query.selector,
            {
                skip: query.skip ? query.skip : undefined,
                limit: query.limit ? query.limit : undefined
            }
        ).fetch(resolve, reject)
    );
    return results;
}