import { Tokenize, type Token } from "./tokenizer";

// Action token
export interface Action {
  type: "action";
  value: string;
}

// Dialogue token
export interface Dialogue {
  type: "dialogue";
  character: string;
  parenthetical: string | null;
  value: string;
}

// Transition token
export interface Transition {
  type: "transition";
  value: string;
}

// Anything that can be inside a scene
export type SceneContent = Action | Dialogue | Transition;

// A scene block
export interface SceneBlock {
  type: "scene";
  value: string; // Scene header
  content: SceneContent[];
}

// Top-level parsed structure
export interface ParsedScreenplay {
  metadata: Record<string, string | null>;
  data: (SceneBlock | SceneContent)[];
}

export function Parser(fountainText: string): ParsedScreenplay {
  const { metadata, tokens } = Tokenize(fountainText);

  const data: (SceneBlock | SceneContent)[] = [];
  let currentScene: SceneBlock | null = null;

  let lastCharacter: string | null = null;
  let lastParenthetical: string | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token: Token = tokens[i];

    // Start a new scene
    if (token.type === "scene") {
      currentScene = { type: "scene", value: token.value, content: [] };
      data.push(currentScene);
      lastCharacter = null;
      lastParenthetical = null;
      continue;
    }

    // Determine target: inside scene or top-level
    const targetArray = currentScene ? currentScene.content : data;

    switch (token.type) {
      case "action":
        targetArray.push({
          type: "action",
          value: token.value,
        });
        break;

      case "transition":
        targetArray.push({
          type: "transition",
          value: token.value,
        });
        break;

      case "character":
        lastCharacter = token.value;
        lastParenthetical = null;
        break;

      case "parenthesis":
        lastParenthetical = token.value;
        break;

      case "dialogue":
        targetArray.push({
          type: "dialogue",
          character: lastCharacter || "",
          parenthetical: lastParenthetical,
          value: token.value,
        });
        lastParenthetical = null;
        break;
    }
  }

  return { metadata, data };
}
