import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import graphql from "highlight.js/lib/languages/graphql";
import ini from "highlight.js/lib/languages/ini";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import scala from "highlight.js/lib/languages/scala";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

/**
 * rehype-highlight registers all ~190 highlight.js grammars by default, which
 * costs roughly 400 kB of bundle for languages that will never appear in a
 * post. This is the subset actually worth shipping.
 */
export const highlightLanguages = {
  bash,
  c,
  cpp,
  css,
  diff,
  dockerfile,
  graphql,
  html: xml,
  ini,
  javascript,
  json,
  markdown,
  python,
  scala,
  sql,
  typescript,
  xml,
  yaml,
};
