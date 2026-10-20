public typealias StateResolveFunction<D> = (StateResolveFunctionInput<D>) -> Bool

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
    input.changeEvent.operation == .delete
}

public func isInsert<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    input.changeEvent.operation == .insert
}

public func isUpdate<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    input.changeEvent.operation == .update
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

public func isSortedBeforeFirst<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    guard let doc = input.changeEvent.doc, let first = input.previousResults.first else { return false }
    return isChangedDoc(input, first) || input.queryParams.areInIncreasingOrder(doc, first)
}

public func isSortedAfterLast<D>(_ input: StateResolveFunctionInput<D>) -> Bool {
    guard let doc = input.changeEvent.doc, let last = input.previousResults.last else { return false }
    return isChangedDoc(input, last) || input.queryParams.areInIncreasingOrder(last, doc)
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

/// Resolves the state with the given index in `orderedStateList`.
public func resolveStateByIndex<D>(_ index: Int, _ input: StateResolveFunctionInput<D>) -> Bool {
    switch index {
    case 0: return isInsert(input)
    case 1: return isUpdate(input)
    case 2: return isDelete(input)
    case 3: return hasLimit(input)
    case 4: return isFindOne(input)
    case 5: return hasSkip(input)
    case 6: return wasResultsEmpty(input)
    case 7: return wasLimitReached(input)
    case 8: return wasFirst(input)
    case 9: return wasLast(input)
    case 10: return sortParamsChanged(input)
    case 11: return wasInResult(input)
    case 12: return wasSortedBeforeFirst(input)
    case 13: return wasSortedAfterLast(input)
    case 14: return isSortedBeforeFirst(input)
    case 15: return isSortedAfterLast(input)
    case 16: return wasMatching(input)
    case 17: return doesMatchNow(input)
    default: fatalError("EventReduce:UNK_STATE \(index)")
    }
}

public func resolveState<D>(_ state: StateName, _ input: StateResolveFunctionInput<D>) -> Bool {
    resolveStateByIndex(orderedStateList.firstIndex(of: state)!, input)
}

/// Returns the binary representation of all states
/// like '010110110111...' where the first '0' means that the first state is false.
public func getStateSet<D>(_ input: StateResolveFunctionInput<D>) -> String {
    orderedStateList.map { resolveState($0, input) ? "1" : "0" }.joined()
}
