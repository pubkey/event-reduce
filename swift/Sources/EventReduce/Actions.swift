/// Action functions mutate the results and the key document map in place.
public typealias ActionFunction<D> = (
    _ queryParams: QueryParams<D>,
    _ changeEvent: ChangeEvent<D>,
    _ previousResults: inout [D],
    _ keyDocumentMap: inout ResultKeyDocumentMap<D>?
) throws -> Void

/// All actions, in the same order as the JavaScript implementation.
/// The BDD references the actions by their index in this list.
public let orderedActionList: [ActionName] = ActionName.allCases

/// Returns the function of the given action.
/// alwaysWrong is only used by the truth-table generator and never
/// returned by the BDD, so it is mapped to unknownAction here.
public func actionFunction<D>(_ action: ActionName) -> ActionFunction<D> {
    switch action {
    case .doNothing: return doNothing
    case .insertFirst: return insertFirst
    case .insertLast: return insertLast
    case .removeFirstItem: return removeFirstItem
    case .removeLastItem: return removeLastItem
    case .removeFirstInsertLast: return removeFirstInsertLast
    case .removeLastInsertFirst: return removeLastInsertFirst
    case .removeFirstInsertFirst: return removeFirstInsertFirst
    case .removeLastInsertLast: return removeLastInsertLast
    case .removeExisting: return removeExisting
    case .replaceExisting: return replaceExisting
    case .alwaysWrong: return unknownAction
    case .insertAtSortPosition: return insertAtSortPosition
    case .removeExistingAndInsertAtSortPosition: return removeExistingAndInsertAtSortPosition
    case .insertAtSortPositionRemoveLast: return insertAtSortPositionRemoveLast
    case .insertAtSortPositionRemoveFirst: return insertAtSortPositionRemoveFirst
    case .runFullQueryAgain: return runFullQueryAgain
    case .unknownAction: return unknownAction
    }
}

/// Returns the index of the changed document inside of the previous results.
private func findIndexOfChangedDoc<D>(
    _ queryParams: QueryParams<D>,
    _ changeEvent: ChangeEvent<D>,
    _ results: [D],
    _ map: ResultKeyDocumentMap<D>?
) -> Int? {
    let id = changeEvent.id
    if let map = map, map[id] == nil {
        return nil
    }
    return indexOfDocumentId(queryParams, results, id)
}

/// The new document of the change event.
/// Only the BDD knows that it exists for the given action.
private func changedDoc<D>(_ changeEvent: ChangeEvent<D>) throws -> D {
    guard let doc = changeEvent.doc else { throw EventReduceError.unknownAction }
    return doc
}

public func doNothing<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {}

public func insertFirst<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    let doc = try changedDoc(changeEvent)
    results.insert(doc, at: 0)
    map?[changeEvent.id] = doc
}

public func insertLast<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    let doc = try changedDoc(changeEvent)
    results.append(doc)
    map?[changeEvent.id] = doc
}

public func removeFirstItem<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    guard !results.isEmpty else { return }
    let first = results.removeFirst()
    map?.removeValue(forKey: queryParams.getDocumentId(first))
}

public func removeLastItem<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    guard let last = results.popLast() else { return }
    map?.removeValue(forKey: queryParams.getDocumentId(last))
}

public func removeFirstInsertLast<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    try removeFirstItem(queryParams, changeEvent, &results, &map)
    try insertLast(queryParams, changeEvent, &results, &map)
}

public func removeLastInsertFirst<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    try removeLastItem(queryParams, changeEvent, &results, &map)
    try insertFirst(queryParams, changeEvent, &results, &map)
}

public func removeFirstInsertFirst<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    try removeFirstItem(queryParams, changeEvent, &results, &map)
    try insertFirst(queryParams, changeEvent, &results, &map)
}

public func removeLastInsertLast<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    try removeLastItem(queryParams, changeEvent, &results, &map)
    try insertLast(queryParams, changeEvent, &results, &map)
}

public func removeExisting<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    let index = findIndexOfChangedDoc(queryParams, changeEvent, results, map)
    map?.removeValue(forKey: changeEvent.id)
    if let index = index {
        results.remove(at: index)
    }
}

public func replaceExisting<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    guard let index = findIndexOfChangedDoc(queryParams, changeEvent, results, map) else { return }
    let doc = try changedDoc(changeEvent)
    results[index] = doc
    map?[changeEvent.id] = doc
}

public func insertAtSortPosition<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    let doc = try changedDoc(changeEvent)
    let id = changeEvent.id
    // If document is already in results,
    // we cannot add it again because it would throw on non-deterministic ordering.
    let isDocInResults: Bool
    if let map = map {
        isDocInResults = map[id] != nil
    } else {
        isDocInResults = indexOfDocumentId(queryParams, results, id) != nil
    }
    if isDocInResults {
        return
    }
    map?[id] = doc
    pushAtSortPosition(&results, doc, by: queryParams.areInIncreasingOrder)
}

public func removeExistingAndInsertAtSortPosition<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    try removeExisting(queryParams, changeEvent, &results, &map)
    try insertAtSortPosition(queryParams, changeEvent, &results, &map)
}

/// Inserts the document at its sort position and then removes the last document.
/// Used when the limit was reached and the new document
/// sorts in between the first and the last document,
/// so the previous last document is pushed out of the results.
public func insertAtSortPositionRemoveLast<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    try insertAtSortPositionAndRemove(removeLastItem, queryParams, changeEvent, &results, &map)
}

/// Inserts the document at its sort position and then removes the first document.
/// Used when a document moves out of the skipped documents into the results,
/// so the previous first document is pushed into the skipped documents.
public func insertAtSortPositionRemoveFirst<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    try insertAtSortPositionAndRemove(removeFirstItem, queryParams, changeEvent, &results, &map)
}

private func insertAtSortPositionAndRemove<D>(
    _ remove: ActionFunction<D>,
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    let countBefore = results.count
    try insertAtSortPosition(queryParams, changeEvent, &results, &map)
    // insertAtSortPosition() does nothing if the document is already in the results
    if results.count > countBefore {
        try remove(queryParams, changeEvent, &results, &map)
    }
}

public func runFullQueryAgain<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    throw EventReduceError.runFullQueryAgain
}

public func unknownAction<D>(
    _ queryParams: QueryParams<D>, _ changeEvent: ChangeEvent<D>,
    _ results: inout [D], _ map: inout ResultKeyDocumentMap<D>?
) throws {
    throw EventReduceError.unknownAction
}
