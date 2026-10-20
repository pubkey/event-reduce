package com.github.pubkey.eventreduce

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class BddTest {
    @Test
    fun packedBddStringIsTheSameAsInTheJavaScriptImplementation() {
        val js = File("../javascript/src/bdd/bdd.generated.ts").readText()
        assertTrue(
            js.contains("export const packedBddString = '$PACKED_BDD_STRING';"),
            "kotlin BddGenerated.kt is out of sync with the JavaScript BDD",
        )
    }

    @Test
    fun packedBddOnlyReferencesKnownStatesAndActions() {
        assertEquals(0, packedBdd.size % 3)
        val n = packedBdd.size / 3
        for (i in packedBdd.indices step 3) {
            assertTrue(packedBdd[i] < orderedStateList.size)
            for (ref in listOf(packedBdd[i + 1], packedBdd[i + 2])) {
                assertTrue(ref < n || ref - n < orderedActionList.size)
            }
        }
    }

    @Test
    fun insertIntoEmptyResultsWithoutLimit() {
        val action = calculateActionName(StateResolveFunctionInput(queryParams(10), insert(Human("a", 20)), emptyList()))
        assertEquals(ActionName.InsertFirst, action)
    }

    @Test
    fun insertOfNonMatchingDocumentDoesNothing() {
        val action = calculateActionName(
            StateResolveFunctionInput(queryParams(10), insert(Human("a", 5)), listOf(Human("b", 20))),
        )
        assertEquals(ActionName.DoNothing, action)
    }
}
