# Error Masking / formatApiError

## What formatApiError does

`formatApiError` (in `frontend/src/core/api/errors.ts`) converts raw errors into safe strings:

- Strips stack traces
- Maps HTTP status codes to human-readable messages
- Returns a string like "Failed to save user"

Return type is `string`, not ReactNode — never use as JSX children expecting an element.

## Symptom: Raw error shown to user

Find the offending catch block:

```bash
grep -rn "\.message" frontend/src --include="*.ts" --include="*.tsx"
```

Every catch block surfacing errors to the UI must use `classifyError` (hooks) or `formatApiError` (toasts/components).

Fix in a hook:

```typescript
// Wrong
} catch (err) { setError((err as Error).message); }

// Correct
} catch (err) { setError(classifyError(err)); }
```

Fix in a toast:

```typescript
// Wrong
toast.error(error.message);

// Correct
toast.error(formatApiError(error, "save user"));
```

## Symptom: formatApiError returns empty string

Both arguments are required: `formatApiError(error: unknown, context: string): string`.
The `context` argument is mandatory — omitting it produces an empty or undefined return.
