package com.github.pubkey.eventreduce

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class ActionsTest {
    @Test
    fun actionNamesMatchTheJavaScriptOrder() {
        assertEquals(
            listOf(
                "doNothing", "insertFirst", "insertLast", "removeFirstItem", "removeLastItem",
                "removeFirstInsertLast", "removeLastInsertFirst", "removeFirstInsertFirst",
                "removeLastInsertLast", "removeExisting", "replaceExisting", "alwaysWrong",
                "insertAtSortPosition", "removeExistingAndInsertAtSortPosition",
                "insertAtSortPositionRemoveLast", "insertAtSortPositionRemoveFirst", "runFullQueryAgain",
                "unknownAction",
            ),
            orderedActionList.map { it.jsName },
        )
    }

    @Test
    fun allActionsDoNotCrashOnAnyInput() {
        val params = queryParams(0, limit = 3)
        val events = listOf(insert(Human("x", 3)), update(Human("b", 2), Human("b", 7)), delete(Human("b", 2)))
        val throwing = setOf(ActionName.AlwaysWrong, ActionName.RunFullQueryAgain, ActionName.UnknownAction)
        for (action in orderedActionList) {
            for (event in events) {
                for (start in listOf(emptyList(), listOf(Human("a", 1), Human("b", 2), Human("c", 3)))) {
                    for (useMap in listOf(true, false)) {
                        val results = start.toMutableList()
                        val run = { runAction(action, params, event, results, if (useMap) toMap(results) else null) }
                        if (action in throwing) {
                            assertFailsWith<EventReduceException> { run() }
                        } else {
                            try {
                                run()
                            } catch (e: EventReduceException) {
                                // inserting actions on a delete event have no document
                                assertNull(event.doc)
                            }
                        }
                    }
                }
            }
        }
    }

    @Test
    fun runFullQueryAgainThrows() {
        val results = mutableListOf(Human("a", 1))
        val error = assertFailsWith<EventReduceException> {
            runAction(ActionName.RunFullQueryAgain, queryParams(0), insert(Human("b", 1)), results)
        }
        assertEquals("EventReduce:RUN_FULL", error.message)
        assertEquals(listOf("a"), ids(results))
    }

    @Test
    fun removeExistingFromTheMiddleKeepsTheMapInSync() {
        val results = mutableListOf(Human("a", 1), Human("b", 2), Human("c", 3))
        val map = toMap(results)
        runAction(ActionName.RemoveExisting, queryParams(0), delete(Human("b", 2)), results, map)
        assertEquals(listOf("a", "c"), ids(results))
        assertEquals(setOf("a", "c"), map.keys)
    }

    @Test
    fun replaceExistingAtTheSamePosition() {
        val results = mutableListOf(Human("a", 1), Human("b", 2), Human("c", 3))
        val map = toMap(results)
        val renamed = Human("b", 2, "new")
        runAction(ActionName.ReplaceExisting, queryParams(0), update(Human("b", 2), renamed), results, map)
        assertEquals(renamed, results[1])
        assertEquals(renamed, map["b"])
    }

    @Test
    fun insertAtSortPosition() {
        val params = queryParams(0)
        val results = mutableListOf<Human>()
        for (doc in listOf(Human("b", 5), Human("d", 9), Human("a", 5), Human("c", 7))) {
            runAction(ActionName.InsertAtSortPosition, params, insert(doc), results)
        }
        assertEquals(listOf("a", "b", "c", "d"), ids(results))
        // inserting a document that is already in the results does nothing
        runAction(ActionName.InsertAtSortPosition, params, insert(Human("c", 7)), results)
        assertEquals(listOf("a", "b", "c", "d"), ids(results))
    }

    @Test
    fun removeFirstInsertLastWithMap() {
        val results = mutableListOf(Human("a", 1), Human("b", 2))
        val map = toMap(results)
        runAction(ActionName.RemoveFirstInsertLast, queryParams(0, limit = 2), insert(Human("c", 3)), results, map)
        assertEquals(listOf("b", "c"), ids(results))
        assertEquals(setOf("b", "c"), map.keys)
    }

    @Test
    fun insertAtSortPositionRemoveLastAndFirst() {
        val params = queryParams(0, limit = 3)
        val results = mutableListOf(Human("a", 1), Human("c", 3), Human("e", 5))
        val map = toMap(results)
        runAction(ActionName.InsertAtSortPositionRemoveLast, params, insert(Human("b", 2)), results, map)
        assertEquals(listOf("a", "b", "c"), ids(results))
        runAction(ActionName.InsertAtSortPositionRemoveFirst, params, insert(Human("d", 4)), results, map)
        assertEquals(listOf("b", "c", "d"), ids(results))
        assertEquals(setOf("b", "c", "d"), map.keys)
        // a document that is already in the results is not inserted, so nothing is removed
        runAction(ActionName.InsertAtSortPositionRemoveLast, params, insert(Human("c", 3)), results)
        assertEquals(listOf("b", "c", "d"), ids(results))
    }
}
