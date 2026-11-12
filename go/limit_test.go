package eventreduce_test

import (
	"errors"
	"testing"

	eventreduce "github.com/pubkey/event-reduce/go/v7"
)

func limitQueryParams(limit int) eventreduce.QueryParams[doc] {
	return eventreduce.QueryParams[doc]{
		GetDocumentID: func(d doc) string { return d.ID },
		Limit:         eventreduce.Int(limit),
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

// Like in SQL, a query with limit 0 returns no documents, so nothing can change its results.
func TestLimitZeroIsAlwaysDoNothing(t *testing.T) {
	a := doc{ID: "a", Age: 1}
	events := []eventreduce.ChangeEvent[doc]{
		eventreduce.InsertEvent("a", a),
		eventreduce.UpdateEvent("a", doc{ID: "a", Age: 2}, a),
		eventreduce.DeleteEvent("a", a),
	}
	for _, event := range events {
		action := eventreduce.CalculateActionName(&eventreduce.StateResolveFunctionInput[doc]{
			QueryParams: limitQueryParams(0), ChangeEvent: event, PreviousResults: []doc{},
		})
		if action != eventreduce.DoNothing {
			t.Errorf("%v: got %v, want doNothing", event.Operation, action)
		}
	}
}

func TestNegativeLimit(t *testing.T) {
	if _, err := eventreduce.NewResultWindowBuffer(limitQueryParams(-1), 0, 0); !errors.Is(err, eventreduce.ErrNegativeLimit) {
		t.Errorf("NewResultWindowBuffer: got %v, want ErrNegativeLimit", err)
	}
	if _, err := eventreduce.NewResultWindowBuffer(limitQueryParams(0), 0, 0); err != nil {
		t.Errorf("NewResultWindowBuffer with limit 0: got %v", err)
	}

	defer func() {
		if recovered := recover(); recovered != eventreduce.ErrNegativeLimit {
			t.Errorf("CalculateActionName: recovered %v, want ErrNegativeLimit", recovered)
		}
	}()
	eventreduce.CalculateActionName(&eventreduce.StateResolveFunctionInput[doc]{
		QueryParams: limitQueryParams(-1), ChangeEvent: eventreduce.InsertEvent("a", doc{ID: "a"}), PreviousResults: []doc{},
	})
	t.Error("CalculateActionName did not panic")
}
