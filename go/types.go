// Package eventreduce updates live query results from database change events
// without running the query over the database again.
//
// It only resolves the BDD that the JavaScript implementation created,
// the BDD is not created or optimized here.
package eventreduce

import "errors"

// WriteOperation is the kind of a write on the database.
type WriteOperation string

// The write operations.
const (
	Insert WriteOperation = "INSERT"
	Update WriteOperation = "UPDATE"
	Delete WriteOperation = "DELETE"
)

// ChangeEvent is a write event on the database.
// ID is the value of the primary key of the changed document.
// Doc is the document after the write, it is not set on deletes.
// Previous is the document before the write, it is not set on inserts.
type ChangeEvent[D any] struct {
	Operation WriteOperation
	ID        string
	Doc       D
	Previous  D
}

// HasDoc is false on deletes.
func (e ChangeEvent[D]) HasDoc() bool { return e.Operation != Delete }

// HasPrevious is false on inserts.
func (e ChangeEvent[D]) HasPrevious() bool { return e.Operation != Insert }

// InsertEvent creates the event of an inserted document.
func InsertEvent[D any](id string, doc D) ChangeEvent[D] {
	return ChangeEvent[D]{Operation: Insert, ID: id, Doc: doc}
}

// UpdateEvent creates the event of an updated document.
func UpdateEvent[D any](id string, doc D, previous D) ChangeEvent[D] {
	return ChangeEvent[D]{Operation: Update, ID: id, Doc: doc, Previous: previous}
}

// DeleteEvent creates the event of a deleted document.
func DeleteEvent[D any](id string, previous D) ChangeEvent[D] {
	return ChangeEvent[D]{Operation: Delete, ID: id, Previous: previous}
}

// QueryParams describes the query whose results are kept up to date.
type QueryParams[D any] struct {
	// GetDocumentID returns the id of a document.
	// It must return the same value as the id of the change events.
	GetDocumentID func(doc D) string
	// Skip is the number of rows to skip, nil for none.
	Skip *int
	// Limit is the maximum number of rows, nil for no limit.
	Limit *int
	// QueryMatcher returns true if the document matches the query.
	QueryMatcher func(doc D) bool
	// SortComparator must never return 0 for two different documents,
	// so that the sorting is deterministic.
	// Use the primary key as last sort field to ensure that.
	SortComparator func(a, b D) int
	// SortFieldsChanged returns true if any of the fields that the query sorts by
	// differs between the previous and the new version of a document.
	SortFieldsChanged func(previous, doc D) bool
}

// Int returns a pointer to the given value, for the Skip and Limit of QueryParams.
func Int(value int) *int { return &value }

func (q QueryParams[D]) withSkipAndLimit(skip, limit *int) QueryParams[D] {
	q.Skip = skip
	q.Limit = limit
	return q
}

// StateResolveFunctionInput is the input of the state functions, of the action functions
// and of CalculateActionName.
// Action functions change PreviousResults and KeyDocumentMap.
type StateResolveFunctionInput[D any] struct {
	QueryParams QueryParams[D]
	ChangeEvent ChangeEvent[D]
	// PreviousResults are the results of the query before the change event.
	PreviousResults []D
	// KeyDocumentMap maps the id of each document in the results to the document, nil for none.
	KeyDocumentMap map[string]D
}

// ActionName is an action, in the same order as the JavaScript implementation.
type ActionName int

// The actions.
const (
	DoNothing ActionName = iota
	InsertFirst
	InsertLast
	RemoveFirstItem
	RemoveLastItem
	RemoveFirstInsertLast
	RemoveLastInsertFirst
	RemoveFirstInsertFirst
	RemoveLastInsertLast
	RemoveExisting
	ReplaceExisting
	// AlwaysWrong is only used by the truth-table generator, it is never returned by the BDD.
	AlwaysWrong
	InsertAtSortPosition
	RemoveExistingAndInsertAtSortPosition
	InsertAtSortPositionRemoveLast
	InsertAtSortPositionRemoveFirst
	RunFullQueryAgain
	// UnknownAction is returned if a state was never reached, so the correct action is not known.
	UnknownAction
)

var actionNames = [...]string{
	"doNothing",
	"insertFirst",
	"insertLast",
	"removeFirstItem",
	"removeLastItem",
	"removeFirstInsertLast",
	"removeLastInsertFirst",
	"removeFirstInsertFirst",
	"removeLastInsertLast",
	"removeExisting",
	"replaceExisting",
	"alwaysWrong",
	"insertAtSortPosition",
	"removeExistingAndInsertAtSortPosition",
	"insertAtSortPositionRemoveLast",
	"insertAtSortPositionRemoveFirst",
	"runFullQueryAgain",
	"unknownAction",
}

// String returns the name as used by the JavaScript implementation.
func (a ActionName) String() string { return actionNames[a] }

// OrderedActionList has all actions, in the same order as the JavaScript implementation.
// The BDD references the actions by their index in this list.
var OrderedActionList = func() []ActionName {
	list := make([]ActionName, len(actionNames))
	for i := range list {
		list[i] = ActionName(i)
	}
	return list
}()

// StateName is a state, in the same order as the JavaScript implementation.
type StateName int

// The states.
const (
	IsInsert StateName = iota
	IsUpdate
	IsDelete
	HasLimit
	IsFindOne
	HasSkip
	WasResultsEmpty
	WasLimitReached
	WasFirst
	WasLast
	SortParamsChanged
	WasInResult
	WasSortedBeforeFirst
	WasSortedAfterLast
	IsSortedBeforeFirst
	IsSortedAfterLast
	WasMatching
	DoesMatchNow
)

var stateNames = [...]string{
	"isInsert",
	"isUpdate",
	"isDelete",
	"hasLimit",
	"isFindOne",
	"hasSkip",
	"wasResultsEmpty",
	"wasLimitReached",
	"wasFirst",
	"wasLast",
	"sortParamsChanged",
	"wasInResult",
	"wasSortedBeforeFirst",
	"wasSortedAfterLast",
	"isSortedBeforeFirst",
	"isSortedAfterLast",
	"wasMatching",
	"doesMatchNow",
}

// String returns the name as used by the JavaScript implementation.
func (s StateName) String() string { return stateNames[s] }

// OrderedStateList has all states, in the same order as the JavaScript implementation.
// The BDD references the states by their index in this list.
var OrderedStateList = func() []StateName {
	list := make([]StateName, len(stateNames))
	for i := range list {
		list[i] = StateName(i)
	}
	return list
}()

// The errors, with the codes of the JavaScript implementation.
var (
	// ErrRunFullQueryAgain is returned by RunAction for RunFullQueryAgain,
	// the query must be run over the database again.
	ErrRunFullQueryAgain = errors.New("EventReduce:RUN_FULL")
	// ErrUnknownAction is returned by RunAction for UnknownAction and AlwaysWrong.
	ErrUnknownAction = errors.New("EventReduce:UNK_ACT")
	// ErrResultWindowOutdated is returned when the results of a result window buffer are read
	// although its result window is not in the buffer.
	ErrResultWindowOutdated = errors.New("EventReduce:RWB_OUTDATED")
	// ErrInvalidResultWindowBufferSize is returned for a negative buffer size.
	ErrInvalidResultWindowBufferSize = errors.New("EventReduce:RWB_SIZE")
)
