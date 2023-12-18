import type { Collection } from '.';
import type { DeterministicSortComparator, MongoQuery } from '../../types';
import { getSortFieldsOfQuery } from '../../util.js';
import type { Human } from '../types';
import { Query } from 'mingo';
import {
    compare as mingoSortComparator
} from 'mingo/util';
import {
    getProperty
} from '../../util.js';

export function mingoCollectionCreator(): Collection {
    const data: Human[] = [];
    const collection: Collection = {
        upsert(docData) {
            this.remove(docData._id);
            data.push(docData);
        },
        remove(docId: string) {
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                if (item._id === docId) {
                    data.splice(i, 1);
                    break;
                }
            }
        },
        getQueryParams(query) {
            const queryInstance = new Query(query.selector);
            return {
                primaryKey: '_id',
                skip: query.skip ? query.skip : undefined,
                limit: query.limit ? query.limit : undefined,
                queryMatcher: d => queryInstance.test(d),
                sortFields: getSortFieldsOfQuery(query),
                sortComparator: getMingoSortComparator(query)
            };
        },
        query(query) {
            const queryInstance = new Query(query.selector);
            const queryParams = this.getQueryParams(query);
            const skip = query.skip ? query.skip : 0;
            const limit = query.limit ? query.limit : Infinity;
            const skipPlusLimit = skip + limit;

            let rows = data
                .filter(d => queryInstance.test(d))
                .sort(queryParams.sortComparator);

            rows = rows.slice(skip, skipPlusLimit);
            return rows;
        }

    };
    return collection;
}


export function getMingoSortComparator<DocType>(
    query: MongoQuery<DocType>
): DeterministicSortComparator<DocType> {
    if (!query.sort) {
        throw new Error('no sort given');
    }
    const sortParts: {
        key: string;
        direction: 'asc' | 'desc';
        getValueFn: (obj: any) => any
    }[] = [];
    query.sort.forEach((key: string) => {
        const direction = key.startsWith('-') ? 'desc' : 'asc';
        sortParts.push({
            key,
            direction: direction,
            getValueFn: (obj: DocType) => getProperty(obj, key)
        });
    });
    const fun: DeterministicSortComparator<DocType> = (a: DocType, b: DocType) => {
        for (let i = 0; i < sortParts.length; ++i) {
            const sortPart = sortParts[i];
            const valueA = sortPart.getValueFn(a);
            const valueB = sortPart.getValueFn(b);
            if (valueA !== valueB) {
                const ret = sortPart.direction === 'asc' ? mingoSortComparator(valueA, valueB) : mingoSortComparator(valueB, valueA);
                return ret as any;
            }
        }
    };

    return fun;
}
