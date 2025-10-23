#!/usr/bin/env bash
set -euo pipefail

git fetch --all --prune

DEFAULT_REF="origin/main"
DATE="$(date +%Y%m%d-%H%M%S)"

while read -r ref; do
  [ -z "$ref" ] && continue
  # Remote branch like origin/codex/...
  branch="${ref#origin/}"
  # If the remote branch tip is contained in main, archive and delete
  if git merge-base --is-ancestor "$ref" "$DEFAULT_REF"; then
    sha=$(git rev-parse "$ref")
    tag="archive/${branch}/${DATE}"
    echo "Archiving $branch at $sha -> tag $tag"
    git tag -f "$tag" "$sha"
    git push origin "refs/tags/$tag"
    echo "Deleting remote branch $branch"
    git push origin ":refs/heads/$branch" || true
  else
    echo "Skipping $branch (not fully merged into main)"
  fi
done < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin/codex/*)

echo "Cleanup finished."

