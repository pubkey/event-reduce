package com.github.pubkey.eventreduce

import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotEquals
import kotlin.test.assertSame
import kotlin.test.assertTrue

/**
 * Port of javascript/test/unit/result-window-buffer.test.ts
 * After every event, the visible result must equal the full query,
 * and the buffer must be an exact slice of the full result.
 */
class ResultWindowBufferTest {
    data class Doc(val id: String, val age: Int, val female: Boolean = true)

    data class TestQuery(val asc: Boolean, val skip: Int? = null, val limit: Int? = null)

    private data class Weights(val insert: Double, val update: Double, val delete: Double)

    private val queries = listOf(
        TestQuery(true, limit = 20),
        TestQuery(false, limit = 20),
        TestQuery(true, skip = 10, limit = 20),
        TestQuery(false, skip = 10, limit = 20),
        TestQuery(true, limit = 1),
        TestQuery(false, skip = 3, limit = 5),
        // skip without limit
        TestQuery(true, skip = 5),
        // neither skip nor limit
        TestQuery(true),
    )
    private val all = RESULT_WINDOW_BUFFER_ALL_ROWS
    private val bufferSizes = listOf(0 to 0, 5 to 0, 0 to 5, 20 to 3, 50 to 20, all to all)
    private val initialRowsList = listOf(0, 30, 300)
    private val eventsPerRun = 600
    private val onlyInserts = Weights(1.0, 0.0, 0.0)

    /**
     * The query is always: female, sorted by age, then by id.
     * Age has only 100 different values, so many rows have the same age
     * and the id decides their order.
     */
    private fun queryParams(query: TestQuery): QueryParams<Doc> {
        val comparator = compareBy<Doc> { it.age }.thenBy { it.id }
        return QueryParams(
            getDocumentId = { it.id },
            skip = query.skip,
            limit = query.limit,
            queryMatcher = { it.female },
            sortComparator = if (query.asc) comparator else comparator.reversed(),
            sortFieldsChanged = { prev, doc -> prev.age != doc.age },
        )
    }

    private fun bufferOf(query: TestQuery, limitBufferSize: Int = 0, skipBufferSize: Int = 0) =
        createResultWindowBuffer(queryParams(query), limitBufferSize, skipBufferSize)

    /** Full query over all documents: filter, sort, skip, limit. */
    private fun runQuery(docs: Map<String, Doc>, params: QueryParams<Doc>, skip: Int, limit: Int?): List<Doc> {
        val all = docs.values.filter(params.queryMatcher).sortedWith(params.sortComparator)
        val start = minOf(skip, all.size)
        val end = if (limit == null) all.size else minOf(start + limit, all.size)
        return all.subList(start, end)
    }

    private fun fill(buffer: ResultWindowBuffer<Doc>, docs: Map<String, Doc>) {
        val query = getResultWindowBufferQuery(buffer)
        resetResultWindowBuffer(buffer, runQuery(docs, buffer.queryParams, query.skip, query.limit))
    }

    private fun ids(docs: List<Doc>) = docs.joinToString(",") { it.id }

    private fun results(buffer: ResultWindowBuffer<Doc>) = ids(getResultWindowBufferResults(buffer))

    private fun insert(doc: Doc): ChangeEvent<Doc> = ChangeEvent.Insert(doc.id, doc)

    private fun update(previous: Doc, doc: Doc): ChangeEvent<Doc> = ChangeEvent.Update(doc.id, doc, previous)

    private fun delete(previous: Doc): ChangeEvent<Doc> = ChangeEvent.Delete(previous.id, previous)

    /**
     * First more inserts, then mostly updates, then more deletes,
     * so that the result grows, moves around and shrinks to (almost) nothing.
     */
    private fun weights(eventIndex: Int): Weights {
        val phase = eventIndex.toDouble() / eventsPerRun
        return when {
            phase < 0.4 -> Weights(3.0, 5.0, 1.0)
            phase < 0.7 -> Weights(1.0, 8.0, 1.0)
            else -> Weights(1.0, 3.0, 5.0)
        }
    }

    private fun randomChangeEvent(
        docs: Map<String, Doc>,
        random: Random,
        newId: () -> String,
        weights: Weights,
    ): ChangeEvent<Doc> {
        val total = weights.insert + weights.update + weights.delete
        var r = random.nextDouble() * total
        if (docs.isEmpty() || r < weights.insert) {
            return insert(Doc(newId(), random.nextInt(1, 101), random.nextDouble() < 0.5))
        }
        r -= weights.insert
        val allDocs = docs.values.toList()
        val previous = allDocs[random.nextInt(allDocs.size)]
        if (r < weights.update) {
            val doc = if (random.nextDouble() < 0.5) {
                // starts or stops matching
                previous.copy(female = !previous.female)
            } else {
                // moves in the sort order
                previous.copy(age = random.nextInt(1, 101))
            }
            return update(previous, doc)
        }
        return delete(previous)
    }

    private fun applyToDocs(docs: MutableMap<String, Doc>, changeEvent: ChangeEvent<Doc>) {
        val doc = changeEvent.doc
        if (doc == null) docs.remove(changeEvent.id) else docs[doc.id] = doc
    }

    private fun counterIds(): () -> String {
        var counter = 0
        return { "id-" + (counter++).toString().padStart(5, '0') }
    }

    @Test
    fun recommendedSizeForEachLimit() {
        val expected = listOf(
            null to 0, 0 to 0, 1 to 0, 2 to 1, 3 to 1, 4 to 2, 10 to 3, 20 to 4,
            100 to 7, 200 to 11, 500 to 20, 1000 to 26, 2711 to 29, 2712 to 30, 100000 to 30,
        )
        for ((limit, size) in expected) {
            assertEquals(size, getRecommendedResultWindowBufferSize(limit), "limit $limit")
        }
    }

    @Test
    fun queryAddsTheBufferSizesToTheSkipAndLimit() {
        assertEquals(ResultWindowBufferQuery(7, 28), getResultWindowBufferQuery(bufferOf(TestQuery(true, 10, 20), 5, 3)))
        // not below skip 0
        assertEquals(ResultWindowBufferQuery(0, 22), getResultWindowBufferQuery(bufferOf(TestQuery(true, 2, 20), 0, 5)))
        // not set means 0
        assertEquals(ResultWindowBufferQuery(10, 20), getResultWindowBufferQuery(bufferOf(TestQuery(true, 10, 20))))
        // all rows
        assertEquals(ResultWindowBufferQuery(0, null), getResultWindowBufferQuery(bufferOf(TestQuery(true, 10, 20), all, all)))
        // no limit for a query without a limit
        assertEquals(ResultWindowBufferQuery(7, null), getResultWindowBufferQuery(bufferOf(TestQuery(true, 10), 5, 3)))
    }

    @Test
    fun throwsOnNegativeBufferSizes() {
        val params = queryParams(TestQuery(true, 10, 20))
        assertFailsWith<EventReduceException> { createResultWindowBuffer(params, limitBufferSize = -1) }
        assertFailsWith<EventReduceException> { createResultWindowBuffer(params, skipBufferSize = -1) }
    }

    @Test
    fun reset() {
        // asks for a full query and has no results before it got rows
        var buffer = bufferOf(TestQuery(true, limit = 2))
        assertFailsWith<EventReduceException> { getResultWindowBufferResults(buffer) }
        assertEquals(
            ResultWindowBufferResult.RunFullQueryAgain,
            applyChangeEventToResultWindowBuffer(buffer, insert(Doc("a", 1))),
        )

        // complete when the query returned fewer rows than requested
        buffer = bufferOf(TestQuery(true, limit = 2), 2)
        resetResultWindowBuffer(buffer, listOf(Doc("a", 1), Doc("b", 2), Doc("c", 3)))
        assertTrue(buffer.complete)
        assertEquals("a,b", results(buffer))

        // not complete when the query returned as many rows as requested
        buffer = bufferOf(TestQuery(true, limit = 1), 1)
        resetResultWindowBuffer(buffer, listOf(Doc("a", 1), Doc("b", 2)))
        assertFalse(buffer.complete)

        // shows the rows after the skipped rows of the buffer
        buffer = bufferOf(TestQuery(true, 1, 2), 0, 1)
        resetResultWindowBuffer(buffer, listOf(Doc("a", 1), Doc("b", 2), Doc("c", 3)))
        assertEquals(0, buffer.offset)
        assertEquals("b,c", results(buffer))
    }

    @Test
    fun refillsTheWindowFromTheBufferWhenAVisibleRowIsDeleted() {
        val buffer = bufferOf(TestQuery(true, limit = 2), 2)
        resetResultWindowBuffer(buffer, listOf(Doc("a", 1), Doc("b", 2), Doc("c", 3), Doc("d", 4)))
        assertEquals(ResultWindowBufferResult.Buffer, applyChangeEventToResultWindowBuffer(buffer, delete(Doc("a", 1))))
        assertEquals("b,c", results(buffer))
        assertEquals("b,c,d", ids(buffer.buffer))
    }

    @Test
    fun doesNotAppendARowThatMovesBehindTheLastRowOfTheBuffer() {
        val buffer = bufferOf(TestQuery(true, limit = 2), 1)
        resetResultWindowBuffer(buffer, listOf(Doc("a", 1), Doc("b", 2), Doc("c", 3)))
        assertEquals(
            ResultWindowBufferResult.Buffer,
            applyChangeEventToResultWindowBuffer(buffer, update(Doc("a", 1), Doc("a", 99))),
        )
        assertEquals("b,c", ids(buffer.buffer))
    }

    @Test
    fun asksForAFullQueryWhenARowIsAddedInFrontOfTheSkipWindowWithoutASkipBuffer() {
        val buffer = bufferOf(TestQuery(true, 1, 1), 1)
        resetResultWindowBuffer(buffer, listOf(Doc("b", 2), Doc("c", 3)))
        assertEquals(
            ResultWindowBufferResult.RunFullQueryAgain,
            applyChangeEventToResultWindowBuffer(buffer, insert(Doc("x", 0))),
        )
        // the results are outdated until the query runs again
        assertFailsWith<EventReduceException> { getResultWindowBufferResults(buffer) }
    }

    @Test
    fun takesTheRowFromTheSkipBufferWhenARowIsAddedInFrontOfTheWindow() {
        val buffer = bufferOf(TestQuery(true, 2, 1), 0, 1)
        // skip 1, limit 2: 'a' is skipped and not in the buffer
        resetResultWindowBuffer(buffer, listOf(Doc("b", 2), Doc("c", 3)))
        assertEquals("c", results(buffer))
        assertEquals(ResultWindowBufferResult.Buffer, applyChangeEventToResultWindowBuffer(buffer, insert(Doc("x", 0))))
        assertEquals(2, buffer.offset)
        assertEquals("b", results(buffer))
    }

    @Test
    fun returnsNoRowsForAQueryWithLimit0() {
        val random = Random(77)
        val newId = counterIds()
        for (skip in listOf(null, 2)) {
            val docs = LinkedHashMap<String, Doc>()
            repeat(10) { applyToDocs(docs, randomChangeEvent(docs, random, newId, onlyInserts)) }
            val buffer = bufferOf(TestQuery(true, skip, 0), 2, 2)
            fill(buffer, docs)
            // no rows are kept, so the buffer query asks for none
            assertEquals(ResultWindowBufferQuery(skip ?: 0, 0), getResultWindowBufferQuery(buffer))
            assertEquals("", results(buffer))
            for (i in 0 until 100) {
                val event = randomChangeEvent(docs, random, newId, weights(i))
                applyToDocs(docs, event)
                assertEquals(ResultWindowBufferResult.EventReduce, applyChangeEventToResultWindowBuffer(buffer, event))
                assertEquals("", results(buffer))
                assertTrue(buffer.buffer.isEmpty())
            }
        }
    }

    @Test
    fun handlesAQueryWithASkipButWithoutALimit() {
        val buffer = bufferOf(TestQuery(true, skip = 1), 0, 1)
        resetResultWindowBuffer(buffer, listOf(Doc("a", 1), Doc("b", 2), Doc("c", 3)))
        assertEquals("b,c", results(buffer))
        assertNotEquals(
            ResultWindowBufferResult.RunFullQueryAgain,
            applyChangeEventToResultWindowBuffer(buffer, insert(Doc("x", 0))),
        )
        assertEquals("a,b,c", results(buffer))
    }

    @Test
    fun applyChangeEventsReturnsTheNewResultsAndIfTheyChanged() {
        var buffer = bufferOf(TestQuery(true, limit = 2), 3)
        resetResultWindowBuffer(buffer, listOf(Doc("a", 1), Doc("b", 2), Doc("c", 3), Doc("d", 4), Doc("e", 5)))
        // a row after the result window changes
        val notVisible = applyChangeEventsToResultWindowBuffer(buffer, listOf(update(Doc("e", 5), Doc("e", 6))))
        assertIs<ResultWindowBufferChangeResult.Results<Doc>>(notVisible)
        assertFalse(notVisible.changed)

        val visible = applyChangeEventsToResultWindowBuffer(buffer, listOf(delete(Doc("a", 1)), delete(Doc("b", 2))))
        assertIs<ResultWindowBufferChangeResult.Results<Doc>>(visible)
        assertTrue(visible.changed)
        assertEquals("c,d", ids(visible.results))

        // a changed row at the same position is reported as changed
        buffer = bufferOf(TestQuery(true, limit = 2))
        resetResultWindowBuffer(buffer, listOf(Doc("a", 1), Doc("b", 3)))
        val result = applyChangeEventsToResultWindowBuffer(buffer, listOf(update(Doc("a", 1), Doc("a", 2))))
        assertIs<ResultWindowBufferChangeResult.Results<Doc>>(result)
        assertTrue(result.changed)
    }

    @Test
    fun applyChangeEventsAsksForAFullQueryWhenTheResultWindowDoesNotFitIntoTheBuffer() {
        val buffer = bufferOf(TestQuery(true, limit = 2))
        assertSame(ResultWindowBufferChangeResult.RunFullQueryAgain, applyChangeEventsToResultWindowBuffer(buffer, emptyList()))
        resetResultWindowBuffer(buffer, listOf(Doc("a", 1), Doc("b", 2)))
        assertSame(
            ResultWindowBufferChangeResult.RunFullQueryAgain,
            applyChangeEventsToResultWindowBuffer(buffer, listOf(delete(Doc("a", 1)))),
        )
    }

    @Test
    fun applyChangeEventsReturnsTheSameAsAFullQueryForRandomBatches() {
        val random = Random(4242)
        val newId = counterIds()
        for (query in queries) {
            val docs = LinkedHashMap<String, Doc>()
            repeat(30) { applyToDocs(docs, randomChangeEvent(docs, random, newId, onlyInserts)) }
            val params = queryParams(query)
            val skip = query.skip ?: 0
            val buffer = bufferOf(query, 3, 3)
            fill(buffer, docs)
            var previousResults = runQuery(docs, params, skip, query.limit)
            for (batch in 0 until 100) {
                val events = (0 until 1 + random.nextInt(5)).map { i ->
                    randomChangeEvent(docs, random, newId, weights(batch * 5 + i)).also { applyToDocs(docs, it) }
                }
                val result = applyChangeEventsToResultWindowBuffer(buffer, events)
                val expected = runQuery(docs, params, skip, query.limit)
                when (result) {
                    is ResultWindowBufferChangeResult.RunFullQueryAgain -> fill(buffer, docs)
                    is ResultWindowBufferChangeResult.Results -> {
                        assertEquals(ids(expected), ids(result.results))
                        val expectedChanged = expected.size != previousResults.size ||
                            expected.indices.any { expected[it] !== previousResults[it] }
                        assertEquals(expectedChanged, result.changed)
                    }
                }
                previousResults = expected
            }
        }
    }

    @Test
    fun aBufferWithBothSizes0NeverRunsTheFullQueryWhenEventReduceAloneDoesNot() {
        var eventReduceFullQueries = 0
        var bufferFullQueries = 0
        var seed = 1000
        for (query in queries) {
            for (initialRows in initialRowsList) {
                seed++
                val random = Random(seed)
                val newId = counterIds()
                val docs = LinkedHashMap<String, Doc>()
                repeat(initialRows) { applyToDocs(docs, randomChangeEvent(docs, random, newId, onlyInserts)) }
                val params = queryParams(query)
                val skip = query.skip ?: 0
                var previousResults = runQuery(docs, params, skip, query.limit).toMutableList()
                var keyDocumentMap = previousResults.associateBy { it.id }.toMutableMap()
                val buffer = bufferOf(query)
                fill(buffer, docs)

                for (i in 0 until eventsPerRun) {
                    val event = randomChangeEvent(docs, random, newId, weights(i))
                    applyToDocs(docs, event)

                    val action = calculateActionName(StateResolveFunctionInput(params, event, previousResults, keyDocumentMap))
                    val eventReduceNeedsQuery = action == ActionName.RunFullQueryAgain
                    if (eventReduceNeedsQuery) {
                        eventReduceFullQueries++
                        previousResults = runQuery(docs, params, skip, query.limit).toMutableList()
                        keyDocumentMap = previousResults.associateBy { it.id }.toMutableMap()
                    } else {
                        runAction(action, params, event, previousResults, keyDocumentMap)
                    }

                    val bufferNeedsQuery = applyChangeEventToResultWindowBuffer(buffer, event) ==
                        ResultWindowBufferResult.RunFullQueryAgain
                    if (bufferNeedsQuery) {
                        bufferFullQueries++
                        fill(buffer, docs)
                    }
                    assertTrue(
                        !bufferNeedsQuery || eventReduceNeedsQuery,
                        "buffer needs a full query but EventReduce does not at event #$i",
                    )
                    assertEquals(ids(runQuery(docs, params, skip, query.limit)), results(buffer))
                }
            }
        }
        assertTrue(bufferFullQueries <= eventReduceFullQueries)
    }

    @Test
    fun randomizedAgainstAFullQuery() {
        val counts = HashMap<ResultWindowBufferResult, Int>()
        var seed = 0
        for (query in queries) {
            for ((limitBufferSize, skipBufferSize) in bufferSizes) {
                for (initialRows in initialRowsList) {
                    seed++
                    val random = Random(seed)
                    var counter = 0
                    val newId = { random.nextInt(1_000_000_000).toString().padStart(9, '0') + "-" + (++counter) }
                    val docs = LinkedHashMap<String, Doc>()
                    repeat(initialRows) { applyToDocs(docs, randomChangeEvent(docs, random, newId, onlyInserts)) }
                    val params = queryParams(query)
                    val skip = query.skip ?: 0
                    val buffer = bufferOf(query, limitBufferSize, skipBufferSize)
                    fill(buffer, docs)

                    for (i in 0 until eventsPerRun) {
                        val event = randomChangeEvent(docs, random, newId, weights(i))
                        applyToDocs(docs, event)

                        val result = applyChangeEventToResultWindowBuffer(buffer, event)
                        counts[result] = (counts[result] ?: 0) + 1
                        if (result == ResultWindowBufferResult.RunFullQueryAgain) {
                            fill(buffer, docs)
                        }
                        val context = "$query, sizes $limitBufferSize/$skipBufferSize, $initialRows rows, " +
                            "event #$i (${event.operation}, $result)"

                        // the visible result equals the full query
                        assertEquals(
                            ids(runQuery(docs, params, skip, query.limit)),
                            results(buffer),
                            "visible result differs from full query at $context",
                        )

                        // the buffer is an exact slice of the full result
                        val full = runQuery(docs, params, 0, null)
                        if (buffer.buffer.isNotEmpty()) {
                            val start = minOf(buffer.offset, full.size)
                            val end = minOf(buffer.offset + buffer.buffer.size, full.size)
                            assertEquals(
                                ids(full.subList(start, end)),
                                ids(buffer.buffer),
                                "buffer is not an exact slice of the full result at $context",
                            )
                        } else {
                            // an empty buffer only knows an upper bound of the rows before it
                            assertTrue(buffer.complete, "empty buffer must be complete at $context")
                            assertTrue(full.size <= buffer.offset, "offset is no upper bound at $context")
                        }
                        if (buffer.complete) {
                            assertTrue(
                                buffer.offset + buffer.buffer.size >= full.size,
                                "complete buffer misses rows at $context",
                            )
                        }

                        // the buffer keeps no more rows than requested on both sides
                        val rowsBefore = skip - buffer.offset
                        assertTrue(rowsBefore <= skipBufferSize, "too many rows before the window")
                        val limit = query.limit
                        if (limit != null && limitBufferSize != all) {
                            assertTrue(
                                buffer.buffer.size <= maxOf(0, rowsBefore) + limit + limitBufferSize,
                                "too many rows after the window",
                            )
                        }

                        // the key map matches the buffer
                        assertEquals(buffer.buffer.size, buffer.keyDocumentMap.size)
                        buffer.buffer.forEach { assertSame(it, buffer.keyDocumentMap[it.id]) }
                    }
                }
            }
        }
        // all three paths are used
        for (result in ResultWindowBufferResult.entries) {
            assertTrue((counts[result] ?: 0) > 0, "$counts")
        }
    }
}
