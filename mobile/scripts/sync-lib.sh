#!/bin/bash
# Sync shared libs web -> mobile. Mobile copies are byte-identical EXCEPT
# relative imports must end in .ts (Node strip-types test runner needs
# explicit extensions; Metro/Next resolve both).
set -e
cd "$(dirname "$0")/../.."
for f in pitch matching songs contour history exercises youtube popular miccheck wav voiceAnalysis paywall; do
  if [ -f "lib/$f.ts" ]; then
    cp "lib/$f.ts" "mobile/src/lib/$f.ts"
  fi
done
# Fix up relative cross-imports to explicit .ts extensions
perl -pi -e 's#from "\./(pitch|songs|matching|contour|history|exercises|youtube|popular|miccheck|wav|voiceAnalysis|paywall)"#from "./$1.ts"#g' mobile/src/lib/*.ts
echo "synced:"
git status --short mobile/src/lib/ | head -15
