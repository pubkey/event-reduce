import type { ChangeEvent, ActionName, ResultKeyDocumentMap, QueryParams, StateSetToActionMap, StateSet, ActionFunction, StateResolveFunctionInput } from './types/index.js';
/**
 * Export as type to ensure we do not
 * end with an import statement in the build output
 * which would increase the build size.
 */
export type { ActionFunction, ActionFunctionInput, ActionName, ChangeEvent, ChangeEventBase, ChangeEventDelete, ChangeEventInsert, ChangeEventUpdate, MongoQuery, QueryMatcher, QueryParams, ResultKeyDocumentMap, DeterministicSortComparator, StateName, StateResolveFunction, StateResolveFunctionInput, StateSet, StateSetToActionMap, WriteOperation } from './types/index.js';
export * from './states/index.js';
export * from './util.js';
export * from './actions/index.js';
export declare function calculateActionFromMap<DocType>(stateSetToActionMap: StateSetToActionMap, input: StateResolveFunctionInput<DocType>): {
    action: ActionName;
    stateSet: StateSet;
};
export declare function calculateActionName<DocType>(input: StateResolveFunctionInput<DocType>): ActionName;
export declare function calculateActionFunction<DocType>(input: StateResolveFunctionInput<DocType>): ActionFunction<DocType>;
/**
 * for performance reasons,
 * @mutates the input
 * @returns the new results
 */
export declare function runAction<DocType>(action: ActionName, queryParams: QueryParams<DocType>, changeEvent: ChangeEvent<DocType>, previousResults: DocType[], keyDocumentMap?: ResultKeyDocumentMap<DocType>): DocType[];
