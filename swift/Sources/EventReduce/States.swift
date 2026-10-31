/// All states, in the same order as the JavaScript implementation.
/// The BDD references the states by their index in this list.
public let orderedStateList: [StateName] = StateName.allCases

public func hasLimit<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    guard let limit = input.queryParams.limit else { return false }
    return limit > 0
}

public func isFindOne<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    input.queryParams.limit == 1
}

public func hasSkip<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    guard let skip = input.queryParams.skip else { return false }
    return skip > 0
}

public func isDelete<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    if case .delete = input.changeEvent { return true }
    return false
}

public func isInsert<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    if case .insert = input.changeEvent { return true }
    return false
}

public func isUpdate<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    if case .update = input.changeEvent { return true }
    return false
}

public func wasLimitReached<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    guard let limit = input.queryParams.limit else { return false }
    return limit > 0 && input.previousResults.count >= limit
}

public func sortParamsChanged<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    guard let doc = input.changeEvent.doc else { return false }
    guard let prev = input.changeEvent.previous else { return true }
    return input.queryParams.sortFieldsChanged(prev, doc)
}

public func wasInResult<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    let id = input.changeEvent.id
    if let map = input.keyDocumentMap {
        return map[id] != nil
    }
    return indexOfDocumentId(input.queryParams, input.previousResults, id) != nil
}

public func wasFirst<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    guard let first = input.previousResults.first else { return false }
    return input.queryParams.getDocumentId(first) == input.changeEvent.id
}

public func wasLast<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    guard let last = input.previousResults.last else { return false }
    return input.queryParams.getDocumentId(last) == input.changeEvent.id
}

/// Returns true if the changed document is the given result item.
/// Then we cannot sort-compare them, because it might end in a non-deterministic
/// sort order. Because both document could be equal.
/// So instead the sort states have to return true.
private func isChangedDoc<D>(_ input: StateResolveFunctionInput<D>, _ resultItem: D) -> Bool {
    input.queryParams.getDocumentId(resultItem) == input.changeEvent.id
}

public func wasSortedBeforeFirst<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    guard let prev = input.changeEvent.previous, let first = input.previousResults.first else { return false }
    return isChangedDoc(input, first) || input.queryParams.areInIncreasingOrder(prev, first)
}

public func wasSortedAfterLast<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    guard let prev = input.changeEvent.previous, let last = input.previousResults.last else { return false }
    return isChangedDoc(input, last) || input.queryParams.areInIncreasingOrder(last, prev)
}

/// If the changed document is the first or last document,
/// the new document is compared with the neighbor instead,
/// so we know if the changed document still sorts first or last.
/// If there is no neighbor, the changed document is still first or last.
public func isSortedBeforeFirst<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    let results = input.previousResults
    guard let doc = input.changeEvent.doc, var first = results.first else { return false }
    if isChangedDoc(input, first) {
        guard results.count > 1 else { return true }
        first = results[1]
    }
    return input.queryParams.areInIncreasingOrder(doc, first)
}

public func isSortedAfterLast<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    let results = input.previousResults
    guard let doc = input.changeEvent.doc, var last = results.last else { return false }
    if isChangedDoc(input, last) {
        guard results.count > 1 else { return true }
        last = results[results.count - 2]
    }
    return input.queryParams.areInIncreasingOrder(last, doc)
}

public func wasMatching<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    guard let prev = input.changeEvent.previous else { return false }
    return input.queryParams.queryMatcher(prev)
}

public func doesMatchNow<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    guard let doc = input.changeEvent.doc else { return false }
    return input.queryParams.queryMatcher(doc)
}

public func wasResultsEmpty<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    input.previousResults.isEmpty
}

public func resolveState<D>(_ state: StateName, _ input: StateResolveFunctionInput<D>) -> Bool {
    switch state {
    case .isInsert: return isInsert(input)
    case .isUpdate: return isUpdate(input)
    case .isDelete: return isDelete(input)
    case .hasLimit: return hasLimit(input)
    case .isFindOne: return isFindOne(input)
    case .hasSkip: return hasSkip(input)
    case .wasResultsEmpty: return wasResultsEmpty(input)
    case .wasLimitReached: return wasLimitReached(input)
    case .wasFirst: return wasFirst(input)
    case .wasLast: return wasLast(input)
    case .sortParamsChanged: return sortParamsChanged(input)
    case .wasInResult: return wasInResult(input)
    case .wasSortedBeforeFirst: return wasSortedBeforeFirst(input)
    case .wasSortedAfterLast: return wasSortedAfterLast(input)
    case .isSortedBeforeFirst: return isSortedBeforeFirst(input)
    case .isSortedAfterLast: return isSortedAfterLast(input)
    case .wasMatching: return wasMatching(input)
    case .doesMatchNow: return doesMatchNow(input)
    }
}

/// Resolves the state with the given index in `orderedStateList`.
public func resolveStateByIndex<D>(_ index: Int, _ input: StateResolveFunctionInput<D>) -> Bool {
    resolveState(orderedStateList[index], input)
}

/// Returns the binary representation of all states
/// like '010110110111...' where the first '0' means that the first state is false.
public func getStateSet<D>(_ input: StateResolveFunctionInput<D>) -> String {
    orderedStateList.map { resolveState($0, input) ? "1" : "0" }.joined()
}
