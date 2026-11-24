/**
 * Limits of what the agent sends (HU-137). A page above them gets 413 and
 * nothing of it is saved. Its body also has the JSON limit of the whole API,
 * 100 kB (the body parser of Express), which answers 413 too.
 */

// Results of Everything in one page, folders and files. The agent asks for
// 200 per page: about 300 bytes each, so they fit in 100 kB
export const MAX_RESULTS_PER_PAGE = 500;

// Pages of one run, numbered from 1
export const MAX_PAGES_PER_RUN = 10_000;
