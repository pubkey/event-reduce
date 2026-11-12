/// A write event on the database.
/// `id` is the value of the primary key of the changed document.
public enum ChangeEvent<D> {
    case insert(id: String, doc: D)
    case update(id: String, doc: D, previous: D)
    case delete(id: String, previous: D)

    public var id: String {
        switch self {
        case .insert(let id, _), .update(let id, _, _), .delete(let id, _):
            return id
        }
    }

    /// The document after the write, nil on deletes.
    public var doc: D? {
        switch self {
        case .insert(_, let doc), .update(_, let doc, _): return doc
        case .delete: return nil
        }
    }

    /// The document before the write, nil on inserts.
    public var previous: D? {
        switch self {
        case .update(_, _, let previous), .delete(_, let previous): return previous
        case .insert: return nil
        }
    }
}

/// Describes the query whose results are kept up to date.
public struct QueryParams<D> {
    /// Returns the id of a document.
    /// Must return the same value as the id of the change events.
    public var getDocumentId: (D) -> String
    public var skip: Int?
    public var limit: Int?
    /// Returns true if the document matches the query.
    public var queryMatcher: (D) -> Bool
    /// Returns true if the first document is sorted before the second one,
    /// like the predicate of `sorted(by:)`.
    /// To have a deterministic sorting, two different documents must never be equal,
    /// so use the primary key as last sort field.
    public var areInIncreasingOrder: (D, D) -> Bool
    /// Returns true if any of the fields that the query sorts by
    /// differs between the previous and the new version of a document.
    /// Called as `sortFieldsChanged(previous, doc)`.
    public var sortFieldsChanged: (D, D) -> Bool

    public init(
        getDocumentId: @escaping (D) -> String,
        skip: Int? = nil,
        limit: Int? = nil,
        queryMatcher: @escaping (D) -> Bool,
        areInIncreasingOrder: @escaping (D, D) -> Bool,
        sortFieldsChanged: @escaping (D, D) -> Bool
    ) {
        self.getDocumentId = getDocumentId
        self.skip = skip
        self.limit = limit
        self.queryMatcher = queryMatcher
        self.areInIncreasingOrder = areInIncreasingOrder
        self.sortFieldsChanged = sortFieldsChanged
    }
}

/// The id of a document as the key of a key document map.
///
/// Swift compares two `String`s by canonical equivalence, so the precomposed "é" (U+00E9)
/// and "e" with a combining accent (U+0065 U+0301) are equal and have the same hash.
/// Databases, and the other implementations of EventReduce, compare ids by their code units,
/// for them these are the ids of two different documents.
/// `DocumentId` is equal only if the UTF-8 bytes of the ids are equal.
/// It can be written as a string literal: `["a": doc]`.
public struct DocumentId: Hashable, ExpressibleByStringLiteral, CustomStringConvertible {
    /// The id of the document.
    public let string: String

    public init(_ string: String) {
        self.string = string
    }

    public init(stringLiteral value: String) {
        self.string = value
    }

    public var description: String { string }

    public static func == (lhs: DocumentId, rhs: DocumentId) -> Bool {
        isSameDocumentId(lhs.string, rhs.string)
    }

    public func hash(into hasher: inout Hasher) {
        for byte in string.utf8 {
            hasher.combine(byte)
        }
    }
}

/// True if the two ids have the same UTF-8 bytes.
/// Not `==`, which is also true for different ids that are canonically equivalent, see `DocumentId`.
@inlinable
public func isSameDocumentId(_ a: String, _ b: String) -> Bool {
    a.utf8.elementsEqual(b.utf8)
}

/// Map from the id of each document in the results to the document.
/// Create a key with `DocumentId(id)`.
public typealias ResultKeyDocumentMap<D> = [DocumentId: D]

/// The input of the state functions and of calculateActionName().
public struct StateResolveFunctionInput<D> {
    public let queryParams: QueryParams<D>
    public let changeEvent: ChangeEvent<D>
    public let previousResults: [D]
    public let keyDocumentMap: ResultKeyDocumentMap<D>?

    public init(
        queryParams: QueryParams<D>,
        changeEvent: ChangeEvent<D>,
        previousResults: [D],
        keyDocumentMap: ResultKeyDocumentMap<D>? = nil
    ) {
        self.queryParams = queryParams
        self.changeEvent = changeEvent
        self.previousResults = previousResults
        self.keyDocumentMap = keyDocumentMap
    }
}

public enum ActionName: String, CaseIterable {
    case doNothing
    case insertFirst
    case insertLast
    case removeFirstItem
    case removeLastItem
    case removeFirstInsertLast
    case removeLastInsertFirst
    case removeFirstInsertFirst
    case removeLastInsertLast
    case removeExisting
    case replaceExisting
    /// Only used by the truth-table generator, never returned by the BDD.
    case alwaysWrong
    case insertAtSortPosition
    case removeExistingAndInsertAtSortPosition
    case insertAtSortPositionRemoveLast
    case insertAtSortPositionRemoveFirst
    case runFullQueryAgain
    /// If a state was never reached, we do not know the correct action.
    case unknownAction
}

public enum StateName: String, CaseIterable {
    case isInsert
    case isUpdate
    case isDelete
    case hasLimit
    case isFindOne
    case hasSkip
    case wasResultsEmpty
    case wasLimitReached
    case wasFirst
    case wasLast
    case sortParamsChanged
    case wasInResult
    case wasSortedBeforeFirst
    case wasSortedAfterLast
    case isSortedBeforeFirst
    case isSortedAfterLast
    case wasMatching
    case doesMatchNow
}

/// Thrown by runAction() for the actions that cannot be applied to the results.
public enum EventReduceError: Error, Equatable {
    /// The query must be run over the database again.
    case runFullQueryAgain
    /// The action is not known to give correct results.
    case unknownAction
    /// The results of a result window buffer were read
    /// although its result window is not in the buffer.
    case resultWindowOutdated
    /// A buffer size of a result window buffer is negative.
    case invalidResultWindowBufferSize
    /// The limit of the query is negative. A limit of 0 is allowed, the query then returns no documents.
    case negativeLimit

    /// The error code that the JavaScript implementation throws as `EventReduce:<code>`.
    public var code: String {
        switch self {
        case .runFullQueryAgain: return "RUN_FULL"
        case .unknownAction: return "UNK_ACT"
        case .resultWindowOutdated: return "RWB_OUTDATED"
        case .invalidResultWindowBufferSize: return "RWB_SIZE"
        case .negativeLimit: return "NEG_LIMIT"
        }
    }
}
