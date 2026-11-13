import { ChangeEvent } from './change-event.js';
export * from './change-event.js';
export * from './mongo.js';

export type WriteOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * The id of a document, a string or a number.
 * Ids are compared with ===, without any conversion:
 * a string id never equals a number id, so '1' and 1 are two different documents.
 */
export type DocumentId = string | number;

export type ResultKeyDocumentMap<DocType> = Map<DocumentId, DocType>;

export type ActionName =
    'doNothing' |
    'insertFirst' |
    'insertLast' |
    'removeFirstItem' |
    'removeLastItem' |
    'removeFirstInsertLast' |
    'removeLastInsertFirst' |
    'removeFirstInsertFirst' |
    'removeLastInsertLast' |
    'removeExisting' |
    'replaceExisting' |
    'alwaysWrong' | // this should be optimised out by later steps
    'insertAtSortPosition' |
    'removeExistingAndInsertAtSortPosition' |
    'insertAtSortPositionRemoveLast' |
    'insertAtSortPositionRemoveFirst' |
    'runFullQueryAgain' |
    'unknownAction' // if a state was never reached, we do not know the correct action
    ;
export type StateName =
    'hasLimit' |
    'isFindOne' |
    'hasSkip' |
    'isDelete' |
    'isInsert' |
    'isUpdate' |
    'wasResultsEmpty' |
    'wasLimitReached' |
    'sortParamsChanged' |
    'wasInResult' |
    'wasFirst' |
    'wasLast' |
    'wasSortedBeforeFirst' |
    'wasSortedAfterLast' |
    'isSortedAfterLast' |
    'isSortedBeforeFirst' |
    'wasMatching' |
    'doesMatchNow';

export interface QueryParams<DocType> {
    /**
     * Field of the document that contains its id.
     * Not used when getDocumentId is set.
     */
    primaryKey: string;
    /**
     * Returns the id of a document.
     * Use this when the id is not stored in a single top-level field,
     * for example for compound or nested primary keys.
     * Must return the same value as the id of the change events.
     * If not set, document[primaryKey] is used.
     */
    getDocumentId?: (doc: DocType) => DocumentId;
    sortFields: string[];
    skip?: number;
    /**
     * Maximum amount of documents in the results, not set means no limit.
     * Like in SQL, limit 0 means that the query returns no documents.
     * A negative limit throws.
     */
    limit?: number;
    queryMatcher: QueryMatcher<DocType>;
    sortComparator: DeterministicSortComparator<DocType>;
}

export type QueryMatcher<DocType> = (doc: DocType) => boolean;

/**
 * The comparator is not allowed to return 0 for two different documents,
 * it must return a negative or a positive number, also when the sort values are equal.
 * Break ties yourself, for example with the primary key as the last sort field.
 * This ensures that we always end with the same output array, no matter of the
 * pre-sorting of the input array, and that EventReduce sorts like the database.
 * A comparator that returns 0 for two different documents throws EventReduce:CMP_ZERO,
 * because the results would be wrong without anyone noticing.
 */
export type DeterministicSortComparator<DocType> = (a: DocType, b: DocType) => 1 | -1;

/**
 * A map contains a stateSet as key and an ActionName as value
 * State-sets that are not in the Map have 'runFullQueryAgain' as value
 *
 * The key is a binary-representation of the ordered state-list
 * like '010110110111...'
 * where the first '0' means that the first state (isInsert) is false
 */
export type StateSet = string;
export type StateSetToActionMap = Map<StateSet, ActionName>;

export interface StateResolveFunctionInput<DocType> {
    queryParams: QueryParams<DocType>;
    changeEvent: ChangeEvent<DocType>;
    previousResults: DocType[];
    keyDocumentMap?: ResultKeyDocumentMap<DocType>;
}

export type StateResolveFunction<DocType> = (
    input: StateResolveFunctionInput<DocType>
) => boolean;

export type ActionFunctionInput<DocType> = StateResolveFunctionInput<DocType>;

/**
 * for performance-reasons,
 * action-function mutate the input
 */
export type ActionFunction<DocType> = (
    input: ActionFunctionInput<DocType>
) => void;


/**
 * @link https://stackoverflow.com/a/49670389/3443137
 */
type DeepReadonly<T> =
    T extends (infer R)[] ? DeepReadonlyArray<R> :
    T extends Function ? T :
    T extends object ? DeepReadonlyObject<T> :
    T;
type DeepReadonlyArray<T> = ReadonlyArray<DeepReadonly<T>>;
export type DeepReadonlyObject<T> = {
    readonly [P in keyof T]: DeepReadonly<T[P]>;
};
