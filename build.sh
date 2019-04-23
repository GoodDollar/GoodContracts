[[ -z $(git status -s) ]] || (echo "Error git not clean" && exit 1)
source .env
if [  $1 == 'deploy' ]; then 
    export NETWORK='fuse'
    npm run migrate_reset:ganache
    export NETWORK='kovan'
    npm run migrate_reset:ganache
fi
./minimize.sh build/contracts
git add build/contracts/*
git commit -a -m "add: version release"
npm version patch
git push --follow-tags
npm pack
npm publish