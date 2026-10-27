package com.github.pubkey.eventreduce

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.fail

/** Runs the test suite that all implementations share, see ../test-suite/README.md. */
class TestSuiteTest {
    data class Doc(val id: String, val age: Int, val name: String = "")

    private fun load(file: String): JsonObject =
        Json.parseToJsonElement(File("../test-suite/$file").readText()).jsonObject

    private fun JsonObject.str(key: String): String = getValue(key).jsonPrimitive.content

    private fun JsonObject.strOrNull(key: String): String? =
        this[key]?.takeIf { it != JsonNull }?.jsonPrimitive?.content

    private fun doc(element: JsonElement): Doc {
        val obj = element.jsonObject
        return Doc(obj.str("id"), obj.getValue("age").jsonPrimitive.int, obj.strOrNull("name") ?: "")
    }

    private fun docs(element: JsonElement): List<Doc> = element.jsonArray.map { doc(it) }

    private fun ids(docs: List<Doc>): JsonArray = JsonArray(docs.map { JsonPrimitive(it.id) })

    private fun queryParams(query: JsonElement): QueryParams<Doc> {
        val obj = query.jsonObject
        val minAge = obj.getValue("minAge").jsonPrimitive.int
        val comparator = compareBy<Doc> { it.age }.thenBy { it.id }
        return QueryParams(
            getDocumentId = { it.id },
            skip = obj.getValue("skip").jsonPrimitive.intOrNull,
            limit = obj.getValue("limit").jsonPrimitive.intOrNull,
            queryMatcher = { it.age > minAge },
            sortComparator = if (obj["desc"]?.jsonPrimitive?.booleanOrNull == true) comparator.reversed() else comparator,
            sortFieldsChanged = { previous, doc -> previous.age != doc.age },
        )
    }

    private fun changeEvent(element: JsonElement): ChangeEvent<Doc> {
        val obj = element.jsonObject
        val id = obj.str("id")
        return when (obj.str("operation")) {
            "INSERT" -> ChangeEvent.Insert(id, doc(obj.getValue("doc")))
            "UPDATE" -> ChangeEvent.Update(id, doc(obj.getValue("doc")), doc(obj.getValue("previous")))
            else -> ChangeEvent.Delete(id, doc(obj.getValue("previous")))
        }
    }

    private fun bufferSize(element: JsonElement): Int =
        if (element.jsonPrimitive.content == "all") RESULT_WINDOW_BUFFER_ALL_ROWS else element.jsonPrimitive.int

    @Test
    fun stateSets() {
        val suite = load("state-sets.json")
        assertEquals(
            suite.getValue("packedBdd").jsonArray.map { it.jsonPrimitive.int },
            PACKED_BDD.toList(),
            "BddGenerated.kt is out of sync with the JavaScript BDD",
        )
        suite.getValue("cases").jsonArray.forEachIndexed { index, element ->
            val testCase = element.jsonObject
            val input = StateResolveFunctionInput(
                queryParams(testCase.getValue("query")),
                changeEvent(testCase.getValue("changeEvent")),
                docs(testCase.getValue("previousResults")),
            )
            assertEquals(testCase.str("stateSet"), getStateSet(input), "state set of case #$index")
            assertEquals(testCase.str("action"), calculateActionName(input).jsName, "action of case #$index")
        }
    }

    @Test
    fun actions() {
        for (element in load("cases.json").getValue("actions").jsonArray) {
            val testCase = element.jsonObject
            val name = testCase.str("name")
            val queryParams = queryParams(testCase.getValue("query"))
            val changeEvent = changeEvent(testCase.getValue("changeEvent"))
            val results = docs(testCase.getValue("previousResults")).toMutableList()
            val keyDocumentMap = if (testCase.getValue("useKeyDocumentMap").jsonPrimitive.boolean) {
                results.associateBy { it.id }.toMutableMap()
            } else {
                null
            }
            val action = testCase.strOrNull("action")?.let { actionName -> ActionName.entries.first { it.jsName == actionName } }
                ?: calculateActionName(StateResolveFunctionInput(queryParams, changeEvent, results, keyDocumentMap)).also {
                    assertEquals(testCase.str("expectedAction"), it.jsName, name)
                }
            val error = try {
                runAction(action, queryParams, changeEvent, results, keyDocumentMap)
                null
            } catch (e: EventReduceException) {
                e.code
            }
            assertEquals(testCase.strOrNull("expectedError"), error, name)
            assertEquals(docs(testCase.getValue("expectedResults")), results, name)
            if (keyDocumentMap != null) {
                assertEquals(docs(testCase.getValue("expectedKeyDocumentMap")), keyDocumentMap.values.sortedBy { it.id }, name)
            }
        }
    }

    @Test
    fun resultWindowBuffer() {
        for (element in load("cases.json").getValue("resultWindowBuffer").jsonArray) {
            val scenario = element.jsonObject
            val name = scenario.str("name")
            val buffer = createResultWindowBuffer(
                queryParams(scenario.getValue("query")),
                bufferSize(scenario.getValue("limitBufferSize")),
                bufferSize(scenario.getValue("skipBufferSize")),
            )
            scenario.getValue("steps").jsonArray.forEachIndexed { index, stepElement ->
                val step = stepElement.jsonObject
                val op = step.str("op")
                val context = "$name: step #$index $op"
                when (op) {
                    "query" -> {
                        val query = getResultWindowBufferQuery(buffer)
                        val actual = buildJsonObject {
                            put("skip", query.skip)
                            put("limit", query.limit)
                        }
                        assertEquals(step.getValue("expected"), actual, context)
                    }
                    "reset" -> resetResultWindowBuffer(buffer, docs(step.getValue("rows")))
                    "results" -> try {
                        val results = ids(getResultWindowBufferResults(buffer))
                        assertEquals(step["expected"], results, context)
                    } catch (e: EventReduceException) {
                        assertEquals(step.strOrNull("expectedError"), e.code, context)
                    }
                    "applyChangeEvent" -> {
                        val result = applyChangeEventToResultWindowBuffer(buffer, changeEvent(step.getValue("changeEvent")))
                        assertEquals(step.str("expected"), result.jsName, context)
                    }
                    "applyChangeEvents" -> {
                        val changeEvents = step.getValue("changeEvents").jsonArray.map { changeEvent(it) }
                        val actual = when (val result = applyChangeEventsToResultWindowBuffer(buffer, changeEvents)) {
                            is ResultWindowBufferChangeResult.RunFullQueryAgain -> buildJsonObject {
                                put("runFullQueryAgain", true)
                            }
                            is ResultWindowBufferChangeResult.Results -> buildJsonObject {
                                put("runFullQueryAgain", false)
                                put("changed", result.changed)
                                put("results", ids(result.results))
                            }
                        }
                        assertEquals(step.getValue("expected"), actual, context)
                    }
                    "inspect" -> {
                        val actual = buildJsonObject {
                            put("buffer", ids(buffer.buffer))
                            put("offset", buffer.offset)
                            put("complete", buffer.complete)
                        }
                        assertEquals(step.getValue("expected"), actual, context)
                    }
                    else -> fail("$context: unknown op")
                }
            }
        }
    }

    @Test
    fun recommendedResultWindowBufferSize() {
        for (pair in load("cases.json").getValue("recommendedResultWindowBufferSize").jsonArray) {
            val limit = pair.jsonArray[0].jsonPrimitive.intOrNull
            assertEquals(pair.jsonArray[1].jsonPrimitive.int, getRecommendedResultWindowBufferSize(limit), "limit $limit")
        }
    }
}
