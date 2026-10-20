package com.github.pubkey.eventreduce

import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * Applies random change events and checks that the results of EventReduce
 * are equal to the results of running the full query over the database again.
 */
class FuzzingTest {
    private fun runFullQuery(params: QueryParams<Human>, db: Map<String, Human>): MutableList<Human> {
        val all = db.values.filter(params.queryMatcher).sortedWith(params.sortComparator)
        val start = minOf(params.skip ?: 0, all.size)
        val end = params.limit?.let { minOf(start + it, all.size) } ?: all.size
        return all.subList(start, end).toMutableList()
    }

    private fun fuzz(seed: Int, skip: Int?, limit: Int?, useMap: Boolean): Int {
        val random = Random(seed)
        val params = queryParams(10, skip, limit)
        val db = LinkedHashMap<String, Human>()
        var results = runFullQuery(params, db)
        var map = toMap(results)
        var optimized = 0
        for (i in 0 until 1000) {
            val event: ChangeEvent<Human>
            if (db.isEmpty() || random.nextInt(3) == 0) {
                val doc = Human("doc$i", random.nextInt(40))
                db[doc.id] = doc
                event = insert(doc)
            } else {
                val keys = db.keys.toList()
                val previous = db.getValue(keys[random.nextInt(keys.size)])
                if (random.nextInt(3) == 0) {
                    db.remove(previous.id)
                    event = delete(previous)
                } else {
                    val doc = if (random.nextInt(4) == 0) {
                        previous.copy(name = "renamed$i")
                    } else {
                        previous.copy(age = random.nextInt(40))
                    }
                    db[doc.id] = doc
                    event = update(previous, doc)
                }
            }

            val action = calculateActionName(
                StateResolveFunctionInput(params, event, results, if (useMap) map else null),
            )
            assertNotEquals(ActionName.UnknownAction, action)
            if (action == ActionName.RunFullQueryAgain) {
                results = runFullQuery(params, db)
                map = toMap(results)
            } else {
                optimized++
                runAction(action, params, event, results, if (useMap) map else null)
                assertEquals(runFullQuery(params, db), results, "wrong results after $action on $event (seed $seed)")
                if (useMap) {
                    assertEquals(toMap(results), map)
                }
            }
        }
        return optimized
    }

    @Test
    fun sameResultsAsRunningTheFullQuery() {
        val cases = listOf(
            Triple(null, null, false),
            Triple(null, null, true),
            Triple(null, 1, false),
            Triple(null, 5, false),
            Triple(null, 5, true),
            Triple(3, 5, false),
            Triple(3, 5, true),
        )
        for ((skip, limit, useMap) in cases) {
            for (seed in 1..10) {
                assertTrue(fuzz(seed * 7919, skip, limit, useMap) > 0)
            }
        }
    }
}
