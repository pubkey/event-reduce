package com.github.pubkey.eventreduce

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class StatesTest {
    private fun resolve(
        state: StateName,
        params: QueryParams<Human>,
        event: ChangeEvent<Human>,
        results: List<Human>,
        map: Map<String, Human>? = null,
    ): Boolean = resolveState(state, StateResolveFunctionInput(params, event, results, map))

    @Test
    fun stateNamesMatchTheJavaScriptOrder() {
        assertEquals(
            listOf(
                "isInsert", "isUpdate", "isDelete", "hasLimit", "isFindOne", "hasSkip",
                "wasResultsEmpty", "wasLimitReached", "wasFirst", "wasLast", "sortParamsChanged",
                "wasInResult", "wasSortedBeforeFirst", "wasSortedAfterLast", "isSortedBeforeFirst",
                "isSortedAfterLast", "wasMatching", "doesMatchNow",
            ),
            orderedStateList.map { it.jsName },
        )
    }

    @Test
    fun limitAndSkip() {
        val event = insert(Human("a", 20))
        var params = queryParams(0, skip = 2, limit = 1)
        assertTrue(resolve(StateName.HasLimit, params, event, emptyList()))
        assertTrue(resolve(StateName.IsFindOne, params, event, emptyList()))
        assertTrue(resolve(StateName.HasSkip, params, event, emptyList()))
        assertTrue(resolve(StateName.WasLimitReached, params, event, listOf(Human("b", 1))))
        params = queryParams(0, skip = 0)
        assertFalse(resolve(StateName.HasLimit, params, event, emptyList()))
        assertFalse(resolve(StateName.IsFindOne, params, event, emptyList()))
        assertFalse(resolve(StateName.HasSkip, params, event, emptyList()))
        assertFalse(resolve(StateName.WasLimitReached, params, event, listOf(Human("b", 1))))
    }

    @Test
    fun operations() {
        val params = queryParams(0)
        val event = delete(Human("a", 1))
        assertTrue(resolve(StateName.IsDelete, params, event, emptyList()))
        assertFalse(resolve(StateName.IsInsert, params, event, emptyList()))
        assertFalse(resolve(StateName.IsUpdate, params, event, emptyList()))
    }

    @Test
    fun sortParamsChanged() {
        val params = queryParams(0)
        val a = Human("a", 1)
        assertFalse(resolve(StateName.SortParamsChanged, params, update(a, a.copy(name = "other")), emptyList()))
        assertTrue(resolve(StateName.SortParamsChanged, params, update(a, a.copy(age = 2)), emptyList()))
        assertTrue(resolve(StateName.SortParamsChanged, params, insert(a), emptyList()))
        assertFalse(resolve(StateName.SortParamsChanged, params, delete(a), emptyList()))
    }

    @Test
    fun wasInResultWithAndWithoutMap() {
        val params = queryParams(0)
        val event = update(Human("b", 1), Human("b", 2))
        val results = listOf(Human("a", 1), Human("b", 1))
        assertTrue(resolve(StateName.WasInResult, params, event, results))
        assertFalse(resolve(StateName.WasInResult, params, event, results.subList(0, 1)))
        assertTrue(resolve(StateName.WasInResult, params, event, results, toMap(results)))
    }

    @Test
    fun firstAndLast() {
        val params = queryParams(0)
        val results = listOf(Human("a", 1), Human("b", 5), Human("c", 10))
        var event = update(Human("a", 1), Human("a", 20))
        assertTrue(resolve(StateName.WasFirst, params, event, results))
        assertFalse(resolve(StateName.WasLast, params, event, results))
        // the changed document is the first one, so it must be true
        assertTrue(resolve(StateName.WasSortedBeforeFirst, params, event, results))
        assertFalse(resolve(StateName.WasSortedAfterLast, params, event, results))
        assertTrue(resolve(StateName.IsSortedAfterLast, params, event, results))
        event = insert(Human("d", 0))
        assertTrue(resolve(StateName.IsSortedBeforeFirst, params, event, results))
        assertFalse(resolve(StateName.IsSortedAfterLast, params, event, results))
        assertFalse(resolve(StateName.WasSortedBeforeFirst, params, event, results))
        assertFalse(resolve(StateName.IsSortedBeforeFirst, params, event, emptyList()))
    }

    @Test
    fun matching() {
        val params = queryParams(10)
        val event = update(Human("a", 5), Human("a", 20))
        assertFalse(resolve(StateName.WasMatching, params, event, emptyList()))
        assertTrue(resolve(StateName.DoesMatchNow, params, event, emptyList()))
        assertTrue(resolve(StateName.WasResultsEmpty, params, event, emptyList()))
    }

    @Test
    fun stateSet() {
        val set = getStateSet(StateResolveFunctionInput(queryParams(0), insert(Human("a", 1)), emptyList()))
        assertEquals("100000100010000001", set)
    }

    @Test
    fun isSortedComparesWithTheNeighborWhenTheChangedDocumentIsFirstOrLast() {
        val params = queryParams(0)
        val results = listOf(Human("a", 1), Human("b", 5), Human("c", 10))
        // the first document moves behind the second one
        assertFalse(resolve(StateName.IsSortedBeforeFirst, params, update(Human("a", 1), Human("a", 7)), results))
        // the first document stays first
        assertTrue(resolve(StateName.IsSortedBeforeFirst, params, update(Human("a", 1), Human("a", 2)), results))
        // the last document moves before the second last one
        assertFalse(resolve(StateName.IsSortedAfterLast, params, update(Human("c", 10), Human("c", 3)), results))
        // the last document stays last
        assertTrue(resolve(StateName.IsSortedAfterLast, params, update(Human("c", 10), Human("c", 20)), results))
        // without a neighbor, the changed document is still first and last
        val event = update(Human("a", 1), Human("a", 7))
        assertTrue(resolve(StateName.IsSortedBeforeFirst, params, event, results.subList(0, 1)))
        assertTrue(resolve(StateName.IsSortedAfterLast, params, event, results.subList(0, 1)))
    }
}
