import { Collection } from '.';
import { DeterministicSortComparator, MongoQuery } from '../../types';
export declare function mingoCollectionCreator(): Collection;
export declare function getMingoSortComparator<DocType>(query: MongoQuery<DocType>): DeterministicSortComparator<DocType>;
