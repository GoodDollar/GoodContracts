[[ -z $(git status -s) ]] || echo "Error git not clean" && exit 1
export NETWORK='fuse'
npm run migarate_reset:ganache
export NETWORK='kovan'
npm run migarate_reset:ganache
./minimize.sh
git add build/contracts/*
git commit -a -m "add: version release"
npm version patch
git push --follow-tags
npm pack
npm publish