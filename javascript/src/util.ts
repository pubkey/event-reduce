import { StateResolveFunctionInput, UNKNOWN, UNKNOWN_VALUE, ActionFunctionInput } from "./types";

export function lastOfArray<T>(ar: T[]): T {
    return ar[ar.length - 1];
}

/**
 * if the previous doc-data is unknown,
 * try to get it from previous results
 * @mutate the changeEvent of input
 */
export function tryToFillPreviousDoc<DocType>(
    input: StateResolveFunctionInput<DocType>
) {
    const prev = input.changeEvent.previous;
    if (prev === UNKNOWN_VALUE) {
        const id = input.changeEvent.id;
        const primary = input.queryParams.primaryKey;
        if (input.keyDocumentMap) {
            const doc = input.keyDocumentMap.get(id);
            if (doc) {
                input.changeEvent.previous = doc;
            }
        } else {
            const found = input.previousResults.find(item => item[primary] === id);
            if (found) {
                input.changeEvent.previous = found;
            }
        }
    }
}