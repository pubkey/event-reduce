package eventreduce

import "strings"

// StateHasLimit is the state hasLimit.
func StateHasLimit[D any](input *StateResolveFunctionInput[D]) bool {
	limit := input.QueryParams.Limit
	return limit != nil && *limit > 0
}

// StateIsFindOne is the state isFindOne.
func StateIsFindOne[D any](input *StateResolveFunctionInput[D]) bool {
	limit := input.QueryParams.Limit
	return limit != nil && *limit == 1
}

// StateHasSkip is the state hasSkip.
func StateHasSkip[D any](input *StateResolveFunctionInput[D]) bool {
	skip := input.QueryParams.Skip
	return skip != nil && *skip > 0
}

// StateIsDelete is the state isDelete.
func StateIsDelete[D any](input *StateResolveFunctionInput[D]) bool {
	return input.ChangeEvent.Operation == Delete
}

// StateIsInsert is the state isInsert.
func StateIsInsert[D any](input *StateResolveFunctionInput[D]) bool {
	return input.ChangeEvent.Operation == Insert
}

// StateIsUpdate is the state isUpdate.
func StateIsUpdate[D any](input *StateResolveFunctionInput[D]) bool {
	return input.ChangeEvent.Operation == Update
}

// StateWasLimitReached is the state wasLimitReached.
func StateWasLimitReached[D any](input *StateResolveFunctionInput[D]) bool {
	limit := input.QueryParams.Limit
	return limit != nil && *limit > 0 && len(input.PreviousResults) >= *limit
}

// StateSortParamsChanged is the state sortParamsChanged.
func StateSortParamsChanged[D any](input *StateResolveFunctionInput[D]) bool {
	changeEvent := input.ChangeEvent
	if !changeEvent.HasDoc() {
		return false
	}
	if !changeEvent.HasPrevious() {
		return true
	}
	return input.QueryParams.SortFieldsChanged(changeEvent.Previous, changeEvent.Doc)
}

// StateWasInResult is the state wasInResult.
func StateWasInResult[D any](input *StateResolveFunctionInput[D]) bool {
	id := input.ChangeEvent.ID
	if input.KeyDocumentMap != nil {
		_, ok := input.KeyDocumentMap[id]
		return ok
	}
	return IndexOfDocumentID(input.QueryParams, input.PreviousResults, id) >= 0
}

// StateWasFirst is the state wasFirst.
func StateWasFirst[D any](input *StateResolveFunctionInput[D]) bool {
	results := input.PreviousResults
	return len(results) > 0 && input.QueryParams.GetDocumentID(results[0]) == input.ChangeEvent.ID
}

// StateWasLast is the state wasLast.
func StateWasLast[D any](input *StateResolveFunctionInput[D]) bool {
	results := input.PreviousResults
	return len(results) > 0 && input.QueryParams.GetDocumentID(results[len(results)-1]) == input.ChangeEvent.ID
}

// comparePreviousWithResult compares the previous document with the first or last result item.
// If the changed document is the result item itself,
// we cannot sort-compare them, because it might end in a non-deterministic
// sort order. Because both document could be equal.
// So instead we have to return true.
func comparePreviousWithResult[D any](input *StateResolveFunctionInput[D], first bool, expected func(int) bool) bool {
	results := input.PreviousResults
	if !input.ChangeEvent.HasPrevious() || len(results) == 0 {
		return false
	}
	resultItem := results[len(results)-1]
	if first {
		resultItem = results[0]
	}
	if input.QueryParams.GetDocumentID(resultItem) == input.ChangeEvent.ID {
		return true
	}
	return expected(input.QueryParams.SortComparator(input.ChangeEvent.Previous, resultItem))
}

// compareDocWithResult compares the new document with the first or last result item.
// If the changed document is the result item itself,
// it compares with the neighbor of the result item instead,
// so we know if the changed document still sorts first or last.
// If there is no neighbor, the changed document is still first or last.
func compareDocWithResult[D any](input *StateResolveFunctionInput[D], first bool, expected func(int) bool) bool {
	results := input.PreviousResults
	if !input.ChangeEvent.HasDoc() || len(results) == 0 {
		return false
	}
	resultItem := results[len(results)-1]
	if first {
		resultItem = results[0]
	}
	if input.QueryParams.GetDocumentID(resultItem) == input.ChangeEvent.ID {
		if len(results) < 2 {
			return true
		}
		resultItem = results[len(results)-2]
		if first {
			resultItem = results[1]
		}
	}
	return expected(input.QueryParams.SortComparator(input.ChangeEvent.Doc, resultItem))
}

func isNegative(c int) bool { return c < 0 }

func isPositive(c int) bool { return c > 0 }

// StateWasSortedBeforeFirst is the state wasSortedBeforeFirst.
func StateWasSortedBeforeFirst[D any](input *StateResolveFunctionInput[D]) bool {
	return comparePreviousWithResult(input, true, isNegative)
}

// StateWasSortedAfterLast is the state wasSortedAfterLast.
func StateWasSortedAfterLast[D any](input *StateResolveFunctionInput[D]) bool {
	return comparePreviousWithResult(input, false, isPositive)
}

// StateIsSortedBeforeFirst is the state isSortedBeforeFirst.
func StateIsSortedBeforeFirst[D any](input *StateResolveFunctionInput[D]) bool {
	return compareDocWithResult(input, true, isNegative)
}

// StateIsSortedAfterLast is the state isSortedAfterLast.
func StateIsSortedAfterLast[D any](input *StateResolveFunctionInput[D]) bool {
	return compareDocWithResult(input, false, isPositive)
}

// StateWasMatching is the state wasMatching.
func StateWasMatching[D any](input *StateResolveFunctionInput[D]) bool {
	return input.ChangeEvent.HasPrevious() && input.QueryParams.QueryMatcher(input.ChangeEvent.Previous)
}

// StateDoesMatchNow is the state doesMatchNow.
func StateDoesMatchNow[D any](input *StateResolveFunctionInput[D]) bool {
	return input.ChangeEvent.HasDoc() && input.QueryParams.QueryMatcher(input.ChangeEvent.Doc)
}

// StateWasResultsEmpty is the state wasResultsEmpty.
func StateWasResultsEmpty[D any](input *StateResolveFunctionInput[D]) bool {
	return len(input.PreviousResults) == 0
}

// resolveStateByIndex resolves the state with the given index in OrderedStateList.
func resolveStateByIndex[D any](index int, input *StateResolveFunctionInput[D]) bool {
	switch StateName(index) {
	case IsInsert:
		return StateIsInsert(input)
	case IsUpdate:
		return StateIsUpdate(input)
	case IsDelete:
		return StateIsDelete(input)
	case HasLimit:
		return StateHasLimit(input)
	case IsFindOne:
		return StateIsFindOne(input)
	case HasSkip:
		return StateHasSkip(input)
	case WasResultsEmpty:
		return StateWasResultsEmpty(input)
	case WasLimitReached:
		return StateWasLimitReached(input)
	case WasFirst:
		return StateWasFirst(input)
	case WasLast:
		return StateWasLast(input)
	case SortParamsChanged:
		return StateSortParamsChanged(input)
	case WasInResult:
		return StateWasInResult(input)
	case WasSortedBeforeFirst:
		return StateWasSortedBeforeFirst(input)
	case WasSortedAfterLast:
		return StateWasSortedAfterLast(input)
	case IsSortedBeforeFirst:
		return StateIsSortedBeforeFirst(input)
	case IsSortedAfterLast:
		return StateIsSortedAfterLast(input)
	case WasMatching:
		return StateWasMatching(input)
	case DoesMatchNow:
		return StateDoesMatchNow(input)
	}
	panic("EventReduce:UNK_STATE")
}

// ResolveState resolves the given state.
func ResolveState[D any](state StateName, input *StateResolveFunctionInput[D]) bool {
	return resolveStateByIndex(int(state), input)
}

// GetStateSet returns the binary representation of all states
// like '010110110111...' where the first '0' means that the first state is false.
func GetStateSet[D any](input *StateResolveFunctionInput[D]) string {
	var set strings.Builder
	for _, state := range OrderedStateList {
		if ResolveState(state, input) {
			set.WriteByte('1')
		} else {
			set.WriteByte('0')
		}
	}
	return set.String()
}
