import { sceneTags } from "./rules";

type TokenType =
  | "dialogue"
  | "action"
  | "scene"
  | "character"
  | "parenthetical"
  | "transition";

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

    if (isParenthetical(line, prev) && prevTokenType === "character") {
      const token = {
        type: "parenthetical",
        value: line.replace(/\(|\)/g, ""),
      };
      tokens.push(token);
      prevTokenType = "parenthetical";
      continue;
    }

    const prevIsCharacterOrDialogue =
      prevTokenType === "character" || prevTokenType === "parenthetical";

    if (line.trim().length > 0 && prevIsCharacterOrDialogue) {
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

  return { metadata, tokens };
}

export { Tokenize };
