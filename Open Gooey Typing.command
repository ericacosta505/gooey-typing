#!/bin/zsh
cd -- "${0:A:h}/app" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if curl --silent --fail http://127.0.0.1:4173/ >/dev/null; then
  open http://127.0.0.1:4173/
else
  (sleep 1; open http://127.0.0.1:4173/) &
  node server.mjs
fi
