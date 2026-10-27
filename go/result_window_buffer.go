package eventreduce

import (
	"math"
	"reflect"
)

// Result window buffer
// ------------
// For a query with a limit or a skip, EventReduce returns RunFullQueryAgain
// when a row has to move into the result window that is not in the previous results:
// the row after the last row (a row left a full window) or the last skipped row
// (a row was added in front of the window).
// The result window buffer keeps rows on both sides of the window in memory,
// so these rows can be taken from memory instead.
// See docs/result-window-buffer.md for the explanation and measurements.
//
// Invariant: Buffer is always an exact, contiguous slice of the full sorted result
// (without skip and limit): exactly Offset matching rows sort before its first row,
// and it never contains a wrong row or misses a row in between.
// If Complete is true, there are no rows after its last row.
// Only if the buffer is empty, Offset can be larger than the real number of rows.

// ResultWindowBufferAllRows as a buffer size keeps all rows on that side of the result window.
const ResultWindowBufferAllRows = math.MaxInt

// maxBufferSize: buffer sizes from this value on keep all rows.
// Keeps the arithmetic far away from an overflow, also where int has 32 bits.
const maxBufferSize = 1 << 29

// ResultWindowBufferResult is what ApplyChangeEvent did.
type ResultWindowBufferResult string

// The results of ApplyChangeEvent.
const (
	// ResultEventReduce means an EventReduce action calculated the new buffer.
	ResultEventReduce ResultWindowBufferResult = "eventReduce"
	// ResultBuffer means EventReduce could not do it (or would have dropped a row), the slice rule did it.
	ResultBuffer ResultWindowBufferResult = "buffer"
	// ResultRunFullQueryAgain means the caller must run the query with the skip and limit of Query()
	// and pass the rows to Reset().
	ResultRunFullQueryAgain ResultWindowBufferResult = "runFullQueryAgain"
)

// ResultWindowBufferQuery is the skip and limit to run the query of the buffer with.
// Limit is nil if all rows after the skip are needed.
type ResultWindowBufferQuery struct {
	Skip  int
	Limit *int
}

// ResultWindowBufferChangeResult is what ApplyChangeEvents returns.
// Results are the rows of the original skip and limit,
// Changed is true if they are not equal to the rows before the change events.
type ResultWindowBufferChangeResult[D any] struct {
	RunFullQueryAgain bool
	Changed           bool
	Results           []D
}

// GetRecommendedResultWindowBufferSize returns the recommended buffer size for each side of the result window.
// About log2(limit) for small limits, grows faster around limit 400 and is at most 30.
// Returns 0 for a limit of 1 (like a find-one query) and for queries without a limit.
func GetRecommendedResultWindowBufferSize(limit *int) int {
	if limit == nil || *limit == 0 {
		return 0
	}
	ratio := 400 / float64(*limit)
	size := math.Floor(math.Log2(float64(*limit)) + 19/(1+ratio*ratio))
	return int(math.Min(30, size))
}

// ResultWindowBuffer keeps rows on both sides of the result window of a query with a skip or limit in memory.
// Create it with NewResultWindowBuffer, run the query with the skip and limit of Query()
// and pass the rows to Reset() before using it.
type ResultWindowBuffer[D any] struct {
	// QueryParams of the original query, with the skip and limit that are shown to the user.
	QueryParams QueryParams[D]
	// LimitBufferSize is the amount of rows to keep after the last row of the result window.
	LimitBufferSize int
	// SkipBufferSize is the amount of rows to keep before the first row of the result window.
	SkipBufferSize int
	// Buffer has all rows that are kept in memory, the result window and the rows around it.
	Buffer []D
	// KeyDocumentMap maps the id of each row in the buffer to the row.
	KeyDocumentMap map[string]D
	// Offset is the number of matching rows that sort before the first row of the buffer.
	Offset int
	// Complete is true if there are no rows after the last row of the buffer.
	Complete bool
}

// NewResultWindowBuffer creates an empty result window buffer.
// queryParams has the skip and limit that are shown to the user.
// ResultWindowBufferAllRows as a size keeps all rows on that side.
// Returns ErrInvalidResultWindowBufferSize for negative sizes.
func NewResultWindowBuffer[D any](queryParams QueryParams[D], limitBufferSize, skipBufferSize int) (*ResultWindowBuffer[D], error) {
	if limitBufferSize < 0 || skipBufferSize < 0 {
		return nil, ErrInvalidResultWindowBufferSize
	}
	// with limit 0 the result is always empty, so no rows are kept
	isEmptyQuery := queryParams.Limit != nil && *queryParams.Limit == 0
	size := func(size int) int {
		if isEmptyQuery {
			return 0
		}
		return min(size, maxBufferSize)
	}
	return &ResultWindowBuffer[D]{
		QueryParams:     queryParams,
		LimitBufferSize: size(limitBufferSize),
		SkipBufferSize:  size(skipBufferSize),
		KeyDocumentMap:  map[string]D{},
	}, nil
}

func (b *ResultWindowBuffer[D]) skip() int {
	if b.QueryParams.Skip == nil {
		return 0
	}
	return *b.QueryParams.Skip
}

// Query returns the skip and limit to run the query of the buffer with.
func (b *ResultWindowBuffer[D]) Query() ResultWindowBufferQuery {
	skip := b.skip()
	bufferSkip := max(0, skip-b.SkipBufferSize)
	var bufferLimit *int
	if b.QueryParams.Limit != nil && b.LimitBufferSize < maxBufferSize {
		bufferLimit = Int((skip - bufferSkip) + *b.QueryParams.Limit + b.LimitBufferSize)
	}
	return ResultWindowBufferQuery{Skip: bufferSkip, Limit: bufferLimit}
}

// Reset sets the buffer to the rows of a fresh query that ran with the skip and limit of Query().
func (b *ResultWindowBuffer[D]) Reset(rows []D) {
	query := b.Query()
	b.Buffer = append([]D(nil), rows...)
	b.KeyDocumentMap = make(map[string]D, len(rows))
	for _, doc := range b.Buffer {
		b.KeyDocumentMap[b.QueryParams.GetDocumentID(doc)] = doc
	}
	b.Offset = query.Skip
	// fewer rows than requested means there are no more rows
	b.Complete = query.Limit == nil || len(rows) < *query.Limit
}

// Results returns the result that is shown to the user.
// Returns ErrResultWindowOutdated if the result window is not in the buffer, which happens
// before Reset() was called or when ApplyChangeEvent() returned ResultRunFullQueryAgain
// and the query did not run again.
func (b *ResultWindowBuffer[D]) Results() ([]D, error) {
	if !b.isResultWindowInBuffer() {
		return nil, ErrResultWindowOutdated
	}
	start := min(b.skip()-b.Offset, len(b.Buffer))
	end := len(b.Buffer)
	if b.QueryParams.Limit != nil {
		end = min(start+*b.QueryParams.Limit, len(b.Buffer))
	}
	return append([]D(nil), b.Buffer[start:end]...), nil
}

// ApplyChangeEvent updates the buffer with the change event.
func (b *ResultWindowBuffer[D]) ApplyChangeEvent(changeEvent ChangeEvent[D]) ResultWindowBufferResult {
	if b.QueryParams.Limit != nil && *b.QueryParams.Limit == 0 {
		// the result of a query with limit 0 is always empty, nothing can change it
		return ResultEventReduce
	}
	if !b.Complete && len(b.Buffer) == 0 {
		return ResultRunFullQueryAgain
	}

	// 1. Let EventReduce handle the buffer as if it was the result of a query
	// with skip = Offset and limit = len(Buffer). This is exactly true,
	// because the buffer is an exact slice of the full result.
	// If the buffer is complete, we use len(Buffer) + 1, so EventReduce
	// knows that the limit is not reached and there are no more rows.
	var skip *int
	if b.Offset > 0 {
		skip = Int(b.Offset)
	}
	limit := len(b.Buffer)
	if b.Complete {
		limit++
	}
	input := &StateResolveFunctionInput[D]{
		QueryParams:     b.QueryParams.withSkipAndLimit(skip, Int(limit)),
		ChangeEvent:     changeEvent,
		PreviousResults: b.Buffer,
		KeyDocumentMap:  b.KeyDocumentMap,
	}
	action := CalculateActionName(input)
	var result ResultWindowBufferResult
	if action == RunFullQueryAgain || action == UnknownAction || dropsARow(action) {
		// 2. EventReduce needs a row before or after the buffer, which it does not know,
		// or it would drop a row to keep the length of the result.
		// But the buffer does not have to keep its length, only to stay an exact slice,
		// so the slice rule lets it shrink or grow instead.
		b.applySliceRule(changeEvent)
		result = ResultBuffer
	} else {
		if err := GetActionFunction[D](action)(input); err != nil {
			// only possible on a broken BDD, make sure the buffer is filled again
			b.Buffer = nil
			b.KeyDocumentMap = map[string]D{}
			b.Complete = false
			return ResultRunFullQueryAgain
		}
		b.Buffer = input.PreviousResults
		result = ResultEventReduce
	}

	// 3. Do not let the buffer grow without bounds on either side.
	b.trim()

	// 4. Run the query again if the result window does not fit into the buffer anymore.
	if !b.isResultWindowInBuffer() {
		return ResultRunFullQueryAgain
	}
	return result
}

// ApplyChangeEvents updates the buffer with all change events.
// Returns the new results, and if they changed,
// or RunFullQueryAgain if the result window does not fit into the buffer anymore.
// Then run the query of Query() and pass the rows to Reset().
// Rows are compared with reflect.DeepEqual to find out if the results changed.
func (b *ResultWindowBuffer[D]) ApplyChangeEvents(changeEvents []ChangeEvent[D]) ResultWindowBufferChangeResult[D] {
	previousResults, err := b.Results()
	if err != nil {
		return ResultWindowBufferChangeResult[D]{RunFullQueryAgain: true}
	}
	for _, changeEvent := range changeEvents {
		if b.ApplyChangeEvent(changeEvent) == ResultRunFullQueryAgain {
			return ResultWindowBufferChangeResult[D]{RunFullQueryAgain: true}
		}
	}
	results, err := b.Results()
	if err != nil {
		return ResultWindowBufferChangeResult[D]{RunFullQueryAgain: true}
	}
	changed := len(results) != len(previousResults)
	for i := 0; !changed && i < len(results); i++ {
		changed = !reflect.DeepEqual(results[i], previousResults[i])
	}
	return ResultWindowBufferChangeResult[D]{Changed: changed, Results: results}
}

// dropsARow is true for the actions that keep the length of the result by dropping its first or last row.
// The slice rule can keep that row instead.
func dropsARow(action ActionName) bool {
	switch action {
	case RemoveFirstItem, RemoveLastItem, RemoveFirstInsertLast, RemoveLastInsertFirst,
		RemoveFirstInsertFirst, RemoveLastInsertLast, InsertAtSortPositionRemoveLast, InsertAtSortPositionRemoveFirst:
		return true
	}
	return false
}

// isResultWindowInBuffer is true if all rows of the result window are in the buffer.
func (b *ResultWindowBuffer[D]) isResultWindowInBuffer() bool {
	start := b.skip() - b.Offset
	if start < 0 {
		return false
	}
	if b.Complete {
		return true
	}
	return b.QueryParams.Limit != nil && len(b.Buffer) >= start+*b.QueryParams.Limit
}

// trim removes rows before the window that are more than SkipBufferSize
// and rows after the window that are more than LimitBufferSize.
func (b *ResultWindowBuffer[D]) trim() {
	getID := b.QueryParams.GetDocumentID
	rowsBeforeWindow := b.skip() - b.Offset
	removeFromStart := min(rowsBeforeWindow-b.SkipBufferSize, len(b.Buffer))
	if removeFromStart > 0 {
		for _, doc := range b.Buffer[:removeFromStart] {
			delete(b.KeyDocumentMap, getID(doc))
		}
		b.Buffer = append(b.Buffer[:0], b.Buffer[removeFromStart:]...)
		b.Offset += removeFromStart
	}

	if b.QueryParams.Limit != nil {
		maxLength := max(0, b.skip()-b.Offset) + *b.QueryParams.Limit + b.LimitBufferSize
		if len(b.Buffer) > maxLength {
			for _, doc := range b.Buffer[maxLength:] {
				delete(b.KeyDocumentMap, getID(doc))
			}
			b.Buffer = b.Buffer[:maxLength]
			b.Complete = false
		}
	}
}

// applySliceRule applies the slice rule:
// Exactly Offset matching rows sort before the first row of the buffer,
// and all matching rows that sort between the first and the last row are in the buffer.
// After the change event, this is still true for the old first and last row, so:
//   - the old version of the changed row is removed from the buffer,
//   - the new version is added if it sorts between the old first and last row,
//   - Offset changes by one if the changed row moved into or out of the rows before the first row.
//
// If Offset is 0, there are no rows before the first row, so a row that sorts before it is added.
// If the buffer is complete, there are no rows after the last row, so a row that sorts after it is added.
//
// An empty buffer (only valid when complete) knows only the number of rows before it.
// There, Offset is only an upper bound, which stays an upper bound with the same update.
func (b *ResultWindowBuffer[D]) applySliceRule(changeEvent ChangeEvent[D]) {
	queryParams := b.QueryParams
	wasMatching := changeEvent.HasPrevious() && queryParams.QueryMatcher(changeEvent.Previous)
	doesMatchNow := changeEvent.HasDoc() && queryParams.QueryMatcher(changeEvent.Doc)

	if len(b.Buffer) == 0 {
		if b.Offset == 0 {
			// there are no rows at all
			if doesMatchNow {
				b.insertAtSortPosition(changeEvent.Doc)
			}
		} else {
			b.Offset += boolToInt(doesMatchNow) - boolToInt(wasMatching)
		}
		return
	}

	first := b.Buffer[0]
	last := b.Buffer[len(b.Buffer)-1]
	hasRowsBefore := b.Offset > 0
	wasBefore := wasMatching && hasRowsBefore && b.compareRows(changeEvent.Previous, first) < 0
	isBeforeNow := doesMatchNow && hasRowsBefore && b.compareRows(changeEvent.Doc, first) < 0

	id := changeEvent.ID
	if _, ok := b.KeyDocumentMap[id]; ok {
		delete(b.KeyDocumentMap, id)
		if index := IndexOfDocumentID(queryParams, b.Buffer, id); index >= 0 {
			b.Buffer = removeAt(b.Buffer, index)
		}
	}
	if doesMatchNow && !isBeforeNow && (b.Complete || b.compareRows(changeEvent.Doc, last) <= 0) {
		b.insertAtSortPosition(changeEvent.Doc)
	}
	b.Offset += boolToInt(isBeforeNow) - boolToInt(wasBefore)
}

// compareRows compares two rows with the sort comparator of the query.
// Returns 0 only for two versions of the same row that sort at the same position.
// For different rows that the comparator sees as equal,
// the primary key decides, so that the order is always deterministic.
func (b *ResultWindowBuffer[D]) compareRows(a, c D) int {
	idA := b.QueryParams.GetDocumentID(a)
	idC := b.QueryParams.GetDocumentID(c)
	result := sign(b.QueryParams.SortComparator(a, c))
	if idA == idC {
		// A deterministic comparator breaks ties by the primary key,
		// which gives the same answer for both directions when the sort values are equal.
		if result == 0 || result == sign(b.QueryParams.SortComparator(c, a)) {
			return 0
		}
		return result
	}
	if result != 0 {
		return result
	}
	if idA < idC {
		return -1
	}
	return 1
}

func (b *ResultWindowBuffer[D]) insertAtSortPosition(doc D) {
	// binary search for the first row that sorts after doc
	low, high := 0, len(b.Buffer)
	for low < high {
		mid := int(uint(low+high) >> 1)
		if b.compareRows(b.Buffer[mid], doc) < 0 {
			low = mid + 1
		} else {
			high = mid
		}
	}
	b.Buffer = insertAt(b.Buffer, low, doc)
	b.KeyDocumentMap[b.QueryParams.GetDocumentID(doc)] = doc
}

func sign(value int) int {
	switch {
	case value < 0:
		return -1
	case value > 0:
		return 1
	}
	return 0
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}
