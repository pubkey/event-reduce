package info.rxdb.eventreduce

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/** Like in SQL, a query with limit 0 returns no documents. A negative limit throws. */
class LimitTest {
    data class Doc(val id: String, val age: Int)

    private fun queryParams(limit: Int?, skip: Int? = null): QueryParams<Doc> = QueryParams(
        getDocumentId = { it.id },
        skip = skip,
        limit = limit,
        queryMatcher = { true },
        sortComparator = compareBy<Doc> { it.age }.thenBy { it.id },
        sortFieldsChanged = { previous, doc -> previous.age != doc.age },
    )

    private val a = Doc("a", 1)
    private val events: List<ChangeEvent<Doc>> = listOf(
        ChangeEvent.Insert("a", a),
        ChangeEvent.Update("a", Doc("a", 2), a),
        ChangeEvent.Delete("a", a),
    )

    private fun calculate(params: QueryParams<Doc>, event: ChangeEvent<Doc>): ActionName =
        calculateActionName(StateResolveFunctionInput(params, event, emptyList()))

    @Test
    fun limitZeroIsAlwaysDoNothing() {
        for (skip in listOf(null, 0, 3)) {
            for (event in events) {
                assertEquals(ActionName.DoNothing, calculate(queryParams(0, skip), event))
            }
        }
    }

    @Test
    fun otherLimitsAreNotChanged() {
        assertEquals(ActionName.InsertFirst, calculate(queryParams(1), events[0]))
        assertEquals(ActionName.InsertFirst, calculate(queryParams(null), events[0]))
    }

    @Test
    fun negativeLimitThrows() {
        assertEquals("NEG_LIMIT", assertFailsWith<EventReduceException> { calculate(queryParams(-1), events[0]) }.code)
        assertEquals("NEG_LIMIT", assertFailsWith<EventReduceException> { createResultWindowBuffer(queryParams(-1)) }.code)
        createResultWindowBuffer(queryParams(0))
    }
}
