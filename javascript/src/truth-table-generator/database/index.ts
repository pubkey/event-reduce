import { ChangeEvent, MongoQuery, QueryParams } from '../../types';
import { Human } from '../types';

/**
 * Abstract the database so that
 * we can swap it out.
 */
export type CollectionCreator<DocType> = () => Collection;


export interface Collection {
    getQueryParams(query: MongoQuery<Human>): QueryParams<Human>;
    upsert(doc: Human): void;
    remove(docId: string): void;
    query(query: MongoQuery): Human[];
}



export function applyChangeEvent<DocType>(
    collection: Collection,
    changeEvent: ChangeEvent<DocType>
): void {
    switch (changeEvent.operation) {
        case 'INSERT':
            collection.upsert(
                changeEvent.doc as any
            );
            break;
        case 'UPDATE':
            collection.upsert(
                changeEvent.doc as any
            );
            break;
        case 'DELETE':
            collection.remove(
                changeEvent.id
            );
            break;
    }
}
