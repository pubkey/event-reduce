import { ChangeEvent } from './change-event.js';
export * from './change-event.js';
export * from './mongo.js';

export type WriteOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export type ResultKeyDocumentMap<DocType> = Map<string, DocType>;

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
    primaryKey: string;
    sortFields: string[];
    skip?: number;
    limit?: number;
    queryMatcher: QueryMatcher<DocType>;
    sortComparator: DeterministicSortComparator<DocType>;
}

export type QueryMatcher<DocType> = (doc: DocType) => boolean;

/**
 * To have a deterministic sorting, we cannot return 0,
 * we only return 1 or -1.
 * This ensures that we always end with the same output array, no mather of the
 * pre-sorting of the input array.
 */
export type DeterministicSortComparator<DocType> = (a: DocType, b: DocType) => 1 | -1;

/**
 * A map contains a stateSet as key and an ActionName as value
 * State-sets that are not in the Map have 'runFullQueryAgain' as value
 *
 * The key is a binary-representation of the ordered state-list
 * like '010110110111...'
 * where the first '0' means that the first state (hasLimit) is false
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
interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> { }
export type DeepReadonlyObject<T> = {
    readonly [P in keyof T]: DeepReadonly<T[P]>;
};
