package eventreduce_test

// Runs the test suite that all implementations share, see ../test-suite/README.md.

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"sort"
	"strings"
	"testing"

	eventreduce "github.com/pubkey/event-reduce/go"
)

type doc struct {
	ID   string `json:"id"`
	Age  int    `json:"age"`
	Name string `json:"name,omitempty"`
}

type query struct {
	MinAge int  `json:"minAge"`
	Skip   *int `json:"skip"`
	Limit  *int `json:"limit"`
	Desc   bool `json:"desc"`
}

type changeEvent struct {
	Operation string `json:"operation"`
	ID        string `json:"id"`
	Doc       *doc   `json:"doc"`
	Previous  *doc   `json:"previous"`
}

type stateSets struct {
	PackedBdd []int `json:"packedBdd"`
	Cases     []struct {
		Query           query       `json:"query"`
		PreviousResults []doc       `json:"previousResults"`
		ChangeEvent     changeEvent `json:"changeEvent"`
		StateSet        string      `json:"stateSet"`
		Action          string      `json:"action"`
	} `json:"cases"`
}

type step struct {
	Op            string          `json:"op"`
	Expected      json.RawMessage `json:"expected"`
	ExpectedError string          `json:"expectedError"`
	Rows          []doc           `json:"rows"`
	ChangeEvent   changeEvent     `json:"changeEvent"`
	ChangeEvents  []changeEvent   `json:"changeEvents"`
}

type cases struct {
	Actions []struct {
		Name                   string      `json:"name"`
		Query                  query       `json:"query"`
		PreviousResults        []doc       `json:"previousResults"`
		UseKeyDocumentMap      bool        `json:"useKeyDocumentMap"`
		ChangeEvent            changeEvent `json:"changeEvent"`
		Action                 string      `json:"action"`
		ExpectedAction         string      `json:"expectedAction"`
		ExpectedError          string      `json:"expectedError"`
		ExpectedResults        []doc       `json:"expectedResults"`
		ExpectedKeyDocumentMap []doc       `json:"expectedKeyDocumentMap"`
	} `json:"actions"`
	ResultWindowBuffer []struct {
		Name            string          `json:"name"`
		Query           query           `json:"query"`
		LimitBufferSize json.RawMessage `json:"limitBufferSize"`
		SkipBufferSize  json.RawMessage `json:"skipBufferSize"`
		Steps           []step          `json:"steps"`
	} `json:"resultWindowBuffer"`
	RecommendedResultWindowBufferSize [][2]*int `json:"recommendedResultWindowBufferSize"`
}

func readJSON(t *testing.T, file string, value any) {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "test-suite", file))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, value); err != nil {
		t.Fatal(err)
	}
}

func queryParams(q query) eventreduce.QueryParams[doc] {
	direction := 1
	if q.Desc {
		direction = -1
	}
	return eventreduce.QueryParams[doc]{
		GetDocumentID: func(d doc) string { return d.ID },
		Skip:          q.Skip,
		Limit:         q.Limit,
		QueryMatcher:  func(d doc) bool { return d.Age > q.MinAge },
		SortComparator: func(a, b doc) int {
			if a.Age != b.Age {
				if a.Age < b.Age {
					return -direction
				}
				return direction
			}
			if a.ID < b.ID {
				return -direction
			}
			return direction
		},
		SortFieldsChanged: func(previous, d doc) bool { return previous.Age != d.Age },
	}
}

func toChangeEvent(e changeEvent) eventreduce.ChangeEvent[doc] {
	switch e.Operation {
	case "INSERT":
		return eventreduce.InsertEvent(e.ID, *e.Doc)
	case "UPDATE":
		return eventreduce.UpdateEvent(e.ID, *e.Doc, *e.Previous)
	}
	return eventreduce.DeleteEvent(e.ID, *e.Previous)
}

func ids(docs []doc) []string {
	result := []string{}
	for _, d := range docs {
		result = append(result, d.ID)
	}
	return result
}

func errorCode(err error) string {
	if err == nil {
		return ""
	}
	return strings.TrimPrefix(err.Error(), "EventReduce:")
}

func actionByName(t *testing.T, name string) eventreduce.ActionName {
	t.Helper()
	for _, action := range eventreduce.OrderedActionList {
		if action.String() == name {
			return action
		}
	}
	t.Fatalf("unknown action %s", name)
	return 0
}

func bufferSize(t *testing.T, raw json.RawMessage) int {
	t.Helper()
	if string(raw) == `"all"` {
		return eventreduce.ResultWindowBufferAllRows
	}
	var size int
	if err := json.Unmarshal(raw, &size); err != nil {
		t.Fatal(err)
	}
	return size
}

func expectJSON(t *testing.T, context string, actual any, expected json.RawMessage) {
	t.Helper()
	var want, got any
	if err := json.Unmarshal(expected, &want); err != nil {
		t.Fatal(err)
	}
	data, _ := json.Marshal(actual)
	_ = json.Unmarshal(data, &got)
	if !reflect.DeepEqual(got, want) {
		t.Errorf("%s: got %s, want %s", context, data, expected)
	}
}

func TestStateSets(t *testing.T) {
	var suite stateSets
	readJSON(t, "state-sets.json", &suite)
	if !slices.Equal(suite.PackedBdd, eventreduce.PackedBdd) {
		t.Fatal("bdd_generated.go is out of sync with the JavaScript BDD")
	}
	for index, c := range suite.Cases {
		input := &eventreduce.StateResolveFunctionInput[doc]{
			QueryParams:     queryParams(c.Query),
			ChangeEvent:     toChangeEvent(c.ChangeEvent),
			PreviousResults: c.PreviousResults,
		}
		if got := eventreduce.GetStateSet(input); got != c.StateSet {
			t.Errorf("state set of case #%d: got %s, want %s", index, got, c.StateSet)
		}
		if got := eventreduce.CalculateActionName(input).String(); got != c.Action {
			t.Errorf("action of case #%d: got %s, want %s", index, got, c.Action)
		}
	}
}

func TestActions(t *testing.T) {
	var suite cases
	readJSON(t, "cases.json", &suite)
	for _, c := range suite.Actions {
		t.Run(c.Name, func(t *testing.T) {
			queryParams := queryParams(c.Query)
			changeEvent := toChangeEvent(c.ChangeEvent)
			results := append([]doc{}, c.PreviousResults...)
			var keyDocumentMap map[string]doc
			if c.UseKeyDocumentMap {
				keyDocumentMap = map[string]doc{}
				for _, d := range results {
					keyDocumentMap[d.ID] = d
				}
			}
			var action eventreduce.ActionName
			if c.Action != "" {
				action = actionByName(t, c.Action)
			} else {
				action = eventreduce.CalculateActionName(&eventreduce.StateResolveFunctionInput[doc]{
					QueryParams: queryParams, ChangeEvent: changeEvent, PreviousResults: results, KeyDocumentMap: keyDocumentMap,
				})
				if action.String() != c.ExpectedAction {
					t.Fatalf("action: got %s, want %s", action, c.ExpectedAction)
				}
			}
			newResults, err := eventreduce.RunAction(action, queryParams, changeEvent, results, keyDocumentMap)
			if errorCode(err) != c.ExpectedError {
				t.Fatalf("error: got %q, want %q", errorCode(err), c.ExpectedError)
			}
			if !reflect.DeepEqual(append([]doc{}, newResults...), c.ExpectedResults) {
				t.Errorf("results: got %v, want %v", newResults, c.ExpectedResults)
			}
			if c.UseKeyDocumentMap {
				docs := []doc{}
				for _, d := range keyDocumentMap {
					docs = append(docs, d)
				}
				sort.Slice(docs, func(i, j int) bool { return docs[i].ID < docs[j].ID })
				if !reflect.DeepEqual(docs, c.ExpectedKeyDocumentMap) {
					t.Errorf("key document map: got %v, want %v", docs, c.ExpectedKeyDocumentMap)
				}
			}
		})
	}
}

func TestResultWindowBuffer(t *testing.T) {
	var suite cases
	readJSON(t, "cases.json", &suite)
	for _, scenario := range suite.ResultWindowBuffer {
		t.Run(scenario.Name, func(t *testing.T) {
			buffer, err := eventreduce.NewResultWindowBuffer(
				queryParams(scenario.Query), bufferSize(t, scenario.LimitBufferSize), bufferSize(t, scenario.SkipBufferSize),
			)
			if err != nil {
				t.Fatal(err)
			}
			for index, s := range scenario.Steps {
				context := fmt.Sprintf("step #%d %s", index, s.Op)
				switch s.Op {
				case "query":
					query := buffer.Query()
					expectJSON(t, context, map[string]any{"skip": query.Skip, "limit": query.Limit}, s.Expected)
				case "reset":
					buffer.Reset(s.Rows)
				case "results":
					results, err := buffer.Results()
					if errorCode(err) != s.ExpectedError {
						t.Errorf("%s: error got %q, want %q", context, errorCode(err), s.ExpectedError)
					}
					if err == nil {
						expectJSON(t, context, ids(results), s.Expected)
					}
				case "applyChangeEvent":
					expectJSON(t, context, buffer.ApplyChangeEvent(toChangeEvent(s.ChangeEvent)), s.Expected)
				case "applyChangeEvents":
					changeEvents := []eventreduce.ChangeEvent[doc]{}
					for _, e := range s.ChangeEvents {
						changeEvents = append(changeEvents, toChangeEvent(e))
					}
					result := buffer.ApplyChangeEvents(changeEvents)
					if result.RunFullQueryAgain {
						expectJSON(t, context, map[string]any{"runFullQueryAgain": true}, s.Expected)
					} else {
						expectJSON(t, context, map[string]any{
							"runFullQueryAgain": false, "changed": result.Changed, "results": ids(result.Results),
						}, s.Expected)
					}
				case "inspect":
					expectJSON(t, context, map[string]any{
						"buffer": ids(buffer.Buffer), "offset": buffer.Offset, "complete": buffer.Complete,
					}, s.Expected)
				default:
					t.Fatalf("%s: unknown op", context)
				}
			}
		})
	}
}

func TestRecommendedResultWindowBufferSize(t *testing.T) {
	var suite cases
	readJSON(t, "cases.json", &suite)
	for _, pair := range suite.RecommendedResultWindowBufferSize {
		if got := eventreduce.GetRecommendedResultWindowBufferSize(pair[0]); got != *pair[1] {
			t.Errorf("limit %v: got %d, want %d", pair[0], got, *pair[1])
		}
	}
}
