import { runHeadlessClient } from "../../../dist/headless-client.js";

console.log(JSON.stringify(await runHeadlessClient(), null, 2));
