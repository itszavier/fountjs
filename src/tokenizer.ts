export interface Token {
  type:
    | "action"
    | "scene"
    | "character"
    | "parenthesis"
    | "dialogue"
    | "transition";
  value: string;
  forced?: boolean;
  centered?: boolean;
}

const sceneTags = [
  "INT",
  "EXT",
  "EST",
  "INT./EXT",
  "INT/EXT",
  "I/E",
  "E/I",
  "E./I.",
  "I./E.",
  "INT./EXT.",
  "EXT./INT.",
];

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

const isCharacter = (
  line: string,
  prev: string | undefined,
  next: string | undefined,
) => {
  const isUpperCase = line === line.toUpperCase();
  const prevEmptyOrScene = !prev || prev.trim() === "";
  const hasNext = (next?.trim().length || 0) > 0;
  return isUpperCase && prevEmptyOrScene && hasNext && line.length < 30;
};

const isParenthesis = (
  line: string,
  prev: string | undefined,
  next: string | undefined,
) => {
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

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const prev = lines[i - 1];
    const next = lines[i + 1];

    if (!line) continue;

    if (line.trim().startsWith("!")) {
      line = line.slice(1).trim(); // remove the !
      const forcedToken: Token = {
        type: "action",
        value: line,
        forced: true,
      };
      tokens.push(forcedToken);
      continue; // skip normal detection
    }

    if (line.trim().startsWith(">") && !isCentered(line)) {
      const forcedToken: Token = {
        type: "transition",
        value: line,
        forced: true,
      };
      tokens.push(forcedToken);
      continue;
    }

    if (line.startsWith("@")) {
      const forcedToken: Token = {
        type: "character",
        value: line,
        forced: true,
      };
      tokens.push(forcedToken);
      continue;
    }

    if (line.trim().startsWith(".")) {
      const forcedToken: Token = {
        type: "scene",
        value: line,
        forced: true,
      };
      tokens.push(forcedToken);
      continue;
    }

    if (isCredit(line)) {
      const key = line.split(":")[0]?.trim();
      const value = line?.split(":")[1]?.trim();
      if (key) metadata[key] = value || null;
      continue;
    }

    if (isScene(line, prev, next)) {
      const token = {
        type: "scene",
        value: line,
      };
      tokens.push(token);
    } else if (isTransition(line, prev, next)) {
      const token = {
        type: "transition",
        value: line,
      };
      tokens.push(token);
    } else if (isCharacter(line, prev, next)) {
      const token = {
        type: "character",
        value: line,
      };
      tokens.push(token);
    } else if (isParenthesis(line, prev, next)) {
      const token = {
        type: "parenthesis",
        value: line,
      };
      tokens.push(token);
    } else if (isDialogue(line, prev, next)) {
      const token = {
        type: "dialogue",
        value: line,
      };
      tokens.push(token);
    } else if (isCentered(line)) {
      const token = {
        type: "action",
        value: line.replaceAll(/^[>]+|[<]+$/g, "").trim(),
        centered: true,
      };
      tokens.push(token);
    } else if (line.trim().length > 0) {
      const token = {
        type: "action",
        value: line,
      };
      tokens.push(token);
    }
  }

  return { metadata, tokens };
}

export { Tokenize };
