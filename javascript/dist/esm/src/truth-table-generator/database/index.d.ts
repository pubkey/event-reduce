import type { ChangeEvent, MongoQuery, QueryParams } from '../../types';
export * from './mingo.js';
/**
 * Abstract the database so that
 * we can swap it out.
 */
export type CollectionCreator<DocType> = () => Collection;
export interface Collection {
    getQueryParams(query: MongoQuery<any>): QueryParams<any>;
    upsert(doc: any): void;
    remove(docId: string): void;
    query(query: MongoQuery): any[];
}
export declare function applyChangeEvent<DocType>(collection: Collection, changeEvent: ChangeEvent<DocType>): void;
