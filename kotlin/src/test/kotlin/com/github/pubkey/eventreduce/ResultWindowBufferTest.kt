package com.github.pubkey.eventreduce

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotEquals
import kotlin.test.assertSame
import kotlin.test.assertTrue

/**
 * Basic tests of the result window buffer,
 * ported from javascript/test/unit/result-window-buffer.test.ts.
 */
class ResultWindowBufferTest {
    data class Doc(val id: String, val age: Int, val female: Boolean = true)

    data class TestQuery(val asc: Boolean, val skip: Int? = null, val limit: Int? = null)

    private val all = RESULT_WINDOW_BUFFER_ALL_ROWS

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

    private fun ids(docs: List<Doc>) = docs.joinToString(",") { it.id }

    private fun results(buffer: ResultWindowBuffer<Doc>) = ids(getResultWindowBufferResults(buffer))

    private fun insert(doc: Doc): ChangeEvent<Doc> = ChangeEvent.Insert(doc.id, doc)

    private fun update(previous: Doc, doc: Doc): ChangeEvent<Doc> = ChangeEvent.Update(doc.id, doc, previous)

    private fun delete(previous: Doc): ChangeEvent<Doc> = ChangeEvent.Delete(previous.id, previous)

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
    fun returnsNoRowsForAQueryWithLimit0() {
        val buffer = bufferOf(TestQuery(true, 2, 0), 2, 2)
        // no rows are kept, so the buffer query asks for none
        assertEquals(ResultWindowBufferQuery(2, 0), getResultWindowBufferQuery(buffer))
        resetResultWindowBuffer(buffer, emptyList())
        for (event in listOf(insert(Doc("a", 1)), update(Doc("a", 1), Doc("a", 2)), delete(Doc("a", 2)))) {
            assertEquals(ResultWindowBufferResult.EventReduce, applyChangeEventToResultWindowBuffer(buffer, event))
            assertEquals("", results(buffer))
        }
    }
}
