// TODO firestore cannot be used offline-only
// and therefore it does not make much sense to test it here

/*
import * as firebase from 'firebase/app';
import 'firebase/firestore';
import { DatabaseImplementation, FirestoreQuery, Human } from './types';
import { ChangeEvent } from 'event-reduce-js';
import { performanceNow } from 'async-test-util';

export class FirestoreImplementation implements DatabaseImplementation<FirestoreQuery> {
    private db: firebase.firestore.Firestore;
    private col: firebase.firestore.CollectionReference;

    getName() {
        return 'firestore';
    }

    getStorageOptions() {
        return [
            'indexeddb',
            'memory'
        ];
    }

    async init(storageOption: string) {
        firebase.initializeApp({
        });
        // DB = firebase.database();
        this.db = firebase.firestore();
        if (storageOption === 'indexeddb') {
            await firebase.firestore().enablePersistence();
        }
        await firebase.firestore().disableNetwork();
        this.col = this.db.collection('docs');
    }

    getExampleQueries(): FirestoreQuery[] {
        return [
            [{
                field: 'age',
                op: '>',
                value: 18
            }]
        ];
    }
    async getRawResults(query: FirestoreQuery): Promise<Human[]> {
        let current: any = this.col;
        for (const part of query) {
            current = current.where(part.field, part.op, part.value);
        }
        const results = await current.get();
        console.dir(results);
        return results.docs as any;
    }
    getQueryParams() {
        return {} as any;
    }
    async getAll(): Promise<Human[]> {
        const docs = await this.col.where('age', '>=', 0).get();
        return docs.docs as any;
    }
    async handleEvent(changeEvent: ChangeEvent<Human>): Promise<number> {
        const startTime = performanceNow();
        return null as any;
    }
}

*/
