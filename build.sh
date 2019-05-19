set -o allexport
source .env
set +o allexport
echo $MNEMONIC
#exit on any command failure
set -e
CHANGES=`git status --porcelain --untracked-files=no -s`
if [[ $CHANGES ]]
then 
    echo "Error git not clean";
    exit -1;
fi
if [[ -z $MNEMONIC_STAGING || -z $INFURA_API ]]
then
    echo "Error MNEMONIC missing no env?";
    exit -1;
fi
if [[  $1 == 'deploy' ]]
then 
    export MNEMONIC = $MNEMONIC_STAGING
    echo "deploying to fuse"
    export NETWORK='fuse'
    # npm run migrate_reset:ganache
    echo "deploying to kovan"
    export NETWORK='kovan'
    npm run migrate_reset:ganache
    read -p "deploy to production? " prompt
    if [[ $MNEMONIC_PROD && $prompt =~ [yY](es)* ]]
    then
        export MNEMONIC = $MNEMONIC_PROD
        export NETWORK='fuse'
        npm run migrate_reset:ganache
    fi

        
    
fi
read -p "Are you sure you want to continue? <y/N> " prompt
if [[ $prompt =~ [yY](es)* ]]
then
    git add build/contracts/*
    git commit -a -m "add: version release"
    npm version patch
    git push --follow-tags
    npm pack
    npm publish
fi