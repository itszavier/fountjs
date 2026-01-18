import { Parser } from "./src/parser";

import fs from "fs";

const file = fs.readFileSync("sample2.fountain", "utf8");
const data = Parser(file);
console.dir(JSON.stringify(data), { depth: null, colors: true });
