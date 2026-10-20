package com.github.pubkey.eventreduce

data class Human(val id: String, val age: Int, val name: String = "name-$id")

/** SELECT * FROM humans WHERE age > minAge ORDER BY age, id */
fun queryParams(minAge: Int, skip: Int? = null, limit: Int? = null): QueryParams<Human> =
    QueryParams(
        getDocumentId = { it.id },
        skip = skip,
        limit = limit,
        queryMatcher = { it.age > minAge },
        sortComparator = compareBy<Human> { it.age }.thenBy { it.id },
        sortFieldsChanged = { prev, doc -> prev.age != doc.age },
    )

fun insert(doc: Human): ChangeEvent<Human> = ChangeEvent.Insert(doc.id, doc)

fun update(previous: Human, doc: Human): ChangeEvent<Human> = ChangeEvent.Update(doc.id, doc, previous)

fun delete(previous: Human): ChangeEvent<Human> = ChangeEvent.Delete(previous.id, previous)

fun toMap(docs: List<Human>): MutableMap<String, Human> = docs.associateBy { it.id }.toMutableMap()

fun ids(docs: List<Human>): List<String> = docs.map { it.id }
