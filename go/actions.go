package eventreduce

import "slices"

// ActionFunction applies an action.
// For performance reasons, it changes the PreviousResults and the KeyDocumentMap of the input.
type ActionFunction[D any] func(input *StateResolveFunctionInput[D]) error

// GetActionFunction returns the function of the given action.
// AlwaysWrong is only used by the truth-table generator and never
// returned by the BDD, so it is handled like UnknownAction.
func GetActionFunction[D any](action ActionName) ActionFunction[D] {
	switch action {
	case DoNothing:
		return ActionDoNothing[D]
	case InsertFirst:
		return ActionInsertFirst[D]
	case InsertLast:
		return ActionInsertLast[D]
	case RemoveFirstItem:
		return ActionRemoveFirstItem[D]
	case RemoveLastItem:
		return ActionRemoveLastItem[D]
	case RemoveFirstInsertLast:
		return ActionRemoveFirstInsertLast[D]
	case RemoveLastInsertFirst:
		return ActionRemoveLastInsertFirst[D]
	case RemoveFirstInsertFirst:
		return ActionRemoveFirstInsertFirst[D]
	case RemoveLastInsertLast:
		return ActionRemoveLastInsertLast[D]
	case RemoveExisting:
		return ActionRemoveExisting[D]
	case ReplaceExisting:
		return ActionReplaceExisting[D]
	case InsertAtSortPosition:
		return ActionInsertAtSortPosition[D]
	case RemoveExistingAndInsertAtSortPosition:
		return ActionRemoveExistingAndInsertAtSortPosition[D]
	case InsertAtSortPositionRemoveLast:
		return ActionInsertAtSortPositionRemoveLast[D]
	case InsertAtSortPositionRemoveFirst:
		return ActionInsertAtSortPositionRemoveFirst[D]
	case RunFullQueryAgain:
		return ActionRunFullQueryAgain[D]
	}
	return ActionUnknownAction[D]
}

// setKeyDocument sets the document in the key document map, if there is one.
func setKeyDocument[D any](input *StateResolveFunctionInput[D], id string, doc D) {
	if input.KeyDocumentMap != nil {
		input.KeyDocumentMap[id] = doc
	}
}

// deleteKeyDocument removes the document from the key document map, if there is one.
func deleteKeyDocument[D any](input *StateResolveFunctionInput[D], id string) {
	if input.KeyDocumentMap != nil {
		delete(input.KeyDocumentMap, id)
	}
}

// findIndexOfChangedDoc returns the index of the changed document inside of the previous results or -1.
func findIndexOfChangedDoc[D any](input *StateResolveFunctionInput[D]) int {
	id := input.ChangeEvent.ID
	if input.KeyDocumentMap != nil {
		if _, ok := input.KeyDocumentMap[id]; !ok {
			return -1
		}
	}
	return IndexOfDocumentID(input.QueryParams, input.PreviousResults, id)
}

// ActionDoNothing is the action doNothing.
func ActionDoNothing[D any](_ *StateResolveFunctionInput[D]) error { return nil }

// ActionInsertFirst is the action insertFirst.
func ActionInsertFirst[D any](input *StateResolveFunctionInput[D]) error {
	if !input.ChangeEvent.HasDoc() {
		return ErrUnknownAction
	}
	doc := input.ChangeEvent.Doc
	input.PreviousResults = slices.Insert(input.PreviousResults, 0, doc)
	setKeyDocument(input, input.ChangeEvent.ID, doc)
	return nil
}

// ActionInsertLast is the action insertLast.
func ActionInsertLast[D any](input *StateResolveFunctionInput[D]) error {
	if !input.ChangeEvent.HasDoc() {
		return ErrUnknownAction
	}
	doc := input.ChangeEvent.Doc
	input.PreviousResults = append(input.PreviousResults, doc)
	setKeyDocument(input, input.ChangeEvent.ID, doc)
	return nil
}

// removeItemAt removes the result at the index and its entry in the key document map.
func removeItemAt[D any](input *StateResolveFunctionInput[D], index int) {
	deleteKeyDocument(input, input.QueryParams.GetDocumentID(input.PreviousResults[index]))
	input.PreviousResults = slices.Delete(input.PreviousResults, index, index+1)
}

// ActionRemoveFirstItem is the action removeFirstItem.
func ActionRemoveFirstItem[D any](input *StateResolveFunctionInput[D]) error {
	if len(input.PreviousResults) > 0 {
		removeItemAt(input, 0)
	}
	return nil
}

// ActionRemoveLastItem is the action removeLastItem.
func ActionRemoveLastItem[D any](input *StateResolveFunctionInput[D]) error {
	if len(input.PreviousResults) > 0 {
		removeItemAt(input, len(input.PreviousResults)-1)
	}
	return nil
}

// ActionRemoveFirstInsertLast is the action removeFirstInsertLast.
func ActionRemoveFirstInsertLast[D any](input *StateResolveFunctionInput[D]) error {
	_ = ActionRemoveFirstItem(input)
	return ActionInsertLast(input)
}

// ActionRemoveLastInsertFirst is the action removeLastInsertFirst.
func ActionRemoveLastInsertFirst[D any](input *StateResolveFunctionInput[D]) error {
	_ = ActionRemoveLastItem(input)
	return ActionInsertFirst(input)
}

// ActionRemoveFirstInsertFirst is the action removeFirstInsertFirst.
func ActionRemoveFirstInsertFirst[D any](input *StateResolveFunctionInput[D]) error {
	_ = ActionRemoveFirstItem(input)
	return ActionInsertFirst(input)
}

// ActionRemoveLastInsertLast is the action removeLastInsertLast.
func ActionRemoveLastInsertLast[D any](input *StateResolveFunctionInput[D]) error {
	_ = ActionRemoveLastItem(input)
	return ActionInsertLast(input)
}

// ActionRemoveExisting is the action removeExisting.
func ActionRemoveExisting[D any](input *StateResolveFunctionInput[D]) error {
	index := findIndexOfChangedDoc(input)
	deleteKeyDocument(input, input.ChangeEvent.ID)
	if index >= 0 {
		input.PreviousResults = slices.Delete(input.PreviousResults, index, index+1)
	}
	return nil
}

// ActionReplaceExisting is the action replaceExisting.
func ActionReplaceExisting[D any](input *StateResolveFunctionInput[D]) error {
	index := findIndexOfChangedDoc(input)
	if index < 0 {
		return nil
	}
	if !input.ChangeEvent.HasDoc() {
		return ErrUnknownAction
	}
	doc := input.ChangeEvent.Doc
	input.PreviousResults[index] = doc
	setKeyDocument(input, input.ChangeEvent.ID, doc)
	return nil
}

// ActionInsertAtSortPosition is the action insertAtSortPosition.
func ActionInsertAtSortPosition[D any](input *StateResolveFunctionInput[D]) error {
	if !input.ChangeEvent.HasDoc() {
		return ErrUnknownAction
	}
	doc := input.ChangeEvent.Doc
	id := input.ChangeEvent.ID
	// If document is already in results,
	// we cannot add it again because it would throw on non-deterministic ordering.
	if input.KeyDocumentMap != nil {
		if _, ok := input.KeyDocumentMap[id]; ok {
			return nil
		}
		input.KeyDocumentMap[id] = doc
	} else if IndexOfDocumentID(input.QueryParams, input.PreviousResults, id) >= 0 {
		return nil
	}
	input.PreviousResults = PushAtSortPosition(input.PreviousResults, doc, input.QueryParams.SortComparator)
	return nil
}

// ActionRemoveExistingAndInsertAtSortPosition is the action removeExistingAndInsertAtSortPosition.
func ActionRemoveExistingAndInsertAtSortPosition[D any](input *StateResolveFunctionInput[D]) error {
	_ = ActionRemoveExisting(input)
	return ActionInsertAtSortPosition(input)
}

// insertAtSortPositionAndRemove inserts the document at its sort position
// and then applies remove, but only if the document was inserted:
// ActionInsertAtSortPosition does nothing if the document is already in the results.
func insertAtSortPositionAndRemove[D any](input *StateResolveFunctionInput[D], remove ActionFunction[D]) error {
	lengthBefore := len(input.PreviousResults)
	if err := ActionInsertAtSortPosition(input); err != nil {
		return err
	}
	if len(input.PreviousResults) > lengthBefore {
		return remove(input)
	}
	return nil
}

// ActionInsertAtSortPositionRemoveLast inserts the document at its sort position
// and then removes the last document.
// Used when the limit was reached and the new document
// sorts in between the first and the last document,
// so the previous last document is pushed out of the results.
func ActionInsertAtSortPositionRemoveLast[D any](input *StateResolveFunctionInput[D]) error {
	return insertAtSortPositionAndRemove(input, ActionRemoveLastItem[D])
}

// ActionInsertAtSortPositionRemoveFirst inserts the document at its sort position
// and then removes the first document.
// Used when a document moves out of the skipped documents into the results,
// so the previous first document is pushed into the skipped documents.
func ActionInsertAtSortPositionRemoveFirst[D any](input *StateResolveFunctionInput[D]) error {
	return insertAtSortPositionAndRemove(input, ActionRemoveFirstItem[D])
}

// ActionRunFullQueryAgain is the action runFullQueryAgain, it always returns ErrRunFullQueryAgain.
func ActionRunFullQueryAgain[D any](_ *StateResolveFunctionInput[D]) error {
	return ErrRunFullQueryAgain
}

// ActionUnknownAction is the action unknownAction, it always returns ErrUnknownAction.
func ActionUnknownAction[D any](_ *StateResolveFunctionInput[D]) error {
	return ErrUnknownAction
}
