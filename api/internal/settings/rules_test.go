package settings

import (
	"encoding/json"
	"reflect"
	"testing"
)

// Every field that Load reads must have a rule, or the admin could not edit it.
func TestEverySettingHasARule(t *testing.T) {
	n := reflect.TypeOf(Settings{}).NumField()
	if len(Rules) != n {
		t.Fatalf("%d rules for %d settings: add the new setting to Rules", len(Rules), n)
	}
	seen := map[string]bool{}
	for _, r := range Rules {
		if seen[r.Key] {
			t.Fatalf("%s twice", r.Key)
		}
		seen[r.Key] = true
	}
}

func TestRuleCheck(t *testing.T) {
	cod, _ := RuleFor("cod_confirm_hours")
	for raw, ok := range map[string]bool{`48`: true, `1`: true, `168`: true, `0`: false, `169`: false, `"48"`: false, `4.5`: false, `-1`: false} {
		_, problem := cod.Check(json.RawMessage(raw))
		if (problem == "") != ok {
			t.Errorf("cod_confirm_hours %s: problem %q", raw, problem)
		}
	}
	free, _ := RuleFor("free_delivery_enabled")
	if out, p := free.Check(json.RawMessage(`true`)); p != "" || string(out) != "true" {
		t.Errorf("bool: %s %q", out, p)
	}
	if _, p := free.Check(json.RawMessage(`"yes"`)); p == "" {
		t.Error("bool accepted a text")
	}
	hero, _ := RuleFor("home_hero_product_slug")
	if out, p := hero.Check(json.RawMessage(`"  dragon  "`)); p != "" || string(out) != `"dragon"` {
		t.Errorf("text: %s %q", out, p)
	}
}
