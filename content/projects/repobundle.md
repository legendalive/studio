RepoBundle turns a zipped repository into a single file an AI model can read, without altering a line of source. The archive is extracted in the browser, every file is catalogued, a directory tree is generated, and the output is bundled verbatim by extension. Nothing is uploaded.

## What comes out

| Artefact | Contents |
| :-- | :-- |
| `CODEBASE.md` | The whole repository as one Markdown file: overview, directory tree, then every text file in a language-tagged code fence. |
| `CODEBASE.txt` | The same content as plain text, for tools that prefer it. |
| `FILE_TREE.md` | Archive summary, bundle inventory, ASCII tree, and a per-file table of paths, sizes and line counts. |
| `bundle_<ext>.<ext>` | One verbatim bundle per extension, with language-aware comment headers naming each original path. |
| `binaries_<ext>.manifest.txt` | A manifest for binary files of that extension. The bytes themselves are preserved under `binary_<ext>/` in the output ZIP. |

The downloadable ZIP carries all of the above together, so a single action produces the context file, the tree report and the per-extension bundles at once.

## The pipeline

1. **Extract.** JSZip opens the archive in memory. Each entry is read as bytes, classified as text or binary, and counted.
2. **Catalogue.** Files are grouped by extension. Line counts are computed by scanning newline bytes, without allocating a string per file.
3. **Tree.** A nested hierarchy is built, sorted directories-first then alphabetically, and rendered as an ASCII tree plus the `FILE_TREE.md` report.
4. **Unified context.** `CODEBASE.md` and `CODEBASE.txt` are assembled chunk by chunk: a header with totals and the tree, then one section per file in path order.
5. **Extension bundles.** Each group is concatenated verbatim with a comment header per file, named `bundle_<ext>.<ext>`.
6. **Package.** Everything is written into a deflated output ZIP, with binaries stored as bytes rather than pasted into text.

## Verbatim, not reformatted

The guarantee is narrow and literal: source bytes are decoded and concatenated, never parsed, transpiled or rewritten. Two details keep that promise intact when the output is Markdown.

First, the fence around each file is chosen so it cannot collide with backticks inside the code. The renderer starts with three backticks and keeps adding one until the sequence no longer appears in the file body.

Second, the per-extension bundles separate files with comment headers written in the right syntax for the language family:

```text
// === File [1/12]: src/utils/zipBundler.ts ===
