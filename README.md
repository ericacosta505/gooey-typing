# Gooey Typing

An interactive pastel jelly keyboard and typing playground. Type a passage, stretch the soft 3D keys, and see your speed and accuracy.

![Gooey Typing preview](Gooey%20Typing%20Preview.jpg)

[Watch the animated preview](Gooey%20in%20Motion.gif)

## Run locally

Install Node.js, then run:

```sh
cd app
npm start
```

Open http://127.0.0.1:4173 in your browser. On macOS, you can also double-click **Open Gooey Typing.command** after installing Node.js.

No dependency installation, build step, account, or API key is needed. Application source is in `app/dist/`; the local server is `app/server.mjs`. Three.js is vendored with its license in `app/dist/vendor/`.

## Check the code

From the `app` directory:

```sh
npm test
npm run check
```

See [the application README](app/README.md) for controls, rendering details, scoring behavior, and the source map.
