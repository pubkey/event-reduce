import {
    ActionName,
    ChangeEvent,
    QueryParams,
    calculateActionName,
    runAction,
    getDocumentId
} from 'event-reduce-js';

/**
 * Limit buffer
 * ------------
 * A usage pattern on top of EventReduce, not part of the event-reduce-js API.
 * See docs/limit-buffer.md for the explanation.
 *
 * For a query with a limit, we keep `limit + bufferSize` rows in memory
 * but only show the first `limit` of them. When a visible row leaves the window
 * (deleted, moved behind the last row, no longer matching), the next row
 * is taken from the buffer instead of running the query again.
 *
 * Invariant: `buffer` is always an exact prefix of the true sorted result
 * (after the skip). It may be shorter than `limit + bufferSize`,
 * but it never contains a wrong row and never misses a row in between.
 * If `complete` is true, the buffer is not only a prefix
 * but the whole result, so there are no rows after its last row.
 */
export type LimitBuffer<DocType> = {
    /**
     * QueryParams of the original query,
     * with the limit that is shown to the user.
     */
    queryParams: QueryParams<DocType>;
    bufferSize: number;
    buffer: DocType[];
    keyDocumentMap: Map<string, DocType>;
    complete: boolean;
};

/**
 * What applyChangeEventToLimitBuffer() did:
 * - 'eventReduce': EventReduce calculated the new buffer
 * - 'buffer': EventReduce could not do it, but the prefix rule could
 * - 'runFullQueryAgain': the caller must run the query with
 *   getLimitBufferQueryLimit() and pass the rows to resetLimitBuffer()
 */
export type LimitBufferResult = 'eventReduce' | 'buffer' | 'runFullQueryAgain';

/**
 * Actions that keep the length of the result by dropping its last row.
 */
const ACTIONS_THAT_DROP_THE_LAST_ROW: Set<ActionName> = new Set([
    'removeLastItem',
    'removeLastInsertFirst',
    'removeLastInsertLast',
    'insertAtSortPositionRemoveLast'
] as ActionName[]);

export function createLimitBuffer<DocType>(
    queryParams: QueryParams<DocType>,
    bufferSize: number,
    rows: DocType[]
): LimitBuffer<DocType> {
    if (!queryParams.limit) {
        throw new Error('the limit buffer only makes sense for queries with a limit');
    }
    const limitBuffer: LimitBuffer<DocType> = {
        queryParams,
        bufferSize,
        buffer: [],
        keyDocumentMap: new Map(),
        complete: false
    };
    resetLimitBuffer(limitBuffer, rows);
    return limitBuffer;
}

/**
 * The limit to use when running the query for the buffer.
 * The skip stays the same as in the original query.
 */
export function getLimitBufferQueryLimit(limitBuffer: LimitBuffer<any>): number {
    return limitBuffer.queryParams.limit + limitBuffer.bufferSize;
}

/**
 * Set the buffer to the rows of a fresh query
 * that ran with getLimitBufferQueryLimit() as limit.
 */
export function resetLimitBuffer<DocType>(
    limitBuffer: LimitBuffer<DocType>,
    rows: DocType[]
) {
    limitBuffer.buffer = rows.slice(0);
    limitBuffer.keyDocumentMap.clear();
    rows.forEach(doc => limitBuffer.keyDocumentMap.set(getDocumentId(limitBuffer.queryParams, doc), doc));
    // fewer rows than requested means there are no more rows
    limitBuffer.complete = rows.length < getLimitBufferQueryLimit(limitBuffer);
}

/**
 * The result that is shown to the user.
 */
export function getLimitBufferResults<DocType>(limitBuffer: LimitBuffer<DocType>): DocType[] {
    return limitBuffer.buffer.slice(0, limitBuffer.queryParams.limit);
}

/**
 * Updates the buffer with the change event.
 * @mutates limitBuffer
 */
export function applyChangeEventToLimitBuffer<DocType>(
    limitBuffer: LimitBuffer<DocType>,
    changeEvent: ChangeEvent<DocType>
): LimitBufferResult {
    const buffer = limitBuffer.buffer;
    if (!limitBuffer.complete && buffer.length === 0) {
        return 'runFullQueryAgain';
    }

    /**
     * 1. Let EventReduce handle the buffer as if it was the result of a query
     * with buffer.length as limit. This is exactly true:
     * an exact prefix of length n is the result of the query with limit n.
     * If the buffer is complete, we use buffer.length + 1, so EventReduce
     * knows that the limit is not reached and there are no more rows.
     */
    const queryParams: QueryParams<DocType> = {
        ...limitBuffer.queryParams,
        limit: limitBuffer.complete ? buffer.length + 1 : buffer.length
    };
    const action = calculateActionName({
        queryParams,
        changeEvent,
        previousResults: buffer,
        keyDocumentMap: limitBuffer.keyDocumentMap
    });
    let result: LimitBufferResult;
    if (action === 'runFullQueryAgain') {
        /**
         * 2. EventReduce needs the row after the buffer, which it does not know.
         * But we do not have to keep the length, only the prefix,
         * so we can let the buffer shrink instead.
         */
        if (!applyPrefixRule(limitBuffer, changeEvent)) {
            return 'runFullQueryAgain';
        }
        result = 'buffer';
    } else if (
        ACTIONS_THAT_DROP_THE_LAST_ROW.has(action) &&
        buffer.length < getLimitBufferQueryLimit(limitBuffer) &&
        applyPrefixRule(limitBuffer, changeEvent)
    ) {
        /**
         * EventReduce keeps the length of the buffer, so it drops the last row
         * when a row comes in. If the buffer has shrunk, the prefix rule
         * keeps that row instead and the buffer grows again.
         */
        result = 'buffer';
    } else {
        runAction(action, queryParams, changeEvent, buffer, limitBuffer.keyDocumentMap);
        result = 'eventReduce';
    }

    // 3. Do not let the buffer grow without bounds.
    const maxLength = getLimitBufferQueryLimit(limitBuffer);
    while (buffer.length > maxLength) {
        const removed = buffer.pop();
        limitBuffer.keyDocumentMap.delete(getDocumentId(limitBuffer.queryParams, removed));
        limitBuffer.complete = false;
    }

    // 4. Not enough rows left to fill the visible window.
    if (!limitBuffer.complete && buffer.length < limitBuffer.queryParams.limit) {
        return 'runFullQueryAgain';
    }
    return result;
}

/**
 * The prefix rule:
 * All matching rows that sort between the first and the last row of the buffer
 * are in the buffer. After the change event, this is still true for the old
 * first and last row, so the new buffer is: the old buffer, without the old version
 * of the changed row, plus the new version if it sorts between the old first and last row.
 * If the buffer is complete, there is no last row to stop at.
 *
 * With skip, there are exactly `skip` rows before the first row of the buffer.
 * - If one of them leaves, the first row of the buffer moves into the skipped rows,
 *   so we remove it.
 * - If one is added, the row that moves into the window is the last of the skipped rows,
 *   which we do not know. Then we must run the query again.
 *
 * Returns false if the change cannot be applied without breaking the invariant.
 * @mutates limitBuffer
 */
function applyPrefixRule<DocType>(
    limitBuffer: LimitBuffer<DocType>,
    changeEvent: ChangeEvent<DocType>
): boolean {
    const queryParams = limitBuffer.queryParams;
    const buffer = limitBuffer.buffer;
    const keyDocumentMap = limitBuffer.keyDocumentMap;
    const skip = queryParams.skip ? queryParams.skip : 0;
    const previous = changeEvent.previous;
    const doc = changeEvent.doc;
    const wasMatching = !!previous && queryParams.queryMatcher(previous);
    const doesMatchNow = !!doc && queryParams.queryMatcher(doc);

    if (buffer.length === 0) {
        // only reachable when complete
        if (skip > 0) {
            // There are at most skip rows, but we do not know how many.
            return !doesMatchNow;
        }
        if (doesMatchNow) {
            insertAtSortPosition(limitBuffer, doc);
        }
        return true;
    }

    const first = buffer[0];
    const last = buffer[buffer.length - 1];
    const isInFront = (d: DocType) => skip > 0 && compareRows(queryParams, d, first) < 0;
    const addedInFront = (doesMatchNow && isInFront(doc) ? 1 : 0) - (wasMatching && isInFront(previous) ? 1 : 0);
    if (addedInFront > 0) {
        return false;
    }

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
        doesMatchNow &&
        !isInFront(doc) &&
        (limitBuffer.complete || compareRows(queryParams, doc, last) <= 0)
    ) {
        insertAtSortPosition(limitBuffer, doc);
    }
    if (addedInFront < 0 && buffer.length > 0) {
        const movedInFront = buffer.shift();
        keyDocumentMap.delete(getDocumentId(queryParams, movedInFront));
    }
    return true;
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

function insertAtSortPosition<DocType>(limitBuffer: LimitBuffer<DocType>, doc: DocType) {
    const buffer = limitBuffer.buffer;
    // binary search for the first row that sorts after doc
    let low = 0;
    let high = buffer.length;
    while (low < high) {
        const mid = (low + high) >>> 1;
        if (compareRows(limitBuffer.queryParams, buffer[mid], doc) < 0) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    buffer.splice(low, 0, doc);
    limitBuffer.keyDocumentMap.set(getDocumentId(limitBuffer.queryParams, doc), doc);
}
