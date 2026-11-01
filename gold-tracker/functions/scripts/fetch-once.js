// Quick local check that the SJC feed still parses: `npm run fetch:once`
import { fetchSjc } from '../src/fetch.js';
console.log(JSON.stringify(await fetchSjc(), null, 2));
