import type {
    ActionFunction,
    ActionFunctionInput,
    ChangeEvent,
    QueryParams,
    ResultKeyDocumentMap
} from './types/index.js';
import { resolveInput } from './bdd/bdd.generated.js';
import { actionFunctionList } from './actions/index.js';
import {
    insertAtSortPositionRemoveFirst,
    insertAtSortPositionRemoveLast,
    removeFirstInsertFirst,
    removeFirstInsertLast,
    removeFirstItem,
    removeLastInsertFirst,
    removeLastInsertLast,
    removeLastItem,
    runFullQueryAgain
} from './actions/action-functions.js';
import { getDocumentId } from './util.js';

/**
 * Result window buffer
 * ------------
 * For a query with a limit or a skip, EventReduce returns runFullQueryAgain
 * when a row has to move into the result window that is not in the previous results:
 * the row after the last row (a row left a full window) or the last skipped row
 * (a row was added in front of the window).
 * The result window buffer keeps rows on both sides of the window in memory,
 * so these rows can be taken from memory instead.
 * See docs/result-window-buffer.md for the explanation and measurements.
 *
 * Invariant: `buffer` is always an exact, contiguous slice of the full sorted result
 * (without skip and limit): exactly `offset` matching rows sort before its first row,
 * and it never contains a wrong row or misses a row in between.
 * If `complete` is true, there are no rows after its last row.
 * Only if the buffer is empty, `offset` can be larger than the real number of rows.
 */
export type ResultWindowBuffer<DocType> = {
    /**
     * QueryParams of the original query,
     * with the skip and limit that are shown to the user.
     */
    queryParams: QueryParams<DocType>;
    /**
     * Amount of rows to keep after the last row of the result window.
     */
    limitBufferSize: number;
    /**
     * Amount of rows to keep before the first row of the result window,
     * out of the skipped rows.
     */
    skipBufferSize: number;
    buffer: DocType[];
    keyDocumentMap: ResultKeyDocumentMap<DocType>;
    /**
     * Number of matching rows that sort before the first row of the buffer.
     */
    offset: number;
    complete: boolean;
};

export type ResultWindowBufferSizes = {
    /**
     * Amount of rows to keep after the result window, default 0.
     * Only used for queries with a limit.
     */
    limitBufferSize?: number;
    /**
     * Amount of skipped rows to keep before the result window, default 0.
     * Only used for queries with a skip.
     */
    skipBufferSize?: number;
};

/**
 * What applyChangeEventToResultWindowBuffer() did:
 * - 'eventReduce': an EventReduce action calculated the new buffer
 * - 'buffer': EventReduce could not do it (or would have dropped a row), the slice rule did it
 * - 'runFullQueryAgain': the caller must run the query with the skip and limit of
 *   getResultWindowBufferQuery() and pass the rows to resetResultWindowBuffer()
 */
export type ResultWindowBufferResult = 'eventReduce' | 'buffer' | 'runFullQueryAgain';

/**
 * Actions that keep the length of the result by dropping its first or last row.
 * The slice rule can keep that row instead.
 */
const ACTIONS_THAT_DROP_A_ROW: Set<ActionFunction<any>> = new Set([
    removeFirstItem,
    removeLastItem,
    removeFirstInsertLast,
    removeLastInsertFirst,
    removeFirstInsertFirst,
    removeLastInsertLast,
    insertAtSortPositionRemoveLast,
    insertAtSortPositionRemoveFirst
]);

/**
 * Creates an empty result window buffer.
 * Run the query with the skip and limit of getResultWindowBufferQuery()
 * and pass the rows to resetResultWindowBuffer() before using it.
 * @param queryParams the params of the query, with the skip and limit that are shown to the user
 */
export function createResultWindowBuffer<DocType>(
    queryParams: QueryParams<DocType>,
    sizes: ResultWindowBufferSizes
): ResultWindowBuffer<DocType> {
    return {
        queryParams,
        limitBufferSize: sizes.limitBufferSize ? sizes.limitBufferSize : 0,
        skipBufferSize: sizes.skipBufferSize ? sizes.skipBufferSize : 0,
        buffer: [],
        keyDocumentMap: new Map(),
        offset: 0,
        complete: false
    };
}

/**
 * The skip and limit to use when running the query for the buffer.
 * limit is undefined if the query has no limit.
 */
export function getResultWindowBufferQuery(resultWindowBuffer: ResultWindowBuffer<any>): { skip: number; limit: number | undefined; } {
    const skip = getSkip(resultWindowBuffer);
    const bufferSkip = Math.max(0, skip - resultWindowBuffer.skipBufferSize);
    const limit = resultWindowBuffer.queryParams.limit;
    return {
        skip: bufferSkip,
        limit: limit ? (skip - bufferSkip) + limit + resultWindowBuffer.limitBufferSize : undefined
    };
}

/**
 * Set the buffer to the rows of a fresh query
 * that ran with the skip and limit of getResultWindowBufferQuery().
 */
export function resetResultWindowBuffer<DocType>(
    resultWindowBuffer: ResultWindowBuffer<DocType>,
    rows: DocType[]
): void {
    const query = getResultWindowBufferQuery(resultWindowBuffer);
    resultWindowBuffer.buffer = rows.slice(0);
    resultWindowBuffer.keyDocumentMap.clear();
    rows.forEach(doc => resultWindowBuffer.keyDocumentMap.set(getDocumentId(resultWindowBuffer.queryParams, doc), doc));
    resultWindowBuffer.offset = query.skip;
    // fewer rows than requested means there are no more rows
    resultWindowBuffer.complete = query.limit === undefined || rows.length < query.limit;
}

/**
 * The result that is shown to the user.
 */
export function getResultWindowBufferResults<DocType>(resultWindowBuffer: ResultWindowBuffer<DocType>): DocType[] {
    const start = getSkip(resultWindowBuffer) - resultWindowBuffer.offset;
    const limit = resultWindowBuffer.queryParams.limit;
    return resultWindowBuffer.buffer.slice(start, limit ? start + limit : undefined);
}

/**
 * Updates the buffer with the change event.
 * @mutates resultWindowBuffer
 */
export function applyChangeEventToResultWindowBuffer<DocType>(
    resultWindowBuffer: ResultWindowBuffer<DocType>,
    changeEvent: ChangeEvent<DocType>
): ResultWindowBufferResult {
    const buffer = resultWindowBuffer.buffer;
    if (!resultWindowBuffer.complete && buffer.length === 0) {
        return 'runFullQueryAgain';
    }

    /**
     * 1. Let EventReduce handle the buffer as if it was the result of a query
     * with skip = offset and limit = buffer.length. This is exactly true,
     * because the buffer is an exact slice of the full result.
     * If the buffer is complete, we use buffer.length + 1, so EventReduce
     * knows that the limit is not reached and there are no more rows.
     */
    const input: ActionFunctionInput<DocType> = {
        queryParams: {
            ...resultWindowBuffer.queryParams,
            skip: resultWindowBuffer.offset > 0 ? resultWindowBuffer.offset : undefined,
            limit: resultWindowBuffer.complete ? buffer.length + 1 : buffer.length
        },
        changeEvent,
        previousResults: buffer,
        keyDocumentMap: resultWindowBuffer.keyDocumentMap
    };
    const action: ActionFunction<DocType> = actionFunctionList[resolveInput(input)];
    let result: ResultWindowBufferResult;
    if (action === runFullQueryAgain || ACTIONS_THAT_DROP_A_ROW.has(action)) {
        /**
         * 2. EventReduce needs a row before or after the buffer, which it does not know,
         * or it would drop a row to keep the length of the result.
         * But the buffer does not have to keep its length, only to stay an exact slice,
         * so the slice rule lets it shrink or grow instead.
         */
        applySliceRule(resultWindowBuffer, changeEvent);
        result = 'buffer';
    } else {
        action(input);
        result = 'eventReduce';
    }

    // 3. Do not let the buffer grow without bounds on either side.
    trimBuffer(resultWindowBuffer);

    // 4. Run the query again if the result window does not fit into the buffer anymore.
    const start = getSkip(resultWindowBuffer) - resultWindowBuffer.offset;
    const limit = resultWindowBuffer.queryParams.limit;
    if (
        start < 0 ||
        (!resultWindowBuffer.complete && (!limit || buffer.length < start + limit))
    ) {
        return 'runFullQueryAgain';
    }
    return result;
}

function getSkip(resultWindowBuffer: ResultWindowBuffer<any>): number {
    const skip = resultWindowBuffer.queryParams.skip;
    return skip ? skip : 0;
}

/**
 * Removes rows before the window that are more than skipBufferSize
 * and rows after the window that are more than limitBufferSize.
 */
function trimBuffer<DocType>(resultWindowBuffer: ResultWindowBuffer<DocType>): void {
    const buffer = resultWindowBuffer.buffer;
    const keyDocumentMap = resultWindowBuffer.keyDocumentMap;
    const queryParams = resultWindowBuffer.queryParams;

    const rowsBeforeWindow = getSkip(resultWindowBuffer) - resultWindowBuffer.offset;
    const removeFromStart = Math.min(rowsBeforeWindow - resultWindowBuffer.skipBufferSize, buffer.length);
    if (removeFromStart > 0) {
        buffer.splice(0, removeFromStart).forEach(doc => keyDocumentMap.delete(getDocumentId(queryParams, doc)));
        resultWindowBuffer.offset = resultWindowBuffer.offset + removeFromStart;
    }

    const limit = queryParams.limit;
    if (limit) {
        const maxLength = Math.max(0, getSkip(resultWindowBuffer) - resultWindowBuffer.offset) + limit + resultWindowBuffer.limitBufferSize;
        if (buffer.length > maxLength) {
            buffer.splice(maxLength).forEach(doc => keyDocumentMap.delete(getDocumentId(queryParams, doc)));
            resultWindowBuffer.complete = false;
        }
    }
}

/**
 * The slice rule:
 * Exactly `offset` matching rows sort before the first row of the buffer,
 * and all matching rows that sort between the first and the last row are in the buffer.
 * After the change event, this is still true for the old first and last row, so:
 * - the old version of the changed row is removed from the buffer,
 * - the new version is added if it sorts between the old first and last row,
 * - offset changes by one if the changed row moved into or out of the rows before the first row.
 * If offset is 0, there are no rows before the first row, so a row that sorts before it is added.
 * If the buffer is complete, there are no rows after the last row, so a row that sorts after it is added.
 *
 * An empty buffer (only valid when complete) knows only the number of rows before it.
 * There, offset is only an upper bound, which stays an upper bound with the same update.
 * @mutates resultWindowBuffer
 */
function applySliceRule<DocType>(
    resultWindowBuffer: ResultWindowBuffer<DocType>,
    changeEvent: ChangeEvent<DocType>
): void {
    const queryParams = resultWindowBuffer.queryParams;
    const buffer = resultWindowBuffer.buffer;
    const keyDocumentMap = resultWindowBuffer.keyDocumentMap;
    const previous = changeEvent.previous;
    const doc = changeEvent.doc;
    const wasMatching = !!previous && queryParams.queryMatcher(previous);
    const doesMatchNow = !!doc && queryParams.queryMatcher(doc);

    if (buffer.length === 0) {
        if (resultWindowBuffer.offset === 0) {
            // there are no rows at all
            if (doc && doesMatchNow) {
                insertAtSortPosition(resultWindowBuffer, doc);
            }
        } else {
            resultWindowBuffer.offset = resultWindowBuffer.offset + (doesMatchNow ? 1 : 0) - (wasMatching ? 1 : 0);
        }
        return;
    }

    const first = buffer[0];
    const last = buffer[buffer.length - 1];
    const hasRowsBefore = resultWindowBuffer.offset > 0;
    const isBefore = (d: DocType) => hasRowsBefore && compareRows(queryParams, d, first) < 0;
    const wasBefore = !!previous && wasMatching && isBefore(previous);
    const isBeforeNow = !!doc && doesMatchNow && isBefore(doc);

    const id = changeEvent.id;
    const docInMap = keyDocumentMap.get(id);
    if (docInMap) {
        let index = buffer.indexOf(docInMap);
        if (index < 0) {
            index = buffer.findIndex(d => getDocumentId(queryParams, d) === id);
        }
        buffer.splice(index, 1);
        keyDocumentMap.delete(id);
    }
    if (
        doc &&
        doesMatchNow &&
        !isBeforeNow &&
        (resultWindowBuffer.complete || compareRows(queryParams, doc, last) <= 0)
    ) {
        insertAtSortPosition(resultWindowBuffer, doc);
    }
    resultWindowBuffer.offset = resultWindowBuffer.offset + (isBeforeNow ? 1 : 0) - (wasBefore ? 1 : 0);
}

/**
 * Compares two rows with the sort comparator of the query.
 * Returns 0 only for two versions of the same row that sort at the same position.
 * For different rows that the comparator sees as equal,
 * the primary key decides, so that the order is always deterministic.
 */
function compareRows<DocType>(queryParams: QueryParams<DocType>, a: DocType, b: DocType): number {
    const idA = getDocumentId(queryParams, a);
    const idB = getDocumentId(queryParams, b);
    // typed as 1 | -1, but comparators like the one of minimongo also return 0 for ties
    const result: number = queryParams.sortComparator(a, b);
    if (idA === idB) {
        // A deterministic comparator breaks ties by the primary key,
        // which gives the same answer for both directions when the sort values are equal.
        if (result === 0 || result === queryParams.sortComparator(b, a)) {
            return 0;
        }
        return result;
    }
    if (result !== 0) {
        return result;
    }
    return idA < idB ? -1 : 1;
}

function insertAtSortPosition<DocType>(resultWindowBuffer: ResultWindowBuffer<DocType>, doc: DocType): void {
    const buffer = resultWindowBuffer.buffer;
    // binary search for the first row that sorts after doc
    let low = 0;
    let high = buffer.length;
    while (low < high) {
        const mid = (low + high) >>> 1;
        if (compareRows(resultWindowBuffer.queryParams, buffer[mid], doc) < 0) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    buffer.splice(low, 0, doc);
    resultWindowBuffer.keyDocumentMap.set(getDocumentId(resultWindowBuffer.queryParams, doc), doc);
}
