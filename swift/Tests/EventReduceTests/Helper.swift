import EventReduce

struct Human: Equatable {
    let id: String
    var age: Int
    var name: String

    init(_ id: String, _ age: Int, name: String? = nil) {
        self.id = id
        self.age = age
        self.name = name ?? "name-\(id)"
    }
}

/// SELECT * FROM humans WHERE age > minAge ORDER BY age, id
func queryParams(_ minAge: Int, skip: Int? = nil, limit: Int? = nil) -> QueryParams<Human> {
    QueryParams(
        getDocumentId: { $0.id },
        skip: skip,
        limit: limit,
        queryMatcher: { $0.age > minAge },
        areInIncreasingOrder: { ($0.age, $0.id) < ($1.age, $1.id) },
        sortFieldsChanged: { $0.age != $1.age }
    )
}

func insert(_ doc: Human) -> ChangeEvent<Human> { .insert(id: doc.id, doc: doc) }

func update(_ previous: Human, _ doc: Human) -> ChangeEvent<Human> {
    .update(id: doc.id, doc: doc, previous: previous)
}

func delete(_ previous: Human) -> ChangeEvent<Human> { .delete(id: previous.id, previous: previous) }

func toMap(_ docs: [Human]) -> [String: Human] {
    Dictionary(uniqueKeysWithValues: docs.map { ($0.id, $0) })
}

func ids(_ docs: [Human]) -> [String] { docs.map { $0.id } }
