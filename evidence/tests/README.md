# Trip ownership regression evidence

These files contain actual Vitest output from the real Express/PostgreSQL
integration test. The external Clerk boundary alone is mocked.

Run sequence required by PLAN.md: establish green; deliberately remove the
owner comparison from the shared ID predicate; record red; restore the
comparison; record green. The defect is confined to synthetic development test
records, never published, and never committed as working application code.

Screenshots render the **verbatim saved runner output** in a browser for
legibility. They are not fabricated result summaries or screenshots of a
terminal application. The raw text files, exact commands, UTC times, source
hashes, and the controlled diff are retained alongside the screenshots.

- [Initial green](trip-isolation-initial-green.txt)
- [Red output](trip-isolation-red.txt) / [red screenshot](trip-isolation-red.jpg)
- [Restored green output](trip-isolation-green.txt) / [green screenshot](trip-isolation-green.jpg)
- [Controlled defect](controlled-defect.diff)
- [Final full suite: 46 passing tests](trip-crud-full-suite.txt)

The focused runs predate the final additional payload-format test: 20 trip
tests then, 21 in the final suite. The isolation test and owner predicate are
unchanged. The focused screenshots make no claim that skipped tests passed.
