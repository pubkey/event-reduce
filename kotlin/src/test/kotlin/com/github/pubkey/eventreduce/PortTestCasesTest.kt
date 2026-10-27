package com.github.pubkey.eventreduce

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Runs the test cases that the JavaScript implementation created,
 * see javascript/test/helper/port-test-cases.ts.
 * This implementation only resolves the BDD that was created there,
 * so it must calculate the same state set and action for every case.
 */
class PortTestCasesTest {
    data class Doc(val id: String, val age: Int)

    private fun doc(element: JsonElement): Doc {
        val obj = element.jsonObject
        return Doc(obj.getValue("id").jsonPrimitive.content, obj.getValue("age").jsonPrimitive.int)
    }

    /** The query of the test cases: age > minAge, sorted by age, then by id. */
    private fun queryParams(query: JsonElement): QueryParams<Doc> {
        val obj = query.jsonObject
        val minAge = obj.getValue("minAge").jsonPrimitive.int
        return QueryParams(
            getDocumentId = { it.id },
            skip = obj.getValue("skip").jsonPrimitive.intOrNull,
            limit = obj.getValue("limit").jsonPrimitive.intOrNull,
            queryMatcher = { it.age > minAge },
            sortComparator = compareBy<Doc> { it.age }.thenBy { it.id },
            sortFieldsChanged = { prev, doc -> prev.age != doc.age },
        )
    }

    private fun changeEvent(element: JsonElement): ChangeEvent<Doc> {
        val obj = element.jsonObject
        val id = obj.getValue("id").jsonPrimitive.content
        return when (obj.getValue("operation").jsonPrimitive.content) {
            "INSERT" -> ChangeEvent.Insert(id, doc(obj.getValue("doc")))
            "UPDATE" -> ChangeEvent.Update(id, doc(obj.getValue("doc")), doc(obj.getValue("previous")))
            else -> ChangeEvent.Delete(id, doc(obj.getValue("previous")))
        }
    }

    @Test
    fun sameStateSetAndActionAsTheJavaScriptImplementation() {
        val cases = Json.parseToJsonElement(File("../javascript/test/fixtures/port-test-cases.json").readText()).jsonArray
        assertTrue(cases.size > 100)
        cases.forEachIndexed { index, element ->
            val testCase = element.jsonObject
            val input = StateResolveFunctionInput(
                queryParams(testCase.getValue("query")),
                changeEvent(testCase.getValue("changeEvent")),
                testCase.getValue("previousResults").jsonArray.filter { it != JsonNull }.map { doc(it) },
            )
            assertEquals(testCase.getValue("stateSet").jsonPrimitive.content, getStateSet(input), "state set of case #$index")
            assertEquals(
                testCase.getValue("action").jsonPrimitive.content,
                calculateActionName(input).jsName,
                "action of case #$index",
            )
        }
    }
}
