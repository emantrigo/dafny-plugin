export const prePostConditionsPrompt = `
Analyze the following Dafny code. Add appropriate preconditions (requires clauses) and 
postconditions (ensures clauses) to methods and functions. Do not change the original code structure or functionality.
Only add pre/post conditions and fix any related errors.

CRITICAL INSTRUCTIONS:
1. ⚠️ NEVER ADD NULL CHECKS ("requires x != null") for ANY parameters
   • In Dafny, reference types like array<T>, seq<T>, set<T>, map<K,V> are NON-NULLABLE by default
   • Adding "requires a != null" for arrays, sequences, sets, or maps is INCORRECT and redundant

2. NON-NULLABLE types in Dafny (NEVER add null checks for these):
   • array<T> - arrays are never null
   • seq<T> - sequences are never null
   • set<T> - sets are never null
   • map<K,V> - maps are never null
   • All value types (int, bool, etc.) are never null

3. Simple rule: Only add "requires x != null" if the type has an explicit ? symbol (like Class? or array?<int>)

EXAMPLES:
✓ CORRECT (for method with array):
method ProcessArray(a: array<int>) returns (sum: int)
requires a.Length > 0
ensures sum > 0

✗ INCORRECT (DO NOT do this):
method ProcessArray(a: array<int>) returns (sum: int)
requires a != null  // WRONG! Arrays cannot be null in Dafny!
requires a.Length > 0
ensures sum > 0

Return only the resulting Dafny code without any explanations.`;
