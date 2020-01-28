import {
    ChangeEvent,
    ActionName,
    ResultKeyDocumentMap,
    QueryParams
} from './types';

export function calculateAction<DocType>(
    queryParams: QueryParams<DocType>,
    changeEvent: ChangeEvent<DocType>,
    previousResults: DocType[],
    keyDocumentMap?: ResultKeyDocumentMap<DocType>
): ActionName {


    return '';
}

/**
 * for performance reasons, this mutates the input
 */
export function runAction<DocType>(
    action: ActionName,
    queryParams: QueryParams<DocType>,
    changeEvent: ChangeEvent<DocType>,
    previousResults: DocType[],
    keyDocumentMap?: ResultKeyDocumentMap<DocType>
) {

}