import {
    ChangeEvent,
    ActionName,
    ResultKeyDocumentMap,
    QueryParams,
    StateSetToActionMap,
    StateSet
} from './types';
import { getStateSet } from './states';

export function calculateActionFromMap<DocType>(
    stateSetToActionMap: StateSetToActionMap,
    queryParams: QueryParams<DocType>,
    changeEvent: ChangeEvent<DocType>,
    previousResults: DocType[],
    keyDocumentMap?: ResultKeyDocumentMap<DocType>
): ActionName {
    const stateSet: StateSet = getStateSet({
        queryParams,
        changeEvent,
        previousResults,
        keyDocumentMap
    });
    const actionName = stateSetToActionMap.get(stateSet);
    if (!actionName) {
        return 'runFullQueryAgain';
    } else {
        return actionName;
    }
}

/**
 * for performance reasons,
 * @mutates the input
 * @returns the new results
 */
export function runAction<DocType>(
    action: ActionName,
    queryParams: QueryParams<DocType>,
    changeEvent: ChangeEvent<DocType>,
    previousResults: DocType[],
    keyDocumentMap?: ResultKeyDocumentMap<DocType>
): DocType[] {

}
