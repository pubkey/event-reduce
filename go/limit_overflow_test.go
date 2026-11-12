package eventreduce_test

import (
	"math"
	"reflect"
	"testing"

	eventreduce "github.com/pubkey/event-reduce/go/v7"
)

// A limit of math.MaxInt, like when it is used for "no limit", must not overflow.
func hugeLimitQueryParams(skip *int) eventreduce.QueryParams[doc] {
	return eventreduce.QueryParams[doc]{
		GetDocumentID: func(d doc) string { return d.ID },
		Skip:          skip,
		Limit:         eventreduce.Int(math.MaxInt),
		QueryMatcher:  func(d doc) bool { return true },
		SortComparator: func(a, b doc) int {
			if a.ID < b.ID {
				return -1
			}
			return 1
		},
		SortFieldsChanged: func(previous, d doc) bool { return false },
	}
}

func TestHugeLimitWithLimitBuffer(t *testing.T) {
	buffer, err := eventreduce.NewResultWindowBuffer(hugeLimitQueryParams(nil), 1, 0)
	if err != nil {
		t.Fatal(err)
	}
	// more rows than an int can count means that all rows are needed
	if query := buffer.Query(); query.Skip != 0 || query.Limit != nil {
		t.Fatalf("query: got skip %d limit %v, want skip 0 and no limit", query.Skip, query.Limit)
	}
	buffer.Reset([]doc{{ID: "a"}})
	if !buffer.Complete {
		t.Fatal("the buffer must be complete")
	}
	results, err := buffer.Results()
	if err != nil || !reflect.DeepEqual(ids(results), []string{"a"}) {
		t.Fatalf("results: got %v %v", ids(results), err)
	}
}

func TestHugeLimitWithSkipBuffer(t *testing.T) {
	buffer, err := eventreduce.NewResultWindowBuffer(hugeLimitQueryParams(eventreduce.Int(1)), 0, 1)
	if err != nil {
		t.Fatal(err)
	}
	if query := buffer.Query(); query.Skip != 0 || query.Limit != nil {
		t.Fatalf("query: got skip %d limit %v, want skip 0 and no limit", query.Skip, query.Limit)
	}
	buffer.Reset([]doc{{ID: "a"}, {ID: "b"}})
	if result := buffer.ApplyChangeEvent(eventreduce.InsertEvent("c", doc{ID: "c"})); result != eventreduce.ResultEventReduce {
		t.Fatalf("result: got %v", result)
	}
	if !reflect.DeepEqual(ids(buffer.Buffer), []string{"a", "b", "c"}) {
		t.Fatalf("buffer: got %v", ids(buffer.Buffer))
	}
	results, err := buffer.Results()
	if err != nil || !reflect.DeepEqual(ids(results), []string{"b", "c"}) {
		t.Fatalf("results: got %v %v", ids(results), err)
	}
}
