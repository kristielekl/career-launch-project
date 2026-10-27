# Services

Place CareerLaunch application logic here, grouped by feature (for example,
`timeline.js`). Services validate input, enforce ownership and task state rules,
and calculate results such as dashboard summaries.

Routes call services; services call `../repositories/` for stored data. Keep services
independent of Express request/response objects and direct SQL so their rules can
be tested independently. Return results or errors for routes to translate into HTTP
responses.
