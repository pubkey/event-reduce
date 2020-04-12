import type { ChangeEvent } from './change-event';
export * from './change-event';
export * from './mongo';
export declare type WriteOperation = 'INSERT' | 'UPDATE' | 'DELETE';
export declare type UNKNOWN = 'UNKNOWN';
export declare type ResultKeyDocumentMap<DocType> = Map<string, DocType>;
export declare type ActionName = 'doNothing' | 'insertFirst' | 'insertLast' | 'removeFirstItem' | 'removeLastItem' | 'removeFirstInsertLast' | 'removeLastInsertFirst' | 'removeExisting' | 'replaceExisting' | 'alwaysWrong' | // this should be optimised out by later steps
'insertAtSortPosition' | 'removeExistingAndInsertAtSortPosition' | 'runFullQueryAgain' | 'unknownAction';
export declare type StateName = 'hasLimit' | 'isFindOne' | 'hasSkip' | 'isDelete' | 'isInsert' | 'isUpdate' | 'wasResultsEmpty' | 'previousUnknown' | 'wasLimitReached' | 'sortParamsChanged' | 'wasInResult' | 'wasSortedBeforeFirst' | 'wasSortedAfterLast' | 'isSortedAfterLast' | 'isSortedBeforeFirst' | 'wasMatching' | 'doesMatchNow';
export interface QueryParams<DocType> {
    primaryKey: string;
    sortFields: string[];
    skip?: number;
    limit?: number;
    queryMatcher: QueryMatcher<DocType>;
    sortComparator: SortComparator<DocType>;
}
export declare type QueryMatcher<DocType> = (doc: DocType) => boolean;
export declare type SortComparator<DocType> = (a: DocType, b: DocType) => 1 | 0 | -1;
/**
 * A map contains a stateSet as key and an ActionName as value
 * State-sets that are not in the Map have 'runFullQueryAgain' as value
 *
 * The key is a binary-representation of the ordered state-list
 * like '010110110111...'
 * where the first '0' means that the first state (hasLimit) is false
 */
export declare type StateSet = string;
export declare type StateSetToActionMap = Map<StateSet, ActionName>;
export interface StateResolveFunctionInput<DocType> {
    queryParams: QueryParams<DocType>;
    changeEvent: ChangeEvent<DocType>;
    previousResults: DocType[];
    keyDocumentMap?: ResultKeyDocumentMap<DocType>;
}
export declare type StateResolveFunction<DocType> = (input: StateResolveFunctionInput<DocType>) => boolean;
export declare type ActionFunctionInput<DocType> = StateResolveFunctionInput<DocType>;
/**
 * for performance-reasons,
 * action-function mutate the input
 */
export declare type ActionFunction<DocType> = (input: ActionFunctionInput<DocType>) => void;
