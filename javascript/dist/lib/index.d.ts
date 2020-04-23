import type { ChangeEvent, ActionName, ResultKeyDocumentMap, QueryParams, StateSetToActionMap, StateSet, ActionFunction, StateResolveFunctionInput } from './types';
export * from './types';
export * from './states';
export * from './util';
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
