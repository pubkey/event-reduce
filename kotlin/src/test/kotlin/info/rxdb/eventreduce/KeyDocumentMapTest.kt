package info.rxdb.eventreduce

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * When the key document map is out of sync and does not have a document that is in the results,
 * the actions must still find the document in the results, like the JavaScript implementation.
 */
class KeyDocumentMapTest {
    data class Doc(val id: String, val age: Int, val name: String = "")

    private val queryParams: QueryParams<Doc> = QueryParams(
        getDocumentId = { it.id },
        queryMatcher = { true },
        sortComparator = compareBy<Doc> { it.age }.thenBy { it.id },
        sortFieldsChanged = { previous, doc -> previous.age != doc.age },
    )
    private val a = Doc("a", 1)
    private val b = Doc("b", 2)

    private fun run(action: ActionName, event: ChangeEvent<Doc>): Pair<List<Doc>, Map<String, Doc>> {
        val keyDocumentMap = mutableMapOf("b" to b)
        val results = runAction(action, queryParams, event, mutableListOf(a, b), keyDocumentMap)
        return results to keyDocumentMap
    }

    @Test
    fun removeExisting() {
        val (results, keyDocumentMap) = run(ActionName.RemoveExisting, ChangeEvent.Delete("a", a))
        assertEquals(listOf(b), results)
        assertEquals(mapOf("b" to b), keyDocumentMap)
    }

    @Test
    fun replaceExisting() {
        val changed = Doc("a", 1, "changed")
        val (results, keyDocumentMap) = run(ActionName.ReplaceExisting, ChangeEvent.Update("a", changed, a))
        assertEquals(listOf(changed, b), results)
        assertEquals(mapOf("a" to changed, "b" to b), keyDocumentMap)
    }

    @Test
    fun removeExistingAndInsertAtSortPosition() {
        val moved = Doc("a", 5)
        val (results, keyDocumentMap) =
            run(ActionName.RemoveExistingAndInsertAtSortPosition, ChangeEvent.Update("a", moved, a))
        // no duplicate of the document
        assertEquals(listOf(b, moved), results)
        assertEquals(mapOf("a" to moved, "b" to b), keyDocumentMap)
    }
}
