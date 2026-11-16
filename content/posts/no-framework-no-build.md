Weaver is 16,414 lines of JavaScript across 72 files and 20 directories, about 675 KB uncompressed. It has no package.json, no node_modules, no bundler and no build step. The repository is the running application: GitHub Pages serves the same files the browser executes. This is what that choice buys, what it costs, and the four rules that keep it maintainable.

## What "no build step" actually means

There is no compilation between writing a line and seeing it run. Every module is a native ES module, every import carries its `.js` extension, and the browser resolves the graph itself. The deploy workflow does not build anything: it uploads the repository tree as the Pages artifact. A commit is live roughly thirty seconds after the green tick.

Two consequences follow, and both matter more than the purity of the setup.

The first is that publishing is a browser activity. Files are written in GitHub's web editor and deployed by Actions. No terminal, no local server, no install step standing between an idea and a shipped change. The second is that the artifact is legible. Anyone can open the repository and read exactly what runs, without reconstructing it from a source map.

:::note
This is a constraint chosen for a specific product, not a rule imposed on everything. RepoBundle, the studio's other shipped tool, is built with React, TypeScript and Vite. The reasoning for that split is at the end of this piece.
:::

## Rule one: a single DOM helper, never innerHTML for content

Every node in the application is built through one function with the shape `el(tag, props, children)`. Children are strings, nodes, or arrays of either. Nothing assigns `innerHTML` with content that came from a user, a file, or a model.

```js
const row = el('div', { class: 'row' }, [
  el('span', { class: 'label' }, [project.name]),
  el('button', { type: 'button', onClick: () => open(project.id) }, ['Open']),
]);
