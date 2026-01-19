import { Tokenize } from "./src/tokenizer";
import { Parser } from "./src/parser";
import fs from "fs";

const file = fs.readFileSync("sample2.fountain", "utf8");
//const data = Parser(file);
const data = Tokenize(file);
console.dir(data, { depth: null, colors: true });
