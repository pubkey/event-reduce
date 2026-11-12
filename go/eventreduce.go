package eventreduce

// CalculateActionName returns the action that transforms the previous results into the new results.
// If it is RunFullQueryAgain, the query must be run over the database again.
// For a query with limit 0 it is always DoNothing.
// Returns UnknownAction and ErrNegativeLimit for a negative limit.
func CalculateActionName[D any](input *StateResolveFunctionInput[D]) (ActionName, error) {
	index, err := ResolveInput(input)
	if err != nil {
		return UnknownAction, err
	}
	return OrderedActionList[index], nil
}

// RunAction applies the action to the results and returns the new results.
// Like append(), the returned slice can share memory with previousResults.
// The keyDocumentMap, if not nil, is kept in sync with the results.
// Returns ErrRunFullQueryAgain for RunFullQueryAgain and ErrUnknownAction for UnknownAction.
func RunAction[D any](
	action ActionName,
	queryParams QueryParams[D],
	changeEvent ChangeEvent[D],
	previousResults []D,
	keyDocumentMap map[string]D,
) ([]D, error) {
	input := &StateResolveFunctionInput[D]{
		QueryParams:     queryParams,
		ChangeEvent:     changeEvent,
		PreviousResults: previousResults,
		KeyDocumentMap:  keyDocumentMap,
	}
	err := GetActionFunction[D](action)(input)
	return input.PreviousResults, err
}
