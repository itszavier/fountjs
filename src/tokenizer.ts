import { sceneTags } from "./rules";

type TokenType =
  | "dialogue"
  | "action"
  | "scene"
  | "character"
  | "parenthetical"
  | "transition";

export type ParseErrorType =
  | "UnclosedParenthetical"
  | "InvalidCharacterName"
  | "InvalidSceneHeading"
  | "UnexpectedToken";

export interface ParseError {
  type: ParseErrorType; // What kind of parsing error it is
  line: number; // Line number in the original script
  message: string; // Human-readable description
  context?: string; // Optional snippet of text that caused the error
}

export interface Token {
  type: TokenType;
  value: string;
  forced?: boolean;
  centered?: boolean;
}

function startWithAny(line: string, prefixes: string[]) {
  return prefixes.some((prefix) => line.startsWith(prefix));
}

const isScene = (
  line: string,
  prev: string | undefined,
  next: string | undefined,
) => {
  const prevEmpty = !prev || prev.trim() === "";
  const nextEmpty = !next || next.trim() === "";
  const hasSceneTag = startWithAny(line, sceneTags);

  return hasSceneTag && prevEmpty && nextEmpty;
};
export interface CharacterParseResult {
  name: string;
  extensions: string[];
  isDual: boolean;
}

const parseCharacter = (line: string): CharacterParseResult | null => {
  if (!line) return null;

  let text = line.trim();
  const isDual = text.endsWith("^");
  if (isDual) text = text.slice(0, -1).trim();

  // Extract all parentheticals at the end
  const extensions: string[] = [];
  const parentheticalRegex = /\(([A-Z.\s]+)\)$/; // matches e.g., (V.O.) or (ON SCREEN)

  let match: RegExpExecArray | null;

  while ((match = parentheticalRegex.exec(text)) !== null) {
    const extension = match[1]!.replace(/\s+/g, " ").trim();
    if (extension) extensions.unshift(extension);

    text = text.slice(0, match.index).trim();
  }
  // Remaining text is the name
  const name = text;
  if (!name || name !== name.toUpperCase()) return null;

  return { name, extensions, isDual };
};

const isParenthetical = (line: string, prev: string | undefined) => {
  if (!prev) return false;

  const prevTrim = prev.trim();
  return (
    prevTrim === prevTrim?.toUpperCase() &&
    line.startsWith("(") &&
    line.endsWith(")")
  );
};

const isDialogue = (
  line: string,
  prev: string | undefined,
  next: string | undefined,
) => {
  if (!line || line.trim() === "") return false;
  if (!prev) return false;

  const prevTrim = prev.trim();

  return (
    prevTrim === prevTrim?.toUpperCase() ||
    (prev?.startsWith("(") && prev?.endsWith(")"))
  );
};

const isTransition = (
  line: string,
  prev: string | undefined,
  next: string | undefined,
) => {
  const prevEmpty = !prev || prev.trim() === "";
  const nextEmpty = !next || next.trim() === "";

  return (
    line === line.toUpperCase() &&
    (line.endsWith(":") || line.endsWith(".")) &&
    prevEmpty &&
    nextEmpty
  );
};

function isCentered(line: string) {
  const lineTrim = line.trim();
  return lineTrim.startsWith(">") && lineTrim.endsWith("<");
}

function isCredit(line: string) {
  const creditKeys = ["Title:", "Credit:", "Author:", "Draft Date:", "Source:"];
  return creditKeys.some((key) => line.startsWith(key));
}

function Tokenize(fountainText: string) {
  const lines = fountainText.split("\n");
  const tokens: any[] = [];
  const errors: ParseError[] = [];
  const metadata: Record<string, string | null> = {};

  // Keeps track of the previous token type
  let prevTokenType: TokenType | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const prev = lines[i - 1];
    const next = lines[i + 1];

    if (!line) continue;

    if (isCredit(line)) {
      const key = line.split(":")[0]?.trim();
      const value = line?.split(":")[1]?.trim();
      if (key) metadata[key] = value || null;
      continue;
    }

    if (line.trim().length === 0) {
      prevTokenType = null;
    }

    if (line.trim().startsWith("!")) {
      // remove the !
      const forcedToken: Token = {
        type: "action",
        value: line.slice(1).trim(),
        forced: true,
      };
      tokens.push(forcedToken);
      prevTokenType = "action";
      continue; // skip normal detection
    }

    if (line.trim().startsWith(">") && !isCentered(line)) {
      const forcedToken: Token = {
        type: "transition",
        value: line.slice(1).trim(),
        forced: true,
      };
      tokens.push(forcedToken);
      continue;
    }

    // Note to self. Remember to parse charactor fully here.
    if (line.startsWith("@")) {
      const forcedToken: Token = {
        type: "character",
        value: line.slice(1).trim(),
        forced: true,
      };
      tokens.push(forcedToken);
      prevTokenType = "character";
      continue;
    }

    if (line.trim().startsWith(".")) {
      const forcedToken: Token = {
        type: "scene",
        value: line.slice(1).trim(),
        forced: true,
      };

      tokens.push(forcedToken);
      prevTokenType = "scene";
      continue;
    }

    if (isScene(line, prev, next)) {
      const token = {
        type: "scene",
        value: line,
      };
      tokens.push(token);
      continue;
    }

    if (isTransition(line, prev, next)) {
      const token = {
        type: "transition",
        value: line,
      };
      tokens.push(token);
      continue;
    }

    const character = parseCharacter(line);

    if (character && (!prev || prev.trim() === "")) {
      const token = {
        type: "character",
        value: character?.name,
        extensions: character?.extensions || [],
        isDual: character?.isDual,
      };
      prevTokenType = "character";
      tokens.push(token);
      continue;
    }

    const prevIsCharacterOrDialogue =
      prevTokenType === "character" || prevTokenType === "dialogue";

    if (line.trim().startsWith("(") && prevIsCharacterOrDialogue) {
      // Case 1: Single unclosed parenthetical followed by empty line -> treat as dialogue
      if (!line.endsWith(")") && (!next || next.trim() === "")) {
        tokens.push({
          type: "dialogue",
          value: line.slice(1).trim(), // remove opening '('
        });
        prevTokenType = "dialogue";
        continue;
      }

      // Case 2: Single-line parenthetical
      if (line.endsWith(")")) {
        const token = {
          type: "parenthetical",
          value: line.slice(1, -1),
        };
        tokens.push(token);
        prevTokenType = "parenthetical";
        continue;
      }

      // Case 3: Multi-line parenthetical
      let buffer = line;
      const MAX_LINE: number = 3;
      let usedlines: number = 0;
      let j: number = i + 1;

      let closed: boolean = false;

      while (j < lines.length && usedlines < MAX_LINE) {
        const l = lines[j];

        if (!l || l.trim() === "") break;
        buffer += " " + l.trim();

        usedlines++;
        if (l.trim().endsWith(")")) {
          const token = {
            type: "parenthetical",
            value: buffer.trim().slice(1, -1).trim(),
          };
          tokens.push(token);
          prevTokenType = "parenthetical";
          closed = true;
          i = j; // advance the cursor to the next line
          break;
        }
        j++;
      }

      if (!closed) {
        errors.push({
          type: "UnclosedParenthetical",
          line: i,
          message: "Parenthetical was not closed within 3 lines.",
          context: buffer,
        });

        tokens.push({
          type: "parenthetical",
          value: buffer.trim(),
        });

        continue;
      }
      continue;
    }
    const prevIsCharacterOrParenthetical =
      prevTokenType === "character" || prevTokenType === "parenthetical";
    if (line.trim().length > 0 && prevIsCharacterOrParenthetical) {
      const token = {
        type: "dialogue",
        value: line.trim(),
      };
      tokens.push(token);
      prevTokenType = "dialogue";
      continue;
    }

    if (isCentered(line)) {
      const token = {
        type: "action",
        value: line.replaceAll(/^[>]+|[<]+$/g, "").trim(),
        centered: true,
      };
      tokens.push(token);
      prevTokenType = "action";
      continue;
    }

    if (line.trim().length > 0) {
      const token = {
        type: "action",
        value: line,
      };
      tokens.push(token);
      prevTokenType = "action";
      continue;
    }
  }

  return { metadata, tokens, errors };
}

export { Tokenize };
